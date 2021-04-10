import * as UserScrapingAPI from '../user-scraping-api.js'
import * as ExtraScraper from './extra-scraper.js'
import {
  getFollowersCount,
  getReactionsCount,
  assertNever,
  findNonLinkedMentionsFromTweet,
} from '../../common.js'

export interface UserScraper {
  totalCount: number | null
  [Symbol.asyncIterator](): ScrapedUsersIterator
}

// 단순 스크래퍼. 기존 체인블락 방식
class SimpleScraper implements UserScraper {
  private retrieverScrapingClient = UserScrapingAPI.UserScrapingAPIClient.fromCookieOptions(
    this.request.retriever.cookieOptions
  )
  private executorScrapingClient = UserScrapingAPI.UserScrapingAPIClient.fromCookieOptions(
    this.request.executor.cookieOptions
  )
  public totalCount: number
  public constructor(private request: FollowerBlockSessionRequest | LockPickerSessionRequest) {
    const { user, list: followKind } = this.request.target
    this.totalCount = getFollowersCount(user, followKind)!
  }
  public async *[Symbol.asyncIterator]() {
    const { user } = this.request.target
    if (user.blocked_by) {
      yield* this.iterateAntiblock()
    } else {
      yield* this.iterateNormally()
    }
  }
  private async *iterateNormally() {
    const { user, list: followKind } = this.request.target
    let scraper: ScrapedUsersIterator = this.executorScrapingClient.getAllFollowsUserList(
      followKind,
      user
    )
    scraper = ExtraScraper.scrapeUsersOnBio(
      this.executorScrapingClient,
      scraper,
      this.request.extraTarget.bioBlock
    )
    yield* scraper
  }
  private async *iterateAntiblock() {
    const { user, list: followKind } = this.request.target
    const idsIterator = this.retrieverScrapingClient.getAllFollowsIds(followKind, user)
    for await (const response of idsIterator) {
      if (!response.ok) {
        throw response.error
      }
      const userIds = response.value.ids
      let scraper: ScrapedUsersIterator = this.executorScrapingClient.lookupUsersByIds(userIds)
      scraper = ExtraScraper.scrapeUsersOnBio(
        this.executorScrapingClient,
        scraper,
        this.request.extraTarget.bioBlock
      )
      yield* scraper
    }
  }
}

// 맞팔로우 스크래퍼
class MutualFollowerScraper implements UserScraper {
  private retrieverScrapingClient = UserScrapingAPI.UserScrapingAPIClient.fromCookieOptions(
    this.request.retriever.cookieOptions
  )
  private executorScrapingClient = UserScrapingAPI.UserScrapingAPIClient.fromCookieOptions(
    this.request.executor.cookieOptions
  )
  public totalCount: number | null = null
  public constructor(private request: FollowerBlockSessionRequest) {}
  public async *[Symbol.asyncIterator]() {
    const { user } = this.request.target
    let mutualFollowersIds: string[]
    if (user.blocked_by) {
      mutualFollowersIds = await this.getMutualFollowersIdsAntiblock()
    } else {
      mutualFollowersIds = await this.getMutualFollowersIdsNormally()
    }
    this.totalCount = mutualFollowersIds.length
    let scraper: ScrapedUsersIterator = this.executorScrapingClient.lookupUsersByIds(
      mutualFollowersIds
    )
    scraper = ExtraScraper.scrapeUsersOnBio(
      this.executorScrapingClient,
      scraper,
      this.request.extraTarget.bioBlock
    )
    yield* scraper
  }
  private async getMutualFollowersIdsNormally() {
    return this.executorScrapingClient.getAllMutualFollowersIds(this.request.target.user)
  }
  private async getMutualFollowersIdsAntiblock() {
    return this.retrieverScrapingClient.getAllMutualFollowersIds(this.request.target.user)
  }
}

// 트윗반응 유저 스크래퍼
class TweetReactedUserScraper implements UserScraper {
  private retrieverScrapingClient = UserScrapingAPI.UserScrapingAPIClient.fromCookieOptions(
    this.request.retriever.cookieOptions
  )
  private executorScrapingClient = UserScrapingAPI.UserScrapingAPIClient.fromCookieOptions(
    this.request.executor.cookieOptions
  )
  public totalCount: number
  public constructor(private request: TweetReactionBlockSessionRequest) {
    this.totalCount = getReactionsCount(request.target)
  }
  public async *[Symbol.asyncIterator]() {
    let reactions = this.fetchReactions()
    const isAntiblock = this.request.retriever.user.id_str !== this.request.executor.user.id_str
    if (isAntiblock) {
      reactions = this.rehydrate(reactions)
    }
    yield* reactions
  }
  private async *rehydrate(scraper: ScrapedUsersIterator): ScrapedUsersIterator {
    // retriever를 갖고 가져온 유저들은 followed_by, blocking 등이 retriever기준으로 되어있다.
    // 실제로 필요한건 executor기준으로 된 값이므로 유저를 다시 가져온다.
    const userIds = new Set<string>()
    for await (const response of scraper) {
      if (!response.ok) {
        continue
      }
      response.value.users.forEach(({ id_str }) => userIds.add(id_str))
    }
    const rehydrateScraper = this.executorScrapingClient.lookupUsersByIds(Array.from(userIds))
    yield* rehydrateScraper
  }
  private async *fetchReactions(): ScrapedUsersIterator {
    const {
      tweet,
      blockRetweeters,
      blockLikers,
      blockMentionedUsers,
      blockQuotedUsers,
      blockNonLinkedMentions,
    } = this.request.target
    const scrapers: ScrapedUsersIterator[] = []
    if (blockRetweeters) {
      scrapers.push(this.retrieverScrapingClient.getAllReactedUserList('retweeted', tweet))
    }
    if (blockLikers) {
      scrapers.push(this.retrieverScrapingClient.getAllReactedUserList('liked', tweet))
    }
    if (blockMentionedUsers) {
      const mentions = tweet.entities.user_mentions || []
      const mentionedUserIds = mentions.map(e => e.id_str)
      scrapers.push(this.retrieverScrapingClient.lookupUsersByIds(mentionedUserIds))
    }
    if (blockQuotedUsers) {
      scrapers.push(this.retrieverScrapingClient.getQuotedUsers(tweet))
    }
    if (blockNonLinkedMentions) {
      const userNames = findNonLinkedMentionsFromTweet(this.request.target.tweet)
      scrapers.push(this.retrieverScrapingClient.lookupUsersByNames(userNames))
    }
    for (const scraper of scrapers) {
      yield* ExtraScraper.scrapeUsersOnBio(
        this.retrieverScrapingClient,
        scraper,
        this.request.extraTarget.bioBlock
      )
    }
  }
}

class ImportUserScraper implements UserScraper {
  private scrapingClient = UserScrapingAPI.UserScrapingAPIClient.fromCookieOptions(
    this.request.executor.cookieOptions
  )
  public totalCount = this.request.target.userIds.length + this.request.target.userNames.length
  public constructor(private request: ImportBlockSessionRequest) {}
  public async *[Symbol.asyncIterator]() {
    // 여러 파일을 import한다면 유저ID와 유저네임 둘 다 있을 수 있다.
    const { userIds, userNames } = this.request.target
    let scraper: ScrapedUsersIterator
    if (userIds.length > 0) {
      scraper = this.scrapingClient.lookupUsersByIds(userIds)
      scraper = ExtraScraper.scrapeUsersOnBio(
        this.scrapingClient,
        scraper,
        this.request.extraTarget.bioBlock
      )
      yield* scraper
    }
    if (userNames.length > 0) {
      scraper = this.scrapingClient.lookupUsersByNames(userNames)
      scraper = ExtraScraper.scrapeUsersOnBio(
        this.scrapingClient,
        scraper,
        this.request.extraTarget.bioBlock
      )
      yield* scraper
    }
  }
}

class UserSearchScraper implements UserScraper {
  private scrapingClient = UserScrapingAPI.UserScrapingAPIClient.fromCookieOptions(
    this.request.executor.cookieOptions
  )
  public totalCount = null
  public constructor(private request: UserSearchBlockSessionRequest) {}
  public async *[Symbol.asyncIterator]() {
    let scraper: ScrapedUsersIterator = this.scrapingClient.getUserSearchResults(
      this.request.target.query
    )
    scraper = ExtraScraper.scrapeUsersOnBio(
      this.scrapingClient,
      scraper,
      this.request.extraTarget.bioBlock
    )
    yield* scraper
  }
}

export function initScraper(request: SessionRequest): UserScraper {
  const { target } = request
  switch (target.type) {
    case 'import':
      return new ImportUserScraper(request as ImportBlockSessionRequest)
    case 'tweet_reaction':
      return new TweetReactedUserScraper(request as TweetReactionBlockSessionRequest)
    case 'user_search':
      return new UserSearchScraper(request as UserSearchBlockSessionRequest)
    case 'lockpicker':
      return new SimpleScraper(request as LockPickerSessionRequest)
    case 'follower':
      if (target.list === 'mutual-followers') {
        return new MutualFollowerScraper(request as FollowerBlockSessionRequest)
      } else {
        return new SimpleScraper(request as FollowerBlockSessionRequest)
      }
    default:
      assertNever(target)
  }
}
