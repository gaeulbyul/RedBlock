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

type AnySessionTarget =
  | FollowerSessionTarget
  | TweetReactionSessionTarget
  | ImportSessionTarget
  | LockPickerSessionTarget
  | UserSearchBlockSessionTarget
  | ExportMyBlocklistTarget

type ExportableSessionTarget =
  | FollowerSessionTarget
  | TweetReactionSessionTarget
  | ExportMyBlocklistTarget

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

interface ExportMyBlocklistTarget {
  type: 'export_my_blocklist'
}

interface Actor {
  user: TwitterUser
  // TwClient는 클래스이기에 message로 주고받으면 메서드 등에 접근할 수 없다.
  // 대신 background에서 TwClient 개체를 만들 수 있도록 cookieOptions로 넘기자..
  cookieOptions: CookieOptions
}

interface SessionRequest<Target extends AnySessionTarget> {
  retriever: Actor
  executor: Actor
  options: RedBlockOptions
  extraTarget: {
    bioBlock: BioBlockMode
  }
  purpose: Purpose
  target: Target
}

interface SessionInfo {
  sessionId: string
  request: SessionRequest<AnySessionTarget>
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
