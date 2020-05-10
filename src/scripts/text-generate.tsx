import {
  SessionInfo,
  FollowerBlockSessionRequest,
  TweetReactionBlockSessionRequest,
} from './background/chainblock-session/session.js'
import * as i18n from './i18n.js'

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
  const { user, count, list: targetList } = request.target
  const { myFollowers, myFollowings } = request.options
  const targetUserName = user.screen_name
  let title = ''
  switch (purpose) {
    case 'chainblock':
      title = i18n.getMessage('confirm_follower_chainblock_title', user.screen_name)
      break
    case 'unchainblock':
      title = i18n.getMessage('confirm_follower_unchainblock_title', user.screen_name)
      break
  }
  const contents = []
  const warnings = []
  switch (targetList) {
    case 'followers':
      contents.push(
        `${i18n.getMessage('target')}: ${i18n.getMessage('followers_with_targets_name_and_count', [
          targetUserName,
          count!,
        ])}`
      )
      break
    case 'friends':
      contents.push(
        `${i18n.getMessage('target')}: ${i18n.getMessage('followings_with_targets_name_and_count', [
          targetUserName,
          count!,
        ])}`
      )
      break
    case 'mutual-followers':
      contents.push(`${i18n.getMessage('target')}: ${i18n.getMessage('mutual_followers_of_xxx', targetUserName)}`)
      break
  }
  if (myFollowers === 'Block') {
    warnings.push(`\u26a0 ${i18n.getMessage('warning_maybe_you_block_your_followers')}`)
  }
  if (myFollowings === 'Block') {
    warnings.push(`\u26a0 ${i18n.getMessage('warning_maybe_you_block_your_followings')}`)
  }
  return {
    title,
    contentLines: contents,
    warningLines: warnings,
  }
}

export function generateTweetReactionBlockMessage(request: TweetReactionBlockSessionRequest): DialogMessageObj {
  const { tweet, blockRetweeters, blockLikers } = request.target
  const { myFollowers, myFollowings } = request.options
  const authorName = tweet.user.screen_name
  const title = i18n.getMessage('confirm_reacted_chainblock_title', authorName)
  const contents = []
  const warnings = []
  if (myFollowers === 'Block') {
    warnings.push(`\u26a0 ${i18n.getMessage('warning_maybe_you_block_your_followers')}`)
  }
  if (myFollowings === 'Block') {
    warnings.push(`\u26a0 ${i18n.getMessage('warning_maybe_you_block_your_followings')}`)
  }
  contents.push(`${i18n.getMessage('retweet')}: ${blockRetweeters ? 'O' : 'X'}`)
  contents.push(`${i18n.getMessage('like')}: ${blockLikers ? 'O' : 'X'}`)
  contents.push(`${i18n.getMessage('tweet_contents')}: ${tweet.text}`)
  return {
    title,
    contentLines: contents,
    warningLines: warnings,
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
  const { purpose } = sessionInfo.request
  const { success, already, skipped, failure } = sessionInfo.progress
  let localizedPurposeCompleted = ''
  let howMany = ''
  let howManyAlready = ''
  switch (purpose) {
    case 'chainblock':
      howMany = i18n.getMessage('blocked_n_users', success.Block)
      howManyAlready = `${i18n.getMessage('already_blocked')}: ${already}`
      localizedPurposeCompleted = i18n.getMessage('chainblock_completed')
      break
    case 'unchainblock':
      howMany = i18n.getMessage('unblocked_n_users', success.UnBlock)
      howManyAlready = `${i18n.getMessage('already_unblocked')}: ${already}`
      localizedPurposeCompleted = i18n.getMessage('unchainblock_completed')
      break
  }
  let message = `${localizedPurposeCompleted} ${howMany}\n`
  message += '('
  message += `${howManyAlready}, `
  message += `${i18n.getMessage('skipped')}: ${skipped}, `
  message += `${i18n.getMessage('failed')}: ${failure}`
  message += ')'
  return message
}

function tweetReactionBlockResultNotification(sessionInfo: SessionInfo<TweetReactionBlockSessionRequest>) {
  const { success, skipped, failure } = sessionInfo.progress
  let message = `${i18n.getMessage('chainblock_completed')} ${i18n.getMessage('blocked_n_users', success.Block)}.\n`
  message += '('
  message += `${i18n.getMessage('skipped')}: ${skipped}, `
  message += `${i18n.getMessage('failed')}: ${failure}`
  message += ')'
  return message
}
