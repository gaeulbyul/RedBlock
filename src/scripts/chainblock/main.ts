interface ChainBlockProgress {
  total: number,
  alreadyBlocked: number,
  skipped: number,
  blockSuccess: number,
  blockFail: number
}

interface ChainBlockOptions {
  useBlockAllAPI: boolean
}

const defaultChainBlockOptions: Readonly<ChainBlockOptions> = Object.freeze({
  useBlockAllAPI: false
})

class ChainBlocker {
  private ui = new ChainBlockUI
  constructor () {}
  async start (targetUserName: string, optionsInput: Partial<ChainBlockOptions> = {}) {
    const options = Object.assign({}, defaultChainBlockOptions, optionsInput)
    const ui = this.ui
    ui.show()
    const targetUser = await TwitterAPI.getSingleUserByName(targetUserName)
    ui.updateTarget(targetUser)
    const progress: ChainBlockProgress = {
      total: targetUser.followers_count,
      alreadyBlocked: 0,
      skipped: 0,
      blockSuccess: 0,
      blockFail: 0
    }
    try {
      const blockAllBuffer: TwitterUser[] = []
      const blockPromises: Promise<void>[] = []
      function flushBlockAllBuffer () {
        const ids = blockAllBuffer.map(user => user.id_str)
        blockAllBuffer.length = 0
        blockPromises.push(TwitterExperimentalBlocker.blockAllByIds(ids).then(result => {
          progress.blockSuccess += result.blocked.length
          progress.blockFail += result.failed.length
          if (result.failed.length > 0) {
            console.error('failed to block these users: ', result.failed.join(','))
          }
          ui.updateProgress(Object.assign({}, progress))
        }))
      }
      for await (const user of TwitterAPI.getAllFollowers(targetUserName)) {
        const shouldStop = [ChainBlockUIState.Closed, ChainBlockUIState.Stopped].includes(ui.state)
        if (shouldStop) {
          break
        }
        if (user === 'RateLimitError') {
          TwitterAPI.getRateLimitStatus().then((limits: LimitStatus) => {
            const followerLimit = limits.followers['/followers/list']
            ui.rateLimited(followerLimit)
          })
          const second = 1000
          const minute = second * 60
          await sleep(1 * minute)
          continue
        }
        ui.rateLimitResetted()
        if (user.blocking) {
          ++progress.alreadyBlocked
          ui.updateProgress(Object.assign({}, progress))
          continue
        }
        const followSkip = _.some([
          user.following,
          user.followed_by,
          user.follow_request_sent
        ])
        if (followSkip) {
          ++progress.skipped
          ui.updateProgress(Object.assign({}, progress))
          continue
        }
        if (options.useBlockAllAPI) {
          blockAllBuffer.push(user)
          if (blockAllBuffer.length >= 600) {
            flushBlockAllBuffer()
          }
        } else {
          blockPromises.push(TwitterAPI.blockUser(user).then(blockResult => {
            if (blockResult) {
              ++progress.blockSuccess
              ui.updateProgress(Object.assign({}, progress))
            } else {
              ++progress.blockFail
              ui.updateProgress(Object.assign({}, progress))
            }
          }))
        }
      }
      if (options.useBlockAllAPI) {
        flushBlockAllBuffer()
      }
      await Promise.all(blockPromises)
      ui.complete(Object.assign({}, progress))
    } catch (err) {
      const error = err as Error
      ui.error(error.message)
      throw err
    }
  }
}
