import { copyFrozenObject, EventEmitter, SessionStatus, sleep } from '../common.js'
import { MutualFollowerScraper, QuickScraper, SimpleScraper, UserScraper } from './chainblock-scraper.js'
import * as TwitterAPI from './twitter-api.js'

type Limit = TwitterAPI.Limit
type TwitterUser = TwitterAPI.TwitterUser
type Tweet = TwitterAPI.Tweet

const PROMISE_BUFFER_SIZE = 150

export type SessionRequests = FollowerBlockSessionRequest | TweetReactionBlockSessionRequest
export type SessionTypes = FollowerBlockSession | TweetReactionBlockSession

export interface FollowerBlockSessionRequest {
  purpose: ChainKind
  target: {
    type: 'follower'
    user: TwitterUser
    list: FollowKind
  }
  options: {
    quickMode: boolean
    myFollowers: Verb
    myFollowings: Verb
    verified: Verb
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
    reaction: ReactionKind
  }
  options: {
    myFollowers: Verb
    myFollowings: Verb
    verified: Verb
  }
}

export interface SessionInfo<ReqT = SessionRequests> {
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

interface SessionEventEmitter {
  'mark-user': MarkUserParams
  'rate-limit': Limit
  'rate-limit-reset': null
  complete: SessionInfo['progress']
  error: string
}

export interface ISession<ReqT = SessionRequests> {
  readonly eventEmitter: EventEmitter<SessionEventEmitter>
  start(): Promise<void>
  stop(): void
  getSessionInfo(): SessionInfo<ReqT>
  isSameTarget(givenTarget: SessionRequests['target']): boolean
}

export class FollowerBlockSession implements ISession<FollowerBlockSessionRequest> {
  private readonly sessionInfo = this.initSessionInfo()
  private shouldStop = false
  public readonly eventEmitter = new EventEmitter<SessionEventEmitter>()
  public constructor(private request: FollowerBlockSessionRequest) {}
  public getSessionInfo() {
    // deep-freeze 하는 게 좋을까?
    return copyFrozenObject(this.sessionInfo)
  }
  public isSameTarget(givenTarget: SessionRequests['target']) {
    if (givenTarget.type !== 'follower') {
      return false
    }
    const givenTargetUser = givenTarget.user
    const thisTargetUser = this.sessionInfo.request.target.user
    return thisTargetUser.id_str === givenTargetUser.id_str
  }
  public async start() {
    const promiseBuffer: Promise<void>[] = []
    let stopped = false
    try {
      const scraper = this.initScraper()
      const userScraper = scraper.scrape()
      for await (const maybeFollower of userScraper) {
        this.updateTotalCount(scraper)
        this.updateScrapedCount()
        if (this.shouldStop) {
          stopped = true
          promiseBuffer.length = 0
          break
        }
        if (!maybeFollower.ok) {
          if (maybeFollower.error instanceof TwitterAPI.RateLimitError) {
            this.handleRateLimit()
            const second = 1000
            const minute = second * 60
            await sleep(1 * minute)
            continue
          } else {
            throw maybeFollower.error
          }
        }
        this.handleRunning()
        const follower = maybeFollower.value
        const whatToDo = this.whatToDoGivenUser(follower)
        if (whatToDo === 'Skip') {
          this.sessionInfo.progress.skipped++
          continue
        } else if (whatToDo === 'AlreadyDone') {
          this.sessionInfo.progress.already++
          continue
        }
        promiseBuffer.push(this.doVerb(follower, whatToDo))
        if (promiseBuffer.length >= PROMISE_BUFFER_SIZE) {
          await Promise.all(promiseBuffer)
          promiseBuffer.length = 0
        }
      }
      await Promise.all(promiseBuffer)
      promiseBuffer.length = 0
      if (!stopped) {
        this.sessionInfo.status = SessionStatus.Completed
        this.eventEmitter.emit('complete', this.sessionInfo.progress)
      }
    } catch (error) {
      this.sessionInfo.status = SessionStatus.Error
      this.eventEmitter.emit('error', error.toString())
      throw error
    }
  }
  public stop() {
    this.shouldStop = true
  }
  private initCount(): SessionInfo['count'] {
    const { user, list } = this.request.target
    let total: number | null
    switch (list) {
      case 'followers':
        total = user.followers_count
        break
      case 'friends':
        total = user.friends_count
        break
      case 'mutual-followers':
        total = null
        break
    }
    return {
      scraped: 0,
      total,
    }
  }
  private initSessionInfo(): SessionInfo<FollowerBlockSessionRequest> {
    return {
      sessionId: generateSessionId(),
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
      count: this.initCount(),
      status: SessionStatus.Initial,
      limit: null,
    }
  }
  private initScraper() {
    const { options, target } = this.sessionInfo.request
    const scraper = options.quickMode ? QuickScraper : SimpleScraper
    switch (target.list) {
      case 'friends':
        return new scraper(target.user, 'friends')
      case 'followers':
        return new scraper(target.user, 'followers')
      case 'mutual-followers':
        return new MutualFollowerScraper(target.user)
      default:
        throw new Error('unreachable')
    }
  }
  private isAlreadyDone(follower: TwitterUser, verb: Verb): boolean {
    const { blocking, muting } = follower
    let already = false
    if (blocking && verb === 'Block') {
      already = true
    } else if (!blocking && verb === 'UnBlock') {
      already = true
    } else if (muting && verb === 'Mute') {
      already = true
    } else if (!muting && verb === 'UnMute') {
      already = true
    }
    return already
  }
  private whatToDoGivenUser(follower: TwitterUser): Verb {
    const { purpose, options } = this.sessionInfo.request
    const { following, followed_by, follow_request_sent } = follower
    const isMyFollowing = following || follow_request_sent
    const isMyFollower = followed_by
    const isMyMutualFollower = isMyFollower && isMyFollowing
    /* 주의!
     * 팝업 UI에 나타난 순서를 고려할 것.
     */
    if (isMyMutualFollower) {
      return 'Skip'
    }
    if (isMyFollower) {
      return options.myFollowers
    }
    if (isMyFollowing) {
      return options.myFollowings
    }
    if (follower.verified) {
      return options.verified
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
    if (this.isAlreadyDone(follower, defaultVerb)) {
      return 'AlreadyDone'
    }
    return defaultVerb
  }
  private updateTotalCount(scraper: UserScraper) {
    if (this.sessionInfo.count.total === null) {
      this.sessionInfo.count.total = scraper.totalCount
    }
  }
  private async doVerb(follower: TwitterUser, verb: VerbSomething): Promise<void> {
    let promise: Promise<TwitterUser>
    const incrementSuccess = (v: VerbSomething) => this.sessionInfo.progress.success[v]++
    const incrementFailure = () => this.sessionInfo.progress.failure++
    switch (verb) {
      case 'Block':
        promise = TwitterAPI.blockUser(follower)
        break
      case 'UnBlock':
        promise = TwitterAPI.unblockUser(follower)
        break
      case 'Mute':
        promise = TwitterAPI.muteUser(follower)
        break
      case 'UnMute':
        promise = TwitterAPI.unmuteUser(follower)
        break
    }
    return promise
      .then(result => {
        if (result) {
          incrementSuccess(verb)
          this.eventEmitter.emit('mark-user', {
            userId: follower.id_str,
            verb,
          })
        } else {
          incrementFailure()
        }
      })
      .catch(() => void incrementFailure())
  }
  private updateScrapedCount() {
    const { success, already, failure, error, skipped } = this.sessionInfo.progress
    const scraped = _.sum([...Object.values(success), already, failure, error, skipped])
    this.sessionInfo.count.scraped = scraped
  }
  private async handleRateLimit() {
    this.sessionInfo.status = SessionStatus.RateLimited
    const limitStatuses = await TwitterAPI.getRateLimitStatus()
    const { target } = this.sessionInfo.request
    let limit: Limit
    switch (target.list) {
      case 'followers':
        limit = limitStatuses.followers['/followers/list']
        break
      case 'friends':
        limit = limitStatuses.friends['/friends/list']
        break
      case 'mutual-followers':
        limit = limitStatuses.followers['/followers/list']
        break
    }
    this.sessionInfo.limit = limit
    this.eventEmitter.emit('rate-limit', limit)
  }
  private async handleRunning() {
    if (this.sessionInfo.status === SessionStatus.RateLimited) {
      this.eventEmitter.emit('rate-limit-reset', null)
    }
    this.sessionInfo.status = SessionStatus.Running
    this.sessionInfo.limit = null
  }
}

export class TweetReactionBlockSession implements ISession<TweetReactionBlockSessionRequest> {
  private readonly sessionInfo = this.initSessionInfo()
  private shouldStop = false
  public readonly eventEmitter = new EventEmitter<SessionEventEmitter>()
  public constructor(private request: TweetReactionBlockSessionRequest) {}
  public isSameTarget(givenTarget: SessionRequests['target']) {
    if (givenTarget.type !== 'tweetReaction') {
      return false
    }
    const thisTargetTweetId = this.sessionInfo.request.target.tweet.id_str
    const givenTweetId = givenTarget.tweet.id_str
    return thisTargetTweetId === givenTweetId
  }
  public async start() {
    this.shouldStop
    throw new Error('not implemented')
  }
  public stop() {
    this.shouldStop = false
  }
  public getSessionInfo() {
    return copyFrozenObject(this.sessionInfo)
  }
  private initCount(): SessionInfo<TweetReactionBlockSessionRequest>['count'] {
    return {
      scraped: 0,
      total: 0,
    }
  }
  private initSessionInfo(): SessionInfo<TweetReactionBlockSessionRequest> {
    return {
      sessionId: generateSessionId(),
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
      count: this.initCount(),
      status: SessionStatus.Initial,
      limit: null,
    }
  }
}

// TODO: rename or create for t.r. session
export const defaultOption: Readonly<FollowerBlockSessionRequest['options']> = Object.freeze({
  quickMode: false,
  myFollowers: 'Skip',
  myFollowings: 'Skip',
  verified: 'Skip',
  mutualBlocked: 'Skip',
})

function generateSessionId(): string {
  return `session/${Date.now()}`
}
