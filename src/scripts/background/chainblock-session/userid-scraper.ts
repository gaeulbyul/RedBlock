import { getFollowersCount, wrapEitherRight } from '../../common/utilities'
import * as UserScrapingAPI from '../user-scraping-api'
import { AudioSpaceScraper, TweetReactedUserScraper, UserScraper } from './scraper'

export interface UserIdScraper {
  totalCount: number | null
  [Symbol.asyncIterator](): ScrapedUserIdsIterator
}
class FromUserScraper implements UserIdScraper {
  public get totalCount() {
    return this.userScraper.totalCount
  }

  public constructor(private readonly userScraper: UserScraper) {}
  public async *[Symbol.asyncIterator]() {
    for await (const response of this.userScraper) {
      if (response.ok) {
        const ids = response.value.users.map(({ id_str }) => id_str)
        yield wrapEitherRight({ ids })
      } else {
        yield response
      }
    }
  }
}

// 단순 스크래퍼. 기존 체인블락 방식
class SimpleScraper implements UserIdScraper {
  private scrapingClient = UserScrapingAPI.UserScrapingAPIClient.fromClientOptions(
    this.request.retriever.clientOptions,
  )

  public totalCount: number
  public constructor(private request: SessionRequest<FollowerSessionTarget>) {
    const { user, list: followKind } = request.target
    this.totalCount = getFollowersCount(user, followKind)!
  }

  public async *[Symbol.asyncIterator]() {
    const { user, list: followKind } = this.request.target
    yield* this.scrapingClient.getAllFollowsIds(followKind, user)
  }
}

// 맞팔로우 스크래퍼
class MutualFollowerScraper implements UserIdScraper {
  private scrapingClient = UserScrapingAPI.UserScrapingAPIClient.fromClientOptions(
    this.request.retriever.clientOptions,
  )

  public totalCount: number | null = null
  public constructor(private request: SessionRequest<FollowerSessionTarget>) {}
  public async *[Symbol.asyncIterator]() {
    const mutualFollowersIds = await this.scrapingClient.getAllMutualFollowersIds(
      this.request.target.user,
    )
    this.totalCount = mutualFollowersIds.length
    yield wrapEitherRight({ ids: mutualFollowersIds })
  }
}

class ExportMyBlocklistScraper implements UserIdScraper {
  private scrapingClient = UserScrapingAPI.UserScrapingAPIClient.fromClientOptions(
    this.request.retriever.clientOptions,
  )

  public totalCount: null = null
  public constructor(private request: SessionRequest<ExportMyBlocklistTarget>) {
    this.request.target
  }

  public async *[Symbol.asyncIterator]() {
    yield* this.scrapingClient.getAllBlockedUsersIds()
  }
}

// NOTE: 나중가면 export 외의 다른 목적으로 id scraper를 사용할 지도 모른다.
export function initIdScraper(request: SessionRequest<ExportableSessionTarget>): UserIdScraper {
  const { target } = request
  switch (target.type) {
    case 'export_my_blocklist':
      return new ExportMyBlocklistScraper(request as SessionRequest<ExportMyBlocklistTarget>)
    case 'tweet_reaction':
      return new FromUserScraper(
        new TweetReactedUserScraper(request as SessionRequest<TweetReactionSessionTarget>),
      )
    case 'follower':
      if (target.list === 'mutual-followers') {
        return new MutualFollowerScraper(request as SessionRequest<FollowerSessionTarget>)
      } else {
        return new SimpleScraper(request as SessionRequest<FollowerSessionTarget>)
      }
    case 'audio_space':
      return new FromUserScraper(
        new AudioSpaceScraper(request as SessionRequest<AudioSpaceSessionTarget>),
      )
  }
}
