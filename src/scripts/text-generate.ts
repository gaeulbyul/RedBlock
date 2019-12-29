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

export function generateTweetReactionBlockMessage(request: TweetReactionBlockSessionRequest): string {
  const { tweet, reaction } = request.target
  const { myFollowers, myFollowings } = request.options
  const reactionKor = reaction === 'retweeted' ? '리트윗' : '마음'
  const reactionCount = formatNumber(getReactionsCount(tweet, reaction))
  let confirmMessage = `정말로 선택한 트윗에 ${reactionKor}을 한 사용자에게 체인블락을 실행하시겠습니까?\n`
  confirmMessage += '--------------------\n'
  confirmMessage += `트윗 작성자: @${tweet.user.screen_name} (${tweet.user.name})\n`
  confirmMessage += `대상: 아래 트윗에 ${reactionKor}을 한 사용자 최대 ${reactionCount}명\n`
  confirmMessage += '\n'
  confirmMessage += '\u26a0 주의! 트윗반응기반 체인블락은 실험적인 기능이며, 몇 가지 주의사항이 있습니다:\n'
  confirmMessage += '- 트윗반응기반의 언체인블락은 없으므로 실수로 실행 시 되돌리기 어려울 수 있습니다.\n'
  confirmMessage +=
    '- 비팔알림(내가 팔로우하지 않는 사용자의 알림)을 끌 경우 이 기능이 제대로 작동하지 않을 수 있습니다.\n'
  confirmMessage +=
    '- 이미 차단하거나 프로텍트, 일시정지등의 이유로 실제로 차단할 수 있는 사용자는 적거나 아예 없을 수 있습니다.\n'
  confirmMessage += '- 이 기능은 팔로워기반 체인블락에 비해 리밋에 걸릴 확률이 높습니다. (API호출 최대치가 적음)\n'
  confirmMessage += '\n'
  if (myFollowers === 'Block') {
    confirmMessage += '\u26a0 주의! 내 팔로워가 있어도 차단할 수 있습니다.\n'
  }
  if (myFollowings === 'Block') {
    confirmMessage += '\u26a0 주의! 내가 팔로우하는 사용자가 있어도 차단할 수 있습니다.\n'
  }
  confirmMessage += '\n'
  confirmMessage += `트윗 내용: ${tweet.text}\n`
  return confirmMessage
}

export function confirmStopMessage(request: SessionInfo['request']) {
  const { target } = request
  if (target.type === 'follower') {
    const isChainBlock = request.purpose === 'chainblock'
    // const isUnChainBlock = purpose === 'unchainblock'
    const purposeKor = isChainBlock ? '체인블락' : '언체인블락'
    return `@${target.user.screen_name}에게 실행중인 ${purposeKor}을 중단하시겠습니까?`
  } else if (target.type === 'tweetReaction') {
    return '트윗반응 체인블락을 중단하시겠습니까?'
  } else {
    throw new Error('unreachable')
  }
}

export function stopButtonTitleMessage(request: SessionInfo['request']) {
  const { target } = request
  if (target.type === 'follower') {
    const isChainBlock = request.purpose === 'chainblock'
    const purposeKor = isChainBlock ? '체인블락' : '언체인블락'
    return `@${target.user.screen_name}에게 실행중인 ${purposeKor}을 중지합니다.`
  } else if (target.type === 'tweetReaction') {
    return '트윗반응 체인블락을 중지합니다.'
  } else {
    throw new Error('unreachable')
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
