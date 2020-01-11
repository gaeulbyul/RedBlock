import { alert } from '../scripts/background/background.js'
import {
  checkFollowerBlockTarget,
  checkTweetReactionBlockTarget,
} from '../scripts/background/chainblock-session/session.js'
import { TwitterUser } from '../scripts/background/twitter-api.js'
import { getUserNameFromURL } from '../scripts/common.js'
import { generateFollowerBlockConfirmMessage, generateTweetReactionBlockMessage } from '../scripts/text-generate.js'

type Tab = browser.tabs.Tab

export async function startFollowerChainBlock(request: FollowerBlockSessionRequest) {
  const [isOk, alertMessage] = checkFollowerBlockTarget(request.target)
  if (!isOk) {
    alert(alertMessage)
    return
  }
  const confirmMessage = generateFollowerBlockConfirmMessage(request)
  if (!window.confirm(confirmMessage)) {
    return
  }
  return browser.runtime.sendMessage<RBActions.StartFollowerChainBlock, void>({
    actionType: 'StartFollowerChainBlock',
    request,
  })
}

export async function startTweetReactionChainBlock(request: TweetReactionBlockSessionRequest) {
  const [isOk, alertMessage] = checkTweetReactionBlockTarget(request.target)
  if (!isOk) {
    alert(alertMessage)
    return
  }
  const confirmMessage = generateTweetReactionBlockMessage(request)
  if (!window.confirm(confirmMessage)) {
    return
  }
  return browser.runtime.sendMessage<RBActions.StartTweetReactionChainBlock, void>({
    actionType: 'StartTweetReactionChainBlock',
    request,
  })
}

export async function stopChainBlock(sessionId: string) {
  return browser.runtime.sendMessage<RBActions.Stop>({
    actionType: 'StopChainBlock',
    sessionId,
  })
}

export async function stopAllChainBlock() {
  return browser.runtime.sendMessage<RBActions.StopAll>({
    actionType: 'StopAllChainBlock',
  })
}

export async function requestProgress() {
  return browser.runtime.sendMessage<RBActions.RequestProgress>({
    actionType: 'RequestProgress',
  })
}

export async function cleanupSessions() {
  return browser.runtime.sendMessage<RBActions.RequestCleanup>({
    actionType: 'RequestCleanup',
  })
}

export async function insertUserToStorage(user: TwitterUser) {
  return browser.runtime.sendMessage<RBActions.InsertUserToStorage>({
    actionType: 'InsertUserToStorage',
    user,
  })
}

export async function removeUserFromStorage(user: TwitterUser) {
  return browser.runtime.sendMessage<RBActions.RemoveUserFromStorage>({
    actionType: 'RemoveUserFromStorage',
    user,
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
