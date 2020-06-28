import { TargetCheckResult } from './background/chainblock.js'
import {
  SessionInfo,
  FollowerBlockSessionRequest,
  TweetReactionBlockSessionRequest,
} from './background/chainblock-session/session.js'
import { SessionStatus, getCountOfUsersToBlock } from './common.js'
import * as i18n from './i18n.js'

export interface DialogMessageObj {
  title: string
  contentLines?: string[]
  warningLines?: string[]
}

export function statusToString(status: SessionStatus): string {
  switch (status) {
    case SessionStatus.Initial:
      return i18n.getMessage('session_status_initial')
    case SessionStatus.Completed:
      return i18n.getMessage('session_status_completed')
    case SessionStatus.Running:
      return i18n.getMessage('session_status_running')
    case SessionStatus.RateLimited:
      return i18n.getMessage('session_status_rate_limited')
    case SessionStatus.Stopped:
      return i18n.getMessage('session_status_stopped')
    case SessionStatus.Error:
      return i18n.getMessage('session_status_error')
  }
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
  const { user, list: targetList } = request.target
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
  let count = getCountOfUsersToBlock(request) ?? '?'
  const contents = []
  const warnings = []
  switch (targetList) {
    case 'followers':
      contents.push(
        `${i18n.getMessage('target')}: ${i18n.getMessage('followers_with_targets_name_and_count', [
          targetUserName,
          count,
        ])}`
      )
      break
    case 'friends':
      contents.push(
        `${i18n.getMessage('target')}: ${i18n.getMessage('followings_with_targets_name_and_count', [
          targetUserName,
          count,
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

export function generateImportBlockMessage(request: ImportBlockSessionRequest): DialogMessageObj {
  const { myFollowers, myFollowings } = request.options
  const warnings = []
  if (myFollowers === 'Block') {
    warnings.push(`\u26a0 ${i18n.getMessage('warning_maybe_you_block_your_followers')}`)
  }
  if (myFollowings === 'Block') {
    warnings.push(`\u26a0 ${i18n.getMessage('warning_maybe_you_block_your_followings')}`)
  }
  const usersCount = request.target.userIds.length
  return {
    title: i18n.getMessage('confirm_import_chainblock_title'),
    contentLines: [`${i18n.getMessage('user_count')}: ${usersCount}`],
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
    case 'import':
      return importBlockResultNotification(sessionInfo as SessionInfo<ImportBlockSessionRequest>)
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

function importBlockResultNotification(sessionInfo: SessionInfo<ImportBlockSessionRequest>) {
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

export function checkResultToString(result: TargetCheckResult): string {
  switch (result) {
    case TargetCheckResult.Ok:
      return ''
    case TargetCheckResult.AlreadyRunningOnSameTarget:
      return i18n.getMessage('already_running_to_same_target')
    case TargetCheckResult.Protected:
      return `\u{1f512} ${i18n.getMessage('cant_chainblock_to_protected')}`
    case TargetCheckResult.NoFollowers:
      return i18n.getMessage('cant_chainblock_follower_is_zero')
    case TargetCheckResult.NoFollowings:
      return i18n.getMessage('cant_chainblock_following_is_zero')
    case TargetCheckResult.NoMutualFollowers:
      return i18n.getMessage('cant_chainblock_mutual_follower_is_zero')
    case TargetCheckResult.ChooseAtLeastRtOrLikes:
      return i18n.getMessage('select_rt_or_like')
    case TargetCheckResult.NobodyRetweetOrLiked:
      return i18n.getMessage('cant_chainblock_nobody_retweet_or_like')
    case TargetCheckResult.NobodyRetweeted:
      return i18n.getMessage('cant_chainblock_nobody_retweeted')
    case TargetCheckResult.NobodyLiked:
      return i18n.getMessage('cant_chainblock_nobody_liked')
    case TargetCheckResult.EmptyList:
      return i18n.getMessage('cant_chainblock_empty_list')
  }
}
