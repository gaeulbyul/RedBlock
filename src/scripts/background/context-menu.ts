import { getUserNameFromURL } from '../common.js'
import { doFollowerChainBlockWithDefaultOptions, doTweetReactionChainBlockWithDefaultOptions } from './entrypoint.js'
import { RedBlockStorage, loadOptions, onOptionsChanged } from './storage.js'

const urlPatterns = ['https://twitter.com/*', 'https://mobile.twitter.com/*']
const tweetUrlPatterns = ['https://twitter.com/*/status/*', 'https://mobile.twitter.com/*/status/*']

function getTweetIdFromUrl(url: URL) {
  const match = /\/status\/(\d+)/.exec(url.pathname)
  return match && match[1]
}

// 크롬에선 browser.menus 대신 비표준 이름(browser.contextMenus)을 쓴다.
// 이를 파이어폭스와 맞추기 위해 이걸 함
if (!('menus' in browser) && 'contextMenus' in browser) {
  browser.menus = (browser as any).contextMenus
}

async function createContextMenu(options: RedBlockStorage['options']) {
  await browser.menus.removeAll()

  browser.menus.create({
    contexts: ['link'],
    documentUrlPatterns: urlPatterns,
    targetUrlPatterns: urlPatterns,
    title: '이 사용자의 팔로워에게 체인블락 실행',
    onclick(clickEvent, _tab) {
      const url = new URL(clickEvent.linkUrl!)
      const userName = getUserNameFromURL(url)!
      doFollowerChainBlockWithDefaultOptions(userName, 'followers')
    },
  })
  browser.menus.create({
    contexts: ['link'],
    documentUrlPatterns: urlPatterns,
    targetUrlPatterns: urlPatterns,
    title: '이 사용자의 팔로잉에게 체인블락 실행',
    onclick(clickEvent, _tab) {
      const url = new URL(clickEvent.linkUrl!)
      const userName = getUserNameFromURL(url)!
      doFollowerChainBlockWithDefaultOptions(userName, 'friends')
    },
  })
  browser.menus.create({
    type: 'separator',
  })

  if (options.experimental_tweetReactionBasedChainBlock) {
    browser.menus.create({
      contexts: ['link'],
      documentUrlPatterns: urlPatterns,
      targetUrlPatterns: tweetUrlPatterns,
      title: '이 트윗을 리트윗한 사용자에게 체인블락 실행(β)',
      onclick(clickEvent, _tab) {
        const url = new URL(clickEvent.linkUrl!)
        const tweetId = getTweetIdFromUrl(url)!
        doTweetReactionChainBlockWithDefaultOptions(tweetId, 'retweeted')
      },
    })
    browser.menus.create({
      contexts: ['link'],
      documentUrlPatterns: urlPatterns,
      targetUrlPatterns: tweetUrlPatterns,
      title: '이 트윗을 마음에 들어한 사용자에게 체인블락 실행(β)',
      onclick(clickEvent, _tab) {
        const url = new URL(clickEvent.linkUrl!)
        const tweetId = getTweetIdFromUrl(url)!
        doTweetReactionChainBlockWithDefaultOptions(tweetId, 'liked')
      },
    })
  }
}

loadOptions().then(createContextMenu)
onOptionsChanged(createContextMenu)
