namespace RedBlock.Background.ChainBlock.Scraper {
  type ScrapeResult = AsyncIterableIterator<Either<Error, TwitterUser>>
  export interface UserScraper {
    scrape(user: TwitterUser): ScrapeResult
  }

  // 단순 스크래퍼. 기존 체인블락 방식
  export class SimpleScraper implements UserScraper {
    constructor(private followKind: FollowKind) {}
    public scrape(user: TwitterUser) {
      return TwitterAPI.getAllFollowsUserList(this.followKind, user)
    }
  }

  // 고속 스크래퍼. 최대 200명 이하의 사용자만 가져온다.
  export class QuickScraper implements UserScraper {
    private readonly limitCount = 200
    constructor(private followKind: FollowKind) {}
    public async *scrape(user: TwitterUser) {
      let count = 0
      for await (const item of TwitterAPI.getAllFollowsUserList(this.followKind, user)) {
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
    public scrape(user: TwitterUser) {
      return TwitterAPI.getAllMutualFollowersUsersList(user)
    }
  }
}
