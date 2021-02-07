import { TwClient } from '../twitter-api.js'
import * as i18n from '../../i18n.js'
import * as CookieHandler from '../cookie-handler.js'
import * as UserScrapingAPI from '../user-scraping-api.js'
import * as ExtraScraper from './extra-scraper.js'
import { getFollowersCount, getReactionsCount, assertNever } from '../../common.js'

export interface UserScraper {
  totalCount: number | null
  [Symbol.asyncIterator](): ScrapedUsersIterator
}

// 단순 스크래퍼. 기존 체인블락 방식
class SimpleScraper implements UserScraper {
  private scrapingClient = new UserScrapingAPI.UserScrapingAPIClient(this.twClient)
  public totalCount: number
  public constructor(
    private twClient: TwClient,
    private request: FollowerBlockSessionRequest | LockPickerSessionRequest
  ) {
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
    const cookieStores = await browser.cookies.getAllCookieStores()
    for (const store of cookieStores) {
      const cookieStoreId = store.id
      // 컨테이너에 트위터 계정을 하나만 로그인한 경우, auth_multi 쿠키가 없어 서
      // getMultiAccountCookies 함수가 null 을 리턴한다.
      const secondaryTwClients: TwClient[] = [new TwClient({ cookieStoreId })]
      const multiCookies = await CookieHandler.getMultiAccountCookies({ cookieStoreId })
      if (multiCookies) {
        const actorUserIds = Object.keys(multiCookies)
        for (const actAsUserId of actorUserIds) {
          secondaryTwClients.push(
            new TwClient({
              cookieStoreId,
              actAsUserId,
            })
          )
        }
      }
      console.debug(
        '[AntiBlock]: storeId: "%s" multiCookies:%o clients:%o',
        cookieStoreId,
        multiCookies,
        secondaryTwClients
      )
      for (const secondaryTwClient of secondaryTwClients) {
        console.debug('[AntiBlock]: secondaryTwClient:%o', secondaryTwClient)
        const secondaryMyself = await secondaryTwClient.getMyself().catch(() => null)
        if (!secondaryMyself) {
          console.debug('[AntiBlock]: login check failed')
          continue
        }
        if (secondaryMyself.id_str === this.request.myself.id_str) {
          continue
        }
        const target = await secondaryTwClient
          .getSingleUser({ user_id: targetUserId })
          .catch(() => null)
        if (target && !target.blocked_by) {
          console.debug('[AntiBlock]: Found! will use %o', secondaryTwClient)
          return secondaryTwClient
        }
      }
    }
    return null
  }
  private async fetchFollowersIds(
    secondaryScrapingClient: UserScrapingAPI.UserScrapingAPIClient
  ): Promise<string[]> {
    let userIds: string[]
    const { list: followKind } = this.request.target
    if (followKind === 'mutual-followers') {
      userIds = await this.getMutualFollowersIdsWith(secondaryScrapingClient)
    } else {
      userIds = await this.getFollowersIdsWith(secondaryScrapingClient)
    }
    this.totalCount = userIds.length
    return userIds
  }
  public async *[Symbol.asyncIterator]() {
    const secondaryTwClient = await this.prepareActor()
    if (!secondaryTwClient) {
      throw new Error(i18n.getMessage('cant_chainblock_to_blocked'))
    }
    const secondaryScrapingClient = new UserScrapingAPI.UserScrapingAPIClient(secondaryTwClient)
    const userIds = await this.fetchFollowersIds(secondaryScrapingClient)
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
    // 여러 파일을 import한다면 유저ID와 유저네임 둘 다 있을 수 있다.
    const { userIds, userNames } = this.request.target
    let scraper: ScrapedUsersIterator
    if (userIds.length > 0) {
      scraper = this.scrapingClient.lookupUsersByIds(userIds)
      scraper = ExtraScraper.scrapeUsersOnBio(
        this.scrapingClient,
        scraper,
        this.request.options.includeUsersInBio
      )
      yield* scraper
    }
    if (userNames.length > 0) {
      scraper = this.scrapingClient.lookupUsersByNames(userNames)
      scraper = ExtraScraper.scrapeUsersOnBio(
        this.scrapingClient,
        scraper,
        this.request.options.includeUsersInBio
      )
      yield* scraper
    }
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
  switch (target.type) {
    case 'import':
      return new ImportUserScraper(twClient, request as ImportBlockSessionRequest)
    case 'tweet_reaction':
      return new TweetReactedUserScraper(twClient, request as TweetReactionBlockSessionRequest)
    case 'user_search':
      return new UserSearchScraper(twClient, request as UserSearchBlockSessionRequest)
    case 'lockpicker':
      return new SimpleScraper(twClient, request as LockPickerSessionRequest)
    case 'follower':
      break
    default:
      assertNever(target)
  }
  if (target.user.blocked_by) {
    return new AntiBlockScraper(twClient, request as FollowerBlockSessionRequest)
  }
  if (target.list === 'mutual-followers') {
    return new MutualFollowerScraper(twClient, request as FollowerBlockSessionRequest)
  }
  return new SimpleScraper(twClient, request as FollowerBlockSessionRequest)
}
