class ChainBlocker {
  private readonly sessions: Map<string, ChainBlockSession> = new Map
  private readonly container: HTMLElement = document.createElement('div')
  private running = false
  constructor () {
    this.container.className = 'redblock-container'
    document.body.appendChild(this.container)
    window.addEventListener('beforeunload', event => {
      const runningStates = [
        ChainBlockUIState.Running,
        ChainBlockUIState.RateLimited
      ]
      const currentSessionStates = [...this.sessions.values()].map(session => session.state)
      const shouldPreventUnload = currentSessionStates.filter(st => runningStates.includes(st))
      if (shouldPreventUnload.length > 0) {
        event.preventDefault()
        event.returnValue = '[Red Block] 다른 페이지로 이동하게 되면 현재 작동중인 체인블락은 멈추게 됩니다. 그래도 이동하시겠습니까?'
        return event.returnValue
      }
    })
  }
  add (targetUser: TwitterUser) {
    const targetUserName = targetUser.screen_name
    if (this.sessions.has(targetUserName)) {
      const ses = this.sessions.get(targetUserName)
      if (ses!.state !== ChainBlockUIState.Closed) {
        window.alert(`이미 ${targetUserName}에게 체인블락이 실행중입니다.`)
        return
      }
    }
    const session = new ChainBlockSession(targetUser)
    session.on<ChainBlockUIState>('update-ui-state', (state: ChainBlockUIState) => {
      if (state === ChainBlockUIState.Closed) {
        this.sessions.delete(targetUserName)
      }
    })
    session.showUI(this.container)
    this.sessions.set(targetUserName, session)
  }
  async start () {
    if (this.running) {
      return
    } else {
      this.running = true
    }
    const sessions = this.sessions.values()
    for (const session of sessions) {
      if (session.state === ChainBlockUIState.Initial) {
        await session.start()
      }
    }
    this.running = false
  }
}

class ChainBlockSession extends EventEmitter {
  private readonly ui = new ChainBlockUI
  private targetUser: TwitterUser
  private __state: ChainBlockUIState = ChainBlockUIState.Initial
  private progress: ChainBlockProgress = {
    total: 0,
    alreadyBlocked: 0,
    skipped: 0,
    blockSuccess: 0,
    blockFail: 0
  }
  constructor (targetUser: TwitterUser) {
    super()
    this.targetUser = targetUser
    this.progress.total = this.targetUser.followers_count
    this.prepareUI()
    this.emit('update-target', targetUser)
  }
  get state (): ChainBlockUIState {
    return this.__state
  }
  set state (state: ChainBlockUIState) {
    this.__state = state
    this.ui.updateState(state)
  }
  public showUI (appendTarget: HTMLElement) {
    this.ui.show(appendTarget)
  }
  private prepareUI () {
    this.ui.updateTarget(this.targetUser)
    this.handleEvents()
  }
  private handleEvents () {
    this.ui.on('redblock-ui-close', () => {
      const shouldNotCloseState = [
        ChainBlockUIState.Running,
        ChainBlockUIState.RateLimited,
        ChainBlockUIState.Initial
      ]
      const shouldNotClose = (shouldNotCloseState.includes(this.state) && !window.confirm('체인블락을 중단할까요?'))
      if (!shouldNotClose) {
        this.ui.stop(this.progress)
        this.ui.close()
      }
    })
  }
  private async rateLimited () {
    const limits = await TwitterAPI.getRateLimitStatus()
    const followerLimit = limits.followers['/followers/list']
    this.state = ChainBlockUIState.RateLimited
    this.ui.rateLimited(followerLimit)
    this.emit('rate-limit', followerLimit)
  }
  private async rateLimitResetted () {
    this.state = ChainBlockUIState.Running
    this.ui.rateLimitResetted()
    this.emit('rate-limit-reset', undefined)
  }
  private checkUserSkip (user: TwitterUser): 'alreadyBlocked' | 'skipped' | null {
    if (user.blocking) {
      return 'alreadyBlocked'
    }
    const followSkip = _.some([
      user.following,
      user.followed_by,
      user.follow_request_sent
    ])
    if (followSkip) {
      return 'skipped'
    }
    return null
  }
  public async start () {
    const {
      ui,
      targetUser
    } = this
    const progress = this.progress
    const updateProgress = () => {
      ui.updateProgress(Object.assign({}, progress))
      this.emit('update-progress', progress)
    }
    try {
      const blockPromises: Promise<void>[] = []
      let stopped = false
      for await (const user of TwitterAPI.getAllFollowers(targetUser.screen_name)) {
        const shouldStop = [ChainBlockUIState.Closed, ChainBlockUIState.Stopped].includes(this.state)
        if (shouldStop) {
          stopped = true
          break
        }
        if (user === 'RateLimitError') {
          this.rateLimited()
          const second = 1000
          const minute = second * 60
          await sleep(1 * minute)
          continue
        }
        this.rateLimitResetted()
        if ('screen_name' in user) {
          const shouldSkip = this.checkUserSkip(user)
          if (shouldSkip) {
            progress[shouldSkip]++
            continue
          }
        }
        let blockUser: Promise<boolean>
        if ('screen_name' in user) {
          blockUser = TwitterAPI.blockUser(user)
        } else {
          blockUser = TwitterAPI.blockUserUnsafe(user)
        }
        blockPromises.push(blockUser.then((blockResult: boolean) => {
          if (blockResult) {
            ++progress.blockSuccess
          } else {
            ++progress.blockFail
          }
          updateProgress()
        }))
      }
      await Promise.all(blockPromises)
      if (stopped) {
        this.state = ChainBlockUIState.Stopped
        ui.stop(Object.assign({}, progress))
        this.emit('stopped', progress)
      } else {
        this.state = ChainBlockUIState.Completed
        ui.complete(Object.assign({}, progress))
        this.emit('complete', progress)
      }
    } catch (err) {
      const error = err as Error
      this.state = ChainBlockUIState.Error
      ui.error(error.message)
      this.emit('error', error.message)
      throw err
    }
  }
}
