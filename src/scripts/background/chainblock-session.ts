const enum ChainBlockSessionStatus {
  Initial,
  Running,
  RateLimited,
  Completed,
  Stopped,
  Error,
}

interface ChainBlockSessionEvents {
  'update-progress': ChainBlockSessionProgress
  'update-state': ChainBlockSessionStatus
  'update-count': number
  'rate-limit': Limit
  'rate-limit-reset': null
  error: string
  start: null
  stop: null
  close: null
  complete: null
}

type Should = 'skip' | 'block' | 'already-blocked'

const BLOCK_PROMISES_BUFFER_SIZE = 150

namespace RedBlock.Background.ChainBlock {
  export class ChainBlockSession extends EventEmitter<ChainBlockSessionEvents> {
    public readonly id: string
    private readonly _targetUser: Readonly<TwitterUser>
    private readonly _options: Readonly<ChainBlockSessionOptions>
    private _shouldStop = false
    private _totalCount = 0
    private _limit: Limit | null = null
    private _status: ChainBlockSessionStatus = ChainBlockSessionStatus.Initial
    private readonly _progress: ChainBlockSessionProgress = {
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
    constructor(init: ChainBlockSessionInit) {
      super()
      this.id = init.sessionId
      this._targetUser = Object.freeze(init.targetUser)
      this._options = Object.freeze(init.options)
      const { targetList } = this._options
      if (targetList === 'followers') {
        this._totalCount = init.targetUser.followers_count
      } else if (targetList === 'friends') {
        this._totalCount = init.targetUser.friends_count
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
    get options(): Readonly<ChainBlockSessionOptions> {
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
    get status(): ChainBlockSessionStatus {
      return this._status
    }
    private updateStatus(status: ChainBlockSessionStatus): void {
      this._status = status
      this.emit('update-state', status)
    }
    get progress(): ChainBlockSessionProgress {
      return copyFrozenObject(this._progress)
    }
    private updateProgress(progress: ChainBlockSessionProgress) {
      Object.assign(this._progress, progress)
      this.emit('update-progress', copyFrozenObject(this.progress))
    }
    public stop() {
      this._shouldStop = true
      this.updateStatus(ChainBlockSessionStatus.Stopped)
      this.emit('stop', null)
    }
    public complete() {
      this.updateStatus(ChainBlockSessionStatus.Completed)
      this.emit('complete', null)
    }
    private async rateLimited() {
      this.updateStatus(ChainBlockSessionStatus.RateLimited)
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
      this.updateStatus(ChainBlockSessionStatus.Running)
      this.updateLimit(null)
    }
    private whatToDoGivenUser(follower: TwitterUser): Should {
      // TODO: should also use friendships/outgoing api
      // for replace follow_request_sent prop
      if (follower.blocking) {
        return 'already-blocked'
      }
      const options = this._options
      const isMyFollowing = follower.following
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
      type FoundReason = keyof ChainBlockSessionProgress
      const incrementProgress = (reason: FoundReason) => {
        const newProgPart: Partial<ChainBlockSessionProgress> = {
          [reason]: this.progress[reason] + 1,
        }
        const newProgress: ChainBlockSessionProgress = Object.assign({}, this.progress, newProgPart)
        this.updateProgress(newProgress)
      }
      this.emit('start', null)
      try {
        const blockPromises: Promise<void>[] = []
        let stopped = false
        const followTarget = this._options.targetList
        const followersIterator = TwitterAPI.getAllFollowsUserList(followTarget, this.targetUser)
        for await (const maybeFollower of followersIterator) {
          if (this._shouldStop) {
            stopped = true
            blockPromises.length = 0
            break
          } else if (this.status === ChainBlockSessionStatus.RateLimited) {
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
          this.updateStatus(ChainBlockSessionStatus.Running)
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
        this.updateStatus(ChainBlockSessionStatus.Error)
        this.emit('error', error.message)
        throw err
      }
    }
  }
}
