import { sendBrowserRuntimeMessage } from '\\/scripts/common/utilities'
import browser from 'webextension-polyfill'

// 파이어폭스에서 CustomEvent의 detail 개체 전달용
declare function cloneInto<T>(detail: T, view: Window | null): T
export function cloneDetail<T>(detail: T): T {
  if (typeof detail === 'object' && typeof cloneInto === 'function') {
    return cloneInto(detail, document.defaultView)
  }
  return detail
}

function injectScriptByPath(path: string) {
  document.body
    .appendChild(
      Object.assign(document.createElement('script'), {
        src: browser.runtime.getURL(path),
      }),
    )
    .remove()
}

export function injectBundle(name: string) {
  injectScriptByPath(`bundled/${name}.bun.js`)
}

function checkMessage(msg: object): msg is RBMessageToContentType {
  if (msg == null) {
    return false
  }
  if (!('messageTo' in msg)) {
    return false
  }
  if ((msg as any).messageTo !== 'content') {
    return false
  }
  return true
}

export function listenExtensionMessages(reactRoot: Element | null) {
  browser.runtime.onMessage.addListener((msg: object) => {
    if (!checkMessage(msg)) {
      console.debug('unknown msg?', msg)
      return
    }
    switch (msg.messageType) {
      case 'MarkUser':
        if (reactRoot) {
          markUser({
            userId: msg.userId,
            userAction: msg.userAction,
          })
        }
        break
      case 'Alert':
        window.alert(msg.message)
        break
      case 'ConfirmChainBlock':
        if (window.confirm(msg.confirmMessage)) {
          sendBrowserRuntimeMessage<RBMessageToBackground.CreateChainBlockSession>({
            messageType: 'CreateChainBlockSession',
            messageTo: 'background',
            request: msg.request,
          })
        }
        break
      case 'ToggleOneClickBlockMode':
        document.body.classList.toggle('redblock-oneclick-block-mode-enabled', msg.enabled)
        break
    }
  })
}

export function toastMessage(detail: ToastMessageParam) {
  const event = new CustomEvent<ToastMessageParam>('RedBlock->ToastMessage', {
    detail: cloneDetail(detail),
  })
  document.dispatchEvent(event)
}

export async function blockUser(user: TwitterUser) {
  return sendBrowserRuntimeMessage<RBMessageToBackground.BlockSingleUser>({
    messageType: 'BlockSingleUser',
    messageTo: 'background',
    user,
  })
}

export async function blockUserById(userId: string) {
  return sendBrowserRuntimeMessage<RBMessageToBackground.BlockUserById>({
    messageType: 'BlockUserById',
    messageTo: 'background',
    userId,
  })
}

export function markUser(detail: MarkUserParams) {
  const event = new CustomEvent<MarkUserParams>('RedBlock->MarkUser', {
    detail: cloneDetail(detail),
  })
  document.dispatchEvent(event)
  const { userId, userAction } = detail
  if (userAction === 'Block') {
    const oneclickButtons = document.querySelectorAll(`[data-redblock-btn-user="${userId}"]`)
    oneclickButtons.forEach(button => button.remove())
  }
}
