const enum SessionStatus {
  Initial,
  Running,
  RateLimited,
  Completed,
  Stopped,
  Error,
}

type Should = 'skip' | 'block' | 'already-blocked'

const BLOCK_PROMISES_BUFFER_SIZE = 150

namespace RedBlock.Background.ChainBlock {
  const { SimpleScraper, QuickScraper, MutualFollowerScraper } = RedBlock.Background.ChainBlock.Scraper
  export class ChainBlockSession extends EventEmitter<{
    'update-progress': SessionInfo['progress']
    'update-state': SessionStatus
    'update-count': number
    'rate-limit': Limit
    'rate-limit-reset': null
    error: string
    start: null
    stop: null
    close: null
    complete: null
  }> {
    public readonly id: string
    private readonly _targetUser: Readonly<TwitterUser>
    private readonly _options: Readonly<SessionInfo['options']>
    private _shouldStop = false
    private _totalCount: number | null = 0
    private _limit: Limit | null = null
    private _status: SessionStatus = SessionStatus.Initial
    private readonly _progress: SessionInfo['progress'] = {
      alreadyBlocked: 0,
      skipped: 0,
      blockSuccess: 0,
      blockFail: 0,
      get totalScraped(): number {
        return _.sum([this.alreadyBlocked, this.skipped, this.blockSuccess, this.blockFail])
      },
      set totalScraped(ignore) {
        // updateProgress 에서 Object.assign 해도 오류 안 뜨게
        ignore
      },
    }
    constructor(init: SessionInit) {
      super()
      this.id = init.sessionId
      this._targetUser = Object.freeze(init.targetUser)
      this._options = Object.freeze(init.options)
      const { targetList } = this._options
      if (targetList === 'followers') {
        this._totalCount = init.targetUser.followers_count
      } else if (targetList === 'friends') {
        this._totalCount = init.targetUser.friends_count
      } else if (targetList === 'mutual-followers') {
        // 스크래핑 전 시점에선 정확히 몇 명인지 파악할 수 없음
        this._totalCount = null
      } else {
        throw new Error('unreachable')
      }
    }
    get totalCount(): number | null {
      return this._totalCount
    }
    get targetUser(): Readonly<TwitterUser> {
      return copyFrozenObject(this._targetUser)
    }
    get options(): Readonly<SessionInfo['options']> {
      return copyFrozenObject(this._options)
    }
    get limit(): Limit | null {
      return this._limit
    }
    private updateLimit(limit: Limit | null): void {
      this._limit = limit
      if (limit) {
        this.emit('rate-limit', limit)
      } else {
        this.emit('rate-limit-reset', null)
      }
    }
    get status(): SessionStatus {
      return this._status
    }
    private updateStatus(status: SessionStatus): void {
      this._status = status
      this.emit('update-state', status)
    }
    get progress(): SessionInfo['progress'] {
      return copyFrozenObject(this._progress)
    }
    private updateProgress(progress: SessionInfo['progress']) {
      Object.assign(this._progress, progress)
      this.emit('update-progress', copyFrozenObject(this.progress))
    }
    public stop() {
      this._shouldStop = true
      this.updateStatus(SessionStatus.Stopped)
      this.emit('stop', null)
    }
    public complete() {
      this.updateStatus(SessionStatus.Completed)
      this.emit('complete', null)
    }
    private async rateLimited() {
      this.updateStatus(SessionStatus.RateLimited)
      const { targetList } = this.options
      const limitStatuses = await TwitterAPI.getRateLimitStatus()
      let limit: Limit
      if (targetList === 'friends') {
        limit = limitStatuses.friends[`/friends/list`]
      } else if (targetList === 'followers') {
        limit = limitStatuses.followers[`/followers/list`]
      } else {
        throw new Error('unreachable')
      }
      this.updateLimit(limit)
    }
    private rateLimitResetted() {
      this.updateStatus(SessionStatus.Running)
      this.updateLimit(null)
    }
    private initScraper(user: TwitterUser, options: SessionInfo['options']) {
      const scraper = options.quickMode ? QuickScraper : SimpleScraper
      switch (options.targetList) {
        case 'friends':
          return new scraper(user, 'friends')
          break
        case 'followers':
          return new scraper(user, 'followers')
          break
        case 'mutual-followers':
          return new MutualFollowerScraper(user)
          break
        default:
          throw new Error('unreachable')
      }
    }
    private whatToDoGivenUser(follower: TwitterUser): Should {
      if (follower.blocking) {
        return 'already-blocked'
      }
      const options = this._options
      const isMyFollowing = follower.following || follower.follow_request_sent
      const isMyFollower = follower.followed_by
      const isMyMutualFollower = isMyFollower && isMyFollowing
      if (isMyMutualFollower) {
        // 내 맞팔로우는 스킵한다.
        return 'skip'
      }
      if (isMyFollower) {
        const whatToDo = options.myFollowers
        console.debug('내 팔로워: %s', whatToDo)
        return whatToDo
      }
      if (isMyFollowing) {
        const whatToDo = options.myFollowings
        console.debug('내 팔로잉: %s', whatToDo)
        return whatToDo
      }
      return 'block'
    }
    public async start() {
      type FoundReason = keyof SessionInfo['progress']
      const incrementProgress = (reason: FoundReason) => {
        const newProgPart: Partial<SessionInfo['progress']> = {
          [reason]: this.progress[reason] + 1,
        }
        const newProgress: SessionInfo['progress'] = Object.assign({}, this.progress, newProgPart)
        this.updateProgress(newProgress)
      }
      this.emit('start', null)
      try {
        const blockPromises: Promise<void>[] = []
        let stopped = false
        const scraper = this.initScraper(this.targetUser, this.options)
        const userScraper = scraper.scrape()
        for await (const maybeFollower of userScraper) {
          if (this.totalCount === null) {
            this._totalCount = scraper.totalCount
          }
          if (this._shouldStop) {
            stopped = true
            blockPromises.length = 0
            break
          } else if (this.status === SessionStatus.RateLimited) {
            this.rateLimitResetted()
          }
          if (!maybeFollower.ok) {
            if (maybeFollower.error instanceof TwitterAPI.RateLimitError) {
              this.rateLimited()
              const second = 1000
              const minute = second * 60
              await sleep(1 * minute)
              continue
            } else {
              throw maybeFollower.error
            }
          }
          const follower = maybeFollower.value
          this.updateStatus(SessionStatus.Running)
          const whatToDo = this.whatToDoGivenUser(follower)
          if (whatToDo === 'skip') {
            incrementProgress('skipped')
            continue
          } else if (whatToDo === 'already-blocked') {
            incrementProgress('alreadyBlocked')
            continue
          }
          blockPromises.push(
            TwitterAPI.blockUser(follower)
              .then((blocked: boolean) => {
                const blockResult = blocked ? 'blockSuccess' : 'blockFail'
                incrementProgress(blockResult)
              })
              .catch(() => {
                incrementProgress('blockFail')
              })
          )
          if (blockPromises.length >= BLOCK_PROMISES_BUFFER_SIZE) {
            await Promise.all(blockPromises)
            blockPromises.length = 0
          }
        }
        await Promise.all(blockPromises)
        blockPromises.length = 0
        if (!stopped) {
          this.complete()
        }
      } catch (err) {
        const error = err as Error
        this.updateStatus(SessionStatus.Error)
        this.emit('error', error.message)
        throw err
      }
    }
  }
}
