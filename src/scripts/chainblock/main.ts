const defaultChainBlockOptions: Readonly<ChainBlockOptions> = Object.freeze({
  useBlockAllAPI: true
})

class ChainBlocker {
  private readonly sessions: Map<string, ChainBlockSession> = new Map
  private readonly container: HTMLElement = document.createElement('div')
  constructor () {
    this.container.className = 'redblock-container'
    document.body.appendChild(this.container)
    window.addEventListener('beforeunload', event => {
      const currentSessionStates = [...this.sessions.values()].map(session => session.state)
      const runningStates = [
        ChainBlockUIState.Running,
        ChainBlockUIState.RateLimited
      ]
      const shouldPreventUnload = currentSessionStates.filter(st => runningStates.includes(st))
      if (shouldPreventUnload.length > 0) {
        event.preventDefault()
        event.returnValue = '[Red Block] 다른 페이지로 이동하게 되면 현재 작동중인 체인블락은 멈추게 됩니다. 그래도 이동하시겠습니까?'
        return event.returnValue
      }
    })
  }
  start (targetUserName: string, optionsInput: Partial<ChainBlockOptions> = {}) {
    if (this.sessions.has(targetUserName)) {
      const ses = this.sessions.get(targetUserName)
      if (ses!.state !== ChainBlockUIState.Closed) {
        window.alert(`이미 ${targetUserName}에게 체인블락이 실행중입니다.`)
        return
      }
    }
    const session = new ChainBlockSession()
    session.on<ChainBlockUIState>('update-ui-state', state => {
      if (state === ChainBlockUIState.Closed) {
        this.sessions.delete(targetUserName)
      }
    })
    session.showUI(this.container)
    session.start(targetUserName, optionsInput)
    this.sessions.set(targetUserName, session)
  }

}

class ChainBlockSession extends EventEmitter {
  private readonly ui = new ChainBlockUI
  constructor () {
    super()
  }
  public showUI(appendTarget: HTMLElement) {
    this.ui.show(appendTarget)
  }
  public stop () {
    this.ui.stop()
  }
  get state () {
    return this.ui.state
  }
  public async start (targetUserName: string, optionsInput: Partial<ChainBlockOptions> = {}) {
    const options = Object.assign({}, defaultChainBlockOptions, optionsInput)
    const ui = this.ui
    ui.on<ChainBlockUIState>('update-state', state => {
      this.emit('update-ui-state', state)
    })
    const targetUser = await TwitterAPI.getSingleUserByName(targetUserName)
    ui.updateTarget(targetUser)
    this.emit('update-target', targetUser)
    const progress: ChainBlockProgress = {
      total: targetUser.followers_count,
      alreadyBlocked: 0,
      skipped: 0,
      blockSuccess: 0,
      blockFail: 0
    }
    const updateProgress = () => {
      ui.updateProgress(Object.assign({}, progress))
      this.emit('update-progress', progress)
    }
    try {
      const blockAllBuffer: TwitterUser[] = []
      const blockPromises: Promise<void>[] = []
      function flushBlockAllBuffer () {
        const ids = blockAllBuffer.map(user => user.id_str)
        blockAllBuffer.length = 0
        blockPromises.push(TwitterExperimentalBlocker.blockAllByIds(ids).then(result => {
          progress.blockSuccess += result.blocked.length
          progress.blockFail += result.failed.length
          if (result.failed.length > 0) {
            console.error('failed to block these users: ', result.failed.join(','))
          }
          updateProgress()
        }))
      }
      for await (const user of TwitterAPI.getAllFollowers(targetUserName)) {
        const shouldStop = [ChainBlockUIState.Closed, ChainBlockUIState.Stopped].includes(ui.state)
        if (shouldStop) {
          break
        }
        if (user === 'RateLimitError') {
          TwitterAPI.getRateLimitStatus().then((limits: LimitStatus) => {
            const followerLimit = limits.followers['/followers/list']
            ui.rateLimited(followerLimit)
            this.emit('rate-limit', followerLimit)
          })
          const second = 1000
          const minute = second * 60
          await sleep(1 * minute)
          continue
        }
        ui.rateLimitResetted()
        this.emit('rate-limit-reset', undefined)
        if (user.blocking) {
          ++progress.alreadyBlocked
          updateProgress()
          continue
        }
        const followSkip = _.some([
          user.following,
          user.followed_by,
          user.follow_request_sent
        ])
        if (followSkip) {
          ++progress.skipped
          updateProgress()
          continue
        }
        if (options.useBlockAllAPI) {
          blockAllBuffer.push(user)
          if (blockAllBuffer.length >= 800) {
            flushBlockAllBuffer()
          }
        } else {
          blockPromises.push(TwitterAPI.blockUser(user).then(blockResult => {
            if (blockResult) {
              ++progress.blockSuccess
            } else {
              ++progress.blockFail
            }
            updateProgress()
          }))
        }
      }
      if (options.useBlockAllAPI && blockAllBuffer.length > 0) {
        flushBlockAllBuffer()
      }
      await Promise.all(blockPromises)
      ui.complete(Object.assign({}, progress))
      this.emit('complete', progress)
    } catch (err) {
      const error = err as Error
      ui.error(error.message)
      this.emit('error', error.message)
      throw err
    }
  }
}
