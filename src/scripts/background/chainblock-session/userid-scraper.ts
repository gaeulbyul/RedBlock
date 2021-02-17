import { TwClient } from '../twitter-api.js'
import * as CookieHandler from '../cookie-handler.js'
import * as UserScrapingAPI from '../user-scraping-api.js'
import * as i18n from '../../i18n.js'
import { getFollowersCount, getReactionsCount, wrapEitherRight } from '../../common.js'

export interface UserIdScraper {
  totalCount: number | null
  [Symbol.asyncIterator](): ScrapedUserIdsIterator
}

// 단순 스크래퍼. 기존 체인블락 방식
class SimpleScraper implements UserIdScraper {
  private scrapingClient = new UserScrapingAPI.UserScrapingAPIClient(this.twClient)
  public totalCount: number
  public constructor(private twClient: TwClient, private request: FollowerBlockSessionRequest) {
    const { user, list: followKind } = this.request.target
    this.totalCount = getFollowersCount(user, followKind)!
  }
  public async *[Symbol.asyncIterator]() {
    const { user, list: followKind } = this.request.target
    yield* this.scrapingClient.getAllFollowsIds(followKind, user)
  }
}

// 맞팔로우 스크래퍼
class MutualFollowerScraper implements UserIdScraper {
  private scrapingClient = new UserScrapingAPI.UserScrapingAPIClient(this.twClient)
  public totalCount: number | null = null
  public constructor(private twClient: TwClient, private request: FollowerBlockSessionRequest) {}
  public async *[Symbol.asyncIterator]() {
    const mutualFollowersIds = await this.scrapingClient.getAllMutualFollowersIds(
      this.request.target.user
    )
    this.totalCount = mutualFollowersIds.length
    yield wrapEitherRight({ ids: mutualFollowersIds })
  }
}

// 차단상대 대상 스크래퍼
class AntiBlockScraper implements UserIdScraper {
  public totalCount: number | null = null
  public constructor(private request: FollowerBlockSessionRequest) {}
  private async *getMutualFollowersIdsWith(
    secondaryScrapingClient: UserScrapingAPI.UserScrapingAPIClient
  ) {
    const mutualFollowerIds = await secondaryScrapingClient.getAllMutualFollowersIds(
      this.request.target.user
    )
    yield wrapEitherRight({ ids: mutualFollowerIds })
  }
  private async *getFollowersIdsWith(
    secondaryScrapingClient: UserScrapingAPI.UserScrapingAPIClient
  ) {
    const { user, list: followKind } = this.request.target
    yield* secondaryScrapingClient.getAllFollowsIds(followKind, user)
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
  private async *fetchFollowersIds(secondaryScrapingClient: UserScrapingAPI.UserScrapingAPIClient) {
    const { user, list: followKind } = this.request.target
    if (followKind === 'mutual-followers') {
      yield* this.getMutualFollowersIdsWith(secondaryScrapingClient)
    } else {
      this.totalCount = getFollowersCount(user, followKind)!
      yield* this.getFollowersIdsWith(secondaryScrapingClient)
    }
  }
  public async *[Symbol.asyncIterator]() {
    const secondaryTwClient = await this.prepareActor()
    if (!secondaryTwClient) {
      throw new Error(i18n.getMessage('cant_chainblock_to_blocked'))
    }
    const secondaryScrapingClient = new UserScrapingAPI.UserScrapingAPIClient(secondaryTwClient)
    yield* this.fetchFollowersIds(secondaryScrapingClient)
  }
}

// 트윗반응 유저 스크래퍼
class TweetReactedUserScraper implements UserIdScraper {
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
    if (blockRetweeters) {
      const { ids } = await this.twClient.getRetweetersIds(tweet)
      yield wrapEitherRight({ ids })
    }
    if (blockLikers) {
      // 마음에 들어하는 유저의 ID를 가져오는 API는 따로 없더라.
      // 기존에 쓰던 API를 활용하여 user id만 yield해준다.
      for await (const response of this.scrapingClient.getAllReactedUserList('liked', tweet)) {
        if (response.ok) {
          const { users } = response.value
          yield wrapEitherRight({
            ids: users.map(({ id_str }) => id_str),
          })
        } else {
          yield response
        }
      }
    }
    if (blockMentionedUsers) {
      const mentions = tweet.entities.user_mentions || []
      yield wrapEitherRight({
        ids: mentions.map(e => e.id_str),
      })
    }
  }
}

// NOTE: 나중가면 export 외의 다른 목적으로 id scraper를 사용할 지도 모른다.
export function initIdScraper(
  twClient: TwClient,
  request: ExportableSessionRequest
): UserIdScraper {
  const { target } = request
  if (target.type === 'tweet_reaction') {
    return new TweetReactedUserScraper(twClient, request as TweetReactionBlockSessionRequest)
  }
  if (target.user.blocked_by) {
    return new AntiBlockScraper(request as FollowerBlockSessionRequest)
  }
  if (target.list === 'mutual-followers') {
    return new MutualFollowerScraper(twClient, request as FollowerBlockSessionRequest)
  }
  return new SimpleScraper(twClient, request as FollowerBlockSessionRequest)
}
