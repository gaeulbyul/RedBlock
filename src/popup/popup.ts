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
  'home'
]

function extractUserNameFromUrl (urlstr: string): string | null {
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

async function executeChainBlock () {
  const tabs = await browser.tabs.query({active: true, currentWindow: true})
  const currentTab = tabs[0]
  if (!currentTab) {
    return
  }
  const userName = extractUserNameFromUrl(currentTab.url as string)
  if (!userName) {
    browser.tabs.executeScript(currentTab.id, {
      code: `window.alert('체인블락할 유저의 프로필페이지(https://twitter.com/[사용자]/followers)에서 실행해주세요.')`
    })
    return
  }
  browser.tabs.sendMessage(currentTab.id as number, {
    action: 'RedBlock/Start',
    userName
  })
  window.close()
}

document.addEventListener('DOMContentLoaded', () => {
  document.querySelector('.menu-item.chain-block-followers')!.addEventListener('click', event => {
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
  const currentVersion = document.querySelector('.currentVersion') as HTMLElement
  currentVersion.textContent = `버전: ${manifest.version}`
  currentVersion.title = `Red Block 버전 ${manifest.version}을(를) 사용하고 있습니다.`
})

// Yandex 브라우저의 경우, 버튼을 누르고 나서도 팝업창이 닫히지 않는다.
// 따라서, Chainblock 함수를 실행할 때 confirmed-chainblock메시지를 보내고,
// 팝업창은 이를 감지하면 창을 닫도록 한다.
/*
browser.runtime.onMessage.addListener(msg => {
  console.info('message received from popup: %j', msg)
  if (msg.action === 'RedBlock/ConfirmedChainBlock') {
    window.close()
  }
})
*/
