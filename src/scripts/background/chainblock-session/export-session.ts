import dayjs from 'dayjs'

import * as TwitterAPI from '\\/scripts/background/twitter-api'
import { EventEmitter } from '\\/scripts/common'
import {
  assertNever,
  copyFrozenObject,
  extractRateLimit,
  getCountOfUsersToBlock,
  sleep,
} from '\\/scripts/common/utilities'
import * as IdScraper from './userid-scraper'

// NOTE: 사이즈 올리게 되면 번역파일도 수정할것
const EXPORT_MAX_SIZE = 100_000

export default class ExportSession {
  private stopReason: StopReason | null = null
  private readonly sessionInfo: SessionInfo
  public readonly eventEmitter = new EventEmitter<SessionEventEmitter>()
  private exportResult: ExportResult

  public constructor(private request: SessionRequest<ExportableSessionTarget>) {
    this.sessionInfo = this.initSessionInfo(request)
    this.exportResult = {
      filename: this.generateFilename(request.target),
      userIds: new Set<string>(),
    }
  }
  public getSessionInfo(): Readonly<SessionInfo> {
    return copyFrozenObject(this.sessionInfo)
  }

  public getExportResult(): ExportResult {
    return this.exportResult
  }

  public markAsExported() {
    this.sessionInfo.exported = true
  }

  public async start() {
    try {
      const scrapedUserIds = this.exportResult.userIds
      const scraper = IdScraper.initIdScraper(this.request)
      for await (const scraperResponse of scraper) {
        if (this.stopReason || scrapedUserIds.size >= EXPORT_MAX_SIZE) {
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
          this.sessionInfo.progress.total = scraper.totalCount
        }
        this.handleRunning()
        for (const userId of scraperResponse.value.ids) {
          if (scrapedUserIds.size >= EXPORT_MAX_SIZE) {
            break
          }
          scrapedUserIds.add(userId)
        }
        this.sessionInfo.progress.scraped = scrapedUserIds.size
      }
      if (this.stopReason) {
        this.sessionInfo.status = 'Stopped'
        this.eventEmitter.emit('stopped', {
          sessionInfo: this.getSessionInfo(),
          reason: this.stopReason,
        })
      } else {
        this.sessionInfo.status = 'Completed'
        this.eventEmitter.emit('complete', this.getSessionInfo())
      }
      this.exportResult = {
        filename: this.generateFilename(this.request.target),
        userIds: scrapedUserIds,
      }
    } catch (error) {
      this.sessionInfo.status = 'Error'
      this.eventEmitter.emit('error', {
        sessionInfo: this.getSessionInfo(),
        message: TwitterAPI.errorToString(error),
      })
      throw error
    }
  }

  public stop(reason: StopReason) {
    this.stopReason = reason
    let shouldStop = false
    switch (this.sessionInfo.status) {
      // Running인 상태에선 루프 돌다가 알아서 멈추고
      // 멈추면서 Status도 바뀐다.
      case 'Running':
      case 'Completed':
      case 'Error':
      case 'Stopped':
        return
      case 'Initial':
      case 'AwaitingUntilRecur':
      case 'RateLimited':
        shouldStop = true
        break
      default:
        assertNever(this.sessionInfo.status)
    }
    if (shouldStop) {
      this.sessionInfo.status = 'Stopped'
    }
  }

  private initSessionInfo(request: SessionRequest<ExportableSessionTarget>): SessionInfo {
    return {
      sessionId: this.generateSessionId(),
      request,
      progress: this.initProgress(request),
      status: 'Initial',
      limit: null,
    }
  }

  private generateSessionId(): string {
    return `session/${Date.now()}`
  }

  private initProgress(request: SessionRequest<ExportableSessionTarget>): SessionInfo['progress'] {
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
      total: getCountOfUsersToBlock(request),
    }
  }

  private generateFilename(target: SessionRequest<ExportableSessionTarget>['target']): string {
    const now = dayjs()
    let prefix: string
    let targetStr: string
    switch (target.type) {
      case 'follower':
        prefix = 'blocklist-'
        targetStr = `user-${target.user.screen_name}`
        break
      case 'tweet_reaction':
        prefix = 'blocklist-'
        targetStr = `tweet-${target.tweet.user.screen_name}-${target.tweet.id_str}`
        break
      case 'audio_space':
        prefix = 'blocklist-'
        targetStr = `audiospace-${target.audioSpace.metadata.title}`
        break
      case 'export_my_blocklist':
        prefix = 'blocked-users'
        targetStr = ''
        break
    }
    targetStr = targetStr.replace(/[<>:"|?*\\/]/g, '_')
    const datetime = now.format('YYYY-MM-DD_HHmmss')
    return `${prefix}${targetStr}[${datetime}].csv`
  }

  private async handleRateLimit() {
    const { sessionInfo, eventEmitter } = this
    let apiKind: ScrapingApiKind
    switch (this.request.target.type) {
      case 'follower':
      case 'tweet_reaction':
        apiKind = 'tweet-reactions'
        break
      case 'audio_space':
        apiKind = 'lookup-users'
        break
      case 'export_my_blocklist':
        apiKind = 'block-ids'
        break
    }
    sessionInfo.status = 'RateLimited'
    const retrieverTwClient = new TwitterAPI.TwClient(this.request.retriever.clientOptions)
    const limitStatuses = await retrieverTwClient.getRateLimitStatus()
    const limit = extractRateLimit(limitStatuses, apiKind)
    sessionInfo.limit = limit
    eventEmitter.emit('rate-limit', limit)
  }

  private handleRunning() {
    const { sessionInfo, eventEmitter } = this
    if (sessionInfo.status === 'Initial') {
      eventEmitter.emit('started', sessionInfo)
    }
    if (sessionInfo.status === 'RateLimited') {
      eventEmitter.emit('rate-limit-reset', null)
    }
    sessionInfo.limit = null
    sessionInfo.status = 'Running'
  }
}
