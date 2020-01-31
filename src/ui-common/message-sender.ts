import { alert } from '../scripts/background/background.js'
import {
  checkFollowerBlockTarget,
  checkTweetReactionBlockTarget,
} from '../scripts/background/chainblock-session/session.js'
import { TwitterUser } from '../scripts/background/twitter-api.js'

export async function startFollowerChainBlock(request: FollowerBlockSessionRequest) {
  const [isOk, alertMessage] = checkFollowerBlockTarget(request.target)
  if (!isOk) {
    alert(alertMessage)
    return
  }
  browser.runtime.sendMessage<RBActions.StartFollowerChainBlock>({
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
  browser.runtime.sendMessage<RBActions.StartTweetReactionChainBlock>({
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
