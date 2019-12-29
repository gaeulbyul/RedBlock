import { copyFrozenObject, EventEmitter, SessionStatus } from '../../common.js'
import * as TwitterAPI from '../twitter-api.js'
import { generateSessionId, ISession, SessionEventEmitter, SessionInfo, SessionRequest } from './session-common.js'

type Tweet = TwitterAPI.Tweet

export interface TweetReactionBlockSessionRequest {
  // 이미 차단한 사용자의 RT/마음은 확인할 수 없다.
  // 따라서, 언체인블락은 구현할 수 없다.
  purpose: 'chainblock'
  target: {
    type: 'tweetReaction'
    // author of tweet
    // user: TwitterUser
    tweet: Tweet
    reaction: ReactionKind
  }
  options: {
    myFollowers: Verb
    myFollowings: Verb
    verified: Verb
  }
}

export default class TweetReactionBlockSession implements ISession<TweetReactionBlockSessionRequest> {
  private readonly sessionInfo = this.initSessionInfo()
  private shouldStop = false
  public readonly eventEmitter = new EventEmitter<SessionEventEmitter>()
  public constructor(private request: TweetReactionBlockSessionRequest) {}
  public isSameTarget(givenTarget: SessionRequest['target']) {
    if (givenTarget.type !== 'tweetReaction') {
      return false
    }
    const thisTargetTweetId = this.sessionInfo.request.target.tweet.id_str
    const givenTweetId = givenTarget.tweet.id_str
    return thisTargetTweetId === givenTweetId
  }
  public async start() {
    this.shouldStop
    throw new Error('not implemented')
  }
  public stop() {
    this.shouldStop = false
  }
  public getSessionInfo() {
    return copyFrozenObject(this.sessionInfo)
  }
  private initCount(): SessionInfo<TweetReactionBlockSessionRequest>['count'] {
    return {
      scraped: 0,
      total: 0,
    }
  }
  private initSessionInfo(): SessionInfo<TweetReactionBlockSessionRequest> {
    return {
      sessionId: generateSessionId(),
      request: this.request,
      progress: {
        already: 0,
        success: {
          Block: 0,
          UnBlock: 0,
          Mute: 0,
          UnMute: 0,
        },
        failure: 0,
        skipped: 0,
        error: 0,
      },
      count: this.initCount(),
      status: SessionStatus.Initial,
      limit: null,
    }
  }
}
