import { SessionStatus } from '../common.js'
import * as TextGenerate from '../text-generate.js'
import { alert, notify } from './background.js'
import FollowerBlockSession, { FollowerBlockSessionRequest } from './chainblock-session/follower.js'
import { ISession, SessionInfo, SessionType } from './chainblock-session/session-common.js'
import TweetReactionBlockSession, { TweetReactionBlockSessionRequest } from './chainblock-session/tweet-reaction.js'

export default class ChainBlocker {
  private readonly sessions = new Map<string, SessionType>()
  constructor() {}
  public isRunning(): boolean {
    if (this.sessions.size <= 0) {
      return false
    }
    const currentRunningSessions = this.getCurrentRunningSessions()
    return currentRunningSessions.length > 0
  }
  private getCurrentRunningSessions() {
    const runningStates = [SessionStatus.Initial, SessionStatus.Running, SessionStatus.RateLimited]
    const currentRunningSessions = Array.from(this.sessions.values()).filter(session =>
      runningStates.includes(session.getSessionInfo().status)
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
  private handleEvents(session: ISession) {
    const sessionInfo = session.getSessionInfo()
    session.eventEmitter.on('complete', () => {
      const message = TextGenerate.chainBlockResultNotification(sessionInfo)
      notify(message)
    })
    session.eventEmitter.on('error', err => {
      let message = `오류발생! 메시지:\n`
      message += err
      notify(message)
    })
    session.eventEmitter.on('mark-user', params => {
      this.markUser(params)
    })
  }
  public addFollowerBlockSession(request: FollowerBlockSessionRequest) {
    const { target } = request
    if (this.isAlreadyRunning(target)) {
      alert('이미 같은 대상에게 체인블락이나 언체인블락이 실행중입니다.')
      return null
    }
    const session = new FollowerBlockSession(request)
    const sessionId = session.getSessionInfo().sessionId
    this.handleEvents(session)
    this.sessions.set(sessionId, session)
    return sessionId
  }
  public addTweetReactionBlockSession(request: TweetReactionBlockSessionRequest) {
    const { target } = request
    if (this.isAlreadyRunning(target)) {
      alert('이미 같은 대상에게 체인블락이 실행중입니다.')
      return null
    }
    const session = new TweetReactionBlockSession(request)
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
  public getAllSessionsProgress(): SessionInfo[] {
    return Array.from(this.sessions.values()).map(ses => ses.getSessionInfo())
  }
}
