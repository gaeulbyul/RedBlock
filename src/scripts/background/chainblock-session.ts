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
  stop: null
  close: null
  complete: null
}

namespace RedBlock.Background.ChainBlock {
  export class ChainBlockSession extends EventEmitter<ChainBlockSessionEvents> {
    public readonly id: string
    private readonly _whitelist = new Set<string>()
    private readonly _targetUser: Readonly<TwitterUser>
    private _totalCount: number | null
    private readonly _options: Readonly<ChainBlockSessionOptions>
    private _status: ChainBlockSessionStatus = ChainBlockSessionStatus.Initial
    private _progress: ChainBlockSessionProgress = {
      alreadyBlocked: 0,
      skipped: 0,
      blockSuccess: 0,
      blockFail: 0,
      get totalScraped(): number {
        return _.sum([this.alreadyBlocked, this.skipped, this.blockSuccess, this.blockFail])
      },
      set totalScraped(ignore) {
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
    get targetUser(): TwitterUser {
      return this._targetUser
    }
    get status(): ChainBlockSessionStatus {
      return this._status
    }
    get options(): ChainBlockSessionOptions {
      return this._options
    }
    // private updateTotalCount(count: number): void {
    //   this._totalCount = count
    //   this.emit('update-count', count)
    // }
    private updateStatus(status: ChainBlockSessionStatus): void {
      this._status = status
      this.emit('update-state', status)
    }
    get progress(): ChainBlockSessionProgress {
      return this._progress
    }
    private updateProgress(progress: ChainBlockSessionProgress) {
      Object.assign(this.progress, progress)
      this.emit('update-progress', copyFrozenObject(this.progress))
    }
    public stop() {
      this.updateStatus(ChainBlockSessionStatus.Stopped)
      this.emit('stop', null)
    }
    public complete() {
      this.updateStatus(ChainBlockSessionStatus.Completed)
      this.emit('complete', null)
    }
    private async rateLimited() {
      this.updateStatus(ChainBlockSessionStatus.RateLimited)
      const limits = await TwitterAPI.getRateLimitStatus()
      // FIXME
      const followerLimit = limits.followers['/followers/list']
      this.emit('rate-limit', followerLimit)
    }
    private rateLimitResetted() {
      this.updateStatus(ChainBlockSessionStatus.Running)
      this.emit('rate-limit-reset', null)
    }
    private checkUserSkip(follower: TwitterUser): 'alreadyBlocked' | 'skipped' | null {
      // TODO: should also use friendships/outgoing api
      // for replace follow_request_sent prop
      if (follower.blocking) {
        return 'alreadyBlocked'
      }
      if (this._whitelist.has(follower.id_str)) {
        return 'skipped'
      }
      return null
    }
    // .following 속성 제거에 따른 대응
    // BlockThemAll 처럼 미리 내 팔로잉/팔로워를 수집하는 방식을 이용함
    private async updateWhitelistFromMyFollows(): Promise<boolean> {
      // XXX too naive -_-
      const { myFollowers, myFollowings } = this._options
      if (myFollowers + myFollowings === 'blockblock') {
        return true
      }
      const myself = await TwitterAPI.getMyself()
      this._whitelist.clear()
      let isOkay = true
      const addIdsToWhitelist = (ids: Either<Error, string>[]): void => {
        for (const maybeId of ids) {
          if (maybeId.ok) {
            this._whitelist.add(maybeId.value)
          } else {
            console.error(maybeId.error)
            isOkay = false
            break
          }
        }
      }
      const myFollowingsList = collectAsync(TwitterAPI.getAllFollowsIds('friends', myself)).then(
        addIdsToWhitelist.bind(this)
      )
      const myFollowersList = collectAsync(TwitterAPI.getAllFollowsIds('followers', myself)).then(
        addIdsToWhitelist.bind(this)
      )
      await Promise.all([myFollowingsList, myFollowersList])
      return isOkay
    }
    public async start() {
      type FoundReason = keyof ChainBlockSessionProgress
      const afterFoundUser = (reason: FoundReason) => {
        const newProgPart: Partial<ChainBlockSessionProgress> = {
          [reason]: this.progress[reason] + 1,
        }
        const newProgress: ChainBlockSessionProgress = Object.assign({}, this.progress, newProgPart)
        this.updateProgress(newProgress)
      }
      try {
        const whitelistUpdateResult = await this.updateWhitelistFromMyFollows()
        if (!whitelistUpdateResult) {
          debugger
          throw new Error('자신의 팔로워 목록을 가져오는 데 실패했습니다.')
        }
        const blockPromises: Promise<void>[] = []
        let stopped = false
        const followTarget = this._options.targetList
        const followersIterator = TwitterAPI.getAllFollowsUserList(followTarget, this.targetUser)
        for await (const maybeFollower of followersIterator) {
          const shouldStop = this.status === ChainBlockSessionStatus.Stopped
          if (shouldStop) {
            stopped = true
            break
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
          if (this.status === ChainBlockSessionStatus.RateLimited) {
            this.rateLimitResetted()
          }
          await sleep(500) //XXX 임시. 나중에 지울 것
          this.updateStatus(ChainBlockSessionStatus.Running)
          const shouldSkip = this.checkUserSkip(follower)
          if (shouldSkip) {
            afterFoundUser(shouldSkip)
            continue
          }
          blockPromises.push(
            TwitterAPI.blockUser(follower)
              .then((blocked: boolean) => {
                const blockResult = blocked ? 'blockSuccess' : 'blockFail'
                afterFoundUser(blockResult)
              })
              .catch(() => {
                afterFoundUser('blockFail')
              })
          )
          if (blockPromises.length >= 60) {
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
