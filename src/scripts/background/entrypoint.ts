namespace RedBlock.Background.Entrypoint {
  const {
    TwitterAPI,
    ChainBlock: { ChainBlocker },
  } = RedBlock.Background
  const chainblocker = new ChainBlocker()
  const tabConnections = new Set<number>()
  export async function doChainBlockWithDefaultSkip(targetUserName: string, targetList: FollowKind) {
    return doChainBlock(targetUserName, {
      myFollowers: 'skip',
      myFollowings: 'skip',
      targetList,
    })
  }
  function generateConfirmMessage(targetUser: TwitterUser, options: ChainBlockSessionOptions): string {
    const targetUserName = targetUser.screen_name
    let confirmMessage = `정말로 @${targetUserName}에게 체인블락을 실행하시겠습니까?\n`
    confirmMessage += '--------------------\n'
    switch (options.targetList) {
      case 'followers':
        confirmMessage += `대상: @${targetUserName}의 팔로워 ${targetUser.followers_count.toLocaleString()}명\n`
        break
      case 'friends':
        confirmMessage += `대상: @${targetUserName}의 팔로잉 ${targetUser.friends_count.toLocaleString()}명\n`
        break
      default:
        throw new Error('unreachable')
    }
    if (options.myFollowers === 'block') {
      confirmMessage += '\u26a0 주의! 내 팔로워가 있어도 차단할 수 있습니다.\n'
    }
    if (options.myFollowings === 'block') {
      confirmMessage += '\u26a0 주의! 내가 팔로우하는 사용자가 있어도 차단할 수 있습니다.\n'
    }
    return confirmMessage
  }
  async function doChainBlock(targetUserName: string, options: ChainBlockSessionOptions) {
    const myself = await TwitterAPI.getMyself().catch(() => null)
    if (!myself) {
      window.alert('로그인 여부를 확인해주세요.')
      return
    }
    try {
      const targetUser = await TwitterAPI.getSingleUserByName(targetUserName)
      if (targetUser.blocked_by) {
        window.alert('\u26d4 상대방이 나를 차단하여 체인블락을 실행할 수 없습니다.')
        return
      }
      if (targetUser.protected && !targetUser.following) {
        window.alert('\u{1f512} 프로텍트 계정을 대상으로 체인블락을 실행할 수 없습니다.')
        return
      }
      let isZero = false
      if (options.targetList === 'followers' && targetUser.followers_count <= 0) {
        isZero = true
      } else if (options.targetList === 'friends' && targetUser.friends_count <= 0) {
        isZero = true
      }
      if (isZero) {
        window.alert('차단할 팔로잉/팔로워가 없습니다. (총 0명)')
        return
      }
      const confirmMessage = generateConfirmMessage(targetUser, options)
      if (window.confirm(confirmMessage)) {
        const sessionId = chainblocker.add(targetUser, options)
        if (!sessionId) {
          console.info('not added. skip')
          return
        }
        chainblocker.start(sessionId)
      }
    } catch (err) {
      if (err instanceof TwitterAPI.RateLimitError) {
        window.alert('현재 리밋에 걸린 상태입니다. 나중에 다시 시도해주세요.')
      } else {
        throw err
      }
    }
  }
  async function stopChainBlock(sessionId: string) {
    chainblocker.stop(sessionId)
  }
  async function sendChainBlockerInfoToTabs() {
    const infos = chainblocker.getAllSessionsProgress()
    for (const tabId of tabConnections) {
      browser.tabs
        .sendMessage<RBChainBlockInfoMessage>(tabId, {
          messageType: 'ChainBlockInfoMessage',
          infos,
        })
        .catch(() => {
          tabConnections.delete(tabId)
        })
    }
  }
  export function initialize() {
    window.setInterval(sendChainBlockerInfoToTabs, UI_UPDATE_DELAY)
    browser.runtime.onMessage.addListener(
      (msg: object, sender: browser.runtime.MessageSender, _sendResponse: (response: any) => Promise<void>): true => {
        if (!(typeof msg === 'object' && 'action' in msg)) {
          return true
        }
        const message = msg as RBAction
        switch (message.action) {
          case Action.StartChainBlock:
            {
              doChainBlock(message.userName, message.options).then(sendChainBlockerInfoToTabs)
            }
            break
          case Action.StopChainBlock:
            {
              const { sessionId } = message
              stopChainBlock(sessionId).then(sendChainBlockerInfoToTabs)
            }
            break
          case Action.RequestProgress:
            {
              const infos = chainblocker.getAllSessionsProgress()
              browser.runtime.sendMessage<RBChainBlockInfoMessage>({
                messageType: 'ChainBlockInfoMessage',
                infos,
              })
            }
            break
          case Action.ConnectToBackground:
            {
              const { tab } = sender
              if (tab) {
                tabConnections.add(tab.id!)
              }
            }
            break
          case Action.DisconnectToBackground:
            {
              const { tab } = sender
              if (tab) {
                tabConnections.delete(tab.id!)
              }
            }
            break
        }
        return true
      }
    )
  }
}

RedBlock.Background.Entrypoint.initialize()
