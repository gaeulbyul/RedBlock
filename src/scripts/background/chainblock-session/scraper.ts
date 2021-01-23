import { TwClient } from '../twitter-api.js'
import * as i18n from '../../i18n.js'
import * as CookieHandler from '../cookie-handler.js'
import * as UserScrapingAPI from '../user-scraping-api.js'
import * as ExtraScraper from './extra-scraper.js'
import { getFollowersCount, getReactionsCount } from '../../common.js'

export interface UserScraper {
  totalCount: number | null
  [Symbol.asyncIterator](): ScrapedUsersIterator
}

// 단순 스크래퍼. 기존 체인블락 방식
class SimpleScraper implements UserScraper {
  private scrapingClient = new UserScrapingAPI.UserScrapingAPIClient(this.twClient)
  public totalCount: number
  public constructor(private twClient: TwClient, private request: FollowerBlockSessionRequest) {
    const { user, list: followKind } = this.request.target
    this.totalCount = getFollowersCount(user, followKind)!
  }
  public async *[Symbol.asyncIterator]() {
    const { user, list: followKind } = this.request.target
    let scraper: ScrapedUsersIterator = this.scrapingClient.getAllFollowsUserList(followKind, user)
    scraper = ExtraScraper.scrapeUsersOnBio(
      this.scrapingClient,
      scraper,
      this.request.options.includeUsersInBio
    )
    yield* scraper
  }
}

// 맞팔로우 스크래퍼
class MutualFollowerScraper implements UserScraper {
  private scrapingClient = new UserScrapingAPI.UserScrapingAPIClient(this.twClient)
  public totalCount: number | null = null
  public constructor(private twClient: TwClient, private request: FollowerBlockSessionRequest) {}
  public async *[Symbol.asyncIterator]() {
    const mutualFollowersIds = await this.scrapingClient.getAllMutualFollowersIds(
      this.request.target.user
    )
    this.totalCount = mutualFollowersIds.length
    let scraper: ScrapedUsersIterator = this.scrapingClient.lookupUsersByIds(mutualFollowersIds)
    scraper = ExtraScraper.scrapeUsersOnBio(
      this.scrapingClient,
      scraper,
      this.request.options.includeUsersInBio
    )
    yield* scraper
  }
}

// 차단상대 대상 스크래퍼
class AntiBlockScraper implements UserScraper {
  private scrapingClient = new UserScrapingAPI.UserScrapingAPIClient(this.twClient)
  public totalCount: number | null = null
  public constructor(private twClient: TwClient, private request: FollowerBlockSessionRequest) {}
  private async getMutualFollowersIdsWith(
    secondaryScrapingClient: UserScrapingAPI.UserScrapingAPIClient
  ) {
    const mutualFollowerIds = await secondaryScrapingClient.getAllMutualFollowersIds(
      this.request.target.user
    )
    return mutualFollowerIds
  }
  private async getFollowersIdsWith(
    secondaryScrapingClient: UserScrapingAPI.UserScrapingAPIClient
  ) {
    const { user, list: followKind } = this.request.target
    const idsIterator = secondaryScrapingClient.getAllFollowsIds(followKind, user)
    const userIds: string[] = []
    for await (const response of idsIterator) {
      if (!response.ok) {
        throw response.error
      }
      userIds.push(...response.value.ids)
    }
    return userIds
  }
  private async prepareActor(): Promise<TwClient | null> {
    const targetUserId = this.request.target.user.id_str
    const multiCookies = await CookieHandler.getMultiAccountCookies()
    if (multiCookies) {
      const actorUserIds = Object.keys(multiCookies)
      for (const actAsUserId of actorUserIds) {
        const secondaryTwitterClient = new TwClient({
          cookieStoreId: this.request.cookieOptions.cookieStoreId,
          actAsUserId,
        })
        const target = await secondaryTwitterClient
          .getSingleUser({ user_id: targetUserId })
          .catch(() => null)
        if (target && !target.blocked_by) {
          return secondaryTwitterClient
        }
      }
    }
    return null
  }
  private async fetchFollowersIds(): Promise<string[]> {
    const { list: followKind } = this.request.target
    let userIds: string[]
    const secondaryTwClient = await this.prepareActor()
    if (!secondaryTwClient) {
      throw new Error(i18n.getMessage('cant_chainblock_to_blocked'))
    }
    const secondaryScrapingClient = new UserScrapingAPI.UserScrapingAPIClient(secondaryTwClient)
    if (followKind === 'mutual-followers') {
      userIds = await this.getMutualFollowersIdsWith(secondaryScrapingClient)
    } else {
      userIds = await this.getFollowersIdsWith(secondaryScrapingClient)
    }
    this.totalCount = userIds.length
    return userIds
  }
  public async *[Symbol.asyncIterator]() {
    const userIds = await this.fetchFollowersIds()
    let scraper: ScrapedUsersIterator = this.scrapingClient.lookupUsersByIds(userIds)
    scraper = ExtraScraper.scrapeUsersOnBio(
      this.scrapingClient,
      scraper,
      this.request.options.includeUsersInBio
    )
    yield* scraper
  }
}

// 트윗반응 유저 스크래퍼
class TweetReactedUserScraper implements UserScraper {
  private scrapingClient = new UserScrapingAPI.UserScrapingAPIClient(this.twClient)
  public totalCount: number
  public constructor(
    private twClient: TwClient,
    private request: TweetReactionBlockSessionRequest
  ) {
    this.totalCount = getReactionsCount(request.target)
  }
  public async *[Symbol.asyncIterator]() {
    const { tweet, blockRetweeters, blockLikers, blockMentionedUsers } = this.request.target
    let scraper: ScrapedUsersIterator
    if (blockRetweeters) {
      scraper = this.scrapingClient.getAllReactedUserList('retweeted', tweet)
      scraper = ExtraScraper.scrapeUsersOnBio(
        this.scrapingClient,
        scraper,
        this.request.options.includeUsersInBio
      )
      yield* scraper
    }
    if (blockLikers) {
      scraper = this.scrapingClient.getAllReactedUserList('liked', tweet)
      scraper = ExtraScraper.scrapeUsersOnBio(
        this.scrapingClient,
        scraper,
        this.request.options.includeUsersInBio
      )
      yield* scraper
    }
    if (blockMentionedUsers) {
      const mentions = tweet.entities.user_mentions || []
      const mentionedUserIds = mentions.map(e => e.id_str)
      scraper = this.scrapingClient.lookupUsersByIds(mentionedUserIds)
      scraper = ExtraScraper.scrapeUsersOnBio(
        this.scrapingClient,
        scraper,
        this.request.options.includeUsersInBio
      )
      yield* scraper
    }
  }
}

class ImportUserScraper implements UserScraper {
  private scrapingClient = new UserScrapingAPI.UserScrapingAPIClient(this.twClient)
  public totalCount = this.request.target.userIds.length
  public constructor(private twClient: TwClient, private request: ImportBlockSessionRequest) {}
  public async *[Symbol.asyncIterator]() {
    let scraper: ScrapedUsersIterator = this.scrapingClient.lookupUsersByIds(
      this.request.target.userIds
    )
    scraper = ExtraScraper.scrapeUsersOnBio(
      this.scrapingClient,
      scraper,
      this.request.options.includeUsersInBio
    )
    yield* scraper
  }
}

class UserSearchScraper implements UserScraper {
  private scrapingClient = new UserScrapingAPI.UserScrapingAPIClient(this.twClient)
  public totalCount = null
  public constructor(private twClient: TwClient, private request: UserSearchBlockSessionRequest) {}
  public async *[Symbol.asyncIterator]() {
    let scraper: ScrapedUsersIterator = this.scrapingClient.getUserSearchResults(
      this.request.target.query
    )
    scraper = ExtraScraper.scrapeUsersOnBio(
      this.scrapingClient,
      scraper,
      this.request.options.includeUsersInBio
    )
    yield* scraper
  }
}

export function initScraper(twClient: TwClient, request: SessionRequest): UserScraper {
  const { target } = request
  if (target.type === 'import') {
    return new ImportUserScraper(twClient, request as ImportBlockSessionRequest)
  }
  if (target.type === 'tweet_reaction') {
    return new TweetReactedUserScraper(twClient, request as TweetReactionBlockSessionRequest)
  }
  if (target.type === 'user_search') {
    return new UserSearchScraper(twClient, request as UserSearchBlockSessionRequest)
  }
  if (target.user.blocked_by) {
    return new AntiBlockScraper(twClient, request as FollowerBlockSessionRequest)
  }
  if (target.list === 'mutual-followers') {
    return new MutualFollowerScraper(twClient, request as FollowerBlockSessionRequest)
  }
  return new SimpleScraper(twClient, request as FollowerBlockSessionRequest)
}
