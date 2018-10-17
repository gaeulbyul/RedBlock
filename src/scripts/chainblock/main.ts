interface ChainblockProgress {
  total: number,
  alreadyBlocked: number,
  skipped: number,
  blockSuccess: number,
  blockFail: number
}

class ChainBlocker {
  private ui = new ChainBlockUI
  constructor () {}
  async start (targetUserName: string) {
    const ui = this.ui
    ui.show()
    const targetUser = await TwitterAPI.getSingleUserByName(targetUserName)
    ui.updateTarget(targetUser)
    const progress: ChainblockProgress = {
      total: targetUser.followers_count,
      alreadyBlocked: 0,
      skipped: 0,
      blockSuccess: 0,
      blockFail: 0
    }
    try {
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
        const blockResult = await TwitterAPI.blockUser(user)
        if (blockResult) {
          ++progress.blockSuccess
          ui.updateProgress(Object.assign({}, progress))
        } else {
          ++progress.blockFail
          ui.updateProgress(Object.assign({}, progress))
        }
        await sleep(10)
      }
      ui.complete(Object.assign({}, progress))
    } catch (err) {
      const error = err as Error
      ui.error(error.message)
      throw err
    }
  }
}
