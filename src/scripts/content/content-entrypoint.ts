function injectPageScripts() {
  browser.runtime
    .getManifest()
    .web_accessible_resources!.filter(path => /\.js/.test(path))
    .forEach(path => {
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
      return
    }
    if (msgobj.messageType === 'MarkUserMessage') {
      const { userId, verb } = msgobj as RBMarkUserMessage
      document.dispatchEvent(
        new CustomEvent<MarkUserParams>('RedBlock->MarkUser', {
          detail: {
            userId,
            verb,
          },
        })
      )
    }
  })
}

injectPageScripts()
listenMarkUserEvents()
