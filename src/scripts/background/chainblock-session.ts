const enum ChainBlockSessionStatus {
  Initial,
  Running,
  RateLimited,
  Completed,
  Stopped,
  Closed,
  Error,
}

interface ChainBlockSessionInit {
  sessionId: string
  targetUser: TwitterUser
  // TODO: options
}

interface ChainBlockSessionOptions {
  // TODO
}

interface ChainBlockSessionEvents {
  'update-progress': ChainBlockSessionProgress
  'update-state': ChainBlockSessionStatus
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
    private readonly whitelist = new Set<string>()
    private readonly _targetUser: TwitterUser
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
      this._targetUser = init.targetUser
    }
    get targetUser(): TwitterUser {
      return this._targetUser
    }
    get status(): ChainBlockSessionStatus {
      return this._status
    }
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
      if (this.whitelist.has(follower.id_str)) {
        return 'skipped'
      }
      if (follower.followers_count > 50000 || follower.friends_count > 50000) {
        return 'skipped'
      }
      if (follower.verified) {
        return 'skipped'
      }
      if (!isSafeToBlock(follower)) {
        return 'skipped'
      }
      return null
    }
    // .following 속성 제거에 따른 대응
    // BlockThemAll 처럼 미리 내 팔로잉/팔로워를 수집하는 방식을 이용함
    private async updateWhitelistFromMyFollows(): Promise<void> {
      const myself = await TwitterAPI.getMyself()
      this.whitelist.clear()
      const myFollowings = collectAsync(TwitterAPI.getAllFollowsIds('friends', myself)).then(ids => {
        ids.forEach(id => this.whitelist.add(id))
      })
      const myFollowers = collectAsync(TwitterAPI.getAllFollowsIds('followers', myself)).then(ids => {
        ids.forEach(id => this.whitelist.add(id))
      })
      await Promise.all([myFollowings, myFollowers])
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
        await this.updateWhitelistFromMyFollows()
        const blockPromises: Promise<void>[] = []
        let stopped = false
        const followersIterator = TwitterAPI.getAllFollowers(this.targetUser)
        for await (const follower of followersIterator) {
          const shouldStop = [ChainBlockSessionStatus.Closed, ChainBlockSessionStatus.Stopped].includes(this.status)
          if (shouldStop) {
            stopped = true
            break
          }
          if (follower === 'RateLimitError') {
            this.rateLimited()
            const second = 1000
            const minute = second * 60
            await sleep(1 * minute)
            continue
          }
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
