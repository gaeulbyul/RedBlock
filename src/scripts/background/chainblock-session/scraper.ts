// import * as TwitterAPI from '../twitter-api.js'
// import * as i18n from '../../i18n.js'
// 위 import는 AntiblockScraper에서 사용하던 거
import * as UserScrapingAPI from '../user-scraping-api.js'
import * as ExtraScraper from './extra-scraper.js'
import { getFollowersCount, getReactionsCount } from '../../common.js'
import { SessionRequest } from './session.js'

export interface UserScraper {
  totalCount: number | null
  [Symbol.asyncIterator](): ScrapedUsersIterator
}

// 단순 스크래퍼. 기존 체인블락 방식
class SimpleScraper implements UserScraper {
  public totalCount: number
  constructor(private request: FollowerBlockSessionRequest) {
    const { user, list: followKind } = this.request.target
    this.totalCount = getFollowersCount(user, followKind)!
  }
  public async *[Symbol.asyncIterator]() {
    const { user, list: followKind } = this.request.target
    let scraper: ScrapedUsersIterator = UserScrapingAPI.getAllFollowsUserList(followKind, user)
    scraper = ExtraScraper.scrapeUsersOnBio(scraper, this.request.options.includeUsersInBio)
    yield* scraper
  }
}

// 맞팔로우 스크래퍼
class MutualFollowerScraper implements UserScraper {
  public totalCount: number | null = null
  public constructor(private request: FollowerBlockSessionRequest) {}
  public async *[Symbol.asyncIterator]() {
    const mutualFollowersIds = await UserScrapingAPI.getAllMutualFollowersIds(
      this.request.target.user
    )
    this.totalCount = mutualFollowersIds.length
    let scraper: ScrapedUsersIterator = UserScrapingAPI.lookupUsersByIds(mutualFollowersIds)
    scraper = ExtraScraper.scrapeUsersOnBio(scraper, this.request.options.includeUsersInBio)
    yield* scraper
  }
}

// 차단상대 대상 스크래퍼
/*
class AntiBlockScraper implements UserScraper {
  public totalCount: number | null = null
  constructor(private request: FollowerBlockSessionRequest) {}
  private async getMutualFollowersIds(actAsUserId: string) {
    const mutualFollowerIds = await UserScrapingAPI.getAllMutualFollowersIds(
      this.request.target.user,
      actAsUserId
    )
    return mutualFollowerIds
  }
  private async getFollowersIds(actAsUserId: string) {
    const { user, list: followKind } = this.request.target
    const idsIterator = UserScrapingAPI.getAllFollowsIds(followKind, user, { actAsUserId })
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
    if (multiCookies) {
      const actorUserIds = Object.keys(multiCookies)
      for (const actorId of actorUserIds) {
        const target = await TwitterAPI.getSingleUserById(
          this.request.target.user.id_str,
          actorId
        ).catch(() => null)
        if (target && !target.blocked_by) {
          return actorId
        }
      }
    }
    throw new Error(i18n.getMessage('cant_chainblock_to_blocked'))
  }
  private async fetchFollowersIds(): Promise<string[]> {
    const { list: followKind } = this.request.target
    let userIds: string[]
    const actAsUserId = await this.prepareActor()
    if (followKind === 'mutual-followers') {
      userIds = await this.getMutualFollowersIds(actAsUserId)
    } else {
      userIds = await this.getFollowersIds(actAsUserId)
    }
    this.totalCount = userIds.length
    return userIds
  }
  public async *[Symbol.asyncIterator]() {
    const userIds = await this.fetchFollowersIds()
    let scraper: ScrapedUsersIterator = UserScrapingAPI.lookupUsersByIds(userIds)
    scraper = ExtraScraper.scrapeUsersOnBio(scraper, this.request.options.includeUsersInBio)
    yield* scraper
  }
}
*/

// 트윗반응 유저 스크래퍼
class TweetReactedUserScraper implements UserScraper {
  public totalCount: number
  constructor(private request: TweetReactionBlockSessionRequest) {
    this.totalCount = getReactionsCount(request.target)
  }
  public async *[Symbol.asyncIterator]() {
    const { tweet, blockRetweeters, blockLikers, blockMentionedUsers } = this.request.target
    let scraper: ScrapedUsersIterator
    if (blockRetweeters) {
      scraper = UserScrapingAPI.getAllReactedUserList('retweeted', tweet)
      scraper = ExtraScraper.scrapeUsersOnBio(scraper, this.request.options.includeUsersInBio)
      yield* scraper
    }
    if (blockLikers) {
      scraper = UserScrapingAPI.getAllReactedUserList('liked', tweet)
      scraper = ExtraScraper.scrapeUsersOnBio(scraper, this.request.options.includeUsersInBio)
      yield* scraper
    }
    if (blockMentionedUsers) {
      const mentions = tweet.entities.user_mentions || []
      const mentionedUserIds = mentions.map(e => e.id_str)
      scraper = UserScrapingAPI.lookupUsersByIds(mentionedUserIds)
      scraper = ExtraScraper.scrapeUsersOnBio(scraper, this.request.options.includeUsersInBio)
      yield* scraper
    }
  }
}

class ImportUserScraper implements UserScraper {
  public totalCount = this.request.target.userIds.length
  constructor(private request: ImportBlockSessionRequest) {}
  public async *[Symbol.asyncIterator]() {
    let scraper: ScrapedUsersIterator = UserScrapingAPI.lookupUsersByIds(
      this.request.target.userIds
    )
    scraper = ExtraScraper.scrapeUsersOnBio(scraper, this.request.options.includeUsersInBio)
    yield* scraper
  }
}

export function initScraper(request: SessionRequest): UserScraper {
  const { target } = request
  if (target.type === 'import') {
    return new ImportUserScraper(request as ImportBlockSessionRequest)
  }
  if (target.type === 'tweet_reaction') {
    return new TweetReactedUserScraper(request as TweetReactionBlockSessionRequest)
  }
  if (target.user.blocked_by) {
    // 작동X
    // return new AntiBlockScraper(request as FollowerBlockSessionRequest)
  }
  if (target.list === 'mutual-followers') {
    return new MutualFollowerScraper(request as FollowerBlockSessionRequest)
  }
  return new SimpleScraper(request as FollowerBlockSessionRequest)
}
