import { PageEnum } from '../common.js'
import { alertToCurrentTab } from './background.js'
import ChainBlocker, { TargetCheckResult } from './chainblock.js'
import * as Storage from './storage.js'
import * as TwitterAPI from './twitter-api.js'
import * as i18n from '../i18n.js'
import * as TextGenerator from '../text-generate.js'
import { initializeContextMenu } from './context-menu.js'
import { initializeWebRequest } from './webrequest.js'
// import { checkFollowerBlockTarget, checkTweetReactionBlockTarget } from './chainblock-session/session.js'

let storageQueue = Promise.resolve()
const chainblocker = new ChainBlocker()

// for debug
Object.assign(window, {
  chainblocker,
})

type SessionCreateResult = Either<TargetCheckResult, string>
export async function createChainBlockSession(request: SessionRequest): Promise<SessionCreateResult> {
  const myself = await TwitterAPI.getMyself().catch(() => null)
  if (!myself) {
    throw new Error(i18n.getMessage('error_occured_check_login'))
  }
  const checkResult = chainblocker.checkTarget(request)
  if (checkResult !== TargetCheckResult.Ok) {
    return {
      ok: false,
      error: checkResult,
    }
  }
  const sessionId = chainblocker.add(request)
  chainblocker.prepare(sessionId)
  return {
    ok: true,
    value: sessionId,
  }
}

function generateConfirmMessage(request: SessionRequest) {
  let confirmMessageObj: TextGenerator.DialogMessageObj
  switch (request.target.type) {
    case 'follower':
      confirmMessageObj = TextGenerator.generateFollowerBlockConfirmMessage(request as FollowerBlockSessionRequest)
      break
    case 'tweetReaction':
      confirmMessageObj = TextGenerator.generateTweetReactionBlockMessage(request as TweetReactionBlockSessionRequest)
      break
  }
  return confirmMessageObj
}

export async function confirmSession(tab: browser.tabs.Tab, request: SessionRequest, sessionId: string) {
  const confirmMessageObj = generateConfirmMessage(request)
  const confirmMessage = TextGenerator.objToString(confirmMessageObj)
  browser.tabs.sendMessage<RBMessages.ConfirmChainBlock>(tab!.id!, {
    messageType: 'ConfirmChainBlock',
    messageTo: 'content',
    confirmMessage,
    sessionId,
  })
}

async function confirmSessionInPopup(request: SessionRequest, sessionId: string) {
  const confirmMessage = generateConfirmMessage(request)
  browser.runtime.sendMessage<RBMessages.ConfirmChainBlockInPopup>({
    messageType: 'ConfirmChainBlockInPopup',
    messageTo: 'popup',
    confirmMessage,
    sessionId,
  })
}

async function startSession(sessionId: string) {
  browser.runtime
    .sendMessage<RBMessages.PopupSwitchTab>({
      messageType: 'PopupSwitchTab',
      messageTo: 'popup',
      page: PageEnum.Sessions,
    })
    .catch(() => {}) // 우클릭 체인블락의 경우 팝업이 없음
  chainblocker.setConfirmed(sessionId)
  return chainblocker.start(sessionId).catch(err => {
    if (err instanceof TwitterAPI.RateLimitError) {
      alertToCurrentTab(i18n.getMessage('error_rate_limited'))
    }
    throw err
  })
}

function cancelSession(sessionId: string) {
  chainblocker.remove(sessionId, true)
}

function stopChainBlock(sessionId: string) {
  chainblocker.stop(sessionId)
}

function rewindChainBlock(sessionId: string) {
  chainblocker.rewind(sessionId)
}

function stopAllChainBlock() {
  chainblocker.stopAll()
}

async function sendProgress() {
  const infos = chainblocker.getAllSessionInfos()
  return browser.runtime
    .sendMessage<RBMessages.ChainBlockInfo>({
      messageType: 'ChainBlockInfo',
      messageTo: 'popup',
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

function handleExtensionMessage(message: RBAction, _sender: browser.runtime.MessageSender) {
  switch (message.actionType) {
    case 'CreateFollowerChainBlockSession':
      createChainBlockSession(message.request).then(async result => {
        if (result.ok) {
          confirmSessionInPopup(message.request, result.value)
        }
      })
      break
    case 'CreateTweetReactionChainBlockSession':
      createChainBlockSession(message.request).then(async result => {
        if (result.ok) {
          confirmSessionInPopup(message.request, result.value)
        }
      })
      break
    case 'Cancel':
      cancelSession(message.sessionId)
      sendProgress()
      break
    case 'Start':
      startSession(message.sessionId).then(sendProgress)
      break
    case 'StopChainBlock':
      stopChainBlock(message.sessionId)
      sendProgress()
      break
    case 'StopAllChainBlock':
      stopAllChainBlock()
      break
    case 'RewindChainBlock':
      rewindChainBlock(message.sessionId)
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
    case 'BlockSingleUser':
      TwitterAPI.blockUser(message.user)
      break
    case 'UnblockSingleUser':
      TwitterAPI.unblockUser(message.user)
      break
  }
}

function initialize() {
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
  initializeWebRequest()
}

initialize()
