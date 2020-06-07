import * as TwitterAPI from '../twitter-api.js'
import * as i18n from '../../i18n.js'
import { getFollowersCount, getReactionsCount } from '../../common.js'
import { SessionRequest } from './session.js'

type ScrapedUsersIterator = AsyncIterableIterator<Either<Error, TwitterUser>>
export interface UserScraper {
  totalCount: number | null
  [Symbol.asyncIterator](): ScrapedUsersIterator
}

// 단순 스크래퍼. 기존 체인블락 방식
export class SimpleScraper implements UserScraper {
  public totalCount: number
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
  constructor(private user: TwitterUser) {}
  public async *[Symbol.asyncIterator]() {
    const mutualFollowersIds = await TwitterAPI.getAllMutualFollowersIds(this.user)
    this.totalCount = mutualFollowersIds.length
    yield* TwitterAPI.lookupUsersByIds(mutualFollowersIds)
  }
}

// 차단상대 대상 스크래퍼
export class AntiBlockScraper implements UserScraper {
  public totalCount: number | null = null
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
    // 현재 파이어폭스의 addons-linter에선 dynamic-import 구문을 지원하지 않는다.
    // https://github.com/mozilla/addons-linter/issues/2940
    // const i18n = await import('../../i18n.js')
    throw new Error(i18n.getMessage('cant_chainblock_to_blocked'))
  }
  public async *[Symbol.asyncIterator]() {
    const actAsUserId = await this.prepareActor()
    if (this.followKind === 'mutual-followers') {
      const mutualFollowerIds = await TwitterAPI.getAllMutualFollowersIds(this.user, actAsUserId)
      this.totalCount = mutualFollowerIds.length
      yield* TwitterAPI.lookupUsersByIds(mutualFollowerIds)
    } else {
      this.totalCount = getFollowersCount(this.user, this.followKind)
      yield* TwitterAPI.getAllFollowsUserList(this.followKind, this.user, actAsUserId)
    }
  }
}

// 트윗반응 유저 스크래퍼
export class TweetReactedUserScraper implements UserScraper {
  public totalCount: number
  constructor(private target: TweetReactionBlockSessionRequest['target']) {
    this.totalCount = getReactionsCount(target)
  }
  public async *[Symbol.asyncIterator]() {
    const { tweet, blockRetweeters, blockLikers } = this.target
    if (blockRetweeters) {
      yield* TwitterAPI.getAllReactedUserList('retweeted', tweet)
    }
    if (blockLikers) {
      yield* TwitterAPI.getAllReactedUserList('liked', tweet)
    }
  }
}

export function initScraper(request: SessionRequest): UserScraper {
  const { target } = request
  if (target.type === 'tweetReaction') {
    return new TweetReactedUserScraper(target)
  }
  if (target.user.blocked_by) {
    return new AntiBlockScraper(target.user, target.list)
  }
  if (target.list === 'mutual-followers') {
    return new MutualFollowerScraper(target.user)
  }
  return new SimpleScraper(target.user, target.list)
}
