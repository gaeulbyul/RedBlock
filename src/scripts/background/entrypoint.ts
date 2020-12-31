import { PageEnum } from '../../popup/popup.js'
import { alertToCurrentTab } from './background.js'
import ChainBlocker from './chainblock.js'
import * as Storage from './storage.js'
import * as TwitterAPI from './twitter-api.js'
import * as i18n from '../i18n.js'
import { checkResultToString } from '../text-generate.js'
import { refreshSavedUsers } from './misc.js'
import { initializeContextMenu } from './context-menu.js'
import { initializeWebRequest, initializeBlockAPILimiter } from './webrequest.js'
import BlockLimiter from './block-limiter.js'
import { assertNever } from '../common.js'

let storageQueue = Promise.resolve()
const blockLimiter = new BlockLimiter()
const chainblocker = new ChainBlocker(blockLimiter)

// for debug
Object.assign(window, {
  chainblocker,
})

async function startSession(sessionId: string) {
  browser.runtime
    .sendMessage<RBMessageToPopup.PopupSwitchTab>({
      messageType: 'PopupSwitchTab',
      messageTo: 'popup',
      page: PageEnum.Sessions,
    })
    .catch(() => {}) // 우클릭 체인블락의 경우 팝업이 없음
  return chainblocker.start(sessionId).catch(err => {
    if (err instanceof TwitterAPI.RateLimitError) {
      alertToCurrentTab(i18n.getMessage('error_rate_limited'))
    } else {
      alertToCurrentTab(err)
    }
  })
}

async function sendProgress() {
  const sessions = chainblocker.getAllSessionInfos()
  return browser.runtime
    .sendMessage<RBMessageToPopup.ChainBlockInfo>({
      messageType: 'ChainBlockInfo',
      messageTo: 'popup',
      limiter: {
        current: blockLimiter.count,
        max: blockLimiter.max,
        remained: blockLimiter.max - blockLimiter.count,
      },
      sessions,
    })
    .catch(() => {})
}

async function saveUserToStorage(user: TwitterUser) {
  storageQueue = storageQueue.then(() => Storage.insertUser(user))
  return storageQueue
}

async function removeUserFromStorage(user: TwitterUser) {
  storageQueue = storageQueue.then(() => Storage.removeUser(user))
  return storageQueue
}

function handleExtensionMessage(
  message: RBMessageToBackgroundType,
  _sender: browser.runtime.MessageSender
) {
  switch (message.messageType) {
    case 'CreateChainBlockSession':
      {
        const result = chainblocker.add(message.request)
        if (result.ok) {
          startSession(result.value).then(sendProgress)
        } else {
          // 이 시점에선 이미 target check를 통과한 요청만이 들어와야 한다
          throw new Error(checkResultToString(result.error))
        }
      }
      break
    // start session을 단독으로 실행하는 상황은 없더라.
    // case 'StartSession':
    //   startSession(message.sessionId).then(sendProgress)
    //   break
    case 'StopSession':
      chainblocker.stop(message.sessionId)
      sendProgress()
      break
    case 'StopAllSessions':
      chainblocker.stopAll()
      sendProgress()
      break
    case 'RewindSession':
      chainblocker.rewind(message.sessionId)
      break
    case 'RequestProgress':
      sendProgress()
      break
    case 'RequestCleanup':
      switch (message.cleanupWhat) {
        case 'inactive':
          chainblocker.cleanupInactiveSessions()
          break
      }
      break
    case 'InsertUserToStorage':
      saveUserToStorage(message.user)
      break
    case 'RemoveUserFromStorage':
      removeUserFromStorage(message.user)
      break
    case 'BlockSingleUser':
      TwitterAPI.blockUser(message.user)
      break
    case 'UnblockSingleUser':
      TwitterAPI.unblockUser(message.user)
      break
    case 'RefreshSavedUsers':
      refreshSavedUsers()
      break
    case 'RequestResetCounter':
      blockLimiter.reset()
      break
    case 'DownloadFromExportSession':
      chainblocker.downloadFileFromExportSession(message.sessionId)
      break
    default:
      assertNever(message)
      break
  }
}

function checkMessage(msg: object): msg is RBMessageToBackgroundType {
  if (msg == null) {
    return false
  }
  if (!('messageTo' in msg)) {
    return false
  }
  if ((msg as any).messageTo !== 'background') {
    return false
  }
  return true
}

function initialize() {
  browser.runtime.onMessage.addListener(
    (
      msg: object,
      sender: browser.runtime.MessageSender,
      _sendResponse: (response: any) => Promise<void>
    ): true => {
      if (checkMessage(msg)) {
        handleExtensionMessage(msg, sender)
      } else {
        console.debug('unknown msg?', msg)
      }
      return true
    }
  )
  initializeContextMenu(chainblocker)
  initializeWebRequest()
  initializeBlockAPILimiter(blockLimiter)
}

initialize()
