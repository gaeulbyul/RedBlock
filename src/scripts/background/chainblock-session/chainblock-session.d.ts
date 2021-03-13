type SessionRequest =
  | FollowerBlockSessionRequest
  | TweetReactionBlockSessionRequest
  | ImportBlockSessionRequest
  | LockPickerSessionRequest
  | UserSearchBlockSessionRequest

type ExportableSessionRequest = FollowerBlockSessionRequest | TweetReactionBlockSessionRequest

type Session = import('./session').ChainBlockSession | import('./session').ExportSession

// NOTE: myself: TwitterUser는 락피커 구현하면서 넣은 것
// 자신에게 일반 체인블락걸면 안 되므로 체크용으로 넣어둠
interface BaseRequest {
  myself: TwitterUser
  cookieOptions: CookieOptions
  options: RedBlockOptions
  extraTarget: {
    bioBlock: BioBlockMode
  }
}

type Purpose =
  | ChainBlockPurpose
  | UnChainBlockPurpose
  | LockPickerPurpose
  | ChainUnfollowPurpose
  | ChainMutePurpose
  | UnChainMutePurpose
  | ExportPurpose

interface ChainBlockPurpose {
  type: 'chainblock'
  myFollowers: UserAction
  myFollowings: UserAction
}

interface UnChainBlockPurpose {
  type: 'unchainblock'
  mutualBlocked: 'Skip' | 'UnBlock'
}

interface LockPickerPurpose {
  type: 'lockpicker'
  protectedFollowers: 'Block' | 'BlockAndUnBlock'
}

interface ChainUnfollowPurpose {
  type: 'chainunfollow'
}

interface ChainMutePurpose {
  type: 'chainmute'
  myFollowers: 'Skip' | 'Mute'
  myFollowings: 'Skip' | 'Mute'
}

interface UnChainMutePurpose {
  type: 'unchainmute'
  mutedAndAlsoBlocked: 'Skip' | 'UnMute'
}

interface ExportPurpose {
  type: 'export'
}

interface FollowerBlockSessionRequest extends BaseRequest {
  purpose: Exclude<Purpose, LockPickerPurpose>
  target: {
    type: 'follower'
    user: TwitterUser
    list: FollowKind
  }
}

interface TweetReactionBlockSessionRequest extends BaseRequest {
  // 이미 차단한 사용자의 RT/마음은 확인할 수 없다.
  // 따라서, 언체인블락은 구현할 수 없다.
  // 또한 프로텍트팔로워 역시 확인할 수 없으므로
  purpose: Exclude<Purpose, UnChainBlockPurpose | LockPickerPurpose>
  target: {
    type: 'tweet_reaction'
    // author of tweet
    // user: TwitterUser
    tweet: Tweet
    // reaction: ReactionKind
    blockRetweeters: boolean
    blockLikers: boolean
    blockMentionedUsers: boolean
    blockQuotedUsers: boolean
    blockNonLinkedMentions: boolean
  }
}

interface LockPickerSessionRequest extends BaseRequest {
  purpose: LockPickerPurpose
  target: {
    type: 'lockpicker'
    user: TwitterUser
    list: 'followers'
  }
}

interface ImportBlockSessionRequest extends BaseRequest {
  purpose: Exclude<Purpose, ExportPurpose | LockPickerPurpose>
  target: {
    type: 'import'
    userIds: string[]
    userNames: string[]
  }
}

interface UserSearchBlockSessionRequest extends BaseRequest {
  // TODO: export는 나중으로 미루자
  purpose: Exclude<Purpose, ExportPurpose | LockPickerPurpose>
  target: {
    type: 'user_search'
    query: string
  }
}

interface SessionInfo<ReqT = SessionRequest> {
  sessionId: string
  request: ReqT
  progress: {
    success: {
      [action in Exclude<UserAction, 'Skip'>]: number
    }
    failure: number
    already: number
    skipped: number
    error: number
    scraped: number
    total: number | null
  }
  status: import('../../common').SessionStatus
  limit: import('../twitter-api').Limit | null
  exported?: boolean
}

interface ExportResult {
  userIds: Set<string>
  filename: string
}

type ScrapedUsersIterator = AsyncIterableIterator<Either<Error, UsersObject>>
type ScrapedUserIdsIterator = AsyncIterableIterator<Either<Error, UserIdsObject>>
