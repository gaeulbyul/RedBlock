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
    browser.tabs.executeScript(currentTab.id, {
      code: `window.alert('체인블락할 유저의 프로필페이지(https://twitter.com/[사용자]/followers)에서 실행해주세요.')`,
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
  /*
  document.querySelector('.menu-item.open-option').onclick = event => {
    event.preventDefault()
    browser.runtime.openOptionsPage()
  }
  */
  const manifest = browser.runtime.getManifest()
  const currentVersion = document.querySelector(
    '.currentVersion'
  ) as HTMLElement
  currentVersion.textContent = `버전: ${manifest.version}`
  currentVersion.title = `Red Block 버전 ${
    manifest.version
  }을(를) 사용하고 있습니다.`
})
