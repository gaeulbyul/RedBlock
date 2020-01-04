import { Action, PageEnum, UI_UPDATE_DELAY } from '../common.js'
import { defaultOption as fcbDefaultOption } from './chainblock-session/follower.js'
import { defaultOption as trcbDefaultOption } from './chainblock-session/tweet-reaction.js'
import { FollowerBlockSessionRequest } from './chainblock-session/session-common.js'
import ChainBlocker from './chainblock.js'
import * as TextGenerate from '../text-generate.js'
import * as Storage from './storage.js'
import * as TwitterAPI from './twitter-api.js'

type TwitterUser = TwitterAPI.TwitterUser
type Tweet = TwitterAPI.Tweet

let storageQueue = Promise.resolve()
const chainblocker = new ChainBlocker()
const tabConnections = new Set<number>()

export async function doFollowerChainBlockWithDefaultOptions(userName: string, targetList: FollowKind) {
  return executeFollowerChainBlock({
    userName,
    targetList,
    purpose: 'chainblock',
    options: fcbDefaultOption,
  })
}

export async function doTweetReactionChainBlockWithDefaultOptions(tweetId: string, reaction: ReactionKind) {
  return executeTweetReactionChainBlock({
    tweetId,
    reaction,
    options: trcbDefaultOption,
  })
}

function generateFollowerBlockRequest(
  targetUser: TwitterUser,
  purpose: ChainKind,
  followKind: FollowKind,
  options: FollowerBlockSessionRequest['options']
): FollowerBlockSessionRequest {
  return {
    purpose,
    target: {
      type: 'follower',
      user: targetUser,
      list: followKind,
    },
    options,
  }
}

function generateTweetReactionBlockRequest(
  tweet: Tweet,
  reaction: ReactionKind,
  options: TweetReactionBlockSessionRequest['options']
): TweetReactionBlockSessionRequest {
  return {
    purpose: 'chainblock',
    target: {
      type: 'tweetReaction',
      tweet,
      reaction,
    },
    options,
  }
}

async function executeFollowerChainBlock(params: FollowerChainParams) {
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
    const request = generateFollowerBlockRequest(targetUser, purpose, targetList, options)
    const confirmMessage = TextGenerate.generateFollowerBlockConfirmMessage(request)
    if (window.confirm(confirmMessage)) {
      const sessionId = chainblocker.addFollowerBlockSession(request)
      if (!sessionId) {
        console.info('not added. skip')
        return
      }
      chainblocker.start(sessionId)
      browser.runtime.sendMessage<RBPopupSwitchTabMessage>({
        messageType: 'PopupSwitchTabMessage',
        page: PageEnum.Sessions,
      })
    }
  } catch (err) {
    if (err instanceof TwitterAPI.RateLimitError) {
      window.alert('현재 리밋에 걸린 상태입니다. 나중에 다시 시도해주세요.')
    } else {
      throw err
    }
  }
}

async function executeTweetReactionChainBlock(params: TweetReactionChainParams) {
  const { tweetId, reaction, options } = params
  const myself = await TwitterAPI.getMyself().catch(() => null)
  if (!myself) {
    window.alert('로그인 여부를 확인해주세요.')
    return
  }
  try {
    const tweet = await TwitterAPI.getTweetById(tweetId)
    let isZero = false
    if (reaction === 'retweeted' && tweet.retweet_count <= 0) {
      isZero = true
    } else if (reaction === 'liked' && tweet.favorite_count <= 0) {
      isZero = true
    }
    if (isZero) {
      window.alert('RT/마음에 든 사용자를 찾을 수 없습니다. (총 0명)')
      return
    }
    const request = generateTweetReactionBlockRequest(tweet, reaction, options)
    const confirmMessage = TextGenerate.generateTweetReactionBlockMessage(request)
    if (window.confirm(confirmMessage)) {
      const sessionId = chainblocker.addTweetReactionBlockSession(request)
      if (!sessionId) {
        console.info('not added. skip')
        return
      }
      chainblocker.start(sessionId)
      browser.runtime.sendMessage<RBPopupSwitchTabMessage>({
        messageType: 'PopupSwitchTabMessage',
        page: PageEnum.Sessions,
      })
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
  return browser.runtime
    .sendMessage<RBChainBlockInfoMessage>({
      messageType: 'ChainBlockInfoMessage',
      infos,
    })
    .catch(() => {})
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

function initialize() {
  window.setInterval(sendChainBlockerInfoToTabs, UI_UPDATE_DELAY)
  browser.runtime.onMessage.addListener(
    (msg: object, sender: browser.runtime.MessageSender, _sendResponse: (response: any) => Promise<void>): true => {
      if (!(typeof msg === 'object' && 'action' in msg)) {
        return true
      }
      const message = msg as RBAction
      switch (message.action) {
        case Action.StartFollowerChainBlock:
          executeFollowerChainBlock(message.params).then(sendChainBlockerInfoToTabs)
          break
        case Action.StartTweetReactionChainBlock:
          executeTweetReactionChainBlock(message.params).then(sendChainBlockerInfoToTabs)
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
