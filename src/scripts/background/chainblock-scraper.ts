import * as TwitterAPI from './twitter-api.js'

type TwitterUser = TwitterAPI.TwitterUser

type ScrapeResult = AsyncIterableIterator<Either<Error, TwitterUser>>
export interface UserScraper {
  scrape(): ScrapeResult
  totalCount: number | null
}

function simpleGetTotalCount(user: TwitterUser, followKind: FollowKind): number {
  switch (followKind) {
    case 'followers':
      return user.followers_count
      break
    case 'friends':
      return user.friends_count
      break
    case 'mutual-followers':
      throw new Error('unreachable')
  }
}

// 단순 스크래퍼. 기존 체인블락 방식
export class SimpleScraper implements UserScraper {
  public totalCount: number
  constructor(private user: TwitterUser, private followKind: FollowKind) {
    this.totalCount = simpleGetTotalCount(user, followKind)
  }
  public scrape() {
    return TwitterAPI.getAllFollowsUserList(this.followKind, this.user)
  }
}

// 고속 스크래퍼. 최대 200명 이하의 사용자만 가져온다.
export class QuickScraper implements UserScraper {
  private readonly limitCount = 200
  public totalCount: number
  constructor(private user: TwitterUser, private followKind: FollowKind) {
    this.totalCount = Math.min(this.limitCount, simpleGetTotalCount(user, followKind))
  }
  public async *scrape() {
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
  public async *scrape() {
    const mutualFollowersIds = await TwitterAPI.getAllMutualFollowersIds(this.user)
    this.totalCount = mutualFollowersIds.length
    yield* TwitterAPI.lookupUsersByIds(mutualFollowersIds)
  }
}
