import { UI_UPDATE_DELAY } from '../common.js'
import { PageEnum } from '../../popup/popup-ui/popup-ui-common.js'
import { alert } from './background.js'
import ChainBlocker from './chainblock.js'
import * as Storage from './storage.js'
import * as TwitterAPI from './twitter-api.js'
import { initializeContextMenu } from './context-menu.js'

type TwitterUser = TwitterAPI.TwitterUser

let storageQueue = Promise.resolve()
const chainblocker = new ChainBlocker()
const tabConnections = new Set<number>()

export async function executeFollowerChainBlock(request: FollowerBlockSessionRequest) {
  const myself = await TwitterAPI.getMyself().catch(() => null)
  if (!myself) {
    alert('로그인 여부를 확인해주세요.')
    return
  }
  try {
    const sessionId = chainblocker.add(request)
    if (!sessionId) {
      console.info('not added. skip')
      return
    }
    chainblocker.start(sessionId)
    browser.runtime
      .sendMessage<RBMessages.PopupSwitchTab>({
        messageType: 'PopupSwitchTab',
        page: PageEnum.Sessions,
      })
      .catch(() => {}) // 우클릭 체인블락의 경우 팝업이 없음
  } catch (err) {
    if (err instanceof TwitterAPI.RateLimitError) {
      alert('현재 리밋에 걸린 상태입니다. 나중에 다시 시도해주세요.')
    } else {
      throw err
    }
  }
}

export async function executeTweetReactionChainBlock(request: TweetReactionBlockSessionRequest) {
  const myself = await TwitterAPI.getMyself().catch(() => null)
  if (!myself) {
    alert('로그인 여부를 확인해주세요.')
    return
  }
  try {
    const sessionId = chainblocker.add(request)
    if (!sessionId) {
      console.info('not added. skip')
      return
    }
    chainblocker.start(sessionId)
    browser.runtime
      .sendMessage<RBMessages.PopupSwitchTab>({
        messageType: 'PopupSwitchTab',
        page: PageEnum.Sessions,
      })
      .catch(() => {}) // 우클릭 체인블락의 경우 팝업이 없음
  } catch (err) {
    if (err instanceof TwitterAPI.RateLimitError) {
      alert('현재 리밋에 걸린 상태입니다. 나중에 다시 시도해주세요.')
    } else {
      throw err
    }
  }
}

async function stopChainBlock(sessionId: string) {
  chainblocker.stop(sessionId)
}

async function stopAllChainBlock() {
  chainblocker.stopAll()
}

async function sendChainBlockerInfoToTabs() {
  const infos = _.orderBy(chainblocker.getAllSessionsProgress(), ['sessionId'], ['desc'])
  for (const tabId of tabConnections) {
    browser.tabs
      .sendMessage<RBMessages.ChainBlockInfo>(tabId, {
        messageType: 'ChainBlockInfo',
        infos,
      })
      .catch(() => {
        tabConnections.delete(tabId)
      })
  }
}

async function sendProgress() {
  const infos = chainblocker.getAllSessionsProgress()
  return browser.runtime
    .sendMessage<RBMessages.ChainBlockInfo>({
      messageType: 'ChainBlockInfo',
      infos,
    })
    .catch(() => {})
}

async function cleanupSessions() {
  chainblocker.cleanupSessions()
}

async function saveUserToStorage(user: TwitterUser) {
  console.info('saving user', user)
  storageQueue = storageQueue.then(() => Storage.insertSingleUserAndSave(user))
  return storageQueue
}

async function removeUserFromStorage(user: TwitterUser) {
  console.info('removing user', user)
  storageQueue = storageQueue.then(() => Storage.removeSingleUserAndSave(user))
  return storageQueue
}

function handleExtensionMessage(message: RBAction, sender: browser.runtime.MessageSender) {
  switch (message.actionType) {
    case 'StartFollowerChainBlock':
      executeFollowerChainBlock(message.request).then(sendChainBlockerInfoToTabs)
      break
    case 'StartTweetReactionChainBlock':
      executeTweetReactionChainBlock(message.request).then(sendChainBlockerInfoToTabs)
      break
    case 'StopChainBlock':
      stopChainBlock(message.sessionId).then(sendChainBlockerInfoToTabs)
      break
    case 'StopAllChainBlock':
      stopAllChainBlock()
      break
    case 'RequestProgress':
      sendProgress()
      break
    case 'RequestCleanup':
      cleanupSessions()
      break
    case 'InsertUserToStorage':
      saveUserToStorage(message.user)
      break
    case 'RemoveUserFromStorage':
      removeUserFromStorage(message.user)
      break
    case 'ConnectToBackground':
      sender.tab && tabConnections.add(sender.tab.id!)
      break
    case 'DisconnectToBackground':
      sender.tab && tabConnections.delete(sender.tab.id!)
      break
  }
}

function initialize() {
  window.setInterval(sendChainBlockerInfoToTabs, UI_UPDATE_DELAY)
  browser.runtime.onMessage.addListener(
    (msg: object, sender: browser.runtime.MessageSender, _sendResponse: (response: any) => Promise<void>): true => {
      if (!(typeof msg === 'object' && 'actionType' in msg)) {
        console.debug('unknown msg?', msg)
        return true
      }
      handleExtensionMessage(msg as RBAction, sender)
      return true
    }
  )
  initializeContextMenu()
}

initialize()
