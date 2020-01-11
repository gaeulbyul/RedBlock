import * as TwitterAPI from '../twitter-api.js'
import { getFollowersCount, getReactionsCount, wrapEither } from '../../common.js'
import { SessionRequest } from './session.js'

type TwitterUser = TwitterAPI.TwitterUser
type Tweet = TwitterAPI.Tweet

type ScrapeResult = AsyncIterableIterator<Either<Error, TwitterUser>>
type UserIdScrapeResult = AsyncIterableIterator<Either<Error, string>>

export interface UserScraper {
  resultType: 'user-object'
  totalCount: number | null
  [Symbol.asyncIterator](): ScrapeResult
}

export interface UserIdScraper {
  resultType: 'user-id'
  totalCount: number | null
  [Symbol.asyncIterator](): UserIdScrapeResult
}

// 단순 스크래퍼. 기존 체인블락 방식
export class SimpleScraper implements UserScraper {
  public readonly resultType = 'user-object'
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
  public readonly resultType = 'user-object'
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
  public readonly resultType = 'user-object'
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
  public readonly resultType = 'user-object'
  public totalCount: number
  constructor(private tweet: Tweet, private reaction: ReactionKind) {
    this.totalCount = getReactionsCount(tweet, reaction)
  }
  public [Symbol.asyncIterator]() {
    return TwitterAPI.getAllReactedUserList(this.reaction, this.tweet)
  }
}

export class FollowersIdScraper implements UserIdScraper {
  public readonly resultType = 'user-id'
  public totalCount: number
  constructor(private user: TwitterUser, private followKind: FollowKind) {
    this.totalCount = getFollowersCount(user, followKind)!
  }
  public async *[Symbol.asyncIterator]() {
    if (this.followKind === 'mutual-followers') {
      yield* await TwitterAPI.getAllMutualFollowersIds(this.user).then(ids => ids.map(wrapEither))
    } else {
      yield* TwitterAPI.getAllFollowsIds(this.followKind, this.user)
    }
  }
}

export function initScraper(request: SessionRequest): UserScraper | UserIdScraper {
  const { options, target } = request
  const simpleScraper = 'quickMode' in options && options.quickMode ? QuickScraper : SimpleScraper
  switch (target.type) {
    case 'follower':
      switch (target.list) {
        case 'followers':
        case 'friends':
          return new simpleScraper(target.user, target.list)
        case 'mutual-followers':
          return new MutualFollowerScraper(target.user)
      }
    case 'tweetReaction':
      return new TweetReactedUserScraper(target.tweet, target.reaction)
  }
}
