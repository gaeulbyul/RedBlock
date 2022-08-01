import { getTotalCountOfReactions } from '\\/scripts/common/utilities'
export { checkResultToString } from '\\/scripts/text-generate'

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
  UnchainblockToRetweetersIsUnavailable,
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
  executor,
  retriever,
}: SessionRequest<FollowerSessionTarget>): TargetCheckResult {
  const { followers_count, friends_count } = target.user
  const targetIsMe = target.user.id_str === executor.user.id_str
  if (target.user.protected && !(target.user.following || targetIsMe)) {
    return TargetCheckResult.Protected
  }
  if (targetIsMe) {
    const { allowSelfChainBlock } = options
    if (!allowSelfChainBlock) {
      return TargetCheckResult.CantChainBlockYourself
    }
  }
  if (target.user.blocked_by) {
    if (!options.enableBlockBuster) {
      return TargetCheckResult.TheyBlocksYou
    }
    if (retriever.user.id_str === executor.user.id_str) {
      return TargetCheckResult.TheyBlocksYou
    }
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
  purpose,
  target,
}: SessionRequest<TweetReactionSessionTarget>): TargetCheckResult {
  const {
    includeRetweeters,
    includeLikers,
    includeMentionedUsers,
    includeQuotedUsers,
    includeNonLinkedMentions,
    includedReactionsV2,
  } = target
  const atLeastOneReaction = Object.values(includedReactionsV2).some(val => val)
  if (
    !(
      includeRetweeters
      || includeLikers
      || atLeastOneReaction
      || includeMentionedUsers
      || includeQuotedUsers
      || includeNonLinkedMentions
    )
  ) {
    return TargetCheckResult.ChooseAtLeastOneOfReaction
  }
  if (purpose.type === 'unchainblock' && includeRetweeters) {
    return TargetCheckResult.UnchainblockToRetweetersIsUnavailable
  }
  const totalCountToBlock = getTotalCountOfReactions(target)
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
  const idCheck = target.user.id_str === retriever.user.id_str
    && retriever.user.id_str === executor.user.id_str
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
  if (audioSpace.metadata.state === 'NotStarted') {
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
      return (
        target1.audioSpace.metadata.rest_id
          === (target2 as AudioSpaceSessionTarget).audioSpace.metadata.rest_id
      )
    case 'export_my_blocklist':
      return true
  }
}
