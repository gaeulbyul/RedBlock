type Session = import('./session').default | import('./export-session').default
type TwClient = import('../twitter-api').TwClient
type Limit = import('../twitter-api').Limit
type ReactionV2Kind = import('../twitter-api').ReactionV2Kind

type SessionStatus =
  | 'Initial'
  | 'AwaitingUntilRecur'
  | 'Running'
  | 'RateLimited'
  | 'Completed'
  | 'Stopped'
  | 'Error'

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
  | UserSearchSessionTarget
  | AudioSpaceSessionTarget
  | ExportMyBlocklistTarget

type ExportableSessionTarget =
  | FollowerSessionTarget
  | TweetReactionSessionTarget
  | AudioSpaceSessionTarget
  | ExportMyBlocklistTarget

interface FollowerSessionTarget {
  type: 'follower'
  user: TwitterUser
  list: FollowKind
}

interface TweetReactionSessionTarget {
  type: 'tweet_reaction'
  tweet: Tweet
  includeRetweeters: boolean
  includeLikers: boolean
  includeMentionedUsers: boolean
  includeQuotedUsers: boolean
  includeNonLinkedMentions: boolean
  includedReactionsV2: ReactionV2Kind[]
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

interface UserSearchSessionTarget {
  type: 'user_search'
  query: string
}

interface AudioSpaceSessionTarget {
  type: 'audio_space'
  audioSpace: AudioSpace
  includeHostsAndSpeakers: boolean
  includeListeners: boolean
}

interface ExportMyBlocklistTarget {
  type: 'export_my_blocklist'
}

interface Actor {
  user: TwitterUser
  // TwClient는 클래스이기에 message로 주고받으면 메서드 등에 접근할 수 없다.
  // 대신 background에서 TwClient 개체를 만들 수 있도록 options만 넘기자..
  clientOptions: TwClientOptions
}

interface SessionRequest<Target extends AnySessionTarget> {
  retriever: Actor
  executor: Actor
  options: RedBlockOptions
  purpose: Purpose
  target: Target
  extraSessionOptions: {
    bioBlock: BioBlockMode
    recurring: boolean
  }
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
  status: SessionStatus
  limit: import('../twitter-api').Limit | null
  exported?: boolean
}

interface ExportResult {
  userIds: Set<string>
  filename: string
}

type ScrapedUsersIterator = AsyncIterableIterator<Either<Error, UsersObject>>
type ScrapedUserIdsIterator = AsyncIterableIterator<Either<Error, UserIdsObject>>

interface SessionEventEmitter {
  'mark-user': MarkUserParams
  'rate-limit': Limit
  'rate-limit-reset': null
  started: SessionInfo
  stopped: { sessionInfo: SessionInfo; reason: StopReason }
  complete: SessionInfo
  'recurring-waiting': { sessionInfo: SessionInfo; delayInMinutes: number }
  error: { sessionInfo: SessionInfo; message: string }
}
