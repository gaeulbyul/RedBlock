import FollowerBlockSession from './follower.js'
import TweetReactionBlockSession from './tweet-reaction.js'
import { SessionStatus, EventEmitter } from '../../common.js'
import * as TwitterAPI from '../twitter-api.js'

export { FollowerBlockSessionRequest } from './follower.js'
export { TweetReactionBlockSessionRequest } from './tweet-reaction.js'

export type SessionRequest = FollowerBlockSessionRequest | TweetReactionBlockSessionRequest
export type SessionType = FollowerBlockSession | TweetReactionBlockSession

type Limit = TwitterAPI.Limit
type TwitterUser = TwitterAPI.TwitterUser

export const PROMISE_BUFFER_SIZE = 150

export interface SessionInfo<ReqT = SessionRequest> {
  sessionId: string
  request: ReqT
  progress: {
    success: {
      [verb in VerbSomething]: number
    }
    failure: number
    already: number
    skipped: number
    error: number
  }
  count: {
    scraped: number
    // totalCount: 맞팔로우 체인의 경우, 실행시작 시점에선 정확한 사용자 수를 알 수 없다.
    // 따라서, null을 통해 '아직 알 수 없음'을 표현한다.
    total: number | null
  }
  status: SessionStatus
  limit: Limit | null
}

export interface SessionEventEmitter {
  'mark-user': MarkUserParams
  'rate-limit': Limit
  'rate-limit-reset': null
  complete: SessionInfo['progress']
  error: string
}

export interface ISession<ReqT = SessionRequest> {
  readonly eventEmitter: EventEmitter<SessionEventEmitter>
  start(): Promise<void>
  stop(): void
  getSessionInfo(): SessionInfo<ReqT>
  isSameTarget(givenTarget: SessionRequest['target']): boolean
}

function isAlreadyDone(follower: TwitterUser, verb: Verb): boolean {
  const { blocking, muting } = follower
  let already = false
  if (blocking && verb === 'Block') {
    already = true
  } else if (!blocking && verb === 'UnBlock') {
    already = true
  } else if (muting && verb === 'Mute') {
    already = true
  } else if (!muting && verb === 'UnMute') {
    already = true
  }
  return already
}

export function whatToDoGivenUser(request: SessionRequest, follower: TwitterUser): Verb {
  const { purpose, options } = request
  const { following, followed_by, follow_request_sent } = follower
  const isMyFollowing = following || follow_request_sent
  const isMyFollower = followed_by
  const isMyMutualFollower = isMyFollower && isMyFollowing
  /* 주의!
   * 팝업 UI에 나타난 순서를 고려할 것.
   */
  if (isMyMutualFollower) {
    return 'Skip'
  }
  if (isMyFollower) {
    return options.myFollowers
  }
  if (isMyFollowing) {
    return options.myFollowings
  }
  if (follower.verified) {
    return options.verified
  }
  let defaultVerb: Verb
  switch (purpose) {
    case 'chainblock':
      defaultVerb = 'Block'
      break
    case 'unchainblock':
      defaultVerb = 'UnBlock'
      break
  }
  if (isAlreadyDone(follower, defaultVerb)) {
    return 'AlreadyDone'
  }
  return defaultVerb
}

export function generateSessionId(): string {
  return `session/${Date.now()}`
}
