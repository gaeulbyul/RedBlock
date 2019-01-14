const userNameBlacklist = [
  '1',
  'about',
  'account',
  'blog',
  'followers',
  'followings',
  'hashtag',
  'i',
  'lists',
  'login',
  'logout',
  'oauth',
  'privacy',
  'search',
  'tos',
  'notifications',
  'messages',
  'explore',
  'home',
]

function extractUserNameFromUrl(urlstr: string): string | null {
  const url = new URL(urlstr)
  const supportingHostname = ['twitter.com', 'mobile.twitter.com']
  if (!supportingHostname.includes(url.hostname)) {
    return null
  }
  const notUserPagePattern01 = /^\/\w\w\/(?:tos|privacy)/
  if (notUserPagePattern01.test(url.pathname)) {
    return null
  }
  const pattern = /^\/([0-9A-Za-z_]+)/
  const match = pattern.exec(url.pathname)
  if (!match) {
    return null
  }
  const userName = match[1]
  if (userNameBlacklist.includes(userName.toLowerCase())) {
    return null
  }
  return userName
}

async function executeChainBlock() {
  const tabs = await browser.tabs.query({
    active: true,
    currentWindow: true,
  })
  const currentTab = tabs[0]
  if (!currentTab) {
    return
  }
  const userName = extractUserNameFromUrl(currentTab.url as string)
  if (!userName) {
    const message = browser.i18n.getMessage('popup_alert_non_twitter')
    // alert 메시지가 팝업 내부가 아니라 보이는 페이지에서 뜨도록
    browser.tabs.executeScript(currentTab.id, {
      code: `window.alert(\`${message}\`)`,
    })
    return
  }
  browser.tabs.sendMessage(currentTab.id as number, {
    action: Action.StartChainBlock,
    userName,
  })
  window.close()
}

document.addEventListener('DOMContentLoaded', () => {
  document
    .querySelector('.menu-item.chain-block-followers')!
    .addEventListener('click', event => {
      event.preventDefault()
      executeChainBlock()
    })
  const manifest = browser.runtime.getManifest()
  const shortMessage = browser.i18n.getMessage(
    'popup_extension_version_short',
    manifest.version
  )
  const longMessage = browser.i18n.getMessage(
    'popup_extension_version_long',
    manifest.version
  )
  const currentVersion = document.querySelector(
    '.currentVersion'
  ) as HTMLElement
  currentVersion.textContent = shortMessage
  currentVersion.title = longMessage
})

function loadI18nMessage() {
  for (const elem of document.querySelectorAll('*[data-i18n-text]')) {
    const messageId = elem.getAttribute('data-i18n-text')!
    const message = browser.i18n.getMessage(messageId)
    elem.textContent = message
  }
  for (const elem of document.querySelectorAll('*[data-i18n-attr]')) {
    const pairs = elem.getAttribute('data-i18n-attr')!.split(',')
    for (const pair of pairs) {
      const [attrName, messageId] = pair.split('=').map(s => s.trim())
      const message = browser.i18n.getMessage(messageId)
      elem.setAttribute(attrName, message)
    }
  }
}
