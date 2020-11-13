// 파이어폭스에서 CustomEvent의 detail 개체 전달용
declare function cloneInto<T>(detail: T, view: Window | null): T
function cloneDetail<T>(detail: T): T {
  // typeof detail === 'object' && typeof cloneInto === 'function'
  if (typeof detail + typeof cloneInto === 'objectfunction') {
    return cloneInto(detail, document.defaultView)
  }
  return detail
}

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
    const msg = msgobj as RBMessageToContentType
    if (msg.messageTo !== 'content') {
      return
    }
    switch (msg.messageType) {
      case 'MarkUser':
        if (reactRoot) {
          document.dispatchEvent(
            new CustomEvent<MarkUserParams>('RedBlock->MarkUser', {
              detail: cloneDetail({
                userId: msg.userId,
                verb: msg.verb,
              }),
            })
          )
        }
        break
      case 'Alert':
        window.alert(msg.message)
        break
      case 'ConfirmChainBlock':
        if (window.confirm(msg.confirmMessage)) {
          browser.runtime.sendMessage<RBMessageToBackground.StartSession>({
            messageType: 'StartSession',
            messageTo: 'background',
            sessionId: msg.sessionId,
          })
        } else {
          browser.runtime.sendMessage<RBMessageToBackground.CancelSession>({
            messageType: 'CancelSession',
            messageTo: 'background',
            sessionId: msg.sessionId,
          })
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
}
