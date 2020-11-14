import { SessionStatus, isRunningSession, isRewindableSession } from '../common.js'
import * as TextGenerate from '../text-generate.js'
import * as i18n from '../i18n.js'
import { notify, updateExtensionBadge } from './background.js'
import {
  TargetCheckResult,
  checkImportBlockTarget,
  checkFollowerBlockTarget,
  checkTweetReactionBlockTarget,
} from './target-checker.js'
import ChainBlockSession from './chainblock-session/session.js'
import { loadOptions } from './storage.js'
import type BlockLimiter from './block-limiter.js'

export default class ChainBlocker {
  private readonly MAX_RUNNING_SESSIONS = 5
  private readonly sessions = new Map<string, ChainBlockSession>()
  constructor(private readonly limiter: BlockLimiter) {}
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
  public checkTarget(request: SessionRequest): TargetCheckResult {
    const { target } = request
    const sameTargetSession = this.getSessionByTarget(target)
    if (sameTargetSession) {
      const sessionInfo = sameTargetSession.getSessionInfo()
      if (isRunningSession(sessionInfo)) {
        return TargetCheckResult.AlreadyRunningOnSameTarget
      }
    }
    switch (target.type) {
      case 'follower':
        return checkFollowerBlockTarget(target)
      case 'tweet_reaction':
        return checkTweetReactionBlockTarget(target)
      case 'import':
        return checkImportBlockTarget(target)
    }
  }
  public getSessionByTarget(target: SessionInfo['request']['target']): ChainBlockSession | null {
    for (const session of this.getCurrentRunningSessions()) {
      if (session.isSameTarget(target)) {
        return session
      }
    }
    return null
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
        .sendMessage<RBMessageToContent.MarkUser>(id, {
          messageType: 'MarkUser',
          messageTo: 'content',
          ...params,
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
      this.markUser(params)
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
      if (!sessionInfo.confirmed) {
        continue
      }
      if (sessionInfo.status === SessionStatus.Initial) {
        await session.start()
      }
    }
  }
  public remove(sessionId: string) {
    const session = this.sessions.get(sessionId)!
    if (isRunningSession(session.getSessionInfo())) {
      throw new Error(`attempted to remove running session! [id=${sessionId}]`)
    }
    this.sessions.delete(sessionId)
    this.updateBadge()
  }
  private register(session: ChainBlockSession) {
    this.handleEvents(session)
    this.sessions.set(session.getSessionInfo().sessionId, session)
  }
  public add(request: SessionRequest): string {
    const { target } = request
    // 만약 confirm대기 중인데 다시 요청하면 그 세션 다시 써도 될듯
    const sameTargetSession = this.getSessionByTarget(target)
    if (sameTargetSession) {
      const sessionInfo = sameTargetSession.getSessionInfo()
      if (isRunningSession(sessionInfo)) {
        throw new Error('unreachable(attempting run already-running session)')
      }
      return sessionInfo.sessionId
    }
    const session = new ChainBlockSession(request, this.limiter)
    this.register(session)
    const sessionId = session.getSessionInfo().sessionId
    return sessionId
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
  public setConfirmed(sessionId: string) {
    const session = this.sessions.get(sessionId)!
    session.setConfirmed()
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
      if (!sessionInfo.confirmed) {
        continue
      }
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
    this.getAllSessionInfos()
      .filter(session => !isRunningSession(session))
      .forEach(session => this.remove(session.sessionId))
    this.updateBadge()
  }
}
