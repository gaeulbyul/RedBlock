import * as Scraper from './scraper.js'
import * as IdScraper from './userid-scraper.js'
import * as TwitterAPI from '../twitter-api.js'
import { TwClient } from '../twitter-api.js'
import {
  EventEmitter,
  SessionStatus,
  copyFrozenObject,
  sleep,
  getCountOfUsersToBlock,
  assertNever,
} from '../../common.js'
import BlockLimiter from '../block-limiter.js'
import { decideWhatToDoGivenUser } from './user-decider.js'

interface SessionEventEmitter {
  'mark-user': MarkUserParams
  'rate-limit': TwitterAPI.Limit
  'rate-limit-reset': null
  started: SessionInfo
  stopped: SessionInfo
  complete: SessionInfo
  error: string
}

// 더 나은 타입이름 없을까...
type ApiKind = FollowKind | 'tweet-reactions' | 'lookup-users' | 'search'

function extractRateLimit(
  limitStatuses: TwitterAPI.LimitStatus,
  apiKind: ApiKind
): TwitterAPI.Limit {
  switch (apiKind) {
    case 'followers':
      return limitStatuses.followers['/followers/list']
    case 'friends':
      return limitStatuses.friends['/friends/list']
    case 'mutual-followers':
      return limitStatuses.followers['/followers/list']
    case 'tweet-reactions':
      return limitStatuses.statuses['/statuses/retweeted_by']
    case 'lookup-users':
      return limitStatuses.users['/users/lookup']
    case 'search':
      return limitStatuses.search['/search/adaptive']
  }
}

abstract class BaseSession {
  protected shouldStop = false
  protected readonly sessionInfo = this.initSessionInfo()
  public readonly eventEmitter = new EventEmitter<SessionEventEmitter>()
  public constructor(protected twClient: TwClient, protected request: SessionRequest) {}
  public getSessionInfo() {
    return copyFrozenObject(this.sessionInfo)
  }
  public async stop() {
    this.shouldStop = true
    return new Promise(resolve => {
      this.eventEmitter.on('stopped', resolve)
    })
  }
  public async rewind() {
    this.resetCounts()
    this.sessionInfo.status = SessionStatus.Initial
  }
  protected initProgress(): SessionInfo['progress'] {
    return {
      already: 0,
      success: {
        Block: 0,
        UnBlock: 0,
        Mute: 0,
        UnMute: 0,
        UnFollow: 0,
        BlockAndUnBlock: 0,
      },
      failure: 0,
      skipped: 0,
      error: 0,
      scraped: 0,
      total: getCountOfUsersToBlock(this.request),
    }
  }
  protected resetCounts() {
    this.sessionInfo.progress = this.initProgress()
  }
  protected initSessionInfo(): SessionInfo {
    return {
      sessionId: this.generateSessionId(),
      request: this.request,
      progress: this.initProgress(),
      status: SessionStatus.Initial,
      limit: null,
    }
  }
  protected generateSessionId(): string {
    return `session/${Date.now()}`
  }
  protected async handleRateLimit() {
    const { sessionInfo, eventEmitter } = this
    let apiKind: ApiKind
    switch (this.request.target.type) {
      case 'follower':
      case 'lockpicker':
        apiKind = this.request.target.list
        break
      case 'tweet_reaction':
        apiKind = 'tweet-reactions'
        break
      case 'import':
        apiKind = 'lookup-users'
        break
      case 'user_search':
        apiKind = 'search'
        break
    }
    sessionInfo.status = SessionStatus.RateLimited
    const limitStatuses = await this.twClient.getRateLimitStatus()
    const limit = extractRateLimit(limitStatuses, apiKind)
    sessionInfo.limit = limit
    eventEmitter.emit('rate-limit', limit)
  }
  protected handleRunning() {
    const { sessionInfo, eventEmitter } = this
    if (sessionInfo.status === SessionStatus.Initial) {
      eventEmitter.emit('started', sessionInfo)
    }
    if (sessionInfo.status === SessionStatus.RateLimited) {
      eventEmitter.emit('rate-limit-reset', null)
    }
    sessionInfo.limit = null
    sessionInfo.status = SessionStatus.Running
  }
}

export class ChainBlockSession extends BaseSession {
  private readonly scraper = Scraper.initScraper(this.twClient, this.request)
  public constructor(protected twClient: TwClient, protected request: SessionRequest) {
    super(twClient, request)
  }
  public async start() {
    const DBG_dontActuallyCallAPI = localStorage.getItem('RedBlock FakeAPI') === 'true'
    if (DBG_dontActuallyCallAPI) {
      console.warn("WARNING: RedBlock FakeAPI mode detected! won't call actual api")
    }
    const now = dayjs()
    let stopped = false
    if (this.checkBlockLimiter() !== 'ok') {
      this.stop()
    } else
      try {
        const scrapedUserIds = new Set<string>()
        for await (const scraperResponse of this.scraper) {
          if (this.shouldStop) {
            stopped = true
            break
          }
          this.sessionInfo.progress.scraped = this.calculateScrapedCount()
          if (!scraperResponse.ok) {
            if (scraperResponse.error instanceof TwitterAPI.RateLimitError) {
              this.handleRateLimit()
              const second = 1000
              const minute = second * 60
              await sleep(1 * minute)
              continue
            } else {
              throw scraperResponse.error
            }
          }
          if (this.sessionInfo.progress.total === null) {
            this.sessionInfo.progress.total = this.scraper.totalCount
          }
          this.handleRunning()
          // promisesBuffer= 차단해제, 뮤트해제 등
          const promisesBuffer: Promise<any>[] = []
          // miniBuffer= 차단, 뮤트 등 많이 쓰면 제한 걸리는 API용
          const miniBuffer: Promise<any>[] = []
          for (const user of scraperResponse.value.users) {
            if (this.shouldStop) {
              stopped = true
              break
            }
            if (scrapedUserIds.has(user.id_str)) {
              continue
            }
            scrapedUserIds.add(user.id_str)
            if (this.checkBlockLimiter() !== 'ok') {
              this.stop()
              break
            }
            const thisIsMe = user.id_str === this.request.myself.id_str
            const whatToDo = decideWhatToDoGivenUser(this.request, user, now)
            console.debug('user %o => %s', user, whatToDo)
            if (whatToDo === 'Skip' || thisIsMe) {
              this.sessionInfo.progress.skipped++
              continue
            } else if (whatToDo === 'AlreadyDone') {
              this.sessionInfo.progress.already++
              continue
            }
            let promise: Promise<TwitterUser>
            if (DBG_dontActuallyCallAPI) {
              promise = Promise.resolve(user)
            } else {
              switch (whatToDo) {
                case 'Block':
                  promise = this.twClient.blockUser(user)
                  break
                case 'Mute':
                  promise = this.twClient.muteUser(user)
                  break
                case 'UnBlock':
                  promise = this.twClient.unblockUser(user)
                  break
                case 'UnMute':
                  promise = this.twClient.unmuteUser(user)
                  break
                case 'UnFollow':
                  promise = this.twClient.unfollowUser(user)
                  break
                case 'BlockAndUnBlock':
                  promise = this.twClient
                    .blockUser(user)
                    .then(blockedUser => this.twClient.unblockUser(blockedUser))
                  break
              }
            }
            promise = promise.then(result => {
              if (result) {
                this.sessionInfo.progress.success[whatToDo]++
                this.eventEmitter.emit('mark-user', {
                  userId: user.id_str,
                  userAction: whatToDo,
                })
              } else {
                this.sessionInfo.progress.failure++
              }
              this.sessionInfo.progress.scraped = this.calculateScrapedCount()
              return result
            })
            switch (whatToDo) {
              case 'Block':
              case 'Mute':
              case 'BlockAndUnBlock':
                // await promise
                miniBuffer.push(promise)
                break
              case 'UnBlock':
              case 'UnMute':
              case 'UnFollow':
                promisesBuffer.push(promise)
                break
              default:
                assertNever(whatToDo)
                break
            }
            if (this.request.options.throttleBlockRequest && miniBuffer.length >= 1) {
              await Promise.allSettled(miniBuffer)
              miniBuffer.length = 0
              await sleep(1000)
            }
          }
          await Promise.allSettled([...miniBuffer, ...promisesBuffer])
          miniBuffer.length = 0
          promisesBuffer.length = 0
        }
        if (stopped) {
          this.sessionInfo.status = SessionStatus.Stopped
          this.eventEmitter.emit('stopped', this.getSessionInfo())
        } else {
          this.sessionInfo.status = SessionStatus.Completed
          this.eventEmitter.emit('complete', this.getSessionInfo())
        }
      } catch (error) {
        this.sessionInfo.status = SessionStatus.Error
        this.eventEmitter.emit('error', error.toString())
        throw error
      }
  }
  private calculateScrapedCount() {
    const { success, already, failure, error, skipped } = this.sessionInfo.progress
    return _.sum([...Object.values(success), already, failure, error, skipped])
  }
  private checkBlockLimiter() {
    const safePurposes: Purpose['type'][] = ['unchainblock', 'unchainmute', 'chainunfollow']
    if (safePurposes.includes(this.request.purpose.type)) {
      return 'ok'
    } else {
      const limiter = new BlockLimiter(this.request.myself.id_str)
      return limiter.check()
    }
  }
}

export class ExportSession extends BaseSession {
  private readonly scraper = IdScraper.initIdScraper(this.twClient, this.request)
  private exportResult: ExportResult = {
    filename: this.generateFilename(this.request.target),
    userIds: new Set<string>(),
  }
  public constructor(protected twClient: TwClient, protected request: ExportableSessionRequest) {
    super(twClient, request)
  }
  public getExportResult(): ExportResult {
    return this.exportResult
  }
  public markAsExported() {
    this.sessionInfo.exported = true
  }
  public async start() {
    let stopped = false
    try {
      const scrapedUserIds = this.exportResult.userIds
      for await (const scraperResponse of this.scraper) {
        // NOTE: 사이즈 올리게 되면 번역파일도 수정할것
        if (this.shouldStop || scrapedUserIds.size > 100000) {
          stopped = this.shouldStop
          break
        }
        if (!scraperResponse.ok) {
          if (scraperResponse.error instanceof TwitterAPI.RateLimitError) {
            this.handleRateLimit()
            const second = 1000
            const minute = second * 60
            await sleep(1 * minute)
            continue
          } else {
            throw scraperResponse.error
          }
        }
        if (this.sessionInfo.progress.total === null) {
          this.sessionInfo.progress.total = this.scraper.totalCount
        }
        this.handleRunning()
        scraperResponse.value.ids.forEach(id => scrapedUserIds.add(id))
        this.sessionInfo.progress.scraped = scrapedUserIds.size
      }
      if (stopped) {
        this.sessionInfo.status = SessionStatus.Stopped
        this.eventEmitter.emit('stopped', this.getSessionInfo())
      } else {
        this.sessionInfo.status = SessionStatus.Completed
        this.eventEmitter.emit('complete', this.getSessionInfo())
      }
      this.exportResult = {
        filename: this.generateFilename(this.request.target),
        userIds: scrapedUserIds,
      }
    } catch (error) {
      this.sessionInfo.status = SessionStatus.Error
      this.eventEmitter.emit('error', error.toString())
      throw error
    }
  }
  private generateFilename(target: ExportableSessionRequest['target']): string {
    const now = dayjs()
    let targetStr: string
    switch (target.type) {
      case 'follower':
        targetStr = `user-${target.user.screen_name}`
        break
      case 'tweet_reaction':
        targetStr = `tweet-${target.tweet.user.screen_name}-${target.tweet.id_str}`
        break
    }
    const datetime = now.format('YYYY-MM-DD_HHmmss')
    return `blocklist-${targetStr}[${datetime}].csv`
  }
}
