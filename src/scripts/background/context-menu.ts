import { getUserNameFromURL, getFollowersCount, getReactionsCount } from '../common.js'
import * as TextGenerate from '../text-generate.js'
import * as i18n from '../i18n.js'
import { alert } from './background.js'
import {
  checkFollowerBlockTarget,
  checkTweetReactionBlockTarget,
  followerBlockDefaultOption,
  tweetReactionBlockDefaultOption,
} from './chainblock-session/session.js'
import { loadOptions, onOptionsChanged } from './storage.js'
import { getSingleUserByName, getTweetById } from './twitter-api.js'

const urlPatterns = ['https://twitter.com/*', 'https://mobile.twitter.com/*']
const tweetUrlPatterns = ['https://twitter.com/*/status/*', 'https://mobile.twitter.com/*/status/*']

function getTweetIdFromUrl(url: URL) {
  const match = /\/status\/(\d+)/.exec(url.pathname)
  return match && match[1]
}

async function sendFollowerChainBlockConfirm(tab: browser.tabs.Tab, userName: string, followKind: FollowKind) {
  const user = await getSingleUserByName(userName)
  const request: FollowerBlockSessionRequest = {
    purpose: 'chainblock',
    options: followerBlockDefaultOption,
    target: {
      type: 'follower',
      list: followKind,
      user,
      count: getFollowersCount(user, followKind),
    },
  }
  const [isOk, alertMessage] = checkFollowerBlockTarget(request.target)
  if (!isOk) {
    alert(alertMessage)
    return
  }
  const confirmMessageObj = TextGenerate.generateFollowerBlockConfirmMessage(request)
  const confirmMessage = TextGenerate.objToString(confirmMessageObj)
  browser.tabs.sendMessage<RBMessages.ConfirmChainBlock>(tab.id!, {
    messageType: 'ConfirmChainBlock',
    confirmMessage,
    action: {
      actionType: 'StartFollowerChainBlock',
      request,
    },
  })
}

async function sendTweetReactionChainBlockConfirm(
  tab: browser.tabs.Tab,
  tweetId: string,
  blockRetweeters: boolean,
  blockLikers: boolean
) {
  const tweet = await getTweetById(tweetId)
  const request: TweetReactionBlockSessionRequest = {
    purpose: 'chainblock',
    options: tweetReactionBlockDefaultOption,
    target: {
      type: 'tweetReaction',
      blockRetweeters,
      blockLikers,
      tweet,
      count: 0,
    },
  }
  request.target.count = getReactionsCount(request.target)
  const [isOk, alertMessage] = checkTweetReactionBlockTarget(request.target)
  if (!isOk) {
    alert(alertMessage)
    return
  }
  const confirmMessageObj = TextGenerate.generateTweetReactionBlockMessage(request)
  const confirmMessage = TextGenerate.objToString(confirmMessageObj)
  browser.tabs.sendMessage<RBMessages.ConfirmChainBlock>(tab.id!, {
    messageType: 'ConfirmChainBlock',
    confirmMessage,
    action: {
      actionType: 'StartTweetReactionChainBlock',
      request,
    },
  })
}

async function createContextMenu() {
  // 크롬에선 browser.menus 대신 비표준 이름(browser.contextMenus)을 쓴다.
  // 이를 파이어폭스와 맞추기 위해 이걸 함
  const menus = new Proxy<typeof browser.menus>({} as any, {
    get(_target, name, receiver) {
      const menu = Reflect.get(browser.menus || {}, name, receiver)
      const ctxMenu = Reflect.get((browser as any).contextMenus || {}, name, receiver)
      return menu || ctxMenu
    },
  })

  await menus.removeAll()

  menus.create({
    contexts: ['link'],
    documentUrlPatterns: urlPatterns,
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
    documentUrlPatterns: urlPatterns,
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
    documentUrlPatterns: urlPatterns,
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

  menus.create({
    contexts: ['link'],
    documentUrlPatterns: urlPatterns,
    targetUrlPatterns: tweetUrlPatterns,
    title: i18n.getMessage('run_retweeters_chainblock_to_this_tweet'),
    onclick(clickEvent, tab) {
      const url = new URL(clickEvent.linkUrl!)
      const tweetId = getTweetIdFromUrl(url)!
      sendTweetReactionChainBlockConfirm(tab, tweetId, true, false)
    },
  })
  menus.create({
    contexts: ['link'],
    documentUrlPatterns: urlPatterns,
    targetUrlPatterns: tweetUrlPatterns,
    title: i18n.getMessage('run_likers_chainblock_to_this_tweet'),
    onclick(clickEvent, tab) {
      const url = new URL(clickEvent.linkUrl!)
      const tweetId = getTweetIdFromUrl(url)!
      sendTweetReactionChainBlockConfirm(tab, tweetId, false, true)
    },
  })
  menus.create({
    contexts: ['link'],
    documentUrlPatterns: urlPatterns,
    targetUrlPatterns: tweetUrlPatterns,
    title: i18n.getMessage('run_retweeters_and_likers_chainblock_to_this_tweet'),
    onclick(clickEvent, tab) {
      const url = new URL(clickEvent.linkUrl!)
      const tweetId = getTweetIdFromUrl(url)!
      sendTweetReactionChainBlockConfirm(tab, tweetId, true, true)
    },
  })
}

export function initializeContextMenu() {
  loadOptions().then(createContextMenu)
  onOptionsChanged(createContextMenu)
}
