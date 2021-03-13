import { findNonLinkedMentions } from '../common.js'

export const enum TargetCheckResult {
  Ok,
  AlreadyRunningOnSameTarget,
  Protected,
  NoFollowers,
  NoFollowings,
  NoMutualFollowers,
  ChooseAtLeastOneOfReaction,
  NobodyWillBlocked,
  EmptyList,
  TheyBlocksYou,
  CantChainBlockYourself,
  CantLockPickerToOther,
  InvalidSearchQuery,
}

export function validateRequest(request: SessionRequest): TargetCheckResult {
  const { target } = request
  switch (target.type) {
    case 'follower':
      return checkFollowerBlockRequest(request as FollowerBlockSessionRequest)
    case 'tweet_reaction':
      return checkTweetReactionBlockRequest(request as TweetReactionBlockSessionRequest)
    case 'lockpicker':
      return checkLockPickerRequest(request as LockPickerSessionRequest)
    case 'import':
      return checkImportBlockRequest(request as ImportBlockSessionRequest)
    case 'user_search':
      return checkUserSearchBlockRequest(request as UserSearchBlockSessionRequest)
  }
}

function checkFollowerBlockRequest({
  target,
  myself,
  options,
}: FollowerBlockSessionRequest): TargetCheckResult {
  const { followers_count, friends_count } = target.user
  if (target.user.protected && !target.user.following) {
    return TargetCheckResult.Protected
  }
  if (target.user.id_str === myself.id_str) {
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
}: TweetReactionBlockSessionRequest): TargetCheckResult {
  const {
    blockRetweeters,
    blockLikers,
    blockMentionedUsers,
    blockQuotedUsers,
    blockNonLinkedMentions,
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
    totalCountToBlock += findNonLinkedMentions(target.tweet).length
  }
  if (totalCountToBlock <= 0) {
    return TargetCheckResult.NobodyWillBlocked
  }
  return TargetCheckResult.Ok
}

function checkImportBlockRequest({ target }: ImportBlockSessionRequest): TargetCheckResult {
  if (target.userIds.length <= 0 && target.userNames.length <= 0) {
    return TargetCheckResult.EmptyList
  }
  return TargetCheckResult.Ok
}
function checkLockPickerRequest({ target, myself }: LockPickerSessionRequest): TargetCheckResult {
  if (target.user.followers_count <= 0) {
    return TargetCheckResult.NoFollowers
  }
  if (target.user.id_str !== myself.id_str) {
    return TargetCheckResult.CantLockPickerToOther
  }
  return TargetCheckResult.Ok
}

function checkUserSearchBlockRequest({ target }: UserSearchBlockSessionRequest): TargetCheckResult {
  if (!target.query) {
    return TargetCheckResult.InvalidSearchQuery
  }
  return TargetCheckResult.Ok
}

export function isSameTarget(target1: SessionRequest['target'], target2: SessionRequest['target']) {
  if (target1.type !== target2.type) {
    return false
  }
  switch (target1.type) {
    case 'follower': {
      const givenUser = (target2 as FollowerBlockSessionRequest['target']).user
      return target1.user.id_str === givenUser.id_str
    }
    case 'tweet_reaction': {
      const givenTweet = (target2 as TweetReactionBlockSessionRequest['target']).tweet
      return target1.tweet.id_str === givenTweet.id_str
    }
    case 'lockpicker':
      return true
    case 'import':
      return false
    case 'user_search': {
      // Q: 대소문자가 같으면 같은 target으로 취급해야 하나?
      // A: OR AND 등 대소문자 가리는 연산자 있다. 다르게 취급하자
      const givenQuery = (target2 as UserSearchBlockSessionRequest['target']).query
      return target1.query === givenQuery
    }
  }
}
