function injectPageScripts() {
  browser.runtime
    .getManifest()
    .web_accessible_resources!.filter((path) => /\.js/.test(path))
    .forEach((path) => {
      document.body.appendChild(
        Object.assign(document.createElement('script'), {
          src: browser.runtime.getURL(path),
        })
      )
    })
}

function listenMarkUserEvents() {
  browser.runtime.onMessage.addListener((msgobj: any) => {
    if (!(typeof msgobj === 'object' && 'messageType' in msgobj)) {
      console.debug('unknown msg?', msgobj)
      return
    }
    const msg = msgobj as RBMessage
    switch (msg.messageType) {
      case 'MarkUser':
        document.dispatchEvent(
          new CustomEvent<MarkUserParams>('RedBlock->MarkUser', {
            detail: {
              userId: msg.userId,
              verb: msg.verb,
            },
          })
        )
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
        const { enabled } = msg
        document.body.classList.toggle('redblock-oneclick-block-mode-enabled', enabled)
        break
    }
  })
}

if (document.getElementById('react-root')) {
  injectPageScripts()
  listenMarkUserEvents()
  document.addEventListener('RedBlock<-BlockUserById', (event) => {
    const customEvent = event as CustomEvent
    const { userId } = customEvent.detail
    browser.runtime.sendMessage<RBActions.BlockUserById>({
      actionType: 'BlockUserById',
      userId,
    })
  })
  document.addEventListener('RedBlock<-UnblockUserById', (event) => {
    const customEvent = event as CustomEvent
    const { userId } = customEvent.detail
    browser.runtime.sendMessage<RBActions.UnblockUserById>({
      actionType: 'UnblockUserById',
      userId,
    })
  })
}
