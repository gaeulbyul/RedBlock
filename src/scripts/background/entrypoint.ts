namespace RedBlock.Background.Entrypoint {
  const UI_UPDATE_DELAY = 250
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
  async function doChainBlock(targetUserName: string, options: ChainBlockSessionOptions) {
    const myself = await TwitterAPI.getMyself().catch(() => null)
    if (!myself) {
      window.alert('로그인 여부를 확인해주세요.')
      return
    }
    try {
      const targetUser = await TwitterAPI.getSingleUserByName(targetUserName)
      if (targetUser.protected && !targetUser.following) {
        window.alert('프로텍트 계정을 대상으로 체인블락을 실행할 수 없습니다.')
      }
      let isZero = false
      if (options.targetList === 'followers' && targetUser.followers_count <= 0) {
        isZero = true
      } else if (options.targetList === 'friends' && targetUser.friends_count <= 0) {
        isZero = true
      }
      if (isZero) {
        window.alert('차단할 팔로잉/팔로워가 없습니다.')
        return
      }
      const confirmMessage = `정말로 ${targetUserName}에게 체인블락을 실행하시겠습니까?`
      if (window.confirm(confirmMessage)) {
        const sessionId = chainblocker.add(targetUser, options)
        if (!sessionId) {
          console.info('not added. skip')
          return
        }
        chainblocker.start(sessionId, 3000)
      }
    } catch (err) {
      if (err instanceof TwitterAPI.RateLimitError) {
        window.alert('리밋입니다. 나중에 다시 시도해주세요.')
      } else {
        throw err
      }
    }
  }
  async function stopChainBlock(sessionId: string) {
    chainblocker.stop(sessionId)
  }
  async function sendChainBlockerInfo() {
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
    window.setInterval(sendChainBlockerInfo, UI_UPDATE_DELAY)
    browser.runtime.onMessage.addListener(
      (
        msgobj: object,
        sender: browser.runtime.MessageSender,
        _sendResponse: (response: any) => Promise<void>
      ): Promise<any> | void => {
        // console.debug('got message: %o from %o', msgobj, sender)
        const message = msgobj as RBAction
        switch (message.action) {
          case Action.StartChainBlock:
            {
              doChainBlock(message.userName, message.options).then(sendChainBlockerInfo)
            }
            break
          case Action.StopChainBlock:
            {
              const { sessionId } = message
              stopChainBlock(sessionId).then(sendChainBlockerInfo)
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
      }
    )
  }
}

RedBlock.Background.Entrypoint.initialize()
