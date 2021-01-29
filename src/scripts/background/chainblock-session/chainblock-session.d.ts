type SessionRequest =
  | FollowerBlockSessionRequest
  | TweetReactionBlockSessionRequest
  | ImportBlockSessionRequest
  | UserSearchBlockSessionRequest

type ExportableSessionRequest = FollowerBlockSessionRequest | TweetReactionBlockSessionRequest

type Session = import('./session').ChainBlockSession | import('./session').ExportSession

// TODO: 언체인블락 분리 (적어도 options만큼이라도)
interface SessionOptions {
  myFollowers: UserAction
  myFollowings: UserAction
  mutualBlocked: UserAction
  myMutualFollowers: UserAction
  protectedFollowers: UserAction
  includeUsersInBio: BioBlockMode
  skipInactiveUser: InactivePeriod
}

// NOTE: myself: TwitterUser는 락피커 구현하면서 넣은 것
// 자신에게 일반 체인블락걸면 안 되므로 체크용으로 넣어둠
interface BaseRequest {
  myself: TwitterUser
  cookieOptions: CookieOptions
}

interface FollowerBlockSessionRequest extends BaseRequest {
  purpose: Purpose
  target: {
    type: 'follower'
    user: TwitterUser
    list: FollowKind
  }
  options: SessionOptions
}

interface TweetReactionBlockSessionRequest extends BaseRequest {
  // 이미 차단한 사용자의 RT/마음은 확인할 수 없다.
  // 따라서, 언체인블락은 구현할 수 없다.
  // 또한 프로텍트팔로워 역시 확인할 수 없으므로
  purpose: Exclude<Purpose, 'unchainblock' | 'lockpicker'>
  target: {
    type: 'tweet_reaction'
    // author of tweet
    // user: TwitterUser
    tweet: Tweet
    // reaction: ReactionKind
    blockRetweeters: boolean
    blockLikers: boolean
    blockMentionedUsers: boolean
  }
  options: SessionOptions
}

interface ImportBlockSessionRequest extends BaseRequest {
  purpose: Exclude<Purpose, 'export' | 'lockpicker'>
  target: {
    type: 'import'
    userIds: string[]
    userNames: string[]
  }
  options: SessionOptions
}

interface UserSearchBlockSessionRequest extends BaseRequest {
  // TODO: export는 나중으로 미루자
  purpose: Exclude<Purpose, 'export' | 'lockpicker'>
  target: {
    type: 'user_search'
    query: string
  }
  options: SessionOptions
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
}

interface ExportResult {
  userIds: Set<string>
  filename: string
}

type ScrapedUsersIterator = AsyncIterableIterator<Either<Error, UsersObject>>
type ScrapedUserIdsIterator = AsyncIterableIterator<Either<Error, UserIdsObject>>
