function injectScriptToPage(path: string) {
  document.body
    .appendChild(
      Object.assign(document.createElement('script'), {
        src: browser.runtime.getURL(path),
      })
    )
    .remove()
}

function listenExtensionMessages(reactRoot: Element | null) {
  browser.runtime.onMessage.addListener((msgobj: any) => {
    if (!(typeof msgobj === 'object' && 'messageType' in msgobj)) {
      console.debug('unknown msg?', msgobj)
      return
    }
    const msg = msgobj as RBMessage
    switch (msg.messageType) {
      case 'MarkUser':
        if (reactRoot) {
          document.dispatchEvent(
            new CustomEvent<MarkUserParams>('RedBlock->MarkUser', {
              detail: {
                userId: msg.userId,
                verb: msg.verb,
              },
            })
          )
        }
        break
      case 'MarkManyUsersAsBlocked':
        if (reactRoot) {
          document.dispatchEvent(
            new CustomEvent<MarkManyUsersAsBlockedParams>('RedBlock->MarkManyUsersAsBlocked', {
              detail: {
                userIds: msg.userIds,
              },
            })
          )
        }
        break
      case 'Alert':
        window.alert(msg.message)
        break
      case 'ConfirmChainBlock':
        if (window.confirm(msg.confirmMessage)) {
          browser.runtime.sendMessage(msg.action)
        }
        break
      case 'ToggleOneClickBlockMode':
        document.body.classList.toggle('redblock-oneclick-block-mode-enabled', msg.enabled)
        break
    }
  })
}

const reactRoot = document.getElementById('react-root')
listenExtensionMessages(reactRoot)

if (reactRoot && location.hostname !== 'tweetdeck.twitter.com') {
  injectScriptToPage('vendor/uuid.js')
  injectScriptToPage('scripts/content/inject.js')
  document.addEventListener('RedBlock<-BlockSingleUser', event => {
    const customEvent = event as CustomEvent<{ user: TwitterUser }>
    const { user } = customEvent.detail
    browser.runtime.sendMessage<RBActions.BlockSingleUser>({
      actionType: 'BlockSingleUser',
      user,
    })
  })
  document.addEventListener('RedBlock<-UnblockSingleUser', event => {
    const customEvent = event as CustomEvent<{ user: TwitterUser }>
    const { user } = customEvent.detail
    browser.runtime.sendMessage<RBActions.UnblockSingleUser>({
      actionType: 'UnblockSingleUser',
      user,
    })
  })
}
