import { SessionInfo, FollowerBlockSessionRequest } from './background/chainblock-session.js'
import { formatNumber } from './common.js'

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
  const { reaction } = request.target
  const reactionKor = reaction === 'retweeted' ? '리트윗' : '마음'
  return `정말로 선택한 트윗에 ${reactionKor}을한 사용자에게 체인블락을 실행하시겠습니까?`
}

export function confirmStopMessage(request: SessionInfo['request']) {
  const { target } = request
  if (target.type === 'follower') {
    const isChainBlock = request.purpose === 'chainblock'
    // const isUnChainBlock = purpose === 'unchainblock'
    const purposeKor = isChainBlock ? '체인블락' : '언체인블락'
    return `@${target.user.screen_name}에게 실행중인 ${purposeKor}을 중단하시겠습니까?`
  } else if (target.type === 'tweetReaction') {
    // TODO
    throw new Error('not implemented')
  } else {
    throw new Error('unreachable')
  }
}

export function stopButtonTitleMessage(request: SessionInfo['request']) {
  const { target } = request
  if (target.type === 'follower') {
    const isChainBlock = request.purpose === 'chainblock'
    // const isUnChainBlock = purpose === 'unchainblock'
    const purposeKor = isChainBlock ? '체인블락' : '언체인블락'
    return `@${target.user.screen_name}에게 실행중인 ${purposeKor}을 중지합니다.`
  } else if (target.type === 'tweetReaction') {
    // TODO
    throw new Error('not implemented')
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
      // TODO
      throw new Error('not implemented')
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
