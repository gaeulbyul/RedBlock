import { getUserNameFromURL } from '../common.js'
import { doChainBlockWithDefaultOptions } from './entrypoint.js'

const urlPatterns = ['https://twitter.com/*', 'https://mobile.twitter.com/*']

// 크롬에선 browser.menus 대신 비표준 이름(browser.contextMenus)을 쓴다.
// 이를 파이어폭스와 맞추기 위해 이걸 함
if (!('menus' in browser) && 'contextMenus' in browser) {
  browser.menus = (browser as any).contextMenus
}

browser.menus.create({
  contexts: ['link'],
  documentUrlPatterns: urlPatterns,
  targetUrlPatterns: urlPatterns,
  title: '이 사용자의 팔로워에게 체인블락 실행',
  onclick(clickEvent, _tab) {
    const url = new URL(clickEvent.linkUrl!)
    const userName = getUserNameFromURL(url)
    if (!userName) {
      return
    }
    doChainBlockWithDefaultOptions(userName, 'followers')
  },
})
browser.menus.create({
  contexts: ['link'],
  documentUrlPatterns: urlPatterns,
  targetUrlPatterns: urlPatterns,
  title: '이 사용자의 팔로잉에게 체인블락 실행',
  onclick(clickEvent, _tab) {
    const url = new URL(clickEvent.linkUrl!)
    const userName = getUserNameFromURL(url)
    if (!userName) {
      return
    }
    doChainBlockWithDefaultOptions(userName, 'friends')
  },
})
