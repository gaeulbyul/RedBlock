import { TargetCheckResult } from './background/target-checker'
import { SessionStatus, getCountOfUsersToBlock, findNonLinkedMentionsFromTweet } from './common'
import * as i18n from '~~/scripts/i18n'

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
    case TargetCheckResult.ChooseEitherSpeakersOrListeners:
      return i18n.getMessage('choose_either_speakers_or_listeners')
    case TargetCheckResult.SpaceIsntStartedYet:
      return i18n.getMessage('audio_space_not_started_yet')
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
    case TargetCheckResult.MaybeNotLoggedIn:
      return i18n.getMessage('error_occured_check_login')
    case TargetCheckResult.InvalidSelectedUserOrTweet:
      return i18n.getMessage('user_not_selected')
  }
}

export function formatFollowsCount(followKind: FollowKind, count: number): string {
  switch (followKind) {
    case 'followers':
      return i18n.getMessage('followers_with_count', count)
    case 'friends':
      return i18n.getMessage('followings_with_count', count)
    case 'mutual-followers':
      return i18n.getMessage('mutual_followers')
  }
}

function describeReactionTargets(target: TweetReactionSessionTarget): string {
  const reactionsToBlock: string[] = []
  const { tweet } = target
  const mentions = tweet.entities.user_mentions || []
  const nonLinkedMentions = findNonLinkedMentionsFromTweet(tweet)
  if (target.includeRetweeters) {
    reactionsToBlock.push(`${i18n.getMessage('retweet')} (${tweet.retweet_count.toLocaleString()})`)
  }
  if (target.includeLikers) {
    reactionsToBlock.push(`${i18n.getMessage('like')} (${tweet.favorite_count.toLocaleString()})`)
  }
  if (target.includeMentionedUsers) {
    reactionsToBlock.push(`${i18n.getMessage('mentioned')} (${mentions.length.toLocaleString()})`)
  }
  if (target.includeQuotedUsers) {
    reactionsToBlock.push(`${i18n.getMessage('quoted')} (${tweet.quote_count.toLocaleString()})`)
  }
  if (target.includeNonLinkedMentions) {
    reactionsToBlock.push(
      `${i18n.getMessage('non_linked_mentions')} (${nonLinkedMentions.length.toLocaleString()})`
    )
  }
  return reactionsToBlock.join(', ')
}

function describeAudioSpaceTarget(target: AudioSpaceSessionTarget): string {
  const {
    audioSpace: { participants },
    includeListeners,
  } = target
  const firstHost = participants.admins[0]
  const nameOfHost = firstHost ? firstHost.twitter_screen_name : '???'
  let result = i18n.getMessage('from_audio_space_by_xxx', nameOfHost)
  if (includeListeners) {
    result += ` (${i18n.getMessage('includes_listeners')})`
  }
  return result
}

function describeTarget({ target }: SessionRequest<AnySessionTarget>): string {
  // @ts-ignore
  const count = getCountOfUsersToBlock({ target })
  switch (target.type) {
    case 'follower':
      switch (target.list) {
        case 'followers':
          return i18n.getMessage('followers_with_targets_name_and_count', [
            target.user.screen_name,
            count!,
          ])
        case 'friends':
          return i18n.getMessage('followings_with_targets_name_and_count', [
            target.user.screen_name,
            count!,
          ])
        case 'mutual-followers':
          return i18n.getMessage('mutual_followers_with_targets_name', target.user.screen_name)
      }
    case 'tweet_reaction':
      return describeReactionTargets(target)
    case 'import':
      return i18n.getMessage('from_imported_blocklist')
    case 'lockpicker':
      return `${i18n.getMessage('lockpicker')} (@${target.user.screen_name})`
    case 'user_search':
      return `${i18n.getMessage('from_user_search_result')} (${i18n.getMessage('query')}: ${
        target.query
      })`
    case 'audio_space':
      return describeAudioSpaceTarget(target)
    case 'export_my_blocklist':
      return i18n.getMessage('exporting_my_blocklist')
  }
}

export function generateConfirmMessage(
  request: SessionRequest<AnySessionTarget>
): DialogMessageObj {
  const target = `${i18n.getMessage('target')}: ${describeTarget(request)}`
  const warnings: string[] = []
  if (canBlockMyFollowers(request.purpose)) {
    warnings.push(`\u26a0 ${i18n.getMessage('warning_maybe_you_block_your_followers')}`)
  }
  if (canBlockMyFollowings(request.purpose)) {
    warnings.push(`\u26a0 ${i18n.getMessage('warning_maybe_you_block_your_followings')}`)
  }
  return {
    title: titleByPurposeType(request.purpose),
    contentLines: [target],
    warningLines: warnings,
  }
}

export function generateSessionCompleteNotificationMessage(sessionInfo: SessionInfo): string {
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
    case 'lockpicker':
      switch (purpose.protectedFollowers) {
        case 'Block':
          howMany = i18n.getMessage('blocked_n_users', success.Block)
          break
        case 'BlockAndUnBlock':
          howMany = i18n.getMessage('bnbed_n_users', success.BlockAndUnBlock)
          break
      }
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
