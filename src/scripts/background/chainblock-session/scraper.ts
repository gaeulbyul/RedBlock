import * as TwitterAPI from '../twitter-api.js'
import { getFollowersCount, getReactionsCount } from '../../common.js'
export { getFollowersCount, getReactionsCount }

type TwitterUser = TwitterAPI.TwitterUser
type Tweet = TwitterAPI.Tweet

type ScrapeResult = AsyncIterableIterator<Either<Error, TwitterUser>>
export interface UserScraper {
  totalCount: number | null
  [Symbol.asyncIterator](): ScrapeResult
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

// 고속 스크래퍼. 최대 200명 이하의 사용자만 가져온다.
export class QuickScraper implements UserScraper {
  private readonly limitCount = 200
  public totalCount: number
  constructor(private user: TwitterUser, private followKind: Exclude<FollowKind, 'mutual-followers'>) {
    this.totalCount = Math.min(this.limitCount, getFollowersCount(user, followKind)!)
  }
  public async *[Symbol.asyncIterator]() {
    let count = 0
    for await (const item of TwitterAPI.getAllFollowsUserList(this.followKind, this.user)) {
      count++
      yield item
      if (count >= this.limitCount) {
        break
      }
    }
  }
}

// 맞팔로우 스크래퍼.
export class MutualFollowerScraper implements UserScraper {
  public totalCount: number | null = null
  constructor(private user: TwitterUser) {}
  public async *[Symbol.asyncIterator]() {
    const mutualFollowersIds = await TwitterAPI.getAllMutualFollowersIds(this.user)
    this.totalCount = mutualFollowersIds.length
    yield* TwitterAPI.lookupUsersByIds(mutualFollowersIds)
  }
}

// 트윗반응 유저 스크래퍼
export class TweetReactedUserScraper implements UserScraper {
  public totalCount: number
  constructor(private tweet: Tweet, private reaction: ReactionKind) {
    this.totalCount = getReactionsCount(tweet, reaction)
  }
  public [Symbol.asyncIterator]() {
    return TwitterAPI.getAllReactedUserList(this.reaction, this.tweet)
  }
}
