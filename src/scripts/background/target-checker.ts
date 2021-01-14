export const enum TargetCheckResult {
  Ok,
  AlreadyRunningOnSameTarget,
  Protected,
  Blocked,
  NoFollowers,
  NoFollowings,
  NoMutualFollowers,
  ChooseAtLeastRtOrLikes,
  NobodyRetweetOrLiked,
  NobodyRetweeted,
  NobodyLiked,
  EmptyList,
}

export function checkFollowerBlockTarget(target: FollowerBlockSessionRequest['target']): TargetCheckResult {
  const { protected: isProtected, blocked_by, following, followers_count, friends_count } = target.user
  if (isProtected && !following) {
    return TargetCheckResult.Protected
  }
  if (blocked_by) {
    return TargetCheckResult.Blocked
  }
  if (target.list === 'followers' && followers_count <= 0) {
    return TargetCheckResult.NoFollowers
  } else if (target.list === 'friends' && friends_count <= 0) {
    return TargetCheckResult.NoFollowings
  } else if (target.list === 'mutual-followers' && followers_count <= 0 && friends_count <= 0) {
    return TargetCheckResult.NoMutualFollowers
  }
  return TargetCheckResult.Ok
}

export function checkTweetReactionBlockTarget(target: TweetReactionBlockSessionRequest['target']): TargetCheckResult {
  if (!(target.blockRetweeters || target.blockLikers)) {
    return TargetCheckResult.ChooseAtLeastRtOrLikes
  }
  const { retweet_count, favorite_count } = target.tweet
  if (retweet_count <= 0 && favorite_count <= 0) {
    return TargetCheckResult.NobodyRetweetOrLiked
  }
  const onlyWantBlockRetweetedUsers = target.blockRetweeters && !target.blockLikers
  const onlyWantBlockLikedUsers = !target.blockRetweeters && target.blockLikers
  if (onlyWantBlockRetweetedUsers && retweet_count <= 0) {
    return TargetCheckResult.NobodyRetweeted
  } else if (onlyWantBlockLikedUsers && favorite_count <= 0) {
    return TargetCheckResult.NobodyLiked
  }
  return TargetCheckResult.Ok
}

export function checkImportBlockTarget(target: ImportBlockSessionRequest['target']): TargetCheckResult {
  if (target.userIds.length <= 0) {
    return TargetCheckResult.EmptyList
  }
  return TargetCheckResult.Ok
}
