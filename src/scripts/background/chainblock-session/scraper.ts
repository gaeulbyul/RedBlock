import * as TwitterAPI from '../twitter-api.js'
import { getFollowersCount, getReactionsCount, collectAsync, unwrap } from '../../common.js'
import { SessionRequest } from './session.js'

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

// 맞팔로우 스크래퍼
export class MutualFollowerScraper implements UserScraper {
  public totalCount: number | null = null
  constructor(private user: TwitterUser) {}
  public async *[Symbol.asyncIterator]() {
    const mutualFollowersIds = await TwitterAPI.getAllMutualFollowersIds(this.user)
    this.totalCount = mutualFollowersIds.length
    yield* TwitterAPI.lookupUsersByIds(mutualFollowersIds)
  }
}

// 차단상대 대상 스크래퍼
export class FollowerScraperFromBlockedUser implements UserScraper {
  public totalCount: number | null = null
  constructor(private user: TwitterUser, private followKind: FollowKind) {}
  private async prepareActor() {
    const multiCookies = await TwitterAPI.getMultiAccountCookies()
    const actorUserIds = Object.keys(multiCookies)
    for (const actorId of actorUserIds) {
      const target = await TwitterAPI.getSingleUserById(this.user.id_str, actorId).catch(() => null)
      if (target && !target.blocked_by) {
        return actorId
      }
    }
    const i18n = await import('../../i18n.js')
    throw new Error(i18n.getMessage('cant_chainblock_to_blocked'))
  }
  public async *[Symbol.asyncIterator]() {
    const actAsUserId = await this.prepareActor()
    const followsUserIds = await collectAsync(TwitterAPI.getAllFollowsIds(this.followKind, this.user, actAsUserId))
    this.totalCount = followsUserIds.length
    yield* TwitterAPI.lookupUsersByIds(followsUserIds.map(unwrap))
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

function getTargetUser(target: SessionRequest['target']): TwitterUser {
  if ('user' in target) {
    return target.user
  } else {
    return target.tweet.user
  }
}

export function initScraper(request: SessionRequest) {
  const { options, target } = request
  const targetUser = getTargetUser(target)
  if (target.type === 'follower' && targetUser.blocked_by) {
    return new FollowerScraperFromBlockedUser(targetUser, target.list)
  }
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
