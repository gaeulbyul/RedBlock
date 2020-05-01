import * as Scraper from './scraper.js'
import * as TwitterAPI from '../twitter-api.js'
import * as i18n from '../../i18n.js'
import { blockMultipleUsers, BlockAllResult } from '../block-all.js'
import {
  MAX_USER_LIMIT,
  EventEmitter,
  SessionStatus,
  copyFrozenObject,
  getFollowersCount,
  getReactionsCount,
  sleep,
} from '../../common.js'

export type SessionRequest = FollowerBlockSessionRequest | TweetReactionBlockSessionRequest

type Limit = TwitterAPI.Limit

// const MAX_USER_LIMIT = 100000

interface SessionEventEmitter {
  'mark-user': MarkUserParams
  'mark-many-users-as-blocked': MarkManyUsersAsBlockedParams
  'rate-limit': Limit
  'rate-limit-reset': null
  started: SessionInfo
  stopped: SessionInfo
  complete: SessionInfo
  error: string
}

export interface FollowerBlockSessionRequest {
  purpose: ChainKind
  target: {
    type: 'follower'
    user: TwitterUser
    list: FollowKind
    count: number | null
  }
  options: {
    myFollowers: Verb
    myFollowings: Verb
    mutualBlocked: Verb
  }
}

export interface TweetReactionBlockSessionRequest {
  // 이미 차단한 사용자의 RT/마음은 확인할 수 없다.
  // 따라서, 언체인블락은 구현할 수 없다.
  purpose: 'chainblock'
  target: {
    type: 'tweetReaction'
    // author of tweet
    // user: TwitterUser
    tweet: Tweet
    // reaction: ReactionKind
    blockRetweeters: boolean
    blockLikers: boolean
    count: number
  }
  options: {
    myFollowers: Verb
    myFollowings: Verb
  }
}

export interface SessionInfo<ReqT = SessionRequest> {
  sessionId: string
  request: ReqT
  progress: {
    success: {
      [verb in VerbSomething]: number
    }
    failure: number
    already: number
    skipped: number
    error: number
  }
  count: {
    scraped: number
    // totalCount: 맞팔로우 체인의 경우, 실행시작 시점에선 정확한 사용자 수를 알 수 없다.
    // 따라서, null을 통해 '아직 알 수 없음'을 표현한다.
    total: number | null
  }
  status: SessionStatus
  limit: Limit | null
}

function isAlreadyDone(follower: TwitterUser, verb: VerbSomething): boolean {
  if (!('blocking' in follower && 'muting' in follower)) {
    return false
  }
  const { blocking, muting } = follower
  if (blocking && verb === 'Block') {
    return true
  } else if (!blocking && verb === 'UnBlock') {
    return true
  } else if (muting && verb === 'Mute') {
    return true
  } else if (!muting && verb === 'UnMute') {
    return true
  }
  return false
}

// 더 나은 타입이름 없을까...
type ApiKind = FollowKind | 'tweet-reactions'

function extractRateLimit(limitStatuses: TwitterAPI.LimitStatus, apiKind: ApiKind): Limit {
  switch (apiKind) {
    case 'followers':
      return limitStatuses.followers['/followers/list']
    case 'friends':
      return limitStatuses.friends['/friends/list']
    case 'mutual-followers':
      return limitStatuses.followers['/followers/list']
    case 'tweet-reactions':
      return limitStatuses.statuses['/statuses/retweeted_by']
    // return limitStatuses.statuses['/statuses/favorited_by']
  }
}

function getCount({ target }: SessionRequest) {
  switch (target.type) {
    case 'follower':
      return getFollowersCount(target.user, target.list)
    case 'tweetReaction':
      return getReactionsCount(target)
  }
}

export default class ChainBlockSession {
  private readonly sessionInfo = this.initSessionInfo()
  private shouldStop = false
  public readonly eventEmitter = new EventEmitter<SessionEventEmitter>()
  public constructor(private request: SessionRequest) {}
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
      case 'tweetReaction':
        const givenTweet = (givenTarget as TweetReactionBlockSessionRequest['target']).tweet
        return thisTarget.tweet.id_str === givenTweet.id_str
    }
  }
  public async start() {
    const scraper = Scraper.initScraper(this.request)
    const blocker = new Blocker()
    const multiBlocker = new BlockAllAPIBlocker()
    const { target } = this.request
    let apiKind: ApiKind
    switch (target.type) {
      case 'follower':
        apiKind = target.list
        break
      case 'tweetReaction':
        apiKind = 'tweet-reactions'
        break
    }
    const incrementSuccess = (v: VerbSomething) => this.sessionInfo.progress.success[v]++
    const incrementFailure = () => this.sessionInfo.progress.failure++
    const handleAfterMultiBlock = (result: void | BlockAllResult) => {
      if (!result) {
        return
      }
      this.eventEmitter.emit('mark-many-users-as-blocked', {
        userIds: result.blocked,
      })
      this.sessionInfo.progress.success.Block += result.blocked.length
      this.sessionInfo.progress.failure += result.failed.length
    }
    let stopped = false
    try {
      for await (const maybeUser of scraper) {
        if (this.shouldStop) {
          stopped = true
          await blocker.flush()
          break
        }
        this.updateTotalCount(scraper)
        this.sessionInfo.count.scraped = this.calculateScrapedCount()
        if (this.sessionInfo.count.scraped >= MAX_USER_LIMIT) {
          this.stop()
          continue
        }
        if (!maybeUser.ok) {
          if (maybeUser.error instanceof TwitterAPI.RateLimitError) {
            this.handleRateLimit(this.sessionInfo, this.eventEmitter, apiKind)
            const second = 1000
            const minute = second * 60
            await sleep(1 * minute)
            continue
          } else {
            throw maybeUser.error
          }
        }
        this.handleRunning(this.sessionInfo, this.eventEmitter)
        const user = maybeUser.value
        const whatToDo = this.whatToDoGivenUser(this.request, user)
        console.debug('whatToDo(req: %o / user: %o) = "%s"', this.request, user, whatToDo)
        if (whatToDo === 'Skip') {
          this.sessionInfo.progress.skipped++
          continue
        } else if (whatToDo === 'AlreadyDone') {
          this.sessionInfo.progress.already++
          continue
        }
        // 트윗반응 체인블락은 수집할 수 있는 수가 적으므로
        // 굳이 block_all API를 타지 않아도 안전할 듯.
        // 따라서 팔로워 체인블락에만 block_all API를 사용한다.
        if (this.request.target.type === 'follower' && whatToDo === 'Block') {
          multiBlocker.add(user)
        } else {
          const afterVerb = (result: boolean) => {
            if (!result) {
              return
            }
            incrementSuccess(whatToDo)
            this.eventEmitter.emit('mark-user', {
              userId: user.id_str,
              verb: whatToDo,
            })
          }
          const blockerPromise = blocker.create(whatToDo, user).then(afterVerb, () => incrementFailure())
          blocker.add(blockerPromise)
        }
        await blocker.flushIfNeed()
        await multiBlocker.flushIfNeeded().then(handleAfterMultiBlock)
      }
      await blocker.flush()
      await multiBlocker.flush().then(handleAfterMultiBlock)
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
  private initSessionInfo() {
    return {
      sessionId: this.generateSessionId(),
      request: this.request,
      progress: {
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
      },
      count: {
        scraped: 0,
        total: getCount(this.request),
      },
      status: SessionStatus.Initial,
      limit: null,
    }
  }
  private generateSessionId(): string {
    return `session/${Date.now()}`
  }
  private updateTotalCount(scraper: Scraper.UserScraper) {
    if (this.sessionInfo.count.total === null) {
      this.sessionInfo.count.total = scraper.totalCount
    }
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
  private handleRunning(sessionInfo: SessionInfo, eventEmitter: EventEmitter<SessionEventEmitter>) {
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
  private whatToDoGivenUser(request: SessionRequest, follower: TwitterUser): Verb {
    const { purpose, options, target } = request
    const { following, followed_by, follow_request_sent } = follower
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
    let defaultVerb: Verb
    switch (purpose) {
      case 'chainblock':
        defaultVerb = 'Block'
        break
      case 'unchainblock':
        defaultVerb = 'UnBlock'
        break
    }
    if (isAlreadyDone(follower, defaultVerb)) {
      return 'AlreadyDone'
    }
    return defaultVerb
  }
}

class BlockAllAPIBlocker {
  private readonly buffer: TwitterUser[] = []
  public add(user: TwitterUser) {
    // console.debug('bmb[b=%d]: insert user:', this.buffer.size, user)
    this.buffer.push(user)
  }
  public async flush() {
    // console.info('flush start!')
    const result = await blockMultipleUsers(this.buffer.map(u => u.id_str)) // .catch(() => { })
    this.buffer.length = 0
    // console.info('flush end!')
    return result
  }
  public async flushIfNeeded() {
    if (this.buffer.length >= 800) {
      return this.flush()
    }
    return
  }
}

class Blocker {
  private readonly BUFFER_SIZE = 150
  private readonly buffer: Promise<any>[] = []
  public get currentSize() {
    return this.buffer.length
  }
  public create(verb: VerbSomething, user: TwitterUser) {
    return this.callAPIFromVerb(verb, user)
  }
  public add(promise: Promise<any>) {
    this.buffer.push(promise)
    return promise
  }
  public async flush() {
    await Promise.all(this.buffer).catch(() => {})
    this.buffer.length = 0
  }
  public async flushIfNeed() {
    if (this.currentSize >= this.BUFFER_SIZE) {
      return this.flush()
    }
  }
  private async callAPIFromVerb(verb: VerbSomething, user: TwitterUser): Promise<boolean> {
    switch (verb) {
      case 'Block':
        return TwitterAPI.blockUser(user)
      case 'UnBlock':
        return TwitterAPI.unblockUser(user)
      case 'Mute':
        return TwitterAPI.muteUser(user)
      case 'UnMute':
        return TwitterAPI.unmuteUser(user)
    }
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

export function checkFollowerBlockTarget(target: FollowerBlockSessionRequest['target']): [boolean, string] {
  const { protected: isProtected, following, followers_count, friends_count } = target.user
  if (isProtected && !following) {
    return [false, `\u{1f512} ${i18n.getMessage('cant_chainblock_to_protected')}`]
  }
  if (target.list === 'followers' && followers_count <= 0) {
    return [false, i18n.getMessage('cant_chainblock_follower_is_zero')]
  } else if (target.list === 'friends' && friends_count <= 0) {
    return [false, i18n.getMessage('cant_chainblock_following_is_zero')]
  } else if (target.list === 'mutual-followers' && followers_count <= 0 && friends_count <= 0) {
    return [false, i18n.getMessage('cant_chainblock_mutual_follower_is_zero')]
  }
  return [true, '']
}

export function checkTweetReactionBlockTarget(target: TweetReactionBlockSessionRequest['target']): [boolean, string] {
  if (!(target.blockRetweeters || target.blockLikers)) {
    return [false, i18n.getMessage('select_rt_or_like')]
  }
  const { retweet_count, favorite_count } = target.tweet
  if (retweet_count <= 0 && favorite_count <= 0) {
    return [false, i18n.getMessage('cant_chainblock_nobody_retweet_or_like')]
  }
  const onlyWantBlockRetweetedUsers = target.blockRetweeters && !target.blockLikers
  const onlyWantBlockLikedUsers = !target.blockRetweeters && target.blockLikers
  if (onlyWantBlockRetweetedUsers && retweet_count <= 0) {
    return [false, i18n.getMessage('cant_chainblock_nobody_retweeted')]
  } else if (onlyWantBlockLikedUsers && favorite_count <= 0) {
    return [false, i18n.getMessage('cant_chainblock_nobody_liked')]
  }
  return [true, '']
}
