type Session = import('./session').ChainBlockSession | import('./session').ExportSession
type TwClient = import('../twitter-api').TwClient

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

type SessionTarget =
  | FollowerSessionTarget
  | TweetReactionSessionTarget
  | ImportSessionTarget
  | LockPickerSessionTarget
  | UserSearchBlockSessionTarget

interface FollowerSessionTarget {
  type: 'follower'
  user: TwitterUser
  list: FollowKind
}

interface TweetReactionSessionTarget {
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

interface LockPickerSessionTarget {
  type: 'lockpicker'
  user: TwitterUser
  list: 'followers'
}

interface ImportSessionTarget {
  type: 'import'
  source: 'file' | 'text'
  userIds: string[]
  userNames: string[]
}

interface UserSearchBlockSessionTarget {
  type: 'user_search'
  query: string
}

interface Actor {
  user: TwitterUser
  // TwClient는 클래스이기에 message로 주고받으면 메서드 등에 접근할 수 없다.
  // 대신 background에서 TwClient 개체를 만들 수 있도록 cookieOptions로 넘기자..
  cookieOptions: CookieOptions
}

interface BaseRequest {
  retriever: Actor
  executor: Actor
  options: RedBlockOptions
  extraTarget: {
    bioBlock: BioBlockMode
  }
}

type SessionRequest =
  | FollowerBlockSessionRequest
  | TweetReactionBlockSessionRequest
  | ImportBlockSessionRequest
  | LockPickerSessionRequest
  | UserSearchBlockSessionRequest

type ExportableSessionRequest = FollowerBlockSessionRequest | TweetReactionBlockSessionRequest

interface FollowerBlockSessionRequest extends BaseRequest {
  purpose: Exclude<Purpose, LockPickerPurpose>
  target: FollowerSessionTarget
}

interface TweetReactionBlockSessionRequest extends BaseRequest {
  // 이미 차단한 사용자의 RT/마음은 확인할 수 없다.
  // 따라서, 언체인블락은 구현할 수 없다.
  // 또한 프로텍트팔로워 역시 확인할 수 없으므로
  purpose: Exclude<Purpose, UnChainBlockPurpose | LockPickerPurpose>
  target: TweetReactionSessionTarget
}

interface LockPickerSessionRequest extends BaseRequest {
  purpose: LockPickerPurpose
  target: LockPickerSessionTarget
}

interface ImportBlockSessionRequest extends BaseRequest {
  purpose: Exclude<Purpose, ExportPurpose | LockPickerPurpose>
  target: ImportSessionTarget
}

interface UserSearchBlockSessionRequest extends BaseRequest {
  // TODO: export는 나중으로 미루자
  purpose: Exclude<Purpose, ExportPurpose | LockPickerPurpose>
  target: UserSearchBlockSessionTarget
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
