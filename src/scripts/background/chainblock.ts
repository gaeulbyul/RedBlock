namespace RedBlock.Background.ChainBlock {
  const { Storage, notify } = RedBlock.Background
  export class ChainBlocker {
    private readonly sessions: Map<string, ChainBlockSession> = new Map()
    private readonly storageQueue = Promise.resolve()
    constructor() {}
    private generateSessionId(user: TwitterUser, options: ChainBlockSessionOptions): string {
      return `session/${user.screen_name}/${options.targetList}/${Date.now()}`
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
    public isAlreadyRunningForUser(givenUser: TwitterUser, givenOptions: ChainBlockSessionOptions): boolean {
      for (const session of this.sessions.values()) {
        const { targetUser } = session
        const isSameUser = targetUser.id_str === givenUser.id_str
        const isSameList = session.options.targetList === givenOptions.targetList
        if (isSameUser && isSameList) {
          return true
        }
      }
      return false
      //
    }
    private handleEvents(session: ChainBlockSession) {
      const { targetUser, options } = session
      const { screen_name } = targetUser
      let targetListKor: string
      switch (options.targetList) {
        case 'followers':
          targetListKor = '팔로워'
          break
        case 'friends':
          targetListKor = '팔로잉'
          break
      }
      session.on('start', () => {
        const message = `지금부터 @${screen_name}에게 체인블락을 실행합니다. 진행상황은 확장기능 버튼을 눌러 확인해주세요.`
        notify(message)
      })
      session.on('complete', () => {
        const { blockSuccess, alreadyBlocked, skipped, blockFail } = session.progress
        let message = `체인블락 완료! @${screen_name}의 ${targetListKor} 중 ${blockSuccess}명을 차단했습니다.\n`
        message += `(이미 차단함: ${alreadyBlocked}, 스킵: ${skipped}, 실패: ${blockFail})`
        notify(message)
      })
      session.on('error', err => {
        let message = `체인블락 오류! 메시지:\n`
        message += err
        notify(message)
      })
    }
    public add(targetUser: TwitterUser, options: ChainBlockSessionOptions): string | null {
      if (this.isAlreadyRunningForUser(targetUser, options)) {
        window.alert(`이미 @${targetUser.screen_name}에게 체인블락이 실행중입니다.`)
        return null
      }
      const sessionId = this.generateSessionId(targetUser, options)
      const session = new ChainBlockSession({
        sessionId,
        targetUser,
        options,
      })
      this.handleEvents(session)
      this.sessions.set(sessionId, session)
      if (options.saveTargetUser) {
        this.storageQueue.then(() => Storage.insertSingleUserAndSave(targetUser))
      } else {
        this.storageQueue.then(() => Storage.removeSingleUserAndSave(targetUser))
      }
      return sessionId
    }
    public stop(sessionId: string) {
      const session = this.sessions.get(sessionId)!
      session.stop()
      this.sessions.delete(sessionId)
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
        if (session.status === ChainBlockSessionStatus.Initial) {
          sessionPromises.push(session.start().catch(() => {}))
        }
      }
      return Promise.all(sessionPromises)
    }
    public getAllSessionsProgress(): ChainBlockSessionInfo[] {
      const result: ChainBlockSessionInfo[] = []
      for (const [sessionId, session] of this.sessions.entries()) {
        const { status, options, progress, targetUser, totalCount, limit } = session
        const target = {
          user: targetUser,
          totalCount,
        }
        result.push({
          sessionId,
          status,
          options,
          progress,
          target,
          limit,
        })
      }
      return result
    }
  }
}
