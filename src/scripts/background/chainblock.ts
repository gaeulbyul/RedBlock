import {
  SessionStatus,
  isRunningSession,
  isRewindableSession,
  checkUserIdBeforeSelfChainBlock,
} from '../common.js'
import * as TextGenerate from '../text-generate.js'
import * as i18n from '../i18n.js'
import { alertToCurrentTab, notify, updateExtensionBadge } from './background.js'
import {
  TargetCheckResult,
  checkImportBlockTarget,
  checkFollowerBlockTarget,
  checkTweetReactionBlockTarget,
  isSameTarget,
} from './target-checker.js'
import { ChainBlockSession, ExportSession } from './chainblock-session/session.js'
import { loadOptions } from './storage.js'
import type BlockLimiter from './block-limiter.js'
import { exportBlocklist } from './blocklist-process.js'

export default class ChainBlocker {
  private readonly MAX_RUNNING_SESSIONS = 5
  private readonly sessions = new Map<string, Session>()
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
    const { target, myself, purpose } = request
    const sameTargetSession = this.getSessionByTarget(target)
    if (sameTargetSession) {
      const sessionInfo = sameTargetSession.getSessionInfo()
      if (isRunningSession(sessionInfo)) {
        return TargetCheckResult.AlreadyRunningOnSameTarget
      }
    }
    if (request.target.type === 'follower') {
      const targetUser = (target as FollowerBlockSessionRequest['target']).user
      const isValidSelfChainBlock = checkUserIdBeforeSelfChainBlock({
        purpose,
        myselfId: myself.id_str,
        givenUserId: targetUser.id_str,
      })
      if (isValidSelfChainBlock.startsWith('invalid')) {
        throw new Error('셀프 체인블락 오폭방지 작동')
      }
    }
    if (request.purpose === 'selfchainblock') {
      // 중복실행여부 및 셀프체인블락 타겟검증 테스트를 통과하면 더 이상 체크할 확인은 없다.
      // (checkFollowerBlockTarget은 target이 상대방일 경우를 상정하며 만든 함수임)
      return TargetCheckResult.Ok
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
  private getSessionByTarget(target: SessionInfo['request']['target']): Session | null {
    for (const session of this.getCurrentRunningSessions()) {
      if (isSameTarget(session.getSessionInfo().request.target, target)) {
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
  private handleEvents(session: Session) {
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
      if (options.removeSessionAfterComplete && info.request.purpose !== 'export') {
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
    const runningSessions = this.getCurrentRunningSessions().map(session =>
      session.getSessionInfo()
    )
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
  public remove(sessionId: string) {
    const session = this.sessions.get(sessionId)!
    if (isRunningSession(session.getSessionInfo())) {
      throw new Error(`attempted to remove running session! [id=${sessionId}]`)
    }
    this.sessions.delete(sessionId)
    this.updateBadge()
  }
  private createSession(request: SessionRequest) {
    let session: Session
    switch (request.purpose) {
      case 'chainblock':
      case 'unchainblock':
      case 'selfchainblock':
        session = new ChainBlockSession(request, this.limiter)
        break
      case 'export':
        session = new ExportSession(request as ExportableSessionRequest)
        break
    }
    this.handleEvents(session)
    this.sessions.set(session.getSessionInfo().sessionId, session)
    return session
  }
  public add(request: SessionRequest): Either<TargetCheckResult, string> {
    const isValidTarget = this.checkTarget(request)
    if (isValidTarget !== TargetCheckResult.Ok) {
      return {
        ok: false,
        error: isValidTarget,
      }
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
      if (sessionInfo.request.purpose === 'export') {
        const exportSession = session as ExportSession
        if (!exportSession.downloaded) {
          continue
        }
      }
      this.remove(sessionInfo.sessionId)
    }
    this.updateBadge()
  }
  public downloadFileFromExportSession(sessionId: string) {
    const session = this.sessions.get(sessionId)! as ExportSession
    if (session.getSessionInfo().request.purpose !== 'export') {
      throw new Error('unreachable - this session is not export-session')
    }
    const exportResult = session.getExportResult()
    if (exportResult.userIds.size > 0) {
      exportBlocklist(exportResult)
      session.downloaded = true
    } else {
      alertToCurrentTab(i18n.getMessage('blocklist_is_empty'))
    }
  }
}
