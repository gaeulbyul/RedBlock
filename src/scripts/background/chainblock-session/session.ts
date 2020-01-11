import * as Scraper from './scraper.js'
import * as TwitterAPI from '../twitter-api.js'
import {
  EventEmitter,
  SessionStatus,
  copyFrozenObject,
  getFollowersCount,
  getReactionsCount,
  collectAsync,
  sleep,
  unwrap,
} from '../../common.js'

export type SessionRequest = FollowerBlockSessionRequest | TweetReactionBlockSessionRequest
// export type SessionType = FollowerBlockSession | TweetReactionBlockSession

type Limit = TwitterAPI.Limit
type TwitterUser = TwitterAPI.TwitterUser
type Tweet = TwitterAPI.Tweet

interface SessionEventEmitter {
  'mark-user': MarkUserParams
  'rate-limit': Limit
  'rate-limit-reset': null
  complete: SessionInfo['progress']
  error: string
}

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

function isAlreadyDone(user: TwitterUser, verb: VerbSomething): boolean {
  const { blocking, muting } = user
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

function extractRateLimit(limitStatuses: TwitterAPI.LimitStatus, apiKind: FollowKind | ReactionKind): Limit {
  switch (apiKind) {
    case 'followers':
      return limitStatuses.followers['/followers/list']
    case 'friends':
      return limitStatuses.friends['/friends/list']
    case 'mutual-followers':
      return limitStatuses.followers['/followers/list']
    case 'retweeted':
      return limitStatuses.statuses['/statuses/retweeted_by']
    case 'liked':
      return limitStatuses.statuses['/statuses/favorited_by']
  }
}

function getCount({ target }: SessionRequest) {
  switch (target.type) {
    case 'follower':
      return getFollowersCount(target.user, target.list)
    case 'tweetReaction':
      return getReactionsCount(target.tweet, target.reaction)
  }
}

export default class ChainBlockSession {
  private readonly sessionInfo = this.initSessionInfo()
  private shouldStop = false
  public readonly eventEmitter = new EventEmitter<SessionEventEmitter>()
  private readonly friendsFilter = new FriendsFilter()
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
    if (scraper.resultType === 'user-id') {
      await this.friendsFilter.collect()
    }
    const { target } = this.request
    let apiKind: FollowKind | ReactionKind
    switch (target.type) {
      case 'follower':
        apiKind = target.list
        break
      case 'tweetReaction':
        apiKind = target.reaction
        break
    }
    const incrementSuccess = (v: VerbSomething) => this.sessionInfo.progress.success[v]++
    const incrementFailure = () => this.sessionInfo.progress.failure++
    let stopped = false
    try {
      for await (const maybeUser of scraper) {
        this.updateTotalCount(scraper)
        this.sessionInfo.count.scraped = this.calculateScrapedCount()
        if (this.shouldStop) {
          stopped = true
          await blocker.flush()
          break
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
        const userId = typeof user === 'string' ? user : user.id_str
        const whatToDo = this.whatToDoGivenUser(this.request, user)
        if (whatToDo === 'Skip') {
          this.sessionInfo.progress.skipped++
          continue
        } else if (whatToDo === 'AlreadyDone') {
          this.sessionInfo.progress.already++
          continue
        }
        blocker.add(whatToDo, user).then(
          resultUser => {
            if (resultUser) {
              incrementSuccess(whatToDo)
              this.eventEmitter.emit('mark-user', {
                userId,
                verb: whatToDo,
              })
            }
          },
          () => incrementFailure
        )
        await blocker.flushIfNeed()
      }
      await blocker.flush()
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
  private updateTotalCount(scraper: Scraper.UserScraper | Scraper.UserIdScraper) {
    if (this.sessionInfo.count.total === null) {
      this.sessionInfo.count.total = scraper.totalCount
    }
  }
  private async handleRateLimit(
    sessionInfo: SessionInfo,
    eventEmitter: EventEmitter<SessionEventEmitter>,
    apiKind: FollowKind | ReactionKind
  ) {
    sessionInfo.status = SessionStatus.RateLimited
    const limitStatuses = await TwitterAPI.getRateLimitStatus()
    const limit = extractRateLimit(limitStatuses, apiKind)
    sessionInfo.limit = limit
    eventEmitter.emit('rate-limit', limit)
  }
  private handleRunning(sessionInfo: SessionInfo, eventEmitter: EventEmitter<SessionEventEmitter>) {
    if (sessionInfo.status === SessionStatus.RateLimited) {
      eventEmitter.emit('rate-limit-reset', null)
    }
    sessionInfo.status = SessionStatus.Running
    sessionInfo.limit = null
  }
  private calculateScrapedCount() {
    const { success, already, failure, error, skipped } = this.sessionInfo.progress
    return _.sum([...Object.values(success), already, failure, error, skipped])
  }
  private whatToDoGivenUser(request: SessionRequest, user: string | TwitterUser): Verb {
    const { purpose, options } = request
    const { isMyFollower, isMyFollowing } = this.friendsFilter.checkUser(user)
    const isMyMutualFollower = isMyFollower && isMyFollowing
    if (isMyMutualFollower) {
      return 'Skip'
    }
    if (isMyFollower) {
      return options.myFollowers
    }
    if (isMyFollowing) {
      return options.myFollowings
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
    if (typeof user === 'string') {
      return defaultVerb
    }
    if (isAlreadyDone(user, defaultVerb)) {
      return 'AlreadyDone'
    }
    return defaultVerb
  }
}

class Blocker {
  private readonly BUFFER_SIZE = 150
  private readonly buffer: Promise<any>[] = []
  public get currentSize() {
    return this.buffer.length
  }
  public add(verb: VerbSomething, user: string | TwitterUser) {
    let promise: Promise<any>
    if (typeof user === 'string') {
      promise = this.callAPIFromVerbById(verb, user)
    } else {
      promise = this.callAPIFromVerb(verb, user)
    }
    this.buffer.push(promise)
    return promise
  }
  public async flush() {
    await Promise.all(this.buffer)
    this.buffer.length = 0
  }
  public async flushIfNeed() {
    if (this.currentSize >= this.BUFFER_SIZE) {
      return this.flush()
    }
  }
  private async callAPIFromVerb(verb: VerbSomething, user: TwitterUser): Promise<TwitterUser> {
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
  private async callAPIFromVerbById(verb: VerbSomething, userId: string): Promise<Response> {
    switch (verb) {
      case 'Block':
        return TwitterAPI.blockUserById(userId)
      case 'UnBlock':
        return TwitterAPI.unblockUserById(userId)
      case 'Mute':
        return TwitterAPI.muteUserById(userId)
      case 'UnMute':
        return TwitterAPI.unmuteUserById(userId)
    }
  }
}

class FriendsFilter {
  private readonly followerIds: string[] = []
  private readonly followingIds: string[] = []
  private collected = false
  public async collect() {
    if (this.collected) {
      return
    }
    const myself = await TwitterAPI.getMyself()
    return Promise.all([
      collectAsync(TwitterAPI.getAllFollowsIds('followers', myself))
        .then(eithers => eithers.map(unwrap))
        .then(userIds => this.followerIds.push(...userIds)),
      collectAsync(TwitterAPI.getAllFollowsIds('friends', myself))
        .then(eithers => eithers.map(unwrap))
        .then(userIds => this.followingIds.push(...userIds)),
    ]).then(() => {
      this.collected = true
    })
  }
  public checkUser(user: string | TwitterUser) {
    if (typeof user === 'string') {
      return this.checkUserId(user)
    }
    return {
      isMyFollower: user.followed_by,
      isMyFollowing: user.following || user.follow_request_sent,
    }
  }
  private checkUserId(userId: string) {
    if (!this.collected) {
      throw new Error('not collected yet.')
    }
    const isMyFollower = this.followerIds.includes(userId)
    const isMyFollowing = this.followingIds.includes(userId)
    return {
      isMyFollower,
      isMyFollowing,
    }
  }
}

export const followerBlockDefaultOption: Readonly<FollowerBlockSessionRequest['options']> = Object.freeze({
  quickMode: false,
  myFollowers: 'Skip',
  myFollowings: 'Skip',
  mutualBlocked: 'Skip',
})

export const tweetReactionBlockDefaultOption: Readonly<TweetReactionBlockSessionRequest['options']> = Object.freeze({
  myFollowers: 'Skip',
  myFollowings: 'Skip',
})

export function checkFollowerBlockTarget(target: FollowerBlockSessionRequest['target']): [boolean, string] {
  if (target.user.blocked_by) {
    return [false, '\u26d4 상대방이 나를 차단하여 (언)체인블락을 실행할 수 없습니다.']
  }
  if (target.user.protected && !target.user.following) {
    return [false, '\u{1f512} 프로텍트 계정을 대상으로 (언)체인블락을 실행할 수 없습니다.']
  }
  if (target.list === 'followers' && target.user.followers_count <= 0) {
    return [false, '팔로워가 0명인 계정입니다.']
  } else if (target.list === 'friends' && target.user.friends_count <= 0) {
    return [false, '팔로잉이 0명인 계정입니다.']
  } else if (target.list === 'mutual-followers' && target.user.followers_count <= 0 && target.user.friends_count <= 0) {
    return [false, '팔로워나 팔로잉이 0명인 계정입니다.']
  }
  return [true, '']
}

export function checkTweetReactionBlockTarget(target: TweetReactionBlockSessionRequest['target']): [boolean, string] {
  if (target.reaction === 'retweeted' && target.tweet.retweet_count <= 0) {
    return [false, '아무도 리트윗하지 않은 트윗입니다.']
  } else if (target.reaction === 'liked' && target.tweet.favorite_count <= 0) {
    return [false, '아무도 마음에 들어하지 않은 트윗입니다.']
  }
  return [true, '']
}
