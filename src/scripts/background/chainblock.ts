interface ChainBlockSessionInfo {
  [sessionId: string]: {
    progress: ChainBlockSessionProgress
    status: ChainBlockSessionStatus
    targetUser: TwitterUser
  }
}

namespace RedBlock.Background.ChainBlock {
  export class ChainBlocker {
    private readonly sessions: Map<string, ChainBlockSession> = new Map()
    constructor() {
      // window.addEventListener('beforeunload', event => {
      //   if (this.isRunning()) {
      //     const message =
      //       '다른 페이지로 이동하게 되면 현재 작동중인 체인블락은 멈추게 됩니다. 그래도 이동하시겠습니까?'
      //     event.preventDefault()
      //     event.returnValue = `[Red Block] ${message}`
      //     return event.returnValue
      //   }
      // })
    }
    private generateSessionId(targetUser: TwitterUser): string {
      return targetUser.screen_name
    }
    public isRunning(): boolean {
      if (this.sessions.size <= 0) {
        return false
      }
      const runningStates = [
        ChainBlockSessionStatus.Initial,
        ChainBlockSessionStatus.Running,
        ChainBlockSessionStatus.RateLimited,
      ]
      const currentRunningSessions = Array.from(this.sessions.values()).filter(session =>
        runningStates.includes(session.status)
      )
      return currentRunningSessions.length > 0
    }
    public add(targetUser: TwitterUser): string | null {
      const sessionId = this.generateSessionId(targetUser)
      if (this.sessions.has(sessionId)) {
        const ses = this.sessions.get(sessionId)!
        if (ses.status !== ChainBlockSessionStatus.Closed) {
          window.alert(`이미 ${targetUser.screen_name}에게 체인블락이 실행중입니다.`)
          return null
        }
      }
      const session = new ChainBlockSession({
        sessionId,
        targetUser,
      })
      // +ui update: add session
      // session.appendToContainer(this.container)
      this.sessions.set(sessionId, session)
      return sessionId
    }
    public stop(sessionId: string) {
      const sessionWillStop = this.sessions.get(sessionId)
      if (!sessionWillStop) {
        return
      }
      sessionWillStop.stop()
      this.sessions.delete(sessionId)
    }
    public async start() {
      const sessions = this.sessions.values()
      const sessionPromises: Promise<void>[] = []
      for (const session of sessions) {
        if (session.status === ChainBlockSessionStatus.Initial) {
          sessionPromises.push(session.start().catch(() => {}))
        }
      }
      return Promise.all(sessionPromises)
    }
    public getAllSessionsProgress(): ChainBlockSessionInfo {
      const result: ChainBlockSessionInfo = {}
      for (const [sessionId, session] of this.sessions.entries()) {
        const { status, progress, targetUser } = session
        result[sessionId] = { status, progress, targetUser }
      }
      return result
    }
  }
}
