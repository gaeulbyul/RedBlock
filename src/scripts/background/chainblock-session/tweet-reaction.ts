import { copyFrozenObject, EventEmitter, SessionStatus, sleep } from '../../common.js'
import * as TwitterAPI from '../twitter-api.js'
import { TweetReactedUserScraper, getReactionsCount } from './scraper.js'
import {
  calculateScrapedCount,
  callAPIFromVerb,
  extractRateLimit,
  initSessionInfo,
  ISession,
  PROMISE_BUFFER_SIZE,
  SessionEventEmitter,
  SessionInfo,
  SessionRequest,
  whatToDoGivenUser,
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
  private shouldStop = false
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
    const promiseBuffer: Promise<void>[] = []
    let stopped = false
    try {
      const scraper = new TweetReactedUserScraper(target.tweet, target.reaction)
      for await (const maybeUser of scraper.scrape()) {
        this.sessionInfo.count.scraped = calculateScrapedCount(this.sessionInfo.progress)
        if (this.shouldStop) {
          stopped = true
          promiseBuffer.length = 0
          break
        }
        if (!maybeUser.ok) {
          if (maybeUser.error instanceof TwitterAPI.RateLimitError) {
            this.handleRateLimit()
            const second = 1000
            const minute = second * 60
            await sleep(1 * minute)
            continue
          } else {
            throw maybeUser.error
          }
        }
        this.handleRunning()
        const reactedUser = maybeUser.value
        const whatToDo = whatToDoGivenUser(this.request, reactedUser)
        if (whatToDo === 'Skip') {
          this.sessionInfo.progress.skipped++
          continue
        } else if (whatToDo === 'AlreadyDone') {
          this.sessionInfo.progress.already++
          continue
        }
        promiseBuffer.push(this.doVerb(reactedUser, whatToDo))
        if (promiseBuffer.length >= PROMISE_BUFFER_SIZE) {
          await Promise.all(promiseBuffer)
          promiseBuffer.length = 0
        }
      }
      await Promise.all(promiseBuffer)
      promiseBuffer.length = 0
      if (!stopped) {
        this.sessionInfo.status = SessionStatus.Completed
        this.eventEmitter.emit('complete', this.sessionInfo.progress)
      }
    } catch (error) {
      this.sessionInfo.status = SessionStatus.Error
      this.eventEmitter.emit('error', error.toString())
      throw error
    }
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
  private async handleRateLimit() {
    this.sessionInfo.status = SessionStatus.RateLimited
    const limitStatuses = await TwitterAPI.getRateLimitStatus()
    const { target } = this.request
    const limit = extractRateLimit(limitStatuses, target.reaction)
    this.sessionInfo.limit = limit
    this.eventEmitter.emit('rate-limit', limit)
  }
  private async handleRunning() {
    if (this.sessionInfo.status === SessionStatus.RateLimited) {
      this.eventEmitter.emit('rate-limit-reset', null)
    }
    this.sessionInfo.status = SessionStatus.Running
    this.sessionInfo.limit = null
  }
  private async doVerb(user: TwitterUser, verb: VerbSomething): Promise<void> {
    const incrementSuccess = (v: VerbSomething) => this.sessionInfo.progress.success[v]++
    const incrementFailure = () => this.sessionInfo.progress.failure++
    const verbResult = await callAPIFromVerb(user, verb).catch(() => void incrementFailure())
    if (verbResult) {
      incrementSuccess(verb)
      this.eventEmitter.emit('mark-user', {
        userId: user.id_str,
        verb,
      })
    }
  }
}

export const defaultOption: Readonly<TweetReactionBlockSessionRequest['options']> = Object.freeze({
  myFollowers: 'Skip',
  myFollowings: 'Skip',
  verified: 'Skip',
})
