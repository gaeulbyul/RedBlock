import { copyFrozenObject, EventEmitter } from '../../common.js'
import * as TwitterAPI from '../twitter-api.js'
import { TweetReactedUserScraper, getReactionsCount } from './scraper.js'
import {
  initSessionInfo,
  mainLoop,
  ISession,
  SessionEventEmitter,
  SessionInfo,
  SessionRequest,
} from './session-common.js'

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
  private readonly sessionInfo = initSessionInfo(this.request, this.initCount())
  protected shouldStop = false
  public readonly eventEmitter = new EventEmitter<SessionEventEmitter>()
  public constructor(private request: TweetReactionBlockSessionRequest) {}
  public getSessionInfo() {
    return copyFrozenObject(this.sessionInfo)
  }
  public isSameTarget(givenTarget: SessionRequest['target']) {
    if (givenTarget.type !== 'tweetReaction') {
      return false
    }
    const thisTargetTweetId = this.request.target.tweet.id_str
    const givenTweetId = givenTarget.tweet.id_str
    return thisTargetTweetId === givenTweetId
  }
  public async start() {
    const { target } = this.request
    const scraper = new TweetReactedUserScraper(target.tweet, target.reaction)
    return mainLoop.call(this, scraper)
  }
  public stop() {
    this.shouldStop = false
  }
  private initCount(): SessionInfo<TweetReactionBlockSessionRequest>['count'] {
    const { tweet, reaction } = this.request.target
    return {
      scraped: 0,
      total: getReactionsCount(tweet, reaction),
    }
  }
  protected updateTotalCount(_scraper: any) {
    // does nothing
  }
}

export const defaultOption: Readonly<TweetReactionBlockSessionRequest['options']> = Object.freeze({
  myFollowers: 'Skip',
  myFollowings: 'Skip',
  verified: 'Skip',
})
