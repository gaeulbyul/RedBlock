import sum from 'lodash-es/sum'
import cloneDeep from 'lodash-es/cloneDeep'
import dayjs from 'dayjs'

import * as Scraper from './scraper'
import * as TwitterAPI from '../twitter-api'
import { examineRetrieverByTargetUser, examineRetrieverByTweetId } from '../blockbuster'
import { TargetCheckResult, validateRequest, checkResultToString } from '../target-checker'
import {
  EventEmitter,
  SessionStatus,
  copyFrozenObject,
  sleep,
  getCountOfUsersToBlock,
  assertNever,
  extractRateLimit,
} from '../../common'
import BlockLimiter from '../block-limiter'
import { decideWhatToDoGivenUser } from './user-decider'
import { loadOptions } from '../storage/options'

const MAX_USERS_TO_SCRAPE_AFTER_REWIND = 200

export default class ChainBlockSession {
  private stopReason: StopReason | null = null
  private readonly sessionInfo = this.initSessionInfo()
  private readonly scrapedUserIds = new Set<string>()
  private maxUsersToScrape = Infinity
  public readonly eventEmitter = new EventEmitter<SessionEventEmitter>()
  public constructor(private request: SessionRequest<AnySessionTarget>) {}
  public getSessionInfo(): Readonly<SessionInfo> {
    return copyFrozenObject(this.sessionInfo)
  }

  public async start() {
    const DBG_dontActuallyCallAPI = localStorage.getItem('RedBlock FakeAPI') === 'true'
    if (DBG_dontActuallyCallAPI) {
      console.warn("WARNING: RedBlock FakeAPI mode detected! won't call actual api")
    }
    const now = dayjs()
    if (this.checkBlockLimiter() !== 'ok') {
      this.stop('block-limitation-reached')
    } else {
      try {
        const scraper = Scraper.initScraper(this.request)
        const twClient = new TwitterAPI.TwClient(this.request.executor.clientOptions)
        for await (const scraperResponse of scraper) {
          if (this.stopReason) {
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
          this.sessionInfo.progress.total = scraper.totalCount
          this.handleRunning()
          // promisesBuffer= 차단해제, 뮤트해제 등
          const promisesBuffer: Promise<any>[] = []
          // miniBuffer= 차단, 뮤트 등 많이 쓰면 제한 걸리는 API용
          const miniBuffer: Promise<any>[] = []
          for (const user of scraperResponse.value.users) {
            if (this.stopReason) {
              break
            }
            if (this.scrapedUserIds.has(user.id_str)) {
              continue
            }
            this.scrapedUserIds.add(user.id_str)
            if (this.checkBlockLimiter() !== 'ok') {
              this.stop('block-limitation-reached')
              break
            }
            const thisIsMe =
              user.id_str === this.request.retriever.user.id_str ||
              user.id_str === this.request.executor.user.id_str
            if (thisIsMe) {
              continue
            }
            const whatToDo = decideWhatToDoGivenUser(this.request, user, now)
            console.debug('user %o => %s', user, whatToDo)
            if (whatToDo === 'Skip') {
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
                  promise = twClient.blockUser(user)
                  break
                case 'Mute':
                  promise = twClient.muteUser(user)
                  break
                case 'UnBlock':
                  promise = twClient.unblockUser(user)
                  break
                case 'UnMute':
                  promise = twClient.unmuteUser(user)
                  break
                case 'UnFollow':
                  promise = twClient.unfollowUser(user)
                  break
                case 'BlockAndUnBlock':
                  promise = twClient
                    .blockUser(user)
                    .then(blockedUser => twClient.unblockUser(blockedUser))
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
            }
            if (this.request.options.delayBlockRequest > 0 && miniBuffer.length >= 1) {
              await Promise.allSettled(miniBuffer)
              miniBuffer.length = 0
              // 단위가 초(second)이므로 밀리초(ms)단위로 쓰기 위해 곱한다.
              // 그냥 sleep을 하면 끝나는동안 shouldStop을 체크하지 못하므로
              // 조금씩 sleep하면서 체크하도록 한다.
              const delay = this.request.options.delayBlockRequest * 1000
              const waitUntil = Date.now() + delay
              while (Date.now() < waitUntil) {
                if (this.stopReason) {
                  break
                }
                await sleep(100)
              }
            }
          }
          await Promise.allSettled([...miniBuffer, ...promisesBuffer])
          miniBuffer.length = 0
          promisesBuffer.length = 0
          if (this.scrapedUserIds.size >= this.maxUsersToScrape) {
            break
          }
        }
        if (this.stopReason) {
          this.sessionInfo.status = SessionStatus.Stopped
          this.eventEmitter.emit('stopped', {
            sessionInfo: this.getSessionInfo(),
            reason: this.stopReason,
          })
        } else if (this.request.extraSessionOptions.recurring) {
          this.sessionInfo.status = SessionStatus.AwaitingUntilRecur
          this.eventEmitter.emit('recurring-waiting', {
            sessionInfo: this.getSessionInfo(),
            delayInMinutes: this.request.options.recurringSessionInterval,
          })
        } else {
          this.sessionInfo.status = SessionStatus.Completed
          this.eventEmitter.emit('complete', this.getSessionInfo())
        }
      } catch (error) {
        this.sessionInfo.status = SessionStatus.Error
        this.eventEmitter.emit('error', {
          sessionInfo: this.getSessionInfo(),
          message: TwitterAPI.errorToString(error),
        })
        throw error
      }
    }
  }

  public async rewind() {
    this.stopReason = null
    this.maxUsersToScrape = MAX_USERS_TO_SCRAPE_AFTER_REWIND
    const maybeNewRequest = await refreshRequest(this.request)
    if (maybeNewRequest.ok) {
      const newRequest = maybeNewRequest.value
      const checkResult = validateRequest(newRequest)
      if (checkResult === TargetCheckResult.Ok) {
        this.sessionInfo.status = SessionStatus.Initial
        this.request = newRequest
      } else {
        this.sessionInfo.status = SessionStatus.Error
        this.eventEmitter.emit('error', {
          sessionInfo: this.getSessionInfo(),
          message: TwitterAPI.errorToString(checkResultToString(checkResult)),
        })
      }
    } else {
      this.sessionInfo.status = SessionStatus.Error
      this.eventEmitter.emit('error', {
        sessionInfo: this.getSessionInfo(),
        message: TwitterAPI.errorToString(maybeNewRequest.error),
      })
    }
  }

  public stop(reason: StopReason) {
    this.stopReason = reason
    let shouldStop = false
    switch (this.sessionInfo.status) {
      // Running인 상태에선 루프 돌다가 알아서 멈추고
      // 멈추면서 Status도 바뀐다.
      case SessionStatus.Running:
      case SessionStatus.Completed:
      case SessionStatus.Error:
      case SessionStatus.Stopped:
        return
      case SessionStatus.Initial:
      case SessionStatus.AwaitingUntilRecur:
      case SessionStatus.RateLimited:
        shouldStop = true
        break
      default:
        assertNever(this.sessionInfo.status)
    }
    if (shouldStop) {
      this.sessionInfo.status = SessionStatus.Stopped
    }
  }

  private calculateScrapedCount() {
    const { success, already, failure, error, skipped } = this.sessionInfo.progress
    return sum([...Object.values(success), already, failure, error, skipped])
  }

  private checkBlockLimiter() {
    const safePurposes: Purpose['type'][] = ['unchainblock', 'unchainmute', 'chainunfollow']
    if (safePurposes.includes(this.request.purpose.type)) {
      return 'ok'
    } else {
      const limiter = new BlockLimiter(this.request.executor.user.id_str)
      return limiter.check()
    }
  }

  private initSessionInfo(): SessionInfo {
    return {
      sessionId: this.generateSessionId(),
      request: this.request,
      progress: this.initProgress(),
      status: SessionStatus.Initial,
      limit: null,
    }
  }

  private generateSessionId(): string {
    return `session/${Date.now()}`
  }

  private initProgress(): SessionInfo['progress'] {
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

  private async handleRateLimit() {
    const { sessionInfo, eventEmitter } = this
    let apiKind: ScrapingApiKind
    switch (this.request.target.type) {
      case 'follower':
      case 'lockpicker':
        apiKind = this.request.target.list
        break
      case 'tweet_reaction':
        apiKind = 'tweet-reactions'
        break
      case 'import':
      case 'audio_space':
        apiKind = 'lookup-users'
        break
      case 'user_search':
        apiKind = 'search'
        break
      case 'export_my_blocklist':
        apiKind = 'block-ids'
        break
    }
    sessionInfo.status = SessionStatus.RateLimited
    const retrieverTwClient = new TwitterAPI.TwClient(this.request.retriever.clientOptions)
    const limitStatuses = await retrieverTwClient.getRateLimitStatus()
    const limit = extractRateLimit(limitStatuses, apiKind)
    sessionInfo.limit = limit
    eventEmitter.emit('rate-limit', limit)
  }

  private handleRunning() {
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

async function refreshRequest<T extends AnySessionTarget>(
  request: SessionRequest<T>
): Promise<Either<TwitterAPI.ErrorResponse | Error, SessionRequest<T>>> {
  const newRequest: SessionRequest<T> = cloneDeep(request)
  newRequest.options = await loadOptions()
  const { enableBlockBuster, enableBlockBusterWithTweetDeck: includeTweetDeck } = newRequest.options
  const actor = newRequest.executor
  const twClient = new TwitterAPI.TwClient(actor.clientOptions)
  const { target } = newRequest
  try {
    switch (target.type) {
      case 'follower':
      case 'lockpicker':
        target.user = await twClient.getSingleUser({ user_id: target.user.id_str })
        if (enableBlockBuster) {
          request.retriever = await examineRetrieverByTargetUser(actor, target.user, {
            includeTweetDeck,
            includeAnotherCookieStores: true,
          })
        }
        break
      case 'tweet_reaction':
        target.tweet = await twClient.getTweetById(target.tweet.id_str)
        if (enableBlockBuster && target.tweet.user.blocked_by) {
          request.retriever = await examineRetrieverByTweetId(actor, target.tweet.id_str, {
            includeTweetDeck,
            includeAnotherCookieStores: true,
          }).then(({ actor }) => actor)
        }
        break
      case 'audio_space':
        target.audioSpace = await twClient.getAudioSpaceById(target.audioSpace.metadata.rest_id)
        break
      case 'import':
      case 'user_search':
      case 'export_my_blocklist':
        break
    }
    return {
      ok: true,
      value: newRequest,
    }
  } catch (error: unknown) {
    if (TwitterAPI.isTwitterErrorMessage(error)) {
      return {
        ok: false,
        error,
      }
    } else {
      throw error
    }
  }
}
