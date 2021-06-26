import { findNonLinkedMentionsFromTweet } from '../common'

export const enum TargetCheckResult {
  Ok = 1, // 1: if (targetCheckResult) {} 에서 falsey하게 판단하는 걸 막기 위해.
  AlreadyRunningOnSameTarget,
  Protected,
  NoFollowers,
  NoFollowings,
  NoMutualFollowers,
  ChooseAtLeastOneOfReaction,
  ChooseEitherSpeakersOrListeners,
  SpaceIsntStartedYet,
  NobodyWillBlocked,
  EmptyList,
  TheyBlocksYou,
  CantChainBlockYourself,
  CantLockPickerToOther,
  InvalidSearchQuery,
  MaybeNotLoggedIn,
  InvalidSelectedUserOrTweet,
}

export function validateRequest(request: SessionRequest<AnySessionTarget>): TargetCheckResult {
  const { target } = request
  switch (target.type) {
    case 'follower':
      return checkFollowerBlockRequest(request as SessionRequest<FollowerSessionTarget>)
    case 'tweet_reaction':
      return checkTweetReactionBlockRequest(request as SessionRequest<TweetReactionSessionTarget>)
    case 'lockpicker':
      return checkLockPickerRequest(request as SessionRequest<LockPickerSessionTarget>)
    case 'import':
      return checkImportBlockRequest(request as SessionRequest<ImportSessionTarget>)
    case 'user_search':
      return checkUserSearchBlockRequest(request as SessionRequest<UserSearchSessionTarget>)
    case 'audio_space':
      return checkAudioSpaceBlockRequest(request as SessionRequest<AudioSpaceSessionTarget>)
    case 'export_my_blocklist':
      return TargetCheckResult.Ok
  }
}

function checkFollowerBlockRequest({
  target,
  options,
  retriever,
  executor,
}: SessionRequest<FollowerSessionTarget>): TargetCheckResult {
  const { followers_count, friends_count } = target.user
  if (target.user.protected && !target.user.following) {
    return TargetCheckResult.Protected
  }
  if (target.user.id_str === retriever.user.id_str || target.user.id_str === executor.user.id_str) {
    return TargetCheckResult.CantChainBlockYourself
  }
  if (target.user.blocked_by && !options.enableAntiBlock) {
    return TargetCheckResult.TheyBlocksYou
  }
  if (target.list === 'followers' && followers_count <= 0) {
    return TargetCheckResult.NoFollowers
  } else if (target.list === 'friends' && friends_count <= 0) {
    return TargetCheckResult.NoFollowings
  } else if (target.list === 'mutual-followers' && (followers_count <= 0 || friends_count <= 0)) {
    return TargetCheckResult.NoMutualFollowers
  }
  return TargetCheckResult.Ok
}

function checkTweetReactionBlockRequest({
  target,
}: SessionRequest<TweetReactionSessionTarget>): TargetCheckResult {
  const {
    includeRetweeters: blockRetweeters,
    includeLikers: blockLikers,
    includeMentionedUsers: blockMentionedUsers,
    includeQuotedUsers: blockQuotedUsers,
    includeNonLinkedMentions: blockNonLinkedMentions,
  } = target
  const mentions = target.tweet.entities.user_mentions || []
  if (
    !(
      blockRetweeters ||
      blockLikers ||
      blockMentionedUsers ||
      blockQuotedUsers ||
      blockNonLinkedMentions
    )
  ) {
    return TargetCheckResult.ChooseAtLeastOneOfReaction
  }
  const { retweet_count, favorite_count, quote_count } = target.tweet
  let totalCountToBlock = 0
  if (blockRetweeters) {
    totalCountToBlock += retweet_count
  }
  if (blockLikers) {
    totalCountToBlock += favorite_count
  }
  if (blockMentionedUsers) {
    totalCountToBlock += mentions.length
  }
  if (blockQuotedUsers) {
    totalCountToBlock += quote_count
  }
  if (blockNonLinkedMentions) {
    totalCountToBlock += findNonLinkedMentionsFromTweet(target.tweet).length
  }
  if (totalCountToBlock <= 0) {
    return TargetCheckResult.NobodyWillBlocked
  }
  return TargetCheckResult.Ok
}

function checkImportBlockRequest({
  target,
}: SessionRequest<ImportSessionTarget>): TargetCheckResult {
  if (target.userIds.length <= 0 && target.userNames.length <= 0) {
    return TargetCheckResult.EmptyList
  }
  return TargetCheckResult.Ok
}
function checkLockPickerRequest({
  target,
  retriever,
  executor,
}: SessionRequest<LockPickerSessionTarget>): TargetCheckResult {
  if (target.user.followers_count <= 0) {
    return TargetCheckResult.NoFollowers
  }
  const idCheck =
    target.user.id_str === retriever.user.id_str && retriever.user.id_str === executor.user.id_str
  if (!idCheck) {
    return TargetCheckResult.CantLockPickerToOther
  }
  return TargetCheckResult.Ok
}

function checkUserSearchBlockRequest({
  target,
}: SessionRequest<UserSearchSessionTarget>): TargetCheckResult {
  if (!target.query) {
    return TargetCheckResult.InvalidSearchQuery
  }
  return TargetCheckResult.Ok
}

function checkAudioSpaceBlockRequest({
  target,
}: SessionRequest<AudioSpaceSessionTarget>): TargetCheckResult {
  const { audioSpace, includeHostsAndSpeakers, includeListeners } = target
  if (audioSpace.state === 'NotStarted') {
    return TargetCheckResult.SpaceIsntStartedYet
  }
  let count = 0
  if (!includeHostsAndSpeakers && !includeListeners) {
    return TargetCheckResult.ChooseEitherSpeakersOrListeners
  }
  if (includeHostsAndSpeakers) {
    count += audioSpace.participants.admins.length
    count += audioSpace.participants.speakers.length
  }
  if (includeListeners) {
    count += audioSpace.participants.listeners.length
  }
  if (count <= 0) {
    return TargetCheckResult.NobodyWillBlocked
  }
  return TargetCheckResult.Ok
}

export function isSameTarget(target1: AnySessionTarget, target2: AnySessionTarget) {
  if (target1.type !== target2.type) {
    return false
  }
  switch (target1.type) {
    case 'follower': {
      const givenUser = (target2 as FollowerSessionTarget).user
      return target1.user.id_str === givenUser.id_str
    }
    case 'tweet_reaction': {
      const givenTweet = (target2 as TweetReactionSessionTarget).tweet
      return target1.tweet.id_str === givenTweet.id_str
    }
    case 'lockpicker':
      return true
    case 'import':
      return false
    case 'user_search': {
      // Q: 대소문자가 같으면 같은 target으로 취급해야 하나?
      // A: OR AND 등 대소문자 가리는 연산자 있다. 다르게 취급하자
      const givenQuery = (target2 as UserSearchSessionTarget).query
      return target1.query === givenQuery
    }
    case 'audio_space':
      return target1.audioSpace.rest_id === (target2 as AudioSpaceSessionTarget).audioSpace.rest_id
    case 'export_my_blocklist':
      return true
  }
}
