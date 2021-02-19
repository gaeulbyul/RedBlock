export function decideWhatToDoGivenUser(
  request: SessionRequest,
  follower: TwitterUser,
  now: Dayjs
): UserAction | 'Skip' | 'AlreadyDone' {
  const { purpose, options } = request
  if (purpose.type === 'export') {
    throw new Error('unreachable')
  }
  const { following, followed_by } = follower
  if (!(typeof following === 'boolean' && typeof followed_by === 'boolean')) {
    throw new Error('following/followed_by property missing?')
  }
  if (checkUserInactivity(follower, now, options.skipInactiveUser) === 'inactive') {
    return 'Skip'
  }
  let whatToDo: UserAction
  switch (purpose.type) {
    case 'chainblock':
      whatToDo = decideWhenChainBlock(purpose, follower)
      break
    case 'unchainblock':
      whatToDo = decideWhenUnChainBlock(purpose, follower)
      break
    case 'chainunfollow':
      whatToDo = decideWhenChainUnfollow(purpose, follower)
      break
    case 'chainmute':
      whatToDo = decideWhenChainMute(purpose, follower)
      break
    case 'unchainmute':
      whatToDo = decideWhenUnChainMute(purpose, follower)
      break
    case 'lockpicker':
      whatToDo = decideWhenLockPicker(purpose, follower)
      break
  }
  if (whatToDo === 'Skip') {
    return whatToDo
  }
  if (whatToDo === 'Mute' && follower.blocking) {
    return options.muteEvenAlreadyBlocking ? 'Mute' : 'Skip'
  }
  if (isAlreadyDone(follower, whatToDo)) {
    return 'AlreadyDone'
  }
  return whatToDo
}

function decideWhenChainBlock(purpose: ChainBlockPurpose, follower: TwitterUser) {
  const { following, followed_by, follow_request_sent } = follower
  const isMyFollowing = following || follow_request_sent
  const isMyFollower = followed_by
  const isMyMutualFollower = isMyFollower && isMyFollowing
  // 주의!
  // 팝업 UI에 나타난 순서를 고려할 것.
  if (isMyMutualFollower) {
    return 'Skip'
  }
  if (isMyFollower) {
    return purpose.myFollowers
  }
  if (isMyFollowing) {
    return purpose.myFollowings
  }
  return 'Block'
}

function decideWhenUnChainBlock(purpose: UnChainBlockPurpose, follower: TwitterUser) {
  if (follower.blocking && follower.blocked_by) {
    return purpose.mutualBlocked
  }
  return 'UnBlock'
}

function decideWhenLockPicker(purpose: LockPickerPurpose, follower: TwitterUser) {
  const { following, followed_by } = follower
  if (follower.protected && followed_by && !following) {
    return purpose.protectedFollowers
  }
  return 'Skip'
}

function decideWhenChainUnfollow(_purpose: ChainUnfollowPurpose, follower: TwitterUser) {
  const { following, followed_by, follow_request_sent } = follower
  const isMyFollowing = following || follow_request_sent
  const isMyFollower = followed_by
  const isMyMutualFollower = isMyFollower && isMyFollowing
  if (isMyMutualFollower) {
    return 'Skip'
  }
  if (!isMyFollowing) {
    return 'Skip'
  }
  return 'UnFollow'
}

function decideWhenChainMute(purpose: ChainMutePurpose, follower: TwitterUser) {
  const { following, followed_by, follow_request_sent } = follower
  const isMyFollowing = following || follow_request_sent
  const isMyFollower = followed_by
  const isMyMutualFollower = isMyFollower && isMyFollowing
  // 주의!
  // 팝업 UI에 나타난 순서를 고려할 것.
  if (isMyMutualFollower) {
    return 'Skip'
  }
  if (isMyFollower) {
    return purpose.myFollowers
  }
  if (isMyFollowing) {
    return purpose.myFollowings
  }
  return 'Mute'
}

function decideWhenUnChainMute(purpose: UnChainMutePurpose, follower: TwitterUser) {
  if (follower.muting && follower.blocking) {
    return purpose.mutedAndAlsoBlocked
  }
  return 'UnMute'
}

function isAlreadyDone(follower: TwitterUser, action: UserAction): boolean {
  if (!('blocking' in follower && 'muting' in follower)) {
    return false
  }
  const { blocking, muting, following, followed_by } = follower
  switch (true) {
    case blocking && action === 'Block':
    case !blocking && action === 'UnBlock':
    case muting && action === 'Mute':
    case !muting && action === 'UnMute':
    case !following && action === 'UnFollow':
    case !followed_by && !following && action === 'BlockAndUnBlock':
      return true
    default:
      return false
  }
}

function checkUserInactivity(
  follower: TwitterUser,
  now: Dayjs,
  inactivePeriod: InactivePeriod
): 'active' | 'inactive' {
  if (inactivePeriod === 'never') {
    // 체크하지 않기로 했으므로 무조건 active
    return 'active'
  }
  if (follower.protected) {
    // 프로텍트걸린 계정의 경우 마지막으로 작성한 트윗의 정보를 가져올 수 없다.
    // 체크할 수 없으므로 active로 취급
    return 'active'
  }
  let before: Dayjs
  switch (inactivePeriod) {
    case '1y':
    case '2y':
    case '3y':
      before = now.subtract(parseInt(inactivePeriod.charAt(0), 10), 'y')
      break
  }
  const lastTweet = follower.status
  let isInactive: boolean
  if (lastTweet) {
    const lastTweetDatetime = dayjs(lastTweet.created_at, 'MMM DD HH:mm:ss ZZ YYYY')
    isInactive = lastTweetDatetime.isBefore(before)
  } else {
    // 작성한 트윗이 없다면 계정생성일을 기준으로 판단한다.
    const accountCreatedDatetime = dayjs(follower.created_at)
    isInactive = accountCreatedDatetime.isBefore(before)
  }
  return isInactive ? 'inactive' : 'active'
}
