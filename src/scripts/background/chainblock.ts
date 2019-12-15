namespace RedBlock.Background.ChainBlock {
  const Session = ChainBlockSession.Session
  export class ChainBlocker {
    private readonly sessions = new Map<string, ChainBlockSession.Session>()
    constructor() {}
    public isRunning(): boolean {
      if (this.sessions.size <= 0) {
        return false
      }
      const runningStates = [SessionStatus.Initial, SessionStatus.Running, SessionStatus.RateLimited]
      const currentRunningSessions = Array.from(this.sessions.values()).filter(session =>
        runningStates.includes(session.getSessionInfo().status)
      )
      return currentRunningSessions.length > 0
    }
    public isAlreadyRunningForUser(givenUser: TwitterUser): boolean {
      for (const session of this.sessions.values()) {
        const { target } = session.getSessionInfo().request
        if (target.user.id_str === givenUser.id_str) {
          return true
        }
      }
      return false
    }
    private handleEvents(session: ChainBlockSession.Session) {
      const { target } = session.getSessionInfo().request
      const { screen_name } = target.user
      let targetListKor: string
      switch (target.list) {
        case 'followers':
          targetListKor = '팔로워'
          break
        case 'friends':
          targetListKor = '팔로잉'
          break
      }
      session.statusEventEmitter.on('complete', () => {
        const sessionInfo = session.getSessionInfo()
        // const { purpose } = sessionInfo.request
        const { success, already, skipped, failure } = sessionInfo.progress
        // const whatIDid = purpose === 'chainblock' ? '차단' : '차단해제'
        let message = `체인블락 완료! @${screen_name}의 ${targetListKor} 중 ${success}명을 차단했습니다.\n`
        message += `(이미 차단함: ${already}, 스킵: ${skipped}, 실패: ${failure})`
        notify(message)
      })
      session.statusEventEmitter.on('error', err => {
        let message = `체인블락 오류! 메시지:\n`
        message += err
        notify(message)
      })
    }
    public add(request: ChainBlockSession.SessionRequest) {
      const targetUser = request.target.user
      if (this.isAlreadyRunningForUser(targetUser)) {
        window.alert(`이미 @${targetUser.screen_name}에게 체인블락이 실행중입니다.`)
        return null
      }
      const session = new Session(request)
      const sessionId = session.getSessionInfo().sessionId
      this.handleEvents(session)
      this.sessions.set(sessionId, session)
      return sessionId
    }
    public stop(sessionId: string) {
      const session = this.sessions.get(sessionId)!
      session.stop()
      this.sessions.delete(sessionId)
    }
    public stopAll() {
      const sessions = this.sessions.values()
      for (const session of sessions) {
        const sessionInfo = session.getSessionInfo()
        if (sessionInfo.status === SessionStatus.Stopped) {
          continue
        }
        session.stop()
      }
    }
    public async start(sessionId: string) {
      const session = this.sessions.get(sessionId)
      if (session) {
        return session.start()
      }
    }
    public async startAll() {
      const sessions = this.sessions.values()
      const sessionPromises: Promise<void>[] = []
      for (const session of sessions) {
        const sessionInfo = session.getSessionInfo()
        if (sessionInfo.status === SessionStatus.Initial) {
          sessionPromises.push(session.start().catch(() => {}))
        }
      }
      return Promise.all(sessionPromises)
    }
    public getAllSessionsProgress(): ChainBlockSession.SessionInfo[] {
      return Array.from(this.sessions.values()).map(ses => ses.getSessionInfo())
    }
  }
}
