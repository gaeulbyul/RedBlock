import { copyFrozenObject, EventEmitter, SessionStatus, sleep } from '../../common.js'
import * as TwitterAPI from '../twitter-api.js'
import { MutualFollowerScraper, QuickScraper, SimpleScraper, UserScraper, getFollowersCount } from './scraper.js'
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

export interface FollowerBlockSessionRequest {
  purpose: ChainKind
  target: {
    type: 'follower'
    user: TwitterUser
    list: FollowKind
  }
  options: {
    quickMode: boolean
    myFollowers: Verb
    myFollowings: Verb
    verified: Verb
    mutualBlocked: Verb
  }
}

export default class FollowerBlockSession implements ISession<FollowerBlockSessionRequest> {
  private readonly sessionInfo = initSessionInfo(this.request, this.initCount())
  private shouldStop = false
  public readonly eventEmitter = new EventEmitter<SessionEventEmitter>()
  public constructor(private request: FollowerBlockSessionRequest) {}
  public getSessionInfo() {
    // deep-freeze 하는 게 좋을까?
    return copyFrozenObject(this.sessionInfo)
  }
  public isSameTarget(givenTarget: SessionRequest['target']) {
    if (givenTarget.type !== 'follower') {
      return false
    }
    const givenTargetUser = givenTarget.user
    const thisTargetUser = this.request.target.user
    return thisTargetUser.id_str === givenTargetUser.id_str
  }
  public async start() {
    const promiseBuffer: Promise<void>[] = []
    let stopped = false
    try {
      const scraper = this.initScraper()
      const userScraper = scraper.scrape()
      for await (const maybeFollower of userScraper) {
        this.updateTotalCount(scraper)
        this.sessionInfo.count.scraped = calculateScrapedCount(this.sessionInfo.progress)
        if (this.shouldStop) {
          stopped = true
          promiseBuffer.length = 0
          break
        }
        if (!maybeFollower.ok) {
          if (maybeFollower.error instanceof TwitterAPI.RateLimitError) {
            this.handleRateLimit()
            const second = 1000
            const minute = second * 60
            await sleep(1 * minute)
            continue
          } else {
            throw maybeFollower.error
          }
        }
        this.handleRunning()
        const follower = maybeFollower.value
        const whatToDo = whatToDoGivenUser(this.request, follower)
        if (whatToDo === 'Skip') {
          this.sessionInfo.progress.skipped++
          continue
        } else if (whatToDo === 'AlreadyDone') {
          this.sessionInfo.progress.already++
          continue
        }
        promiseBuffer.push(this.doVerb(follower, whatToDo))
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
    this.shouldStop = true
  }
  private initCount(): SessionInfo['count'] {
    const { user, list } = this.request.target
    const total = getFollowersCount(user, list)
    return {
      scraped: 0,
      total,
    }
  }
  private initScraper() {
    const { options, target } = this.request
    const scraper = options.quickMode ? QuickScraper : SimpleScraper
    switch (target.list) {
      case 'friends':
        return new scraper(target.user, 'friends')
      case 'followers':
        return new scraper(target.user, 'followers')
      case 'mutual-followers':
        return new MutualFollowerScraper(target.user)
    }
  }
  private updateTotalCount(scraper: UserScraper) {
    if (this.sessionInfo.count.total === null) {
      this.sessionInfo.count.total = scraper.totalCount
    }
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
  private async handleRateLimit() {
    this.sessionInfo.status = SessionStatus.RateLimited
    const limitStatuses = await TwitterAPI.getRateLimitStatus()
    const { target } = this.request
    const limit = extractRateLimit(limitStatuses, target.list)
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
}

export const defaultOption: Readonly<FollowerBlockSessionRequest['options']> = Object.freeze({
  quickMode: false,
  myFollowers: 'Skip',
  myFollowings: 'Skip',
  verified: 'Skip',
  mutualBlocked: 'Skip',
})
