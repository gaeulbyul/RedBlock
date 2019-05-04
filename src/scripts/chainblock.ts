interface ChainBlockProgress {
  total: number
  alreadyBlocked: number
  skipped: number
  blockSuccess: number
  blockFail: number
}

interface ChainBlockProgressUpdate {
  reason: 'alreadyBlocked' | 'skipped' | 'blockSuccess' | 'blockFail'
  user: TwitterUser
}

const enum ChainBlockUIState {
  Initial,
  Running,
  RateLimited,
  Completed,
  Stopped,
  Closed,
  Error,
}

const blocker = new ChainBlocker()

async function doChainBlock(targetUserName: string) {
  try {
    const targetUser = await TwitterAPI.getSingleUserByName(targetUserName)
    // TODO: check protect&non-following
    // if (targetUser.protected && !following) {
    //   window.alert(i18n`script_alert_unable_to_protected_user`)
    // }
    if (targetUser.followers_count <= 0) {
      window.alert(i18n`script_alert_zero_follower`)
      return
    }
    const confirmMessage = i18n`script_confirm_chain_block${targetUserName}`
    if (window.confirm(confirmMessage)) {
      blocker.add(targetUser)
      blocker.show()
      await sleep(5000)
      blocker.start()
    }
  } catch (err) {
    if (err instanceof TwitterAPI.RateLimitError) {
      window.alert(i18n`script_alert_rate_limited`)
    } else {
      throw err
    }
  }
}

browser.runtime.onMessage.addListener((msgobj: object) => {
  const message = msgobj as RBMessage
  switch (message.action) {
    case Action.StartChainBlock:
      {
        if (document.querySelector('.mobcb-bg') != null) {
          window.alert(i18n`script_alert_mirror_of_block_running`)
          return
        }
        void doChainBlock(message.userName)
      }
      break
  }
})
