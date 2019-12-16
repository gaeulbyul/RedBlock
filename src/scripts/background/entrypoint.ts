import { Action, formatNumber, UI_UPDATE_DELAY } from '../common.js'
import { defaultOption, SessionRequest } from './chainblock-session.js'
import ChainBlocker from './chainblock.js'
import * as Storage from './storage.js'
import * as TwitterAPI from './twitter-api.js'

type TwitterUser = TwitterAPI.TwitterUser

let storageQueue = Promise.resolve()
const chainblocker = new ChainBlocker()
const tabConnections = new Set<number>()

export async function doChainBlockWithDefaultOptions(userName: string, targetList: FollowKind) {
  return doChainBlock({
    userName,
    targetList,
    purpose: 'chainblock',
    options: defaultOption,
  })
}

function generateConfirmMessage(request: SessionRequest): string {
  const { purpose } = request
  const { user: targetUser, list: targetList } = request.target
  const { myFollowers, myFollowings, quickMode } = request.options
  const targetUserName = targetUser.screen_name
  const purposeKor = purpose === 'chainblock' ? '체인블락' : '언체인블락'
  let confirmMessage = `정말로 @${targetUserName}에게 ${purposeKor}을 실행하시겠습니까?\n`
  confirmMessage += '--------------------\n'
  switch (targetList) {
    case 'followers':
      confirmMessage += `대상: @${targetUserName}의 팔로워 ${formatNumber(targetUser.followers_count, quickMode)}명\n`
      break
    case 'friends':
      confirmMessage += `대상: @${targetUserName}의 팔로잉 ${formatNumber(targetUser.friends_count, quickMode)}명\n`
      break
    case 'mutual-followers':
      confirmMessage += `대상: @${targetUserName}의 맞팔로우 유저\n`
      break
    default:
      throw new Error('unreachable')
  }
  if (myFollowers === 'Block') {
    confirmMessage += '\u26a0 주의! 내 팔로워가 있어도 차단할 수 있습니다.\n'
  }
  if (myFollowings === 'Block') {
    confirmMessage += '\u26a0 주의! 내가 팔로우하는 사용자가 있어도 차단할 수 있습니다.\n'
  }
  return confirmMessage
}

function generateRequest(
  targetUser: TwitterUser,
  purpose: ChainKind,
  followKind: FollowKind,
  options: SessionRequest['options']
): SessionRequest {
  return {
    purpose,
    target: {
      user: targetUser,
      list: followKind,
    },
    options,
  }
}

async function doChainBlock(params: ChainParams) {
  const { targetList, userName, purpose, options } = params
  const myself = await TwitterAPI.getMyself().catch(() => null)
  if (!myself) {
    window.alert('로그인 여부를 확인해주세요.')
    return
  }
  try {
    const targetUser = await TwitterAPI.getSingleUserByName(userName)
    if (targetUser.blocked_by) {
      window.alert('\u26d4 상대방이 나를 차단하여 (언)체인블락을 실행할 수 없습니다.')
      return
    }
    if (targetUser.protected && !targetUser.following) {
      window.alert('\u{1f512} 프로텍트 계정을 대상으로 (언)체인블락을 실행할 수 없습니다.')
      return
    }
    let isZero = false
    if (targetList === 'followers' && targetUser.followers_count <= 0) {
      isZero = true
    } else if (targetList === 'friends' && targetUser.friends_count <= 0) {
      isZero = true
    }
    // TODO: 맞팔로우 체인시 팔로워 OR 팔로잉이 0인지 체크
    if (isZero) {
      window.alert('차단/차단해제할 팔로잉/팔로워가 없습니다. (총 0명)')
      return
    }
    const request = generateRequest(targetUser, purpose, targetList, options)
    const confirmMessage = generateConfirmMessage(request)
    if (window.confirm(confirmMessage)) {
      const sessionId = chainblocker.add(request)
      if (!sessionId) {
        console.info('not added. skip')
        return
      }
      chainblocker.start(sessionId)
    }
  } catch (err) {
    if (err instanceof TwitterAPI.RateLimitError) {
      window.alert('현재 리밋에 걸린 상태입니다. 나중에 다시 시도해주세요.')
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
  const infos = chainblocker.getAllSessionsProgress()
  for (const tabId of tabConnections) {
    browser.tabs
      .sendMessage<RBChainBlockInfoMessage>(tabId, {
        messageType: 'ChainBlockInfoMessage',
        infos,
      })
      .catch(() => {
        tabConnections.delete(tabId)
      })
  }
}
async function sendProgress() {
  const infos = chainblocker.getAllSessionsProgress()
  return browser.runtime.sendMessage<RBChainBlockInfoMessage>({
    messageType: 'ChainBlockInfoMessage',
    infos,
  })
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
export function initialize() {
  window.setInterval(sendChainBlockerInfoToTabs, UI_UPDATE_DELAY)
  browser.runtime.onMessage.addListener(
    (msg: object, sender: browser.runtime.MessageSender, _sendResponse: (response: any) => Promise<void>): true => {
      if (!(typeof msg === 'object' && 'action' in msg)) {
        return true
      }
      const message = msg as RBAction
      switch (message.action) {
        case Action.StartChainBlock:
          doChainBlock(message.params).then(sendChainBlockerInfoToTabs)
          break
        case Action.StopChainBlock:
          stopChainBlock(message.sessionId).then(sendChainBlockerInfoToTabs)
          break
        case Action.StopAllChainBlock:
          stopAllChainBlock()
          break
        case Action.RequestProgress:
          sendProgress()
          break
        case Action.InsertUserToStorage:
          saveUserToStorage(message.user)
          break
        case Action.RemoveUserFromStorage:
          removeUserFromStorage(message.user)
          break
        case Action.ConnectToBackground:
          sender.tab && tabConnections.add(sender.tab.id!)
          break
        case Action.DisconnectToBackground:
          sender.tab && tabConnections.delete(sender.tab.id!)
          break
      }
      return true
    }
  )
}

initialize()
