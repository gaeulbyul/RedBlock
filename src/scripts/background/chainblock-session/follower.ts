import { copyFrozenObject, EventEmitter } from '../../common.js'
import { MutualFollowerScraper, QuickScraper, SimpleScraper, UserScraper, getFollowersCount } from './scraper.js'
import {
  initSessionInfo,
  mainLoop,
  ISession,
  SessionEventEmitter,
  SessionInfo,
  SessionRequest,
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
  protected shouldStop = false
  public readonly eventEmitter = new EventEmitter<SessionEventEmitter>()
  public constructor(private request: FollowerBlockSessionRequest) {}
  public getSessionInfo() {
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
    const scraper = this.initScraper()
    return mainLoop.call(this, scraper)
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
  protected updateTotalCount(scraper: UserScraper) {
    if (this.sessionInfo.count.total === null) {
      this.sessionInfo.count.total = scraper.totalCount
    }
  }
}

export const defaultOption: Readonly<FollowerBlockSessionRequest['options']> = Object.freeze({
  quickMode: false,
  myFollowers: 'Skip',
  myFollowings: 'Skip',
  verified: 'Skip',
  mutualBlocked: 'Skip',
})
