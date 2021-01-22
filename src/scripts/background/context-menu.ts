import { getUserNameFromURL } from '../common.js'
import * as i18n from '../i18n.js'
import { defaultSessionOptions } from './chainblock-session/session.js'
import * as TwitterAPI from './twitter-api.js'
import type ChainBlocker from './chainblock.js'
import { TargetCheckResult } from './target-checker.js'
import { generateConfirmMessage, checkResultToString, objToString } from '../text-generate.js'
import { alertToTab } from './background.js'
import { getCookieStoreIdFromTab } from './cookie-handler.js'

/* TODO
TwClient: 우클릭 버튼 누를 시 넘겨받는 tab 데이터에 따라 cookieStoreId / incognito 등 정보 활용
*/

type BrowserTab = browser.tabs.Tab

const urlPatterns = ['https://twitter.com/*', 'https://mobile.twitter.com/*']
const documentUrlPatterns = [
  'https://twitter.com/*',
  'https://mobile.twitter.com/*',
  'https://tweetdeck.twitter.com/*',
]

const tweetUrlPatterns = ['https://twitter.com/*/status/*', 'https://mobile.twitter.com/*/status/*']

function getTweetIdFromUrl(url: URL) {
  const match = /\/status\/(\d+)/.exec(url.pathname)
  return match && match[1]
}

async function sendConfirmToTab(tab: BrowserTab, request: SessionRequest) {
  const confirmMessage = objToString(generateConfirmMessage(request))
  browser.tabs.sendMessage<RBMessageToContent.ConfirmChainBlock>(tab.id!, {
    messageType: 'ConfirmChainBlock',
    messageTo: 'content',
    confirmMessage,
    request,
  })
}

async function confirmFollowerChainBlockRequest(
  tab: BrowserTab,
  chainblocker: ChainBlocker,
  userName: string,
  followKind: FollowKind
) {
  const cookieStoreId = await getCookieStoreIdFromTab(tab)
  const twClient = new TwitterAPI.TwClient({ cookieStoreId })
  const myself = await twClient.getMyself().catch(() => null)
  if (!myself) {
    return alertToTab(tab, i18n.getMessage('error_occured_check_login'))
  }
  const user = await twClient.getSingleUser({ screen_name: userName })
  const request: FollowerBlockSessionRequest = {
    purpose: 'chainblock',
    options: defaultSessionOptions,
    target: {
      type: 'follower',
      list: followKind,
      user,
    },
    myself,
    cookieOptions: twClient.cookieOptions,
  }
  const checkResult = chainblocker.checkTarget(request)
  if (checkResult === TargetCheckResult.Ok) {
    return sendConfirmToTab(tab, request)
  } else {
    const alertMessage = checkResultToString(checkResult)
    return alertToTab(tab, alertMessage)
  }
}

async function confirmTweetReactionChainBlockRequest(
  tab: BrowserTab,
  chainblocker: ChainBlocker,
  tweetId: string,
  whoToBlock: {
    blockRetweeters: boolean
    blockLikers: boolean
    blockMentionedUsers: boolean
  }
) {
  const cookieStoreId = await getCookieStoreIdFromTab(tab)
  const twClient = new TwitterAPI.TwClient({ cookieStoreId })
  const myself = await twClient.getMyself().catch(() => null)
  if (!myself) {
    return alertToTab(tab, i18n.getMessage('error_occured_check_login'))
  }
  const tweet = await twClient.getTweetById(tweetId)
  const request: TweetReactionBlockSessionRequest = {
    purpose: 'chainblock',
    options: defaultSessionOptions,
    target: {
      type: 'tweet_reaction',
      tweet,
      ...whoToBlock,
    },
    myself,
    cookieOptions: twClient.cookieOptions,
  }
  const checkResult = chainblocker.checkTarget(request)
  if (checkResult === TargetCheckResult.Ok) {
    return sendConfirmToTab(tab, request)
  } else {
    const alertMessage = checkResultToString(checkResult)
    return alertToTab(tab, alertMessage)
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

export async function initializeContextMenu(chainblocker: ChainBlocker) {
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
      confirmFollowerChainBlockRequest(tab, chainblocker, userName, 'followers')
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
      confirmFollowerChainBlockRequest(tab, chainblocker, userName, 'friends')
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
      confirmFollowerChainBlockRequest(tab, chainblocker, userName, 'mutual-followers')
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
      confirmTweetReactionChainBlockRequest(tab, chainblocker, tweetId, {
        blockRetweeters: true,
        blockLikers: false,
        blockMentionedUsers: false,
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
      confirmTweetReactionChainBlockRequest(tab, chainblocker, tweetId, {
        blockRetweeters: false,
        blockLikers: true,
        blockMentionedUsers: false,
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
      confirmTweetReactionChainBlockRequest(tab, chainblocker, tweetId, {
        blockRetweeters: true,
        blockLikers: true,
        blockMentionedUsers: false,
      })
    },
  })
  menus.create({
    contexts: ['link'],
    documentUrlPatterns,
    targetUrlPatterns: tweetUrlPatterns,
    title: i18n.getMessage('run_mentioned_users_chainblock_to_this_tweet'),
    onclick(clickEvent, tab) {
      const url = new URL(clickEvent.linkUrl!)
      const tweetId = getTweetIdFromUrl(url)!
      confirmTweetReactionChainBlockRequest(tab, chainblocker, tweetId, {
        blockRetweeters: false,
        blockLikers: false,
        blockMentionedUsers: true,
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
