import { SessionStatus, isRunningStatus } from '../common.js'
import * as TextGenerate from '../text-generate.js'
import * as i18n from '../i18n.js'
import { alert, notify, updateExtensionBadge } from './background.js'
import ChainBlockSession from './chainblock-session/session.js'
import { loadOptions } from './storage.js'

export default class ChainBlocker {
  private readonly MAX_RUNNING_SESSIONS = 5
  private readonly sessions = new Map<string, ChainBlockSession>()
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
      isRunningStatus(session.getSessionInfo().status)
    )
    return currentRunningSessions
  }
  public isAlreadyRunning(target: SessionInfo['request']['target']): boolean {
    for (const session of this.getCurrentRunningSessions()) {
      if (session.isSameTarget(target)) {
        return true
      }
    }
    return false
  }
  private async markUser(params: MarkUserParams) {
    const tabs = await browser.tabs.query({
      discarded: false,
      url: ['https://twitter.com/*', 'https://mobile.twitter.com/*'],
    })
    tabs.forEach(tab => {
      const id = tab.id
      if (typeof id !== 'number') {
        return
      }
      browser.tabs
        .sendMessage<RBMessages.MarkUser>(id, {
          messageType: 'MarkUser',
          ...params,
        })
        .catch(() => {})
    })
  }
  private async markManyUsersAsBlocked({ userIds }: MarkManyUsersAsBlockedParams) {
    const tabs = await browser.tabs.query({
      discarded: false,
      url: ['https://twitter.com/*', 'https://mobile.twitter.com/*'],
    })
    tabs.forEach(tab => {
      const id = tab.id
      if (typeof id !== 'number') {
        return
      }
      browser.tabs
        .sendMessage<RBMessages.MarkManyUsersAsBlocked>(id, {
          messageType: 'MarkManyUsersAsBlocked',
          userIds,
        })
        .catch(() => {})
    })
  }
  private handleEvents(session: ChainBlockSession) {
    session.eventEmitter.on('started', () => {
      this.updateBadge()
    })
    session.eventEmitter.on('complete', async info => {
      const { sessionId } = info
      const message = TextGenerate.chainBlockResultNotification(info)
      notify(message)
      this.startRemainingSessions()
      this.updateBadge()
      const options = await loadOptions()
      if (options.removeSessionAfterComplete) {
        this.removeSession(sessionId)
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
      this.markUser(params)
    })
    session.eventEmitter.on('mark-many-users-as-blocked', ({ userIds }) => {
      this.markManyUsersAsBlocked({ userIds })
    })
  }
  private updateBadge() {
    const runningSessions = this.getCurrentRunningSessions().map(session => session.getSessionInfo())
    console.debug('updateExtensionBadge(%o)', runningSessions)
    updateExtensionBadge(runningSessions)
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
  private removeSession(sessionId: string) {
    const session = this.sessions.get(sessionId)!
    if (isRunningStatus(session.getSessionInfo().status)) {
      throw new Error(`attempted to remove running session! [id=${sessionId}]`)
    }
    this.sessions.delete(sessionId)
  }
  public add(request: SessionRequest) {
    const { target } = request
    if (this.isAlreadyRunning(target)) {
      alert(i18n.getMessage('already_running_to_same_target'))
      return null
    }
    const session = new ChainBlockSession(request)
    const sessionId = session.getSessionInfo().sessionId
    this.handleEvents(session)
    this.sessions.set(sessionId, session)
    return sessionId
  }
  public stop(sessionId: string) {
    const session = this.sessions.get(sessionId)!
    session.stop()
    this.updateBadge()
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
    this.updateBadge()
  }
  public async start(sessionId: string) {
    const count = this.checkAvailableSessionsCount()
    if (count <= 0) {
      return
    }
    const session = this.sessions.get(sessionId)
    if (session) {
      await session.start()
      this.updateBadge()
    }
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
  public getAllSessionInfos(): SessionInfo[] {
    return Array.from(this.sessions.values()).map(ses => ses.getSessionInfo())
  }
  public cleanupSessions() {
    const sessions = this.sessions.values()
    for (const session of sessions) {
      const sessionInfo = session.getSessionInfo()
      if (isRunningStatus(sessionInfo.status)) {
        continue
      }
      this.sessions.delete(sessionInfo.sessionId)
    }
    this.updateBadge()
  }
}
