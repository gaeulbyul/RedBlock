import { SessionStatus, isRunningSession, isRewindableSession, isExportableTarget } from '../common'
import * as TextGenerate from '../text-generate'
import { alertToCurrentTab, notify, updateExtensionBadge } from './background'
import { markUser } from './misc'
import { TargetCheckResult, validateRequest, isSameTarget } from './target-checker'
import { ChainBlockSession, ExportSession } from './chainblock-session/session'
import { loadOptions } from './storage'
import { exportBlocklist } from './blocklist-process'
import * as i18n from '~~/scripts/i18n'

export default class ChainBlocker {
  private readonly MAX_RUNNING_SESSIONS = 5
  private readonly sessions = new Map<string, Session>()
  constructor() {}
  public hasRunningSession(): boolean {
    if (this.sessions.size <= 0) {
      return false
    }
    const currentRunningSessions = this.getCurrentRunningSessions()
    return currentRunningSessions.length > 0
  }
  private getCurrentRunningSessions() {
    const currentRunningSessions = Array.from(this.sessions.values()).filter(session =>
      isRunningSession(session.getSessionInfo())
    )
    return currentRunningSessions
  }
  private getSessionByTarget(target: AnySessionTarget): Session | null {
    return (
      this.getCurrentRunningSessions().find(session =>
        isSameTarget(session.getSessionInfo().request.target, target)
      ) || null
    )
  }
  private handleEvents(session: Session) {
    session.eventEmitter.on('started', () => {
      this.updateBadge()
    })
    session.eventEmitter.on('complete', async info => {
      const { sessionId } = info
      const message = TextGenerate.generateSessionCompleteNotificationMessage(info)
      notify(message)
      this.startRemainingSessions()
      this.updateBadge()
      const options = await loadOptions()
      if (options.removeSessionAfterComplete && info.request.purpose.type !== 'export') {
        this.remove(sessionId)
      }
    })
    session.eventEmitter.on('stopped', () => {
      this.startRemainingSessions()
      this.updateBadge()
    })
    session.eventEmitter.on('error', error => {
      notify(`${i18n.getMessage('error_occured')}:\n${error}`)
      this.updateBadge()
    })
    session.eventEmitter.on('mark-user', params => {
      markUser(params)
    })
  }
  private updateBadge() {
    const runningSessions = this.getCurrentRunningSessions().map(session =>
      session.getSessionInfo()
    )
    const count = runningSessions.length
    updateExtensionBadge(count)
  }
  private checkAvailableSessionsCount() {
    const runningSessions = this.getCurrentRunningSessions()
    return this.MAX_RUNNING_SESSIONS - runningSessions.length
  }
  private async startRemainingSessions() {
    for (const session of this.sessions.values()) {
      const count = this.checkAvailableSessionsCount()
      if (count <= 0) {
        break
      }
      const sessionInfo = session.getSessionInfo()
      if (sessionInfo.status === SessionStatus.Initial) {
        await session.start()
      }
    }
  }
  private checkAlreadyRunningOnSameTarget(target: AnySessionTarget): boolean {
    const sameTargetSession = this.getSessionByTarget(target)
    if (sameTargetSession) {
      const sessionInfo = sameTargetSession.getSessionInfo()
      if (isRunningSession(sessionInfo)) {
        return true
      }
    }
    return false
  }
  public remove(sessionId: string) {
    this.sessions.delete(sessionId)
    this.updateBadge()
  }
  private createSession(request: SessionRequest<AnySessionTarget>) {
    let session: Session
    switch (request.purpose.type) {
      case 'chainblock':
      case 'unchainblock':
      case 'lockpicker':
      case 'chainunfollow':
      case 'chainmute':
      case 'unchainmute':
        session = new ChainBlockSession(request)
        break
      case 'export':
        if (!isExportableTarget(request.target)) {
          throw new Error('attempted to start export session with non-exportable request')
        }
        session = new ExportSession(request as SessionRequest<ExportableSessionTarget>)
        break
    }
    this.handleEvents(session)
    this.sessions.set(session.getSessionInfo().sessionId, session)
    return session
  }
  public add(request: SessionRequest<AnySessionTarget>): Either<TargetCheckResult, string> {
    const isValidTarget = validateRequest(request)
    if (isValidTarget !== TargetCheckResult.Ok) {
      throw new Error(TextGenerate.checkResultToString(isValidTarget))
    }
    const session = this.createSession(request)
    const sessionId = session.getSessionInfo().sessionId
    return {
      ok: true,
      value: sessionId,
    }
  }
  public stop(sessionId: string) {
    const session = this.sessions.get(sessionId)!
    session.stop()
    this.remove(sessionId)
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
    this.updateBadge()
  }
  public async start(sessionId: string) {
    const count = this.checkAvailableSessionsCount()
    if (count <= 0) {
      return
    }
    const session = this.sessions.get(sessionId)!
    await session.start()
    this.updateBadge()
  }
  public async startAll() {
    const sessions = this.sessions.values()
    const sessionPromises: Promise<void>[] = []
    for (const session of sessions) {
      const count = this.checkAvailableSessionsCount()
      if (count <= 0) {
        break
      }
      const sessionInfo = session.getSessionInfo()
      if (sessionInfo.status === SessionStatus.Initial) {
        sessionPromises.push(session.start().catch(() => {}))
      }
    }
    await Promise.all(sessionPromises)
    this.updateBadge()
  }
  public async rewind(sessionId: string) {
    const session = this.sessions.get(sessionId)!
    if (isRewindableSession(session.getSessionInfo())) {
      session.rewind()
      this.updateBadge()
      await session.start()
    }
  }
  public getAllSessionInfos(): SessionInfo[] {
    return Array.from(this.sessions.values()).map(ses => ses.getSessionInfo())
  }
  public cleanupInactiveSessions() {
    for (const [, session] of this.sessions) {
      const sessionInfo = session.getSessionInfo()
      if (isRunningSession(sessionInfo)) {
        continue
      }
      if (sessionInfo.request.purpose.type === 'export') {
        if (!sessionInfo.exported) {
          continue
        }
      }
      this.remove(sessionInfo.sessionId)
    }
    this.updateBadge()
  }
  public downloadFileFromExportSession(sessionId: string) {
    const session = this.sessions.get(sessionId)! as ExportSession
    if (session.getSessionInfo().request.purpose.type !== 'export') {
      throw new Error('unreachable - this session is not export-session')
    }
    const exportResult = session.getExportResult()
    if (exportResult.userIds.size > 0) {
      exportBlocklist(exportResult)
      session.markAsExported()
    } else {
      alertToCurrentTab(i18n.getMessage('blocklist_is_empty'))
    }
  }
  public checkRequest(request: SessionRequest<AnySessionTarget>): TargetCheckResult {
    if (this.checkAlreadyRunningOnSameTarget(request.target)) {
      return TargetCheckResult.AlreadyRunningOnSameTarget
    }
    return validateRequest(request)
  }
}
