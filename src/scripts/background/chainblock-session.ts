namespace RedBlock.Background.ChainBlockSession {
  const PROMISE_BUFFER_SIZE = 150
  const { SimpleScraper, QuickScraper, MutualFollowerScraper } = RedBlock.Background.ChainBlock.Scraper
  type UserScraper = RedBlock.Background.ChainBlock.Scraper.UserScraper
  type VerbSomething = 'Block' | 'UnBlock' | 'Mute' | 'UnMute'
  type VerbNothing = 'Skip' | 'AlreadyDone'
  type Verb = VerbSomething | VerbNothing
  export interface SessionRequest {
    purpose: 'chainblock' | 'unchainblock'
    target: {
      user: TwitterUser
      list: FollowKind
    }
    options: {
      quickMode: boolean
      myFollowers: Verb
      myFollowings: Verb
      verified: Verb
      // 미구현, 언체인블락 전용, 맞차단한 경우는 차단을 풀어주지 않는 옵션
      mutualBlocked: Verb
    }
  }
  export interface SessionInfo {
    sessionId: string
    request: SessionRequest
    progress: {
      success: number
      failure: number
      already: number
      skipped: number
      error: number
    }
    count: {
      scraped: number
      // totalCount: 맞팔로우 체인의 경우, 실행시작 시점에선 정확한 사용자 수를 알 수 없다.
      // 따라서, null을 통해 '아직 알 수 없음'을 표현한다.
      total: number | null
    }
    status: SessionStatus
    limit: Limit | null
  }
  export const defaultOption: Readonly<SessionRequest['options']> = Object.freeze({
    quickMode: false,
    myFollowers: 'Skip',
    myFollowings: 'Skip',
    verified: 'Skip',
    mutualBlocked: 'Skip',
  })
  export class Session {
    private readonly sessionInfo = this.initSessionInfo()
    public readonly statusEventEmitter = new EventEmitter<{
      'rate-limit': Limit
      'rate-limit-reset': null
      complete: SessionInfo['progress']
      error: string
    }>()
    public shouldStop = false
    public constructor(private request: SessionRequest) {}
    public getSessionInfo() {
      // deep-freeze 하는 게 좋을까?
      return copyFrozenObject(this.sessionInfo)
    }
    public async start() {
      const $$DBG$$_plan: Array<[TwitterUser, Verb]> = []
      const promiseBuffer: Promise<void>[] = []
      let stopped = false
      try {
        const scraper = this.initScraper()
        const userScraper = scraper.scrape()
        for await (const maybeFollower of userScraper) {
          this.updateTotalCount(scraper)
          if (this.shouldStop) {
            stopped = true
            promiseBuffer.length = 0
            break
          }
          if (!maybeFollower.ok) {
            if (maybeFollower.error instanceof TwitterAPI.RateLimitError) {
              this.handleRateLimit()
              const second = 1000
              const minute = second * 60
              await sleep(1 * minute)
              continue
            } else {
              throw maybeFollower.error
            }
          }
          this.handleRunning()
          const follower = maybeFollower.value
          const whatToDo = this.whatToDoGivenUser(follower)
          promiseBuffer.push(
            (async () => {
              $$DBG$$_plan.push([follower, whatToDo])
              this.sessionInfo.progress.success++
            })()
          )
          if (whatToDo === 'Skip') {
            this.sessionInfo.progress.skipped++
            continue
          } else if (whatToDo === 'AlreadyDone') {
            this.sessionInfo.progress.already++
            continue
          }
          // promiseBuffer.push(this.doVerb(follower, whatToDo))
          this.doVerb

          if (promiseBuffer.length >= PROMISE_BUFFER_SIZE) {
            await Promise.all(promiseBuffer)
            promiseBuffer.length = 0
          }
        }
        await Promise.all(promiseBuffer)
        promiseBuffer.length = 0
        if (!stopped) {
          this.sessionInfo.status = SessionStatus.Completed
          this.statusEventEmitter.emit('complete', this.sessionInfo.progress)
        }
        {
          const cols: Array<keyof TwitterUser> = [
            'screen_name',
            'blocking',
            'muting',
            'followed_by',
            'following',
            'name',
          ]
          console.table(
            $$DBG$$_plan.map(([u, whatToDo]) => Object.assign(u, { whatToDo })),
            [...cols, 'whatToDo']
          )
        }
      } catch (error) {
        this.sessionInfo.status = SessionStatus.Error
        this.statusEventEmitter.emit('error', error.toString())
        throw error
      }
    }
    public stop() {
      this.shouldStop = true
    }
    private generateSessionId(): string {
      const { purpose } = this.request
      const { user, list } = this.request.target
      return `session/${purpose}/${user.screen_name}/${list}/${Date.now()}`
    }
    private initCount(): SessionInfo['count'] {
      const { user, list } = this.request.target
      let total: number | null
      switch (list) {
        case 'followers':
          total = user.followers_count
          break
        case 'friends':
          total = user.friends_count
          break
        case 'mutual-followers':
          total = null
          break
      }
      return {
        scraped: 0,
        total,
      }
    }
    private initSessionInfo(): SessionInfo {
      return {
        sessionId: this.generateSessionId(),
        request: this.request,
        progress: {
          already: 0,
          success: 0,
          failure: 0,
          skipped: 0,
          error: 0,
        },
        count: this.initCount(),
        status: SessionStatus.Initial,
        limit: null,
      }
    }
    private initScraper() {
      const { options, target } = this.sessionInfo.request
      const scraper = options.quickMode ? QuickScraper : SimpleScraper
      switch (target.list) {
        case 'friends':
          return new scraper(target.user, 'friends')
        case 'followers':
          return new scraper(target.user, 'followers')
        case 'mutual-followers':
          return new MutualFollowerScraper(target.user)
        default:
          throw new Error('unreachable')
      }
    }
    private isAlreadyDone(follower: TwitterUser, verb: Verb): boolean {
      const { blocking, muting } = follower
      let already = false
      if (blocking && verb === 'Block') {
        already = true
      } else if (!blocking && verb === 'UnBlock') {
        already = true
      } else if (muting && verb === 'Mute') {
        already = true
      } else if (!muting && verb === 'UnMute') {
        already = true
      }
      return already
    }
    private whatToDoGivenUser(follower: TwitterUser): Verb {
      const { purpose, options } = this.sessionInfo.request
      const { following, followed_by, follow_request_sent } = follower
      const isMyFollowing = following || follow_request_sent
      const isMyFollower = followed_by
      const isMyMutualFollower = isMyFollower && isMyFollowing
      /* 주의!
       * 팝업 UI에 나타난 순서를 고려할 것.
       */
      if (isMyMutualFollower) {
        return 'Skip'
      }
      if (isMyFollower) {
        return options.myFollowers
      }
      if (isMyFollowing) {
        return options.myFollowings
      }
      if (follower.verified) {
        return options.verified
      }
      let defaultVerb: Verb
      switch (purpose) {
        case 'chainblock':
          defaultVerb = 'Block'
          break
        case 'unchainblock':
          defaultVerb = 'UnBlock'
          break
      }
      if (this.isAlreadyDone(follower, defaultVerb)) {
        return 'AlreadyDone'
      }
      return defaultVerb
    }
    private updateTotalCount(scraper: UserScraper) {
      if (this.sessionInfo.count.total === null) {
        this.sessionInfo.count.total = scraper.totalCount
      }
    }
    private async doVerb(follower: TwitterUser, verb: VerbSomething): Promise<void> {
      let promise = Promise.resolve(false)
      const incrementSuccess = () => this.sessionInfo.progress.success++
      const incrementFailure = () => this.sessionInfo.progress.failure++
      switch (verb) {
        case 'Block':
          promise = TwitterAPI.blockUser(follower)
          break
        case 'UnBlock':
          promise = TwitterAPI.unblockUser(follower)
          break
        case 'Mute':
          promise = TwitterAPI.muteUser(follower)
          break
        case 'UnMute':
          promise = TwitterAPI.unmuteUser(follower)
          break
      }
      return promise
        .then(result => {
          if (result) {
            incrementSuccess()
          } else {
            incrementFailure()
          }
        })
        .catch(() => void incrementFailure())
    }
    private async handleRateLimit() {
      this.sessionInfo.status = SessionStatus.RateLimited
      const limitStatuses = await TwitterAPI.getRateLimitStatus()
      const { target } = this.sessionInfo.request
      let limit: Limit
      switch (target.list) {
        case 'followers':
          limit = limitStatuses.followers['/followers/list']
          break
        case 'friends':
          limit = limitStatuses.friends['/friends/list']
          break
        case 'mutual-followers':
          limit = limitStatuses.followers['/followers/list']
          break
      }
      this.sessionInfo.limit = limit
      this.statusEventEmitter.emit('rate-limit', limit)
    }
    private async handleRunning() {
      if (this.sessionInfo.status === SessionStatus.RateLimited) {
        this.statusEventEmitter.emit('rate-limit-reset', null)
      }
      this.sessionInfo.status = SessionStatus.Running
      this.sessionInfo.limit = null
    }
  }
}
