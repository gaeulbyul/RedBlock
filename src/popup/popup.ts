import { getUserNameFromURL } from '../scripts/common.js'

export {
  startFollowerChainBlock,
  startTweetReactionChainBlock,
  stopAllChainBlock,
  stopChainBlock,
  removeUserFromStorage,
  requestProgress,
  cleanupSessions,
  insertUserToStorage,
} from '../ui-common/message-sender.js'

type Tab = browser.tabs.Tab

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
