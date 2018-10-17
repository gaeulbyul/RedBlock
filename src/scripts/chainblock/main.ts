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
    const targetUser = await TwitterAPI.getSingleUserByName(targetUserName)
    ui.updateTarget(targetUser)
    const progress: ChainblockProgress = {
      total: targetUser.followers_count,
      alreadyBlocked: 0,
      skipped: 0,
      blockSuccess: 0,
      blockFail: 0
    }
    for await (const user of TwitterAPI.getAllFollowers(targetUserName)) {
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
      // console.warn('WARNING: fake block!')
      // TODO: implement block, real block
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
    ui.finalize(Object.assign({}, progress))
  }
}


function shouldBlock(user: TwitterUser): boolean {
  const reasons = [
    user.blocking, // 이미 차단함
    user.following, // 내가 팔로우중
    user.followed_by, // 나를 팔로우함
    user.follow_request_sent // (프로텍트 계정의 경우) 팔로우 신청 대기 중. (팔로우중으로 취급)
  ]
  return !(reasons.some(t => t))
}
