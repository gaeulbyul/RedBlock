import { TargetCheckResult } from './background/target-checker.js'
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

function generateFollowerBlockConfirmMessage(
  request: FollowerBlockSessionRequest
): DialogMessageObj {
  const { purpose } = request
  const { user, list: targetList } = request.target
  const { myFollowers, myFollowings } = request.options
  const targetUserName = user.screen_name
  let title: string
  switch (purpose) {
    case 'chainblock':
      title = i18n.getMessage('confirm_follower_chainblock_title', user.screen_name)
      break
    case 'unchainblock':
      title = i18n.getMessage('confirm_follower_unchainblock_title', user.screen_name)
      break
    case 'export':
      title = i18n.getMessage('confirm_follower_export_title', user.screen_name)
      break
    case 'lockpicker':
      title = i18n.getMessage('confirm_lockpicker_title')
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
      contents.push(
        `${i18n.getMessage('target')}: ${i18n.getMessage(
          'mutual_followers_of_xxx',
          targetUserName
        )}`
      )
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

function generateTweetReactionBlockConfirmMessage(
  request: TweetReactionBlockSessionRequest
): DialogMessageObj {
  const { tweet, blockRetweeters, blockLikers, blockMentionedUsers } = request.target
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
  const targets = []
  if (blockRetweeters) {
    targets.push(i18n.getMessage('retweet'))
  }
  if (blockLikers) {
    targets.push(i18n.getMessage('like'))
  }
  if (blockMentionedUsers) {
    targets.push(i18n.getMessage('mentioned'))
  }
  contents.push(`${i18n.getMessage('block_target')}: ${targets.join(', ')}`)
  // contents.push(`${i18n.getMessage('tweet_contents')}: ${tweet.full_text}`)
  return {
    title,
    contentLines: contents,
    warningLines: warnings,
  }
}

function generateImportBlockConfirmMessage(request: ImportBlockSessionRequest): DialogMessageObj {
  const { myFollowers, myFollowings } = request.options
  const warnings = []
  if (myFollowers === 'Block') {
    warnings.push(`\u26a0 ${i18n.getMessage('warning_maybe_you_block_your_followers')}`)
  }
  if (myFollowings === 'Block') {
    warnings.push(`\u26a0 ${i18n.getMessage('warning_maybe_you_block_your_followings')}`)
  }
  const usersCount = request.target.userIds.length.toLocaleString()
  return {
    title: i18n.getMessage('confirm_import_chainblock_title'),
    contentLines: [`${i18n.getMessage('user_count')}: ${usersCount}`],
    warningLines: warnings,
  }
}

function generateLockPickerConfirmMessage(): DialogMessageObj {
  return {
    title: i18n.getMessage('confirm_lockpicker_title'),
  }
}

function generateUserSearchBlockConfirmMessage(
  request: UserSearchBlockSessionRequest
): DialogMessageObj {
  const { myFollowers, myFollowings } = request.options
  const targetDescription = `${i18n.getMessage('query')}: '${request.target.query}'`
  const warningLines = []
  if (myFollowers === 'Block') {
    warningLines.push(`\u26a0 ${i18n.getMessage('warning_maybe_you_block_your_followers')}`)
  }
  if (myFollowings === 'Block') {
    warningLines.push(`\u26a0 ${i18n.getMessage('warning_maybe_you_block_your_followings')}`)
  }
  return {
    title: i18n.getMessage('confirm_search_chainblock_title'),
    contentLines: [targetDescription],
    warningLines,
  }
}

export function generateConfirmMessage(request: SessionRequest): DialogMessageObj {
  if (request.purpose === 'lockpicker') {
    return generateLockPickerConfirmMessage()
  }
  switch (request.target.type) {
    case 'follower':
      return generateFollowerBlockConfirmMessage(request as FollowerBlockSessionRequest)
    case 'tweet_reaction':
      return generateTweetReactionBlockConfirmMessage(request as TweetReactionBlockSessionRequest)
    case 'import':
      return generateImportBlockConfirmMessage(request as ImportBlockSessionRequest)
    case 'user_search':
      return generateUserSearchBlockConfirmMessage(request as UserSearchBlockSessionRequest)
  }
}

export function chainBlockResultNotification(sessionInfo: SessionInfo): string {
  const { target } = sessionInfo.request
  switch (target.type) {
    case 'follower':
      return followerBlockResultNotification(
        sessionInfo as SessionInfo<FollowerBlockSessionRequest>
      )
    case 'tweet_reaction':
      return tweetReactionBlockResultNotification(
        sessionInfo as SessionInfo<TweetReactionBlockSessionRequest>
      )
    case 'import':
      return importBlockResultNotification(sessionInfo as SessionInfo<ImportBlockSessionRequest>)
    case 'user_search':
      return userSearchBlockResultNotification(
        sessionInfo as SessionInfo<UserSearchBlockSessionRequest>
      )
  }
}

function followerBlockResultNotification(sessionInfo: SessionInfo<FollowerBlockSessionRequest>) {
  const { purpose } = sessionInfo.request
  const { success, already, skipped, failure, scraped } = sessionInfo.progress
  let localizedPurposeCompleted: string
  let howMany: string
  let howManyAlready: string
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
    case 'export':
      howMany = i18n.getMessage('exported_n_users', scraped)
      howManyAlready = ''
      localizedPurposeCompleted = i18n.getMessage('export_completed')
      break
    case 'lockpicker':
      howMany = i18n.getMessage('blocked_n_users', success.Block)
      howManyAlready = ''
      localizedPurposeCompleted = i18n.getMessage('lockpicker_completed')
      break
  }
  let message = `${localizedPurposeCompleted} ${howMany}\n`
  if (howManyAlready) {
    message += '('
    message += `${howManyAlready}, `
    message += `${i18n.getMessage('skipped')}: ${skipped}, `
    message += `${i18n.getMessage('failed')}: ${failure}`
    message += ')'
  }
  return message
}

function tweetReactionBlockResultNotification(
  sessionInfo: SessionInfo<TweetReactionBlockSessionRequest>
) {
  const { purpose } = sessionInfo.request
  const { success, skipped, failure } = sessionInfo.progress
  let message = `${i18n.getMessage('chainblock_completed')} ${i18n.getMessage(
    'blocked_n_users',
    success.Block
  )}.\n`
  if (purpose !== 'export') {
    message += '('
    message += `${i18n.getMessage('skipped')}: ${skipped}, `
    message += `${i18n.getMessage('failed')}: ${failure}`
    message += ')'
  }
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

function userSearchBlockResultNotification(
  sessionInfo: SessionInfo<UserSearchBlockSessionRequest>
) {
  const { purpose } = sessionInfo.request
  const { success, already, skipped, failure } = sessionInfo.progress
  let localizedPurposeCompleted: string
  let howMany: string
  let howManyAlready: string
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
  if (howManyAlready) {
    message += '('
    message += `${howManyAlready}, `
    message += `${i18n.getMessage('skipped')}: ${skipped}, `
    message += `${i18n.getMessage('failed')}: ${failure}`
    message += ')'
  }

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
    case TargetCheckResult.ChooseAtLeastOneOfReaction:
      return i18n.getMessage('select_rt_or_like')
    case TargetCheckResult.NobodyWillBlocked:
      return i18n.getMessage('cant_chainblock_nobody_will_blocked')
    case TargetCheckResult.EmptyList:
      return i18n.getMessage('cant_chainblock_empty_list')
    case TargetCheckResult.TheyBlocksYou:
      return i18n.getMessage('cant_chainblock_to_blocked')
    case TargetCheckResult.CantChainBlockYourself:
      return i18n.getMessage('cant_chainblock_to_yourself')
    case TargetCheckResult.CantLockPickerToOther:
      return i18n.getMessage('cant_lockpicker_to_others')
  }
}
