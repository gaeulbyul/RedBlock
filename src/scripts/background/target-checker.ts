import { checkUserIdBeforeLockPicker } from '../common.js'

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
    // TODO: 완전 지워버려~~
    // return TargetCheckResult.TheyBlocksYou
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
  if (target.userIds.length <= 0 && target.userNames.length <= 0) {
    return TargetCheckResult.EmptyList
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

export function checkLockPickerTarget(request: FollowerBlockSessionRequest): TargetCheckResult {
  const validity = checkUserIdBeforeLockPicker({
    purpose: request.purpose,
    myselfId: request.myself.id_str,
    givenUserId: request.target.user.id_str,
  })
  switch (validity) {
    case 'self':
    case 'other':
      return TargetCheckResult.Ok
    case 'invalid self':
      return TargetCheckResult.CantLockPickerToOther
    case 'invalid other':
      return TargetCheckResult.CantChainBlockYourself
  }
}
