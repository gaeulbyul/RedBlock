import { PageEnum } from '../../popup/popup-ui/pages.js'
import { alertToCurrentTab } from './background.js'
import ChainBlocker from './chainblock.js'
import * as Storage from './storage.js'
import * as TwitterAPI from './twitter-api.js'
import * as i18n from '../i18n.js'
import { checkResultToString } from '../text-generate.js'
import { refreshSavedUsers } from './misc.js'
import { initializeContextMenu } from './context-menu.js'
import { initializeWebRequest } from './webrequest.js'
import BlockLimiter from './block-limiter.js'
import { assertNever } from '../common.js'
import { getCookieStoreIdFromTab } from './cookie-handler.js'

let storageQueue = Promise.resolve()
const chainblocker = new ChainBlocker()

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
      let errStr = ''
      try {
        errStr = JSON.stringify(err, null, 2)
      } catch {
        errStr = err
      }
      alertToCurrentTab(`Error: ${errStr}`)
    }
  })
}

async function sendProgress() {
  const sessions = chainblocker.getAllSessionInfos()
  return browser.runtime
    .sendMessage<RBMessageToPopup.ChainBlockInfo>({
      messageType: 'ChainBlockInfo',
      messageTo: 'popup',
      sessions,
    })
    .catch(() => {})
}

async function sendBlockLimiterStatus(options: BlockLimiterOptions) {
  const blockLimiter = new BlockLimiter(options)
  return browser.runtime.sendMessage<RBMessageToPopup.BlockLimiterInfo>({
    messageType: 'BlockLimiterInfo',
    messageTo: 'popup',
    status: {
      current: blockLimiter.count,
      max: blockLimiter.max,
      remained: blockLimiter.max - blockLimiter.count,
    },
  })
}

async function saveUserToStorage(user: TwitterUser) {
  storageQueue = storageQueue.then(() => Storage.insertUser(user))
  return storageQueue
}

async function removeUserFromStorage(user: TwitterUser) {
  storageQueue = storageQueue.then(() => Storage.removeUser(user))
  return storageQueue
}

async function twClientFromTab(tab: browser.tabs.Tab): Promise<TwitterAPI.TwClient> {
  if (!tab) {
    throw new Error('tab is missing')
  }
  let cookieStoreId = await getCookieStoreIdFromTab(tab)
  return new TwitterAPI.TwClient({ cookieStoreId })
}

function handleExtensionMessage(
  message: RBMessageToBackgroundType,
  sender: browser.runtime.MessageSender
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
      twClientFromTab(sender.tab!).then(twClient => twClient.blockUser(message.user))
      break
    case 'UnblockSingleUser':
      twClientFromTab(sender.tab!).then(twClient => twClient.unblockUser(message.user))
      break
    case 'RefreshSavedUsers':
      refreshSavedUsers(message.cookieOptions)
      break
    case 'RequestBlockLimiterStatus':
      sendBlockLimiterStatus(message.blockLimiterOptions)
      break
    case 'RequestResetCounter':
      {
        const blockLimiter = new BlockLimiter(message.blockLimiterOptions)
        blockLimiter.reset()
      }
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
}

initialize()
