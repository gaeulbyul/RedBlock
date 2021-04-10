import * as UserScrapingAPI from '../user-scraping-api.js'
import {
  getFollowersCount,
  getReactionsCount,
  wrapEitherRight,
  findNonLinkedMentionsFromTweet,
} from '../../common.js'

export interface UserIdScraper {
  totalCount: number | null
  [Symbol.asyncIterator](): ScrapedUserIdsIterator
}

function convertUsersObjectToIdsObject({ users }: UsersObject): UserIdsObject {
  const ids = users.map(({ id_str }) => id_str)
  return { ids }
}

// 단순 스크래퍼. 기존 체인블락 방식
class SimpleScraper implements UserIdScraper {
  private scrapingClient = new UserScrapingAPI.UserScrapingAPIClient(
    this.request.retriever.twClient
  )
  public totalCount: number
  public constructor(private request: FollowerBlockSessionRequest) {
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
  private scrapingClient = new UserScrapingAPI.UserScrapingAPIClient(
    this.request.retriever.twClient
  )
  public totalCount: number | null = null
  public constructor(private request: FollowerBlockSessionRequest) {}
  public async *[Symbol.asyncIterator]() {
    const mutualFollowersIds = await this.scrapingClient.getAllMutualFollowersIds(
      this.request.target.user
    )
    this.totalCount = mutualFollowersIds.length
    yield wrapEitherRight({ ids: mutualFollowersIds })
  }
}

// 트윗반응 유저 스크래퍼
class TweetReactedUserScraper implements UserIdScraper {
  private scrapingClient = new UserScrapingAPI.UserScrapingAPIClient(
    this.request.retriever.twClient
  )
  public totalCount: number
  public constructor(private request: TweetReactionBlockSessionRequest) {
    this.totalCount = getReactionsCount(request.target)
  }
  public async *[Symbol.asyncIterator]() {
    const {
      tweet,
      blockRetweeters,
      blockLikers,
      blockMentionedUsers,
      blockQuotedUsers,
      blockNonLinkedMentions,
    } = this.request.target
    if (blockRetweeters) {
      const { ids } = await this.request.retriever.twClient.getRetweetersIds(tweet)
      yield wrapEitherRight({ ids })
    }
    if (blockLikers) {
      // 마음에 들어하는 유저의 ID를 가져오는 API는 따로 없더라.
      // 기존에 쓰던 API를 활용하여 user id만 yield해준다.
      for await (const response of this.scrapingClient.getAllReactedUserList('liked', tweet)) {
        if (response.ok) {
          const ids = convertUsersObjectToIdsObject(response.value)
          yield wrapEitherRight(ids)
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
    if (blockQuotedUsers) {
      for await (const response of this.scrapingClient.getQuotedUsers(tweet)) {
        if (response.ok) {
          const ids = convertUsersObjectToIdsObject(response.value)
          yield wrapEitherRight(ids)
        } else {
          yield response
        }
      }
    }
    if (blockNonLinkedMentions) {
      const userNames = findNonLinkedMentionsFromTweet(this.request.target.tweet)
      for await (const response of this.scrapingClient.lookupUsersByNames(userNames)) {
        if (response.ok) {
          const ids = convertUsersObjectToIdsObject(response.value)
          yield wrapEitherRight(ids)
        } else {
          yield response
        }
      }
    }
  }
}

// NOTE: 나중가면 export 외의 다른 목적으로 id scraper를 사용할 지도 모른다.
export function initIdScraper(request: ExportableSessionRequest): UserIdScraper {
  const { target } = request
  if (target.type === 'tweet_reaction') {
    return new TweetReactedUserScraper(request as TweetReactionBlockSessionRequest)
  }
  if (target.list === 'mutual-followers') {
    return new MutualFollowerScraper(request as FollowerBlockSessionRequest)
  }
  return new SimpleScraper(request as FollowerBlockSessionRequest)
}
