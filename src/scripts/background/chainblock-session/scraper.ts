import * as TwitterAPI from '../twitter-api.js'
import * as UserScrapingAPI from '../user-scraping-api.js'
import { getFollowersCount, getReactionsCount, wrapEitherRight, resumableAsyncIterate } from '../../common.js'
import { SessionRequest } from './session.js'

interface UsersObject {
  users: TwitterUser[]
}

type ScrapedUsersIterator = AsyncIterableIterator<Either<Error, UsersObject>>
export interface UserScraper {
  totalCount: number | null
  prepare(): Promise<void>
  stopPrepare(): void
  [Symbol.asyncIterator](): ScrapedUsersIterator
}

// 단순 스크래퍼. 기존 체인블락 방식
class SimpleScraper implements UserScraper {
  public totalCount: number
  private readonly prefetchedUsers: TwitterUser[] = []
  private prefetchShouldStop = false
  private generator: AsyncIterableIterator<Either<Error, TwitterAPI.UserListResponse>>
  constructor(user: TwitterUser, followKind: FollowKind) {
    this.totalCount = getFollowersCount(user, followKind)!
    this.generator = UserScrapingAPI.getAllFollowsUserList(followKind, user, {})
  }
  public async prepare() {
    for await (const response of resumableAsyncIterate(this.generator)) {
      if (!response.ok) {
        console.error(response.error)
        break
      }
      const responseData = response.value
      const { users, next_cursor_str } = responseData
      this.prefetchedUsers.push(...users)
      if (this.prefetchShouldStop || next_cursor_str === '0') {
        break
      }
    }
  }
  public stopPrepare() {
    this.prefetchShouldStop = true
  }
  public async *[Symbol.asyncIterator]() {
    yield wrapEitherRight({ users: this.prefetchedUsers })
    yield* this.generator
    // return UserScrapingAPI.getAllFollowsUserList(this.followKind, this.user)
  }
}

// 맞팔로우 스크래퍼
class MutualFollowerScraper implements UserScraper {
  public totalCount: number | null = null
  private prefetchedUsers: TwitterUser[] = []
  private prefetchShouldStop = false
  private generator!: AsyncIterableIterator<Either<Error, UsersObject>>
  public async prepare() {
    const mutualFollowersIds = await UserScrapingAPI.getAllMutualFollowersIds(this.user)
    this.totalCount = mutualFollowersIds.length
    this.generator = UserScrapingAPI.lookupUsersByIds(mutualFollowersIds)
    for await (const response of resumableAsyncIterate(this.generator)) {
      if (!response.ok) {
        console.error(response.error)
        break
      }
      const responseData = response.value
      const { users } = responseData
      this.prefetchedUsers.push(...users)
      if (this.prefetchShouldStop) {
        break
      }
    }
  }
  public stopPrepare() {
    this.prefetchShouldStop = true
  }
  constructor(private user: TwitterUser) {}
  public async *[Symbol.asyncIterator]() {
    yield wrapEitherRight({ users: this.prefetchedUsers })
    yield* this.generator
  }
}

// 트윗반응 유저 스크래퍼
class TweetReactedUserScraper implements UserScraper {
  public totalCount: number
  private prefetchedUsers: TwitterUser[] = []
  private prefetchShouldStop = false
  private generator!: AsyncIterableIterator<Either<Error, TwitterAPI.UserListResponse>>
  public async prepare() {
    const { tweet, blockRetweeters, blockLikers } = this.target
    async function* reactedUsers() {
      if (blockRetweeters) {
        yield* UserScrapingAPI.getAllReactedUserList('retweeted', tweet)
      }
      if (blockLikers) {
        yield* UserScrapingAPI.getAllReactedUserList('liked', tweet)
      }
    }
    this.generator = reactedUsers()
    for await (const response of resumableAsyncIterate(this.generator)) {
      if (!response.ok) {
        console.error(response.error)
        break
      }
      const responseData = response.value
      const { users } = responseData
      this.prefetchedUsers.push(...users)
      // next_cursor_str이 존재하지만, 두 API에서 가져오므로 이걸 체크하여 정지하면
      // 다음 API를 호출하지 않을 수 있다.
      if (this.prefetchShouldStop) {
        break
      }
    }
  }
  public stopPrepare() {
    this.prefetchShouldStop = true
  }
  constructor(private target: TweetReactionBlockSessionRequest['target']) {
    this.totalCount = getReactionsCount(target)
  }
  public async *[Symbol.asyncIterator]() {
    yield wrapEitherRight({ users: this.prefetchedUsers })
    yield* this.generator
  }
}

class ImportUserScraper implements UserScraper {
  public totalCount = this.userIds.length
  private readonly prefetchedUsers: TwitterUser[] = []
  private prefetchShouldStop = false
  private generator: AsyncIterableIterator<Either<Error, UsersObject>>
  constructor(private userIds: string[]) {
    this.generator = UserScrapingAPI.lookupUsersByIds(userIds)
  }
  public async prepare() {
    for await (const response of resumableAsyncIterate(this.generator)) {
      if (!response.ok) {
        console.error(response.error)
        break
      }
      const responseData = response.value
      const { users } = responseData
      this.prefetchedUsers.push(...users)
      if (this.prefetchShouldStop) {
        break
      }
    }
  }
  public stopPrepare() {
    this.prefetchShouldStop = true
  }
  public async *[Symbol.asyncIterator]() {
    yield wrapEitherRight({ users: this.prefetchedUsers })
    yield* this.generator
  }
}

export function initScraper(request: SessionRequest): UserScraper {
  const { target } = request
  if (target.type === 'import') {
    return new ImportUserScraper(target.userIds)
  }
  if (target.type === 'tweet_reaction') {
    return new TweetReactedUserScraper(target)
  }
  if (target.list === 'mutual-followers') {
    return new MutualFollowerScraper(target.user)
  }
  return new SimpleScraper(target.user, target.list)
}
