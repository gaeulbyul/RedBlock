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
}

export function checkFollowerBlockTarget(
  target: FollowerBlockSessionRequest['target']
): TargetCheckResult {
  const {
    protected: isProtected,
    blocked_by,
    following,
    followers_count,
    friends_count,
  } = target.user
  if (isProtected && !following) {
    return TargetCheckResult.Protected
  }
  if (blocked_by) {
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

export function checkTweetReactionBlockTarget(
  target: TweetReactionBlockSessionRequest['target']
): TargetCheckResult {
  const { blockRetweeters, blockLikers, blockMentionedUsers } = target
  const mentions = target.tweet.entities.user_mentions || []
  if (!(blockRetweeters || blockLikers || blockMentionedUsers)) {
    return TargetCheckResult.ChooseAtLeastOneOfReaction
  }
  const { retweet_count, favorite_count } = target.tweet
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
  if (totalCountToBlock <= 0) {
    return TargetCheckResult.NobodyWillBlocked
  }
  return TargetCheckResult.Ok
}

export function checkImportBlockTarget(
  target: ImportBlockSessionRequest['target']
): TargetCheckResult {
  if (target.userIds.length <= 0) {
    return TargetCheckResult.EmptyList
  }
  return TargetCheckResult.Ok
}
