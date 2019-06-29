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

type Should = 'skip' | 'block' | 'already-blocked'

namespace RedBlock.Background.ChainBlock {
  export class ChainBlockSession extends EventEmitter<ChainBlockSessionEvents> {
    public readonly id: string
    private _prepared = false
    private _shouldStop = false
    private readonly _myFollowingsIds = new Set<string>()
    private readonly _myFollowersIds = new Set<string>()
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
      const { targetList } = this._options
      const limits = await TwitterAPI.getRateLimitStatus()
      if (targetList === 'friends') {
        const followerLimit = limits.friends[`/friends/list`]
        this.emit('rate-limit', followerLimit)
      } else if (targetList === 'followers') {
        const followerLimit = limits.followers[`/followers/list`]
        this.emit('rate-limit', followerLimit)
      } else {
        throw new Error('unreachable')
      }
    }
    private rateLimitResetted() {
      this.updateStatus(ChainBlockSessionStatus.Running)
      this.emit('rate-limit-reset', null)
    }
    public async prepare() {
      try {
        const myFollowersUpdateList = await this.updateMyFollowersList()
        if (!myFollowersUpdateList) {
          throw new Error('자신의 팔로워 목록을 가져오는 데 실패했습니다.')
        }
        this._prepared = true
      } catch (err) {
        console.error(err)
        this._prepared = false
      }
    }
    private whatToDoGivenUser(follower: TwitterUser): Should {
      // TODO: should also use friendships/outgoing api
      // for replace follow_request_sent prop
      if (follower.blocking) {
        return 'already-blocked'
      }
      const options = this._options
      const isMyFollowing = this._myFollowingsIds.has(follower.id_str)
      const isMyFollower = this._myFollowersIds.has(follower.id_str)
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
    // .following 속성 제거에 따른 대응
    // BlockThemAll 처럼 미리 내 팔로잉/팔로워를 수집하는 방식을 이용함
    private async updateMyFollowersList(): Promise<boolean> {
      let isOkay = true
      const addIdsToSet = (set: Set<string>, ids: Either<Error, string>[]): void => {
        for (const maybeId of ids) {
          if (maybeId.ok) {
            set.add(maybeId.value)
          } else {
            console.error(maybeId.error)
            isOkay = false
            break
          }
        }
      }
      this._myFollowersIds.clear()
      this._myFollowingsIds.clear()
      const myselfP = TwitterAPI.getMyself()
      myselfP.then(async myself => {
        const allIds = await collectAsync(TwitterAPI.getAllFollowsIds('followers', myself))
        addIdsToSet(this._myFollowersIds, allIds)
      })
      myselfP.then(async myself => {
        const allIds = await collectAsync(TwitterAPI.getAllFollowsIds('friends', myself))
        addIdsToSet(this._myFollowingsIds, allIds)
      })
      await myselfP
      console.debug('내 팔로잉/팔로워 목록: %o', [this._myFollowersIds, this._myFollowingsIds])
      return isOkay
    }
    public async start() {
      if (!this._prepared) {
        throw new Error('아직 준비(prepare)되지 않았습니다.')
      }
      type FoundReason = keyof ChainBlockSessionProgress
      const incrementProgress = (reason: FoundReason) => {
        const newProgPart: Partial<ChainBlockSessionProgress> = {
          [reason]: this.progress[reason] + 1,
        }
        const newProgress: ChainBlockSessionProgress = Object.assign({}, this.progress, newProgPart)
        this.updateProgress(newProgress)
      }
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
