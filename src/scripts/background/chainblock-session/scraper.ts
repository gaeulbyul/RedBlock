import * as TwitterAPI from '../twitter-api.js'
import { getFollowersCount, getReactionsCount, wrapEither } from '../../common.js'
import { SessionRequest } from './session.js'
import { RedBlockStorage } from '../storage.js'

type TwitterUser = TwitterAPI.TwitterUser
type Tweet = TwitterAPI.Tweet

type ScrapedUsersIterator = AsyncIterableIterator<Either<Error, TwitterUser>>
export interface UserScraper {
  totalCount: number | null
  requireFriendsFilter: false
  [Symbol.asyncIterator](): ScrapedUsersIterator
}

type ScrapedUserIdsIterator = AsyncIterableIterator<Either<Error, string>>
export interface UserIdScraper {
  totalCount: number | null
  requireFriendsFilter: true
  [Symbol.asyncIterator](): ScrapedUserIdsIterator
}

// 단순 스크래퍼. 기존 체인블락 방식
export class SimpleScraper implements UserScraper {
  public totalCount: number
  public readonly requireFriendsFilter = false
  constructor(private user: TwitterUser, private followKind: FollowKind) {
    this.totalCount = getFollowersCount(user, followKind)!
  }
  public [Symbol.asyncIterator]() {
    return TwitterAPI.getAllFollowsUserList(this.followKind, this.user)
  }
}

// 맞팔로우 스크래퍼
export class MutualFollowerScraper implements UserScraper {
  public totalCount: number | null = null
  public readonly requireFriendsFilter = false
  constructor(private user: TwitterUser) {}
  public async *[Symbol.asyncIterator]() {
    const mutualFollowersIds = await TwitterAPI.getAllMutualFollowersIds(this.user)
    this.totalCount = mutualFollowersIds.length
    yield* TwitterAPI.lookupUsersByIds(mutualFollowersIds)
  }
}

// 차단상대 대상 스크래퍼
export class AntiBlockScraper implements UserIdScraper {
  public totalCount: number | null = null
  public readonly requireFriendsFilter = true
  constructor(private user: TwitterUser, private followKind: FollowKind) {}
  private async prepareActor() {
    const multiCookies = await TwitterAPI.getMultiAccountCookies()
    const actorUserIds = Object.keys(multiCookies)
    for (const actorId of actorUserIds) {
      const target = await TwitterAPI.getSingleUserById(this.user.id_str, actorId).catch(() => null)
      if (target && !target.blocked_by) {
        return actorId
      }
    }
    const i18n = await import('../../i18n.js')
    throw new Error(i18n.getMessage('cant_chainblock_to_blocked'))
  }
  public async *[Symbol.asyncIterator]() {
    const actAsUserId = await this.prepareActor()
    if (this.followKind === 'mutual-followers') {
      yield* await TwitterAPI.getAllMutualFollowersIds(this.user, actAsUserId).then(ids => ids.map(wrapEither))
    } else {
      yield* TwitterAPI.getAllFollowsIds(this.followKind, this.user, actAsUserId)
    }
  }
}

export class FollowersIdScraper implements UserIdScraper {
  public totalCount: number
  public readonly requireFriendsFilter = true
  constructor(private user: TwitterUser, private followKind: FollowKind) {
    this.totalCount = getFollowersCount(user, followKind)!
  }
  public async *[Symbol.asyncIterator]() {
    if (this.followKind === 'mutual-followers') {
      yield* await TwitterAPI.getAllMutualFollowersIds(this.user).then(ids => ids.map(wrapEither))
    } else {
      yield* TwitterAPI.getAllFollowsIds(this.followKind, this.user)
    }
  }
}

// 트윗반응 유저 스크래퍼
export class TweetReactedUserScraper implements UserScraper {
  public totalCount: number
  public readonly requireFriendsFilter = false
  constructor(private tweet: Tweet, private reaction: ReactionKind) {
    this.totalCount = getReactionsCount(tweet, reaction)
  }
  public [Symbol.asyncIterator]() {
    return TwitterAPI.getAllReactedUserList(this.reaction, this.tweet)
  }
}

interface ApiUsageCalculationResult {
  ids: number
  lists: number
  prefer: 'lists' | 'ids'
}

export function calcApiUsage(
  myFollowersCount: number,
  myFollowingsCount: number,
  targetCount: number
): ApiUsageCalculationResult {
  const { ceil } = Math
  const ids = ceil(myFollowersCount / 5000) + ceil(myFollowingsCount / 5000) + ceil(targetCount / 5000)
  const lists = ceil(targetCount / 200)
  return {
    ids,
    lists,
    prefer: ids < lists ? 'ids' : 'lists',
  }
}

interface ScraperInitializationParams {
  requestedUser: TwitterUser
  request: SessionRequest
  redblockOptions: RedBlockStorage['options']
}

export function initScraper({
  requestedUser,
  request,
  redblockOptions,
}: ScraperInitializationParams): UserScraper | UserIdScraper {
  const { target, purpose } = request
  if (target.type === 'tweetReaction') {
    return new TweetReactedUserScraper(target.tweet, target.reaction)
  }
  if (target.user.blocked_by) {
    return new AntiBlockScraper(target.user, target.list)
  }
  if (target.list === 'mutual-followers') {
    return new MutualFollowerScraper(target.user)
  }
  const targetFollowsCount = getFollowersCount(target.user, target.list)!
  // TODO: 맞팔로우 체인블락은? API 사용횟수 계산식을 바꿔야 할 듯
  const estimatedApiUsage = calcApiUsage(requestedUser.followers_count, requestedUser.friends_count, targetFollowsCount)
  // 언체인블락의 경우...
  // - ids 스크래퍼로 긁으면 상대방의 차단여부를 판단할 수 없고,
  // - 그래서 불필요한 차단해제요청을 하게 되버린다.
  // - 따라서 체인블락을 할 때에만 적용
  const shouldRailgunScraper =
    redblockOptions.enableRailgun && purpose === 'chainblock' && estimatedApiUsage.prefer === 'ids'
  if (shouldRailgunScraper) {
    return new FollowersIdScraper(target.user, target.list)
  }
  return new SimpleScraper(target.user, target.list)
}
