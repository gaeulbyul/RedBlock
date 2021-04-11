import { getUserNameFromURL } from '../scripts/common.js'
import {
  examineRetrieverByTargetUser,
  examineRetrieverByTweetId,
} from '../scripts/background/antiblock.js'
import { loadOptions } from '../scripts/background/storage.js'
import type { TwClient } from '../scripts/background/twitter-api.js'

type Tab = browser.tabs.Tab

export async function toggleOneClickBlockMode(enabled: boolean) {
  const tab = await getCurrentTab()
  const tabId = tab && tab.id
  if (typeof tabId !== 'number') {
    throw new Error()
  }
  return browser.tabs.sendMessage<RBMessageToContent.ToggleOneClickBlockMode>(tabId, {
    messageType: 'ToggleOneClickBlockMode',
    messageTo: 'content',
    enabled,
  })
}

export async function getCurrentTab(): Promise<Tab> {
  const tabs = await browser.tabs.query({
    active: true,
    currentWindow: true,
  })
  const currentTab = tabs[0]!
  return currentTab
}

export function getUserNameFromTab(tab: Tab): string | null {
  if (!tab.url) {
    return null
  }
  const url = new URL(tab.url)
  return getUserNameFromURL(url)
}

function getCurrentSearchQueryFromTab(tab: Tab): string | null {
  if (!tab.url) {
    return null
  }
  const url = new URL(tab.url)
  if (!['twitter.com', 'mobile.twitter.com'].includes(url.hostname)) {
    return null
  }
  if (url.pathname !== '/search') {
    return null
  }
  if (url.searchParams.get('f') !== 'user') {
    return null
  }
  return url.searchParams.get('q') || null
}

// 트윗 신고화면에선 사용자 이름 대신 ID가 나타난다.
function getUserIdFromTab(tab: Tab): string | null {
  if (!tab.url) {
    return null
  }
  const url = new URL(tab.url)
  if (!['twitter.com', 'mobile.twitter.com'].includes(url.host)) {
    return null
  }
  const match1 = /^\/i\/report\/user\/(\d+)/.exec(url.pathname)
  if (match1) {
    return match1[1]
  }
  const reportedUserId = url.pathname.startsWith('/i/safety/report')
    ? url.searchParams.get('reported_user_id')
    : null
  if (reportedUserId) {
    return reportedUserId
  }
  return null
}

function getTweetIdFromTab(tab: Tab): string | null {
  if (!tab.url) {
    return null
  }
  const url = new URL(tab.url)
  if (!['twitter.com', 'mobile.twitter.com'].includes(url.host)) {
    return null
  }
  const match1 = /\/status\/(\d+)/.exec(url.pathname)
  if (match1) {
    return match1[1]
  }
  // 신고화면에서
  const reportedTweetId = url.pathname.startsWith('/i/safety/report')
    ? url.searchParams.get('reported_tweet_id')
    : null
  if (reportedTweetId) {
    return reportedTweetId
  }
  return null
}

export function determineInitialPurposeType<T extends Purpose>(
  myself: TwitterUser | null,
  givenUser: TwitterUser | null
): T['type'] {
  if (!(myself && givenUser)) {
    return 'chainblock'
  }
  if (givenUser.following) {
    return 'unchainblock'
  }
  return 'chainblock'
}

export function checkMessage(msg: object): msg is RBMessageToPopupType {
  if (msg == null) {
    return false
  }
  if (!('messageTo' in msg)) {
    return false
  }
  if ((msg as any).messageTo !== 'popup') {
    return false
  }
  return true
}

interface TabContext {
  executor: Actor | null
  retriever: Actor | null
  currentUser: TwitterUser | null
  currentTweet: Tweet | null
  currentSearchQuery: string | null
}

export async function getTabContext(
  tab: browser.tabs.Tab,
  twClient: TwClient
): Promise<TabContext> {
  const myself = await twClient.getMyself().catch(() => null)
  if (!myself) {
    return {
      executor: null,
      retriever: null,
      currentUser: null,
      currentTweet: null,
      currentSearchQuery: null,
    }
  }
  const options = await loadOptions()
  if (options.enableAntiBlock) {
    return getTabContextWithAntiblock(myself, tab, twClient)
  }
  const executor: Actor = {
    user: myself,
    cookieOptions: twClient.cookieOptions,
  }
  const retriever = Object.assign({}, executor)
  const tweetId = getTweetIdFromTab(tab)
  const userId = getUserIdFromTab(tab)
  const userName = getUserNameFromTab(tab)
  const currentTweet = await (tweetId ? twClient.getTweetById(tweetId).catch(() => null) : null)
  let currentUser: TwitterUser | null = null
  if (currentTweet) {
    currentUser = currentTweet.user
  } else if (userName) {
    currentUser = await twClient.getSingleUser({ screen_name: userName }).catch(() => null)
  } else if (userId) {
    currentUser = await twClient.getSingleUser({ user_id: userId }).catch(() => null)
  }
  const currentSearchQuery = getCurrentSearchQueryFromTab(tab)
  return {
    executor,
    retriever,
    currentTweet,
    currentUser,
    currentSearchQuery,
  }
}

async function getTabContextWithAntiblock(
  myself: TwitterUser,
  tab: browser.tabs.Tab,
  twClient: TwClient
): Promise<TabContext> {
  const executor: Actor = {
    user: myself,
    cookieOptions: twClient.cookieOptions,
  }
  const retriever = Object.assign({}, executor)
  const tweetId = getTweetIdFromTab(tab)
  const userId = getUserIdFromTab(tab)
  const userName = getUserNameFromTab(tab)
  let currentTweet: Tweet | null = null
  let currentUser: TwitterUser | null = null
  let usingAlternativeRetriever = false
  if (tweetId) {
    const result = await examineRetrieverByTweetId(executor, tweetId)
    if (result) {
      currentTweet = result.targetTweet
      if (result.tweetRetrievedFromPrimary) {
        currentUser = currentTweet.user
      } else {
        usingAlternativeRetriever = true
        retriever.user = result.user
        retriever.cookieOptions = result.cookieOptions
      }
    }
  }
  if (!currentUser) {
    if (userName) {
      currentUser = await twClient.getSingleUser({ screen_name: userName }).catch(() => null)
    } else if (userId) {
      currentUser = await twClient.getSingleUser({ user_id: userId }).catch(() => null)
    }
  }
  if (currentUser && currentUser.blocked_by && !usingAlternativeRetriever) {
    const result = await examineRetrieverByTargetUser(executor, currentUser)
    if (result) {
      usingAlternativeRetriever = true
      retriever.user = result.user
      retriever.cookieOptions = result.cookieOptions
    }
  }
  const currentSearchQuery = getCurrentSearchQueryFromTab(tab)
  return {
    executor,
    retriever,
    currentTweet,
    currentUser,
    currentSearchQuery,
  }
}
