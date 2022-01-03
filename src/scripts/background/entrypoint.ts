import browser from 'webextension-polyfill'

import * as i18n from '../../scripts/i18n'
import { assertNever, sendBrowserRuntimeMessage } from '../common/utilities'
import { checkResultToString } from '../text-generate'
import { alertToCurrentTab, downloadCleaner } from './background'
import BlockLimiter from './block-limiter'
import { initializeContextMenu } from './context-menu'
import { getCookieStoreIdFromTab } from './cookie-handler'
import SessionManager from './session-manager'
import { migrateStorage } from './storage'
import { loadUIOptions } from './storage/options'
import * as TwitterAPI from './twitter-api'
import { initializeWebRequest } from './webrequest'

const sessionManager = new SessionManager()

// for debug
Object.assign(window, {
  sessionManager,
  TwitterAPI,
})

async function startSession(sessionId: string) {
  sendBrowserRuntimeMessage<RBMessageToPopup.PopupSwitchTab>({
    messageType: 'PopupSwitchTab',
    messageTo: 'popup',
    page: 'chainblock-sessions-page',
  }).catch(() => {}) // 우클릭 체인블락의 경우 팝업이 없음
  return sessionManager.start(sessionId).catch(err => {
    if (err instanceof TwitterAPI.RateLimitError) {
      alertToCurrentTab(i18n.getMessage('error_rate_limited'))
    } else {
      console.error(err)
    }
  })
}

async function sendSessionManagerInfo() {
  const sessions = sessionManager.getAllSessionInfos()
  const recurringAlarmInfos = await sessionManager.recurringManager.getAll()
  return sendBrowserRuntimeMessage<RBMessageToPopup.ChainBlockInfo>({
    messageType: 'ChainBlockInfo',
    messageTo: 'popup',
    sessions,
    recurringAlarmInfos,
  }).catch(() => {})
}

async function sendBlockLimiterStatus(userId: string) {
  const { count: current, max } = new BlockLimiter(userId)
  return sendBrowserRuntimeMessage<RBMessageToPopup.BlockLimiterInfo>({
    messageType: 'BlockLimiterInfo',
    messageTo: 'popup',
    userId,
    status: {
      current,
      max,
      remained: max - current,
    },
  }).catch(() => {})
}

async function twClientFromTab(tab: browser.Tabs.Tab): Promise<TwitterAPI.TwClient> {
  if (!tab) {
    throw new Error('tab is missing')
  }
  const cookieStoreId = await getCookieStoreIdFromTab(tab)
  return new TwitterAPI.TwClient({ cookieStoreId })
}

function handleExtensionMessage(
  message: RBMessageToBackgroundType,
  sender: browser.Runtime.MessageSender,
) {
  switch (message.messageType) {
    case 'CreateChainBlockSession':
      {
        const result = sessionManager.add(message.request)
        if (result.ok) {
          startSession(result.value).then(sendSessionManagerInfo)
        } else {
          // 이 시점에선 이미 target check를 통과한 요청만이 들어와야 한다
          // throw new Error(checkResultToString(result.error))
          alertToCurrentTab(checkResultToString(result.error))
        }
      }
      break
    // start session을 단독으로 실행하는 상황은 없더라.
    // case 'StartSession':
    //   startSession(message.sessionId).then(sendProgress)
    //   break
    case 'StopSession':
      sessionManager.stopAndRemove(message.sessionId, 'user-request')
      sendSessionManagerInfo()
      break
    case 'StopAllSessions':
      sessionManager.stopAll('user-request')
      sendSessionManagerInfo()
      break
    case 'RewindSession':
      sessionManager.rewind(message.sessionId)
      break
    case 'RequestChainBlockInfo':
      sendSessionManagerInfo()
      break
    case 'RequestCleanup':
      switch (message.cleanupWhat) {
        case 'inactive':
          sessionManager.cleanupInactiveSessions()
          break
        case 'nuke-all':
          sessionManager.forcelyNukeSessions()
          break
        default:
          assertNever(message.cleanupWhat)
      }
      break
    case 'BlockSingleUser':
      twClientFromTab(sender.tab!).then(twClient => twClient.blockUser(message.user))
      break
    case 'BlockUserById':
      twClientFromTab(sender.tab!).then(twClient => twClient.blockUserById(message.userId))
      break
    case 'UnblockUserById':
      twClientFromTab(sender.tab!).then(twClient => twClient.unblockUserById(message.userId))
      break
    case 'RequestBlockLimiterStatus':
      sendBlockLimiterStatus(message.userId)
      break
    case 'RequestResetBlockCounter':
      BlockLimiter.resetCounterByUserId(message.userId)
      sendBlockLimiterStatus(message.userId)
      break
    case 'DownloadFromExportSession':
      sessionManager.downloadFileFromExportSession(message.sessionId)
      break
    default:
      assertNever(message)
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
  browser.runtime.onMessage.addListener((msg: object, sender: browser.Runtime.MessageSender) => {
    if (checkMessage(msg)) {
      handleExtensionMessage(msg, sender)
    } else {
      console.debug('unknown msg?', msg)
    }
  })
  loadUIOptions().then(({ menus }) => initializeContextMenu(sessionManager, menus))
  initializeWebRequest()
  browser.runtime.onInstalled.addListener(() => {
    migrateStorage()
  })
  downloadCleaner()
}

initialize()
