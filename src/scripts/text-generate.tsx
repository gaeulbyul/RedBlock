import {
  SessionInfo,
  FollowerBlockSessionRequest,
  TweetReactionBlockSessionRequest,
} from './background/chainblock-session/session.js'
import { formatNumber, getReactionsCount } from './common.js'

export interface DialogMessageObj {
  title: string
  contentLines?: string[]
  warningLines?: string[]
}

export function objToString(msg: DialogMessageObj): string {
  const { title, contentLines, warningLines } = msg
  let result = title
  if (!(contentLines && warningLines)) {
    return result
  }
  result += '\n'
  result += '-'.repeat(10)
  result += '\n'
  if (contentLines) {
    contentLines.forEach(line => (result += `${line}\n`))
  }
  if (warningLines) {
    warningLines.forEach(line => (result += `${line}\n`))
  }
  return result
}

export function generateFollowerBlockConfirmMessage(request: FollowerBlockSessionRequest): DialogMessageObj {
  const { purpose } = request
  const { user: targetUser, list: targetList } = request.target
  const { myFollowers, myFollowings, quickMode } = request.options
  const targetUserName = targetUser.screen_name
  const purposeKor = purpose === 'chainblock' ? '체인블락' : '언체인블락'
  const title = `정말로 @${targetUserName}에게 ${purposeKor}을 실행하시겠습니까?`
  const contents = []
  const warnings = []
  switch (targetList) {
    case 'followers':
      contents.push(`대상: @${targetUserName}의 팔로워 ${formatNumber(targetUser.followers_count, quickMode)}명`)
      break
    case 'friends':
      contents.push(`대상: @${targetUserName}의 팔로잉 ${formatNumber(targetUser.friends_count, quickMode)}명`)
      break
    case 'mutual-followers':
      contents.push(`대상: @${targetUserName}의 맞팔로우 유저`)
      break
  }
  if (myFollowers === 'Block') {
    warnings.push('\u26a0 주의! 내 팔로워를 차단할 수도 있습니다.')
  }
  if (myFollowings === 'Block') {
    warnings.push('\u26a0 주의! 내가 팔로우하는 사용자를 차단할 수도 있습니다.')
  }
  return {
    title,
    contentLines: contents,
    warningLines: warnings,
  }
}

export function generateTweetReactionBlockMessage(request: TweetReactionBlockSessionRequest): DialogMessageObj {
  const { tweet, reaction } = request.target
  const { myFollowers, myFollowings } = request.options
  const reactionKor = reaction === 'retweeted' ? '리트윗을' : '마음에 들어'
  const reactionCount = formatNumber(getReactionsCount(tweet, reaction))
  const title = `정말로 선택한 트윗에 ${reactionKor}한 사용자에게 체인블락을 실행하시겠습니까?`
  const contents = []
  const warnings = []
  contents.push('--------------------')
  contents.push(`대상: 아래 트윗에 ${reactionKor}한 사용자 최대 ${reactionCount}명`)
  if (myFollowers === 'Block') {
    warnings.push('\u26a0 주의! 내 팔로워를 차단할 수도 있습니다.')
  }
  if (myFollowings === 'Block') {
    warnings.push('\u26a0 주의! 내가 팔로우하는 사용자를 차단할 수도 있습니다.')
  }
  contents.push('')
  contents.push(`작성자: @${tweet.user.screen_name} (${tweet.user.name})`)
  contents.push(`내용: ${tweet.text}`)
  return {
    title,
    contentLines: contents,
    warningLines: warnings,
  }
}

export function confirmStopMessage(request: SessionInfo['request']): DialogMessageObj {
  const { target } = request
  const isChainBlock = request.purpose === 'chainblock'
  const purposeKor = isChainBlock ? '체인블락' : '언체인블락'
  let title = ''
  switch (target.type) {
    case 'follower':
      title = `@${target.user.screen_name}에게 실행중인 ${purposeKor}을 중단하시겠습니까?`
      break
    case 'tweetReaction':
      title = '트윗반응 체인블락을 중단하시겠습니까?'
      break
  }
  return { title }
}

export function stopButtonTooltipMessage(request: SessionInfo['request']) {
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
