import { getUserNameFromURL } from '../scripts/common.js'

export {
  startFollowerChainBlock,
  startTweetReactionChainBlock,
  stopAllChainBlock,
  stopChainBlock,
  cancelChainBlock,
  insertUserToStorage,
  removeUserFromStorage,
  requestProgress,
  cleanupInactiveSessions,
} from '../scripts/background/request-sender.js'

type Tab = browser.tabs.Tab

export async function toggleOneClickBlockMode(enabled: boolean) {
  const tab = await getCurrentTab()
  const tabId = tab && tab.id
  if (typeof tabId !== 'number') {
    throw new Error()
  }
  return browser.tabs.sendMessage<RBMessages.ToggleOneClickBlockMode>(tabId, {
    messageType: 'ToggleOneClickBlockMode',
    messageTo: 'content',
    enabled,
  })
}

export async function getCurrentTab(): Promise<Tab | null> {
  const tabs = await browser.tabs.query({
    active: true,
    currentWindow: true,
  })
  const currentTab = tabs[0]
  if (!currentTab || !currentTab.url) {
    return null
  }
  return currentTab
}

export function getUserNameFromTab(tab: Tab): string | null {
  if (!tab || !tab.url) {
    return null
  }
  const url = new URL(tab.url)
  return getUserNameFromURL(url)
}

export function getTweetIdFromTab(tab: Tab): string | null {
  if (!tab || !tab.url) {
    return null
  }
  const url = new URL(tab.url)
  if (!['twitter.com', 'mobile.twitter.com'].includes(url.host)) {
    return null
  }
  const match = /\/status\/(\d+)/.exec(url.pathname)
  return match && match[1]
}
