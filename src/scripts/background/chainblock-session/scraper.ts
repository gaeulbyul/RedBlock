import * as TwitterAPI from '../twitter-api.js'
import * as UserScrapingAPI from '../user-scraping-api.js'
import * as i18n from '../../i18n.js'
import { getFollowersCount, getReactionsCount } from '../../common.js'
import { SessionRequest } from './session.js'

interface UsersObject {
  users: TwitterUser[]
}

type ScrapedUsersIterator = AsyncIterableIterator<Either<Error, UsersObject>>
export interface UserScraper {
  totalCount: number | null
  [Symbol.asyncIterator](): ScrapedUsersIterator
}

// 단순 스크래퍼. 기존 체인블락 방식
class SimpleScraper implements UserScraper {
  public totalCount: number
  constructor(private user: TwitterUser, private followKind: FollowKind) {
    this.totalCount = getFollowersCount(user, followKind)!
  }
  public [Symbol.asyncIterator]() {
    return UserScrapingAPI.getAllFollowsUserList(this.followKind, this.user)
  }
}

// 맞팔로우 스크래퍼
class MutualFollowerScraper implements UserScraper {
  public totalCount: number | null = null
  public constructor(private user: TwitterUser) {}
  public async *[Symbol.asyncIterator]() {
    const mutualFollowersIds = await UserScrapingAPI.getAllMutualFollowersIds(this.user)
    this.totalCount = mutualFollowersIds.length
    yield* UserScrapingAPI.lookupUsersByIds(mutualFollowersIds)
  }
}

// 차단상대 대상 스크래퍼
class AntiBlockScraper implements UserScraper {
  public totalCount: number | null = null
  constructor(private user: TwitterUser, private followKind: FollowKind) {}
  private async getMutualFollowersIds(actAsUserId: string) {
    const mutualFollowerIds = await UserScrapingAPI.getAllMutualFollowersIds(this.user, actAsUserId)
    return mutualFollowerIds
  }
  private async getFollowersIds(actAsUserId: string) {
    const idsIterator = UserScrapingAPI.getAllFollowsIds(this.followKind, this.user, { actAsUserId })
    const userIds: string[] = []
    for await (const response of idsIterator) {
      if (!response.ok) {
        throw response.error
      }
      userIds.push(...response.value.ids)
    }
    return userIds
  }
  private async prepareActor() {
    const multiCookies = await TwitterAPI.getMultiAccountCookies()
    const actorUserIds = Object.keys(multiCookies)
    for (const actorId of actorUserIds) {
      const target = await TwitterAPI.getSingleUserById(this.user.id_str, actorId).catch(() => null)
      if (target && !target.blocked_by) {
        return actorId
      }
    }
    throw new Error(i18n.getMessage('cant_chainblock_to_blocked'))
  }
  private async fetchFollowersIds(): Promise<string[]> {
    let userIds: string[]
    const actAsUserId = await this.prepareActor()
    if (this.followKind === 'mutual-followers') {
      userIds = await this.getMutualFollowersIds(actAsUserId)
    } else {
      userIds = await this.getFollowersIds(actAsUserId)
    }
    this.totalCount = userIds.length
    return userIds
  }
  public async *[Symbol.asyncIterator]() {
    const userIds = await this.fetchFollowersIds()
    yield* UserScrapingAPI.lookupUsersByIds(userIds)
  }
}

// 트윗반응 유저 스크래퍼
class TweetReactedUserScraper implements UserScraper {
  public totalCount: number
  constructor(private target: TweetReactionBlockSessionRequest['target']) {
    this.totalCount = getReactionsCount(target)
  }
  public async *[Symbol.asyncIterator]() {
    const { tweet, blockRetweeters, blockLikers } = this.target
    if (blockRetweeters) {
      yield* UserScrapingAPI.getAllReactedUserList('retweeted', tweet)
    }
    if (blockLikers) {
      yield* UserScrapingAPI.getAllReactedUserList('liked', tweet)
    }
  }
}

class ImportUserScraper implements UserScraper {
  public totalCount = this.userIds.length
  constructor(private userIds: string[]) {}
  public [Symbol.asyncIterator]() {
    return UserScrapingAPI.lookupUsersByIds(this.userIds)
  }
}

export function initScraper(request: SessionRequest): UserScraper {
  const { target } = request
  if (target.type === 'import') {
    return new ImportUserScraper(target.userIds)
  }
  if (target.type === 'tweet_reaction') {
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
