import { TargetCheckResult } from './background/target-checker.js'
import { SessionStatus, getCountOfUsersToBlock } from './common.js'
import * as i18n from './i18n.js'

const actionsThatNeedWarning: UserAction[] = ['Block', 'UnFollow', 'BlockAndUnBlock']

function canBlockMyFollowers(purpose: Purpose): boolean {
  if (!('myFollowers' in purpose)) {
    return false
  }
  return actionsThatNeedWarning.includes(purpose.myFollowers)
}

function canBlockMyFollowings(purpose: Purpose): boolean {
  if (!('myFollowings' in purpose)) {
    return false
  }
  return actionsThatNeedWarning.includes(purpose.myFollowings)
}

function titleByPurposeType(purpose: Purpose): string {
  switch (purpose.type) {
    case 'chainblock':
      return i18n.getMessage('confirm_chainblock_title')
    case 'unchainblock':
      return i18n.getMessage('confirm_unchainblock_title')
    case 'export':
      return i18n.getMessage('confirm_export_title')
    case 'chainunfollow':
      return i18n.getMessage('confirm_chainunfollow_title')
    case 'chainmute':
      return i18n.getMessage('confirm_chainmute_title')
    case 'unchainmute':
      return i18n.getMessage('confirm_unchainmute_title')
    case 'lockpicker':
      switch (purpose.protectedFollowers) {
        case 'Block':
          return i18n.getMessage('confirm_lockpicker_block_title')
        case 'BlockAndUnBlock':
          return i18n.getMessage('confirm_lockpicker_bnb_title')
      }
  }
}

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
  const targetUserName = user.screen_name
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
  if (canBlockMyFollowers(purpose)) {
    warnings.push(`\u26a0 ${i18n.getMessage('warning_maybe_you_block_your_followers')}`)
  }
  if (canBlockMyFollowings(purpose)) {
    warnings.push(`\u26a0 ${i18n.getMessage('warning_maybe_you_block_your_followings')}`)
  }
  return {
    title: titleByPurposeType(purpose),
    contentLines: contents,
    warningLines: warnings,
  }
}

function generateTweetReactionBlockConfirmMessage(
  request: TweetReactionBlockSessionRequest
): DialogMessageObj {
  const { purpose } = request
  const { blockRetweeters, blockLikers, blockMentionedUsers } = request.target
  const contents = []
  const warnings = []
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
  if (canBlockMyFollowers(purpose)) {
    warnings.push(`\u26a0 ${i18n.getMessage('warning_maybe_you_block_your_followers')}`)
  }
  if (canBlockMyFollowings(purpose)) {
    warnings.push(`\u26a0 ${i18n.getMessage('warning_maybe_you_block_your_followings')}`)
  }
  return {
    title: titleByPurposeType(purpose),
    contentLines: contents,
    warningLines: warnings,
  }
}

function generateImportBlockConfirmMessage(request: ImportBlockSessionRequest): DialogMessageObj {
  const warnings = []
  if (canBlockMyFollowers(request.purpose)) {
    warnings.push(`\u26a0 ${i18n.getMessage('warning_maybe_you_block_your_followers')}`)
  }
  if (canBlockMyFollowings(request.purpose)) {
    warnings.push(`\u26a0 ${i18n.getMessage('warning_maybe_you_block_your_followings')}`)
  }
  const usersCount = request.target.userIds.length.toLocaleString()
  return {
    title: titleByPurposeType(request.purpose),
    contentLines: [`${i18n.getMessage('user_count')}: ${usersCount}`],
    warningLines: warnings,
  }
}

function generateLockPickerConfirmMessage(request: LockPickerSessionRequest): DialogMessageObj {
  let title: string
  const { purpose } = request
  switch (purpose.protectedFollowers) {
    case 'Block':
      title = i18n.getMessage('confirm_lockpicker_block_title')
      break
    case 'BlockAndUnBlock':
      title = i18n.getMessage('confirm_lockpicker_bnb_title')
      break
  }
  return { title }
}

function generateUserSearchBlockConfirmMessage(
  request: UserSearchBlockSessionRequest
): DialogMessageObj {
  const targetDescription = `${i18n.getMessage('query')}: '${request.target.query}'`
  const warningLines = []
  if (canBlockMyFollowers(request.purpose)) {
    warningLines.push(`\u26a0 ${i18n.getMessage('warning_maybe_you_block_your_followers')}`)
  }
  if (canBlockMyFollowings(request.purpose)) {
    warningLines.push(`\u26a0 ${i18n.getMessage('warning_maybe_you_block_your_followings')}`)
  }
  return {
    title: titleByPurposeType(request.purpose),
    contentLines: [targetDescription],
    warningLines,
  }
}

export function generateConfirmMessage(request: SessionRequest): DialogMessageObj {
  switch (request.target.type) {
    case 'follower':
      return generateFollowerBlockConfirmMessage(request as FollowerBlockSessionRequest)
    case 'tweet_reaction':
      return generateTweetReactionBlockConfirmMessage(request as TweetReactionBlockSessionRequest)
    case 'lockpicker':
      return generateLockPickerConfirmMessage(request as LockPickerSessionRequest)
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
    case 'lockpicker':
      return lockpickerResultNotification(sessionInfo as SessionInfo<LockPickerSessionRequest>)
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
  switch (purpose.type) {
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
    case 'chainunfollow':
      howMany = i18n.getMessage('unfollowed_n_users', success.UnFollow)
      howManyAlready = ''
      localizedPurposeCompleted = i18n.getMessage('lockpicker_completed')
      break
    case 'chainmute':
      howMany = i18n.getMessage('muted_n_users', success.Mute)
      howManyAlready = `${i18n.getMessage('already_muted')}: ${already}`
      localizedPurposeCompleted = i18n.getMessage('chainmute_completed')
      break
    case 'unchainmute':
      howMany = i18n.getMessage('unmuted_n_users', success.UnMute)
      howManyAlready = `${i18n.getMessage('already_unmuted')}: ${already}`
      localizedPurposeCompleted = i18n.getMessage('unchainmute_completed')
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
  if (purpose.type !== 'export') {
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
  switch (purpose.type) {
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

function lockpickerResultNotification(sessionInfo: SessionInfo<LockPickerSessionRequest>) {
  const { success } = sessionInfo.progress
  const localizedPurposeCompleted = i18n.getMessage('lockpicker_completed')
  let howMany: string
  switch (sessionInfo.request.purpose.protectedFollowers) {
    case 'Block':
      howMany = i18n.getMessage('blocked_n_users', success.Block)
      break
    case 'BlockAndUnBlock':
      howMany = i18n.getMessage('bnbed_n_users', success.BlockAndUnBlock)
      break
  }
  let message = `${localizedPurposeCompleted} ${howMany}\n`
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
  switch (purpose.type) {
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
    case 'chainunfollow':
      howMany = i18n.getMessage('unfollowed_n_users', success.Block)
      howManyAlready = ''
      localizedPurposeCompleted = i18n.getMessage('chainunfollow_completed')
      break
    case 'chainmute':
      howMany = i18n.getMessage('muted_n_users', success.Mute)
      howManyAlready = `${i18n.getMessage('already_muted')}: ${already}`
      localizedPurposeCompleted = i18n.getMessage('chainmute_completed')
      break
    case 'unchainmute':
      howMany = i18n.getMessage('unmuted_n_users', success.UnMute)
      howManyAlready = `${i18n.getMessage('already_unmuted')}: ${already}`
      localizedPurposeCompleted = i18n.getMessage('unchainmute_completed')
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
    case TargetCheckResult.InvalidSearchQuery:
      return i18n.getMessage('cant_chainblock_searchquery_invalid')
  }
}
