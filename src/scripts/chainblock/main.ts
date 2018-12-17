class ChainBlocker {
  private readonly sessions: Map<string, ChainBlockSession> = new Map()
  private readonly container: HTMLElement = document.createElement('div')
  private readonly allowMultipleSession = false
  constructor() {
    this.container.className = 'redblock-bg'
    this.container.style.display = 'none'
    document.body.appendChild(this.container)
    window.addEventListener('beforeunload', event => {
      if (this.isRunning()) {
        event.preventDefault()
        event.returnValue =
          '[Red Block] 다른 페이지로 이동하게 되면 현재 작동중인 체인블락은 멈추게 됩니다. 그래도 이동하시겠습니까?'
        return event.returnValue
      }
    })
  }
  public isRunning(): boolean {
    if (this.sessions.size <= 0) {
      return false
    }
    const runningStates = [
      ChainBlockUIState.Running,
      ChainBlockUIState.RateLimited,
    ]
    const currentSessionStates = [...this.sessions.values()].map(
      session => session.state
    )
    const shouldPreventUnload = currentSessionStates.filter(st =>
      runningStates.includes(st)
    )
    return shouldPreventUnload.length > 0
  }
  public add(targetUser: TwitterUser) {
    if (!this.allowMultipleSession && this.isRunning()) {
      window.alert('이미 체인블락이 실행중입니다.')
      return
    }
    const targetUserName = targetUser.screen_name
    if (this.sessions.has(targetUserName)) {
      const ses = this.sessions.get(targetUserName)
      if (ses!.state !== ChainBlockUIState.Closed) {
        window.alert(`이미 ${targetUserName}에게 체인블락이 실행중입니다.`)
        return
      }
    }
    const session = new ChainBlockSession(targetUser)
    session.on('close', () => {
      this.remove(targetUser)
    })
    session.appendToContainer(this.container)
    this.sessions.set(targetUserName, session)
  }
  public remove(targetUser: TwitterUser) {
    this.sessions.delete(targetUser.screen_name)
    if (!this.isRunning()) {
      this.hide()
    }
  }
  public show() {
    this.container.style.display = ''
  }
  public hide() {
    this.container.style.display = 'none'
  }
  public async start() {
    if (this.isRunning()) {
      return
    }
    const sessions = this.sessions.values()
    for (const session of sessions) {
      if (session.state === ChainBlockUIState.Initial) {
        await session.start()
      }
    }
  }
}

class ChainBlockSession extends EventEmitter {
  private readonly ui = new ChainBlockUI()
  private _state: ChainBlockUIState = ChainBlockUIState.Initial
  private progress: ChainBlockProgress = {
    total: 0,
    alreadyBlocked: 0,
    skipped: 0,
    blockSuccess: 0,
    blockFail: 0,
  }
  constructor(private targetUser: TwitterUser) {
    super()
    this.progress.total = this.targetUser.followers_count
    this.prepareUI()
    this.emit('update-target', targetUser)
  }
  get state(): ChainBlockUIState {
    return this._state
  }
  set state(state: ChainBlockUIState) {
    this._state = state
    this.ui.updateState(state)
  }
  public appendToContainer(appendTarget: HTMLElement) {
    this.ui.show(appendTarget)
  }
  private prepareUI() {
    this.ui.updateTarget(this.targetUser)
    this.handleEvents()
  }
  private handleEvents() {
    this.ui.on('ui-close', () => {
      const shouldConfirmStates = [
        ChainBlockUIState.Running,
        ChainBlockUIState.RateLimited,
        ChainBlockUIState.Initial,
      ]
      /*
      const shouldStopStates = [
        ChainBlockUIState.Running,
        ChainBlockUIState.RateLimited
      ]
      */
      // const shouldStop = shouldStopStates.includes(this.state)
      const shouldConfirm = shouldConfirmStates.includes(this.state)
      const shouldClose =
        !shouldConfirm ||
        (shouldConfirm && window.confirm('체인블락을 중단할까요?'))
      if (shouldClose) {
        /*
        if (shouldStop) {
          this.stop()
        }
        */
        this.close()
      }
    })
  }
  public stop() {
    this.state = ChainBlockUIState.Stopped
    this.ui.stop(copyFrozenObject(this.progress))
    this.emit('stop')
  }
  public complete() {
    this.state = ChainBlockUIState.Completed
    this.ui.complete(copyFrozenObject(this.progress))
    this.emit('complete')
  }
  public close() {
    this.ui.close()
    this.emit('close')
  }
  private async rateLimited() {
    this.state = ChainBlockUIState.RateLimited
    const limits = await TwitterAPI.getRateLimitStatus()
    const followerLimit = limits.followers['/followers/list']
    this.ui.rateLimited(followerLimit)
    this.emit('rate-limit', followerLimit)
  }
  private rateLimitResetted() {
    this.state = ChainBlockUIState.Running
    this.ui.rateLimitResetted()
    this.emit('rate-limit-reset', undefined)
  }
  private checkUserSkip(
    follower: TwitterUser
  ): 'alreadyBlocked' | 'skipped' | null {
    if (follower.blocking) {
      return 'alreadyBlocked'
    }
    const followSkip = _.some([
      follower.following,
      follower.followed_by,
      follower.follow_request_sent,
    ])
    if (followSkip) {
      return 'skipped'
    }
    if (follower.followers_count > 50000 || follower.friends_count > 50000) {
      return 'skipped'
    }
    if (follower.verified) {
      return 'skipped'
    }
    return null
  }
  public async start() {
    const updateProgress = (up: ChainBlockProgressUpdate) => {
      this.progress[up.reason]++
      this.emit('update-progress', copyFrozenObject(this.progress))
      this.ui.updateProgress(copyFrozenObject(this.progress))
      this.ui.updateProgressUser(copyFrozenObject(up))
    }
    const followerScraperOptions = {
      delay: 300,
    }
    try {
      const blockPromises: Promise<void>[] = []
      let stopped = false
      for await (const follower of TwitterAPI.getAllFollowers(
        this.targetUser,
        followerScraperOptions
      )) {
        const shouldStop = [
          ChainBlockUIState.Closed,
          ChainBlockUIState.Stopped,
        ].includes(this.state)
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
        if (this.state === ChainBlockUIState.RateLimited) {
          this.rateLimitResetted()
        }
        this.state = ChainBlockUIState.Running
        const shouldSkip = this.checkUserSkip(follower)
        if (shouldSkip) {
          updateProgress({
            reason: shouldSkip,
            user: follower,
          })
          continue
        }
        blockPromises.push(
          TwitterAPI.blockUser(follower).then((blocked: boolean) => {
            const blockResult = blocked ? 'blockSuccess' : 'blockFail'
            updateProgress({
              reason: blockResult,
              user: follower,
            })
          })
        )
        if (blockPromises.length >= 60) {
          await Promise.all(blockPromises).then(() => {
            blockPromises.length = 0
          })
        }
      }
      await Promise.all(blockPromises)
      if (stopped) {
        this.stop()
      } else {
        this.complete()
      }
    } catch (err) {
      const error = err as Error
      this.state = ChainBlockUIState.Error
      this.ui.error(error.message)
      this.emit('error', error.message)
      throw err
    }
  }
}
