import { getUserNameFromURL } from '../common.js'
import * as i18n from '../i18n.js'
import { followerBlockDefaultOption, tweetReactionBlockDefaultOption } from './chainblock-session/session.js'
import * as TwitterAPI from './twitter-api.js'
import { createChainBlockSession, confirmSession } from './entrypoint.js'
import { checkResultToString } from '../text-generate.js'
import { alertToCurrentTab } from './background.js'

const urlPatterns = ['https://twitter.com/*', 'https://mobile.twitter.com/*']
const documentUrlPatterns = ['https://twitter.com/*', 'https://mobile.twitter.com/*', 'https://tweetdeck.twitter.com/*']
const tweetUrlPatterns = ['https://twitter.com/*/status/*', 'https://mobile.twitter.com/*/status/*']

function getTweetIdFromUrl(url: URL) {
  const match = /\/status\/(\d+)/.exec(url.pathname)
  return match && match[1]
}

async function sendFollowerChainBlockConfirm(tab: browser.tabs.Tab, userName: string, followKind: FollowKind) {
  const myself = await TwitterAPI.getMyself().catch(() => null)
  if (!myself) {
    return alertToCurrentTab(i18n.getMessage('error_occured_check_login'))
  }
  const user = await TwitterAPI.getSingleUserByName(userName)
  const request: FollowerBlockSessionRequest = {
    purpose: 'chainblock',
    options: followerBlockDefaultOption,
    target: {
      type: 'follower',
      list: followKind,
      user,
    },
  }
  const result = createChainBlockSession(request)
  if (result.ok) {
    return confirmSession(tab, request, result.value)
  } else {
    const alertMessage = checkResultToString(result.error)
    return alertToCurrentTab(alertMessage)
  }
}

async function sendTweetReactionChainBlockConfirm(
  tab: browser.tabs.Tab,
  tweetId: string,
  { blockRetweeters, blockLikers }: { blockRetweeters: boolean; blockLikers: boolean }
) {
  const myself = await TwitterAPI.getMyself().catch(() => null)
  if (!myself) {
    return alertToCurrentTab(i18n.getMessage('error_occured_check_login'))
  }
  const tweet = await TwitterAPI.getTweetById(tweetId)
  const request: TweetReactionBlockSessionRequest = {
    purpose: 'chainblock',
    options: tweetReactionBlockDefaultOption,
    target: {
      type: 'tweet_reaction',
      blockRetweeters,
      blockLikers,
      tweet,
    },
  }
  const result = createChainBlockSession(request)
  if (result.ok) {
    return confirmSession(tab, request, result.value)
  } else {
    const alertMessage = checkResultToString(result.error)
    return alertToCurrentTab(alertMessage)
  }
}

// 크롬에선 browser.menus 대신 비표준 이름(browser.contextMenus)을 쓴다.
// 이를 파이어폭스와 맞추기 위해 이걸 함
const menus = new Proxy<typeof browser.menus>({} as any, {
  get(_target, name, receiver) {
    const menu = Reflect.get(browser.menus || {}, name, receiver)
    const ctxMenu = Reflect.get((browser as any).contextMenus || {}, name, receiver)
    return menu || ctxMenu
  },
})

async function createContextMenu() {
  await menus.removeAll()
  // 우클릭 - 유저
  menus.create({
    contexts: ['link'],
    documentUrlPatterns,
    targetUrlPatterns: urlPatterns,
    title: i18n.getMessage('run_followers_chainblock_to_this_user'),
    onclick(clickEvent, tab) {
      const url = new URL(clickEvent.linkUrl!)
      const userName = getUserNameFromURL(url)!
      sendFollowerChainBlockConfirm(tab, userName, 'followers')
    },
  })
  menus.create({
    contexts: ['link'],
    documentUrlPatterns,
    targetUrlPatterns: urlPatterns,
    title: i18n.getMessage('run_followings_chainblock_to_this_user'),
    onclick(clickEvent, tab) {
      const url = new URL(clickEvent.linkUrl!)
      const userName = getUserNameFromURL(url)!
      sendFollowerChainBlockConfirm(tab, userName, 'friends')
    },
  })
  menus.create({
    contexts: ['link'],
    documentUrlPatterns,
    targetUrlPatterns: urlPatterns,
    title: i18n.getMessage('run_mutual_followers_chainblock_to_this_user'),
    onclick(clickEvent, tab) {
      const url = new URL(clickEvent.linkUrl!)
      const userName = getUserNameFromURL(url)!
      sendFollowerChainBlockConfirm(tab, userName, 'mutual-followers')
    },
  })

  menus.create({
    type: 'separator',
  })
  // 우클릭 - 트윗
  menus.create({
    contexts: ['link'],
    documentUrlPatterns,
    targetUrlPatterns: tweetUrlPatterns,
    title: i18n.getMessage('run_retweeters_chainblock_to_this_tweet'),
    onclick(clickEvent, tab) {
      const url = new URL(clickEvent.linkUrl!)
      const tweetId = getTweetIdFromUrl(url)!
      sendTweetReactionChainBlockConfirm(tab, tweetId, {
        blockRetweeters: true,
        blockLikers: false,
      })
    },
  })
  menus.create({
    contexts: ['link'],
    documentUrlPatterns,
    targetUrlPatterns: tweetUrlPatterns,
    title: i18n.getMessage('run_likers_chainblock_to_this_tweet'),
    onclick(clickEvent, tab) {
      const url = new URL(clickEvent.linkUrl!)
      const tweetId = getTweetIdFromUrl(url)!
      sendTweetReactionChainBlockConfirm(tab, tweetId, {
        blockRetweeters: false,
        blockLikers: true,
      })
    },
  })
  menus.create({
    contexts: ['link'],
    documentUrlPatterns,
    targetUrlPatterns: tweetUrlPatterns,
    title: i18n.getMessage('run_retweeters_and_likers_chainblock_to_this_tweet'),
    onclick(clickEvent, tab) {
      const url = new URL(clickEvent.linkUrl!)
      const tweetId = getTweetIdFromUrl(url)!
      sendTweetReactionChainBlockConfirm(tab, tweetId, {
        blockRetweeters: true,
        blockLikers: true,
      })
    },
  })
  // 확장기능버튼
  menus.create({
    contexts: ['browser_action'],
    documentUrlPatterns: tweetUrlPatterns,
    title: i18n.getMessage('open_in_new_tab'),
    onclick(_clickEvent, _tab) {
      const url = browser.runtime.getURL('/popup/popup.html') + '?istab=1'
      browser.tabs.create({
        active: true,
        url,
      })
    },
  })
  menus.create({
    contexts: ['browser_action'],
    documentUrlPatterns: tweetUrlPatterns,
    title: i18n.getMessage('options'),
    onclick(_clickEvent, _tab) {
      browser.runtime.openOptionsPage()
    },
  })
}

export function initializeContextMenu() {
  createContextMenu()
}
