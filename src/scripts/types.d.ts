type HTTPMethods = 'get' | 'delete' | 'post' | 'put'
type URLParamsObj = { [key: string]: string | number | boolean }

interface TwitterUser {
  id_str: string
  screen_name: string
  name: string
  blocked_by: boolean
  blocking: boolean
  muting: boolean
  // 1st-party API에선 이 속성이 안 지워진듯. 따라서 그냥 사용한다.
  following: boolean
  followed_by: boolean
  follow_request_sent: boolean
  friends_count: number
  followers_count: number
  protected: boolean
  verified: boolean
  created_at: string // datetime example: 'Sun Jun 29 05:52:09 +0000 2014'
  description: string
  profile_image_url_https: string
}

interface TwitterUserEntities {
  [userId: string]: TwitterUser
}

interface FollowsListResponse {
  next_cursor_str: string
  users: TwitterUser[]
}

interface UserIdsResponse {
  next_cursor_str: string
  ids: string[]
}

type FollowKind = 'followers' | 'friends' | 'mutual-followers'

type ConnectionType =
  | 'following'
  | 'following_requested'
  | 'followed_by'
  | 'blocking'
  | 'blocked_by'
  | 'muting'
  | 'none'

interface Friendship {
  name: string
  screen_name: string
  id_str: string
  connections: ConnectionType[]
}

type FriendshipResponse = Friendship[]

interface Relationship {
  source: {
    id_str: string
    screen_name: string
    following: boolean
    followed_by: boolean
    live_following: boolean
    following_received: boolean
    following_requested: boolean
    notifications_enabled: boolean
    can_dm: boolean
    can_media_tag: boolean
    blocking: boolean
    blocked_by: boolean
    muting: boolean
    want_retweets: boolean
    all_replies: boolean
    marked_spam: boolean
  }
  target: {
    id_str: string
    screen_name: string
    following: boolean
    followed_by: boolean
    following_received: boolean
    following_requested: boolean
  }
}

interface Limit {
  limit: number
  remaining: number
  reset: number
}

interface LimitStatus {
  application: {
    '/application/rate_limit_status': Limit
  }
  blocks: {
    // note: POST API (create, destroy) not exists.
    '/blocks/list': Limit
    '/blocks/ids': Limit
  }
  followers: {
    '/followers/ids': Limit
    '/followers/list': Limit
  }
  friends: {
    '/friends/list': Limit
    '/friends/ids': Limit
  }
}

interface EventStore {
  [eventName: string]: Function[]
}

interface EitherRight<T> {
  ok: true
  value: T
}

interface EitherLeft<E> {
  ok: false
  error: E
}

type Either<E, T> = EitherLeft<E> | EitherRight<T>

declare namespace RBActions {
  export interface Start {
    action: Action.StartChainBlock
    userName: string
    targetList: FollowKind
    options: RedBlock.Background.ChainBlockSession.SessionRequest['options']
  }

  export interface Stop {
    action: Action.StopChainBlock
    sessionId: string
  }

  export interface StopAll {
    action: Action.StopAllChainBlock
  }

  export interface ConnectToBackground {
    action: Action.ConnectToBackground
  }

  export interface DisconnectToBackground {
    action: Action.DisconnectToBackground
  }

  export interface InsertUserToStorage {
    action: Action.InsertUserToStorage
    user: TwitterUser
  }

  export interface RemoveUserFromStorage {
    action: Action.RemoveUserFromStorage
    user: TwitterUser
  }

  export interface RequestProgress {
    action: Action.RequestProgress
  }
}

type RBAction =
  | RBActions.Start
  | RBActions.Stop
  | RBActions.StopAll
  | RBActions.ConnectToBackground
  | RBActions.DisconnectToBackground
  | RBActions.InsertUserToStorage
  | RBActions.RemoveUserFromStorage
  | RBActions.RequestProgress

interface RBChainBlockInfoMessage {
  messageType: 'ChainBlockInfoMessage'
  infos: RedBlock.Background.ChainBlockSession.SessionInfo[]
}

declare namespace uuid {
  function v1(): string
}

/*
interface SessionInfo {
  sessionId: string
  progress: {
    alreadyBlocked: number
    skipped: number
    blockSuccess: number
    blockFail: number
    totalScraped: number
  }
  status: SessionStatus
  target: {
    user: TwitterUser
    // totalCount: 맞팔로우 체인의 경우, 실행시작 시점에선 정확한 사용자 수를 알 수 없다.
    // 따라서, null을 통해 '아직 알 수 없음'을 표현한다.
    totalCount: number | null
  }
  options: {
    targetList: FollowKind | 'mutual-followers'
    quickMode: boolean
    myFollowers: 'skip' | 'block'
    myFollowings: 'skip' | 'block'
  }
  // limits?: Limit
  limit: Limit | null
}

interface SessionInit {
  sessionId: string
  targetUser: TwitterUser
  options: SessionInfo['options']
}
*/

interface RedBlockStorage {
  savedUsers: TwitterUser[]
}

// ---- browser notification types ----

interface BrowserNotificationButton {
  title: string
  iconUrl?: string
}

interface BrowserNotificationItem {
  title: string
  message: string
}

interface BrowserNotification {
  type: 'basic' | 'image' | 'list' | 'progress'
  iconUrl: string
  title: string
  message: string
  contextMessage?: string
  priority: 0 | 1 | 2 // -2, -1 does not support on some platform
  eventTime?: number
  buttons?: BrowserNotificationButton[]
  items: BrowserNotificationItem[]
  imageUrl?: string
  progress?: number
}

type BNotificationOptions = browser.notifications.NotificationOptions

// ---- react-tabs ----

declare var ReactTabs: typeof import('react-tabs')

// ---- context menu ----

declare namespace browser {
  export import contextMenus = browser.menus
}
