type PageId = import('../popup/popup-ui/pages').PageId
type TwitterUser = import('./background/twitter-api').TwitterUser
type Tweet = import('./background/twitter-api').Tweet
type AudioSpace = import('./background/twitter-api').AudioSpace
type DialogMessageObj = import('./text-generate').DialogMessageObj

// ---- vendor modules ----
declare var _: typeof import('lodash')
declare var React: typeof import('react')
declare var ReactDOM: typeof import('react-dom')
declare var MaterialUI: typeof import('@material-ui/core')
declare namespace twttr {
  export const txt: typeof import('twitter-text')
}
declare var dayjs: typeof import('dayjs')
declare type Dayjs = import('dayjs').Dayjs

declare namespace uuid {
  function v1(): string
}

type FollowKind = 'followers' | 'friends' | 'mutual-followers'
type ReactionKind = 'retweeted' | 'liked'

type UserAction = 'Skip' | 'Block' | 'UnBlock' | 'Mute' | 'UnMute' | 'BlockAndUnBlock' | 'UnFollow'
type BioBlockMode = 'never' | 'all' | 'smart'

type EventStore = Record<string, Function[]>

interface EitherRight<T> {
  ok: true
  value: T
}

interface EitherLeft<E> {
  ok: false
  error: E
}

type Either<E, T> = EitherLeft<E> | EitherRight<T>

interface UsersObject {
  users: TwitterUser[]
}

interface UserIdsObject {
  ids: string[]
}

declare namespace RBMessageToBackground {
  interface CreateChainBlockSession {
    messageType: 'CreateChainBlockSession'
    messageTo: 'background'
    request: SessionRequest<AnySessionTarget>
  }

  interface StartSession {
    messageType: 'StartSession'
    messageTo: 'background'
    sessionId: string
  }

  interface StopSession {
    messageType: 'StopSession'
    messageTo: 'background'
    sessionId: string
  }

  interface StopAllSessions {
    messageType: 'StopAllSessions'
    messageTo: 'background'
  }

  interface RewindSession {
    messageType: 'RewindSession'
    messageTo: 'background'
    sessionId: string
  }

  interface RequestProgress {
    messageType: 'RequestProgress'
    messageTo: 'background'
  }

  interface RequestCleanup {
    messageType: 'RequestCleanup'
    messageTo: 'background'
    cleanupWhat: 'inactive'
  }

  interface RequestBlockLimiterStatus {
    messageType: 'RequestBlockLimiterStatus'
    messageTo: 'background'
    userId: string
  }

  interface RequestResetCounter {
    messageType: 'RequestResetCounter'
    messageTo: 'background'
    userId: string
  }

  interface BlockSingleUser {
    messageType: 'BlockSingleUser'
    messageTo: 'background'
    user: TwitterUser
  }

  interface UnblockUserById {
    messageType: 'UnblockUserById'
    messageTo: 'background'
    userId: string
  }

  interface DownloadFromExportSession {
    messageType: 'DownloadFromExportSession'
    messageTo: 'background'
    sessionId: string
  }
}

declare type RBMessageToBackgroundType =
  | RBMessageToBackground.CreateChainBlockSession
  // | RBMessageToBackground.StartSession
  | RBMessageToBackground.StopSession
  | RBMessageToBackground.StopAllSessions
  | RBMessageToBackground.RewindSession
  | RBMessageToBackground.RequestProgress
  | RBMessageToBackground.RequestCleanup
  | RBMessageToBackground.RequestBlockLimiterStatus
  | RBMessageToBackground.RequestResetCounter
  | RBMessageToBackground.BlockSingleUser
  | RBMessageToBackground.UnblockUserById
  | RBMessageToBackground.DownloadFromExportSession

declare namespace RBMessageToPopup {
  interface ChainBlockInfo {
    messageType: 'ChainBlockInfo'
    messageTo: 'popup'
    sessions: SessionInfo[]
  }

  interface BlockLimiterInfo {
    messageType: 'BlockLimiterInfo'
    messageTo: 'popup'
    status: BlockLimiterStatus
    userId: string
  }

  interface PopupSwitchTab {
    messageType: 'PopupSwitchTab'
    messageTo: 'popup'
    page: PageId
  }
}

declare type RBMessageToPopupType =
  | RBMessageToPopup.ChainBlockInfo
  | RBMessageToPopup.BlockLimiterInfo
  | RBMessageToPopup.PopupSwitchTab

declare namespace RBMessageToContent {
  interface MarkUser {
    messageType: 'MarkUser'
    messageTo: 'content'
    userId: string
    userAction: UserAction
  }

  interface Alert {
    messageType: 'Alert'
    messageTo: 'content'
    message: string
  }

  interface ConfirmChainBlock {
    messageType: 'ConfirmChainBlock'
    messageTo: 'content'
    confirmMessage: string
    request: SessionRequest<AnySessionTarget>
    // sessionId: string
  }

  interface ToggleOneClickBlockMode {
    messageType: 'ToggleOneClickBlockMode'
    messageTo: 'content'
    enabled: boolean
  }
}

declare type RBMessageToContentType =
  | RBMessageToContent.MarkUser
  | RBMessageToContent.Alert
  | RBMessageToContent.ConfirmChainBlock
  | RBMessageToContent.ToggleOneClickBlockMode

// ---- content & inject ----

interface MarkUserParams {
  userId: string
  userAction: UserAction
}

interface MarkManyUsersAsBlockedParams {
  userIds: string[]
}

// 트위터의 Redux store에는 일부 속성에 실제 값 대신 id만 들어있음

type TweetEntity = Tweet & {
  user: string
  quoted_status?: string
}

interface OneClickBlockableTweetElement {
  tweet: Tweet
}

interface OneClickBlockableUserCellElement {
  user: TwitterUser
}

interface UndoOneClickBlockByIdParam {
  userId: string
  userName: string // 차단해제 메시지에 띄울 유저이름
}

interface ToastMessageParam {
  text: string
  undoBlock?: UndoOneClickBlockByIdParam
}

// ---- 1click block related ----

interface BadWordItem {
  id: string
  enabled: boolean
  word: string
  regexp: boolean
}

// ---- block limitation ----

interface BlockLimiterStatus {
  current: number
  max: number
  remained: number
}

// ---- bookmark ----

interface BookmarkTweetItem {
  type: 'tweet'
  itemId: string
  tweetId: string
}

interface BookmarkUserItem {
  type: 'user'
  itemId: string
  userId: string
}

type BookmarkItem = BookmarkTweetItem | BookmarkUserItem

// ---- import chainblock ----

interface ImportChainJson {
  connection: string
  connectionType: string // 'followers'
  users: Array<{
    id: string
    name: string // actually, it is screen_name (but unused prop in tbc)
  }>
}

interface TwitterArchiveBlockItem {
  blocking: {
    accountId: string
    userLink: string
  }
}

// ---- cookie related ----

interface CookieOptions {
  cookieStoreId: string
  actAsUserId?: string
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

// copied from https://github.com/Microsoft/TypeScript/issues/21309#issuecomment-376338415
type RequestIdleCallbackHandle = any
type RequestIdleCallbackOptions = {
  timeout: number
}
type RequestIdleCallbackDeadline = {
  readonly didTimeout: boolean
  timeRemaining: () => number
}

declare function requestIdleCallback(
  callback: (deadline: RequestIdleCallbackDeadline) => void,
  opts?: RequestIdleCallbackOptions
): RequestIdleCallbackHandle
declare function cancelIdleCallback(handle: RequestIdleCallbackHandle): void
// .end
