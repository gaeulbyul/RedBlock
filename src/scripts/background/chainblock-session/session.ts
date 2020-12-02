import * as Scraper from './scraper.js'
import * as TwitterAPI from '../twitter-api.js'
import { EventEmitter, SessionStatus, copyFrozenObject, sleep, getCountOfUsersToBlock } from '../../common.js'
import BlockLimiter from '../block-limiter.js'

export type SessionRequest = FollowerBlockSessionRequest | TweetReactionBlockSessionRequest | ImportBlockSessionRequest

interface SessionEventEmitter {
  'mark-user': MarkUserParams
  'rate-limit': TwitterAPI.Limit
  'rate-limit-reset': null
  started: SessionInfo
  stopped: SessionInfo
  complete: SessionInfo
  error: string
}

export interface FollowerBlockSessionRequest {
  purpose: Purpose
  target: {
    type: 'follower'
    user: TwitterUser
    list: FollowKind
  }
  options: {
    myFollowers: UserAction
    myFollowings: UserAction
    mutualBlocked: UserAction
  }
}

export interface TweetReactionBlockSessionRequest {
  // 이미 차단한 사용자의 RT/마음은 확인할 수 없다.
  // 따라서, 언체인블락은 구현할 수 없다.
  purpose: 'chainblock'
  target: {
    type: 'tweet_reaction'
    // author of tweet
    // user: TwitterUser
    tweet: Tweet
    // reaction: ReactionKind
    blockRetweeters: boolean
    blockLikers: boolean
    blockMentionedUsers: boolean
  }
  options: {
    myFollowers: UserAction
    myFollowings: UserAction
  }
}

export interface ImportBlockSessionRequest {
  purpose: Purpose
  target: {
    type: 'import'
    userIds: string[]
  }
  options: {
    myFollowers: UserAction
    myFollowings: UserAction
  }
}

export interface SessionInfo<ReqT = SessionRequest> {
  sessionId: string
  request: ReqT
  progress: {
    success: {
      [action in Exclude<UserAction, 'Skip'>]: number
    }
    failure: number
    already: number
    skipped: number
    error: number
    scraped: number
    total: number | null
  }
  confirmed: boolean
  status: SessionStatus
  limit: TwitterAPI.Limit | null
}

function isAlreadyDone(follower: TwitterUser, action: UserAction): boolean {
  if (!('blocking' in follower && 'muting' in follower)) {
    return false
  }
  const { blocking, muting } = follower
  if (blocking && action === 'Block') {
    return true
  } else if (!blocking && action === 'UnBlock') {
    return true
  } else if (muting && action === 'Mute') {
    return true
  } else if (!muting && action === 'UnMute') {
    return true
  }
  return false
}

// 더 나은 타입이름 없을까...
type ApiKind = FollowKind | 'tweet-reactions' | 'lookup-users'

function extractRateLimit(limitStatuses: TwitterAPI.LimitStatus, apiKind: ApiKind): TwitterAPI.Limit {
  switch (apiKind) {
    case 'followers':
      return limitStatuses.followers['/followers/list']
    case 'friends':
      return limitStatuses.friends['/friends/list']
    case 'mutual-followers':
      return limitStatuses.followers['/followers/list']
    case 'tweet-reactions':
      return limitStatuses.statuses['/statuses/retweeted_by']
    case 'lookup-users':
      return limitStatuses.users['/users/lookup']
  }
}

export default class ChainBlockSession {
  private shouldStop = false
  private readonly sessionInfo = this.initSessionInfo()
  private readonly scraper = Scraper.initScraper(this.request)
  public readonly eventEmitter = new EventEmitter<SessionEventEmitter>()
  public constructor(private request: SessionRequest, private limiter: BlockLimiter) {}
  public getSessionInfo() {
    return copyFrozenObject(this.sessionInfo)
  }
  public isSameTarget(givenTarget: SessionRequest['target']) {
    const thisTarget = this.request.target
    if (thisTarget.type !== givenTarget.type) {
      return false
    }
    switch (thisTarget.type) {
      case 'follower':
        const givenUser = (givenTarget as FollowerBlockSessionRequest['target']).user
        return thisTarget.user.id_str === givenUser.id_str
      case 'tweet_reaction':
        const givenTweet = (givenTarget as TweetReactionBlockSessionRequest['target']).tweet
        return thisTarget.tweet.id_str === givenTweet.id_str
      case 'import':
        return false
    }
  }
  public setConfirmed() {
    this.sessionInfo.confirmed = true
  }
  public async start() {
    if (!this.sessionInfo.confirmed) {
      throw new Error('session not confirmed')
    }
    const $$DBG$$_noApiCall = localStorage.getItem('RedBlock FakeAPI') === 'true'
    if ($$DBG$$_noApiCall) {
      console.warn("WARNING: RedBlock FakeAPI mode detected! won't call actual api")
    }
    let apiKind: ApiKind
    switch (this.request.target.type) {
      case 'follower':
        apiKind = this.request.target.list
        break
      case 'tweet_reaction':
        apiKind = 'tweet-reactions'
        break
      case 'import':
        apiKind = 'lookup-users'
        break
    }
    let stopped = false
    try {
      for await (const scraperResponse of this.scraper) {
        if (this.shouldStop) {
          stopped = true
          break
        }
        this.sessionInfo.progress.scraped = this.calculateScrapedCount()
        if (!scraperResponse.ok) {
          if (scraperResponse.error instanceof TwitterAPI.RateLimitError) {
            this.handleRateLimit(this.sessionInfo, this.eventEmitter, apiKind)
            const second = 1000
            const minute = second * 60
            await sleep(1 * minute)
            continue
          } else {
            throw scraperResponse.error
          }
        }
        if (this.sessionInfo.progress.total === null) {
          this.sessionInfo.progress.total = this.scraper.totalCount
        }
        this.handleRunning()
        let promisesBuffer: Promise<any>[] = []
        for (const user of scraperResponse.value.users) {
          const blockLimitReached = this.limiter.check() !== 'ok'
          if (blockLimitReached) {
            this.stop()
            break
          }
          const whatToDo = this.whatToDoGivenUser(this.request, user)
          console.debug('user %o => %s', user, whatToDo)
          if (whatToDo === 'Skip') {
            this.sessionInfo.progress.skipped++
            continue
          } else if (whatToDo === 'AlreadyDone') {
            this.sessionInfo.progress.already++
            continue
          }
          let promise: Promise<boolean>
          if ($$DBG$$_noApiCall) {
            promise = Promise.resolve(true)
          } else {
            switch (whatToDo) {
              case 'Block':
                promise = TwitterAPI.blockUser(user)
                break
              case 'Mute':
                promise = TwitterAPI.muteUser(user)
                break
              case 'UnBlock':
                promise = TwitterAPI.unblockUser(user)
                break
              case 'UnMute':
                promise = TwitterAPI.unmuteUser(user)
                break
            }
          }
          promise = promise.then(result => {
            if (result) {
              this.sessionInfo.progress.success[whatToDo]++
              this.eventEmitter.emit('mark-user', {
                userId: user.id_str,
                userAction: whatToDo,
              })
            } else {
              this.sessionInfo.progress.failure++
            }
            return result
          })
          if (whatToDo === 'Block' || whatToDo === 'Mute') {
            await promise
          } else if (whatToDo === 'UnBlock' || whatToDo === 'UnMute') {
            promisesBuffer.push(promise)
          }
        }
        await Promise.allSettled(promisesBuffer)
      }
      if (stopped) {
        this.sessionInfo.status = SessionStatus.Stopped
        this.eventEmitter.emit('stopped', this.getSessionInfo())
      } else {
        this.sessionInfo.status = SessionStatus.Completed
        this.eventEmitter.emit('complete', this.getSessionInfo())
      }
    } catch (error) {
      this.sessionInfo.status = SessionStatus.Error
      this.eventEmitter.emit('error', error.toString())
      throw error
    }
  }
  public async stop() {
    this.shouldStop = true
    return new Promise(resolve => {
      this.eventEmitter.on('stopped', resolve)
    })
  }
  public async rewind() {
    this.resetCounts()
    this.sessionInfo.status = SessionStatus.Initial
  }
  private initProgress(): SessionInfo['progress'] {
    return {
      already: 0,
      success: {
        Block: 0,
        UnBlock: 0,
        Mute: 0,
        UnMute: 0,
      },
      failure: 0,
      skipped: 0,
      error: 0,
      scraped: 0,
      total: getCountOfUsersToBlock(this.request),
    }
  }
  private resetCounts() {
    this.sessionInfo.progress = this.initProgress()
  }
  private initSessionInfo(): SessionInfo {
    return {
      sessionId: this.generateSessionId(),
      request: this.request,
      progress: this.initProgress(),
      status: SessionStatus.Initial,
      limit: null,
      confirmed: false,
    }
  }
  private generateSessionId(): string {
    return `session/${Date.now()}`
  }
  private async handleRateLimit(
    sessionInfo: SessionInfo,
    eventEmitter: EventEmitter<SessionEventEmitter>,
    apiKind: ApiKind
  ) {
    sessionInfo.status = SessionStatus.RateLimited
    const limitStatuses = await TwitterAPI.getRateLimitStatus()
    const limit = extractRateLimit(limitStatuses, apiKind)
    sessionInfo.limit = limit
    eventEmitter.emit('rate-limit', limit)
  }
  private handleRunning() {
    const { sessionInfo, eventEmitter } = this
    if (sessionInfo.status === SessionStatus.Initial) {
      eventEmitter.emit('started', sessionInfo)
    }
    if (sessionInfo.status === SessionStatus.RateLimited) {
      eventEmitter.emit('rate-limit-reset', null)
    }
    sessionInfo.limit = null
    sessionInfo.status = SessionStatus.Running
  }
  private calculateScrapedCount() {
    const { success, already, failure, error, skipped } = this.sessionInfo.progress
    return _.sum([...Object.values(success), already, failure, error, skipped])
  }
  private whatToDoGivenUser(request: SessionRequest, follower: TwitterUser): UserAction | 'Skip' | 'AlreadyDone' {
    const { purpose, options, target } = request
    const { following, followed_by, follow_request_sent } = follower
    if (!(typeof following === 'boolean' && typeof followed_by === 'boolean')) {
      throw new Error('following/followed_by property missing?')
    }
    const isMyFollowing = following || follow_request_sent
    const isMyFollower = followed_by
    const isMyMutualFollower = isMyFollower && isMyFollowing
    // 주의!
    // 팝업 UI에 나타난 순서를 고려할 것.
    if (isMyMutualFollower) {
      return 'Skip'
    }
    if (isMyFollower) {
      return options.myFollowers
    }
    if (isMyFollowing) {
      return options.myFollowings
    }
    if (purpose === 'unchainblock' && 'mutualBlocked' in options) {
      const blockedBy = target.type === 'follower' && target.user.blocked_by
      if (blockedBy) {
        return options.mutualBlocked
      }
    }
    let defaultAction: UserAction
    switch (purpose) {
      case 'chainblock':
        defaultAction = 'Block'
        break
      case 'unchainblock':
        defaultAction = 'UnBlock'
        break
    }
    if (isAlreadyDone(follower, defaultAction)) {
      return 'AlreadyDone'
    }
    return defaultAction
  }
}

export const followerBlockDefaultOption: Readonly<FollowerBlockSessionRequest['options']> = Object.freeze({
  myFollowers: 'Skip',
  myFollowings: 'Skip',
  mutualBlocked: 'Skip',
})

export const tweetReactionBlockDefaultOption: Readonly<TweetReactionBlockSessionRequest['options']> = Object.freeze({
  myFollowers: 'Skip',
  myFollowings: 'Skip',
})
