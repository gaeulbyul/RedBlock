export function decideWhatToDoGivenUser(
  request: SessionRequest,
  follower: TwitterUser,
  now: Dayjs
): UserAction | 'Skip' | 'AlreadyDone' {
  if (request.purpose === 'export') {
    throw new Error('unreachable')
  }
  const { following, followed_by } = follower
  if (!(typeof following === 'boolean' && typeof followed_by === 'boolean')) {
    throw new Error('following/followed_by property missing?')
  }
  if (checkUserInactivity(follower, now, request.options.skipInactiveUser) === 'inactive') {
    return 'Skip'
  }
  let whatToDo: UserAction
  switch (request.purpose) {
    case 'chainblock':
      whatToDo = decideWhenChainBlock(request, follower)
      break
    case 'unchainblock':
      whatToDo = decideWhenUnChainBlock(request, follower)
      break
    case 'chainunfollow':
      whatToDo = decideWhenChainUnfollow(request, follower)
      break
    case 'lockpicker':
      whatToDo = decideWhenLockPicker(request, follower)
      break
  }
  if (whatToDo === 'Skip') {
    return whatToDo
  }
  if (isAlreadyDone(follower, whatToDo)) {
    return 'AlreadyDone'
  }
  return whatToDo
}

function decideWhenChainBlock(request: SessionRequest, follower: TwitterUser) {
  const { options } = request
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
    return options.myFollowers
  }
  if (isMyFollowing) {
    return options.myFollowings
  }
  return 'Block'
}

function decideWhenUnChainBlock(request: SessionRequest, follower: TwitterUser) {
  const { options } = request
  if (follower.blocking && follower.blocked_by) {
    return options.mutualBlocked
  }
  return 'UnBlock'
}

function decideWhenLockPicker(request: SessionRequest, follower: TwitterUser) {
  const { options } = request
  const { following, followed_by } = follower
  if (follower.protected && followed_by && !following) {
    return options.protectedFollowers
  }
  return 'Skip'
}

function decideWhenChainUnfollow(request: SessionRequest, follower: TwitterUser) {
  const { options } = request
  const { following, followed_by, follow_request_sent } = follower
  const isMyFollowing = following || follow_request_sent
  const isMyFollower = followed_by
  const isMyMutualFollower = isMyFollower && isMyFollowing
  if (isMyMutualFollower) {
    return options.myMutualFollowers
  }
  if (!isMyFollowing) {
    return 'Skip'
  }
  return 'UnFollow'
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
    case !followed_by && action === 'BlockAndUnBlock':
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
