namespace RedBlock.Background.ChainBlock {
  export class ChainBlocker {
    private readonly sessions: Map<string, ChainBlockSession> = new Map()
    constructor() {}
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
    public add(targetUser: TwitterUser, options: ChainBlockSessionOptions): string | null {
      const sessionId = this.generateSessionId(targetUser)
      if (this.sessions.has(sessionId)) {
        window.alert(`이미 ${targetUser.screen_name}에게 체인블락이 실행중입니다.`)
        return null
      }
      const session = new ChainBlockSession({
        sessionId,
        targetUser,
        options,
      })
      this.sessions.set(sessionId, session)
      return sessionId
    }
    public async prepare(sessionId: string): Promise<void> {
      const session = this.sessions.get(sessionId)
      if (!session) {
        throw new Error(`id ${sessionId}인 세션을 찾을 수 없습니다`)
      }
      return session.prepare()
    }
    public stop(sessionId: string) {
      const session = this.sessions.get(sessionId)
      if (!session) {
        throw new Error(`id ${sessionId}인 세션을 찾을 수 없습니다`)
      }
      session.stop()
      this.sessions.delete(sessionId)
    }
    public async start(sessionId: string) {
      const session = this.sessions.get(sessionId)
      if (!session) {
        throw new Error(`id ${sessionId}인 세션을 찾을 수 없습니다`)
      }
      return session.start()
    }
    public async startAll() {
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
        const { status, options, progress, targetUser, totalCount, limit } = session
        const target = {
          user: targetUser,
          totalCount,
        }
        result[sessionId] = { status, options, progress, target, limit }
      }
      return result
    }
  }
}
