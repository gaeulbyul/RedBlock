namespace RedBlock.Background.Entrypoint {
  const {
    TwitterAPI,
    ChainBlock: { ChainBlocker },
  } = RedBlock.Background
  const chainblocker = new ChainBlocker()
  async function doChainBlock(targetUserName: string, options: ChainBlockSessionOptions) {
    const myself = await TwitterAPI.getMyself().catch(() => null)
    if (!myself) {
      window.alert('로그인 여부를 확인해주세요.')
    }
    try {
      const targetUser = await TwitterAPI.getSingleUserByName(targetUserName)
      // TODO: check protect&non-following
      // if (targetUser.protected && !following) {
      //   window.alert(i18n`script_alert_unable_to_protected_user`)
      // }
      if (targetUser.followers_count <= 0) {
        window.alert('차단할 팔로워가 없습니다.')
        return
      }
      const confirmMessage = `정말로 ${targetUserName}에게 체인블락을 실행하시겠습니까?`
      if (window.confirm(confirmMessage)) {
        const sessionId = chainblocker.add(targetUser, options)
        if (sessionId) {
          await sleep(3000)
          await chainblocker.prepare(sessionId)
          chainblocker.start(sessionId)
        }
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
  function requestChainBlockerInfo(): ChainBlockSessionInfo {
    return chainblocker.getAllSessionsProgress()
    //
  }
  export function initialize() {
    browser.runtime.onMessage.addListener(
      (
        msgobj: object,
        sender: browser.runtime.MessageSender,
        _sendResponse: (response: any) => Promise<void>
      ): Promise<any> | void => {
        console.debug('got message: %o from %o', msgobj, sender)
        const message = msgobj as RBMessage
        switch (message.action) {
          case Action.StartChainBlock:
            {
              void doChainBlock(message.userName, message.options)
            }
            break
          case Action.RequestProgress: {
            {
              const info = requestChainBlockerInfo()
              console.debug('response c.b.i with %o', info)
              return Promise.resolve(info)
              // sendResponse(Promise.resolve(info))
            }
          }
          case Action.StopChainBlock:
            {
              const { sessionId } = message
              stopChainBlock(sessionId)
            }
            break
        }
      }
    )
  }
}

RedBlock.Background.Entrypoint.initialize()
