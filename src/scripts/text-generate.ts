import {
  SessionInfo,
  FollowerBlockSessionRequest,
  TweetReactionBlockSessionRequest,
} from './background/chainblock-session/session-common.js'
import { formatNumber, getReactionsCount } from './common.js'

export function generateFollowerBlockConfirmMessage(request: FollowerBlockSessionRequest): string {
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
  }
  if (myFollowers === 'Block') {
    confirmMessage += '\u26a0 주의! 내 팔로워가 있어도 차단할 수 있습니다.\n'
  }
  if (myFollowings === 'Block') {
    confirmMessage += '\u26a0 주의! 내가 팔로우하는 사용자가 있어도 차단할 수 있습니다.\n'
  }
  return confirmMessage
}

export function generateTweetReactionBlockMessage(request: TweetReactionBlockSessionRequest): string {
  const { tweet, reaction } = request.target
  const { myFollowers, myFollowings } = request.options
  const reactionKor = reaction === 'retweeted' ? '리트윗' : '마음'
  const reactionCount = formatNumber(getReactionsCount(tweet, reaction))
  let confirmMessage = `정말로 선택한 트윗에 ${reactionKor}을 한 사용자에게 체인블락을 실행하시겠습니까?\n`
  confirmMessage += '--------------------\n'
  confirmMessage += `대상: 아래 트윗에 ${reactionKor}을 한 사용자 최대 ${reactionCount}명\n`
  if (myFollowers === 'Block') {
    confirmMessage += '\u26a0 주의! 내 팔로워가 있어도 차단할 수 있습니다.\n'
  }
  if (myFollowings === 'Block') {
    confirmMessage += '\u26a0 주의! 내가 팔로우하는 사용자가 있어도 차단할 수 있습니다.\n'
  }
  confirmMessage += '\n'
  confirmMessage += `작성자: @${tweet.user.screen_name} (${tweet.user.name})\n`
  confirmMessage += `내용: ${tweet.text}\n`
  return confirmMessage
}

export function confirmStopMessage(request: SessionInfo['request']) {
  const { target } = request
  const isChainBlock = request.purpose === 'chainblock'
  const purposeKor = isChainBlock ? '체인블락' : '언체인블락'
  switch (target.type) {
    case 'follower':
      return `@${target.user.screen_name}에게 실행중인 ${purposeKor}을 중단하시겠습니까?`
    case 'tweetReaction':
      return '트윗반응 체인블락을 중단하시겠습니까?'
  }
}

export function stopButtonTitleMessage(request: SessionInfo['request']) {
  const { target } = request
  const isChainBlock = request.purpose === 'chainblock'
  const purposeKor = isChainBlock ? '체인블락' : '언체인블락'
  switch (target.type) {
    case 'follower':
      return `@${target.user.screen_name}에게 실행중인 ${purposeKor}을 중지합니다.`
    case 'tweetReaction':
      return '트윗반응 체인블락을 중지합니다.'
  }
}

export function chainBlockResultNotification(sessionInfo: SessionInfo): string {
  const { target } = sessionInfo.request
  switch (target.type) {
    case 'follower':
      return followerBlockResultNotification(sessionInfo as SessionInfo<FollowerBlockSessionRequest>)
    case 'tweetReaction':
      return tweetReactionBlockResultNotification(sessionInfo as SessionInfo<TweetReactionBlockSessionRequest>)
  }
}

function followerBlockResultNotification(sessionInfo: SessionInfo<FollowerBlockSessionRequest>) {
  const { target, purpose } = sessionInfo.request
  const { screen_name } = target.user
  const { success, already, skipped, failure } = sessionInfo.progress
  let targetListKor = ''
  let whatIDid = ''
  let howMany = ''
  let howManyAlready = ''
  switch (target.list) {
    case 'followers':
      targetListKor = '팔로워'
      break
    case 'friends':
      targetListKor = '팔로잉'
      break
  }
  switch (purpose) {
    case 'chainblock':
      whatIDid = '체인블락'
      howMany = `${success.Block}명을 차단했습니다.`
      howManyAlready = `이미 차단함: ${already}`
      break
    case 'unchainblock':
      whatIDid = '언체인블락'
      howMany = `${success.UnBlock}명을 차단해제했습니다.`
      howManyAlready = `이미 차단해제함: ${already}`
      break
  }
  let message = `${whatIDid} 완료! @${screen_name}의 ${targetListKor} 중 ${howMany}\n`
  message += `(${howManyAlready}, 스킵: ${skipped}, 실패: ${failure})`
  return message
}

function tweetReactionBlockResultNotification(sessionInfo: SessionInfo<TweetReactionBlockSessionRequest>) {
  const { target } = sessionInfo.request
  const { success, skipped, failure } = sessionInfo.progress
  let reactionKor = ''
  switch (target.reaction) {
    case 'retweeted':
      reactionKor = '리트윗'
      break
    case 'liked':
      reactionKor = '마음'
      break
  }
  let message = `체인블락 완료! 트윗을 ${reactionKor}한 사용자 중 ${success.Block}명을 차단했습니다.\n`
  message += `(스킵: ${skipped}, 실패: ${failure})`
  return message
}
