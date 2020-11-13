type PageEnum = typeof import('../popup/popup').PageEnum
type SessionInfo = import('./background/chainblock-session/session').SessionInfo
type SessionRequest = import('./background/chainblock-session/session').SessionRequest
type FollowerBlockSessionRequest = import('./background/chainblock-session/session').FollowerBlockSessionRequest
type TweetReactionBlockSessionRequest = import('./background/chainblock-session/session').TweetReactionBlockSessionRequest
type ImportBlockSessionRequest = import('./background/chainblock-session/session').ImportBlockSessionRequest
type TwitterUser = import('./background/twitter-api').TwitterUser
type Tweet = import('./background/twitter-api').Tweet
type DialogMessageObj = import('./text-generate').DialogMessageObj

// ---- vendor modules ----
declare var _: typeof import('lodash')
declare var React: typeof import('react')
declare var ReactDOM: typeof import('react-dom')
declare var MaterialUI: typeof import('@material-ui/core')

declare namespace uuid {
  function v1(): string
}

type FollowKind = 'followers' | 'friends' | 'mutual-followers'
type ChainKind = 'chainblock' | 'unchainblock'
type ReactionKind = 'retweeted' | 'liked'

type VerbSomething = 'Block' | 'UnBlock' | 'Mute' | 'UnMute'
type VerbNothing = 'Skip' | 'AlreadyDone'
type Verb = VerbSomething | VerbNothing

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

declare namespace RBMessageToBackground {
  interface CreateFollowerChainBlockSession {
    messageType: 'CreateFollowerChainBlockSession'
    messageTo: 'background'
    request: FollowerBlockSessionRequest
  }

  interface CreateTweetReactionChainBlockSession {
    messageType: 'CreateTweetReactionChainBlockSession'
    messageTo: 'background'
    request: TweetReactionBlockSessionRequest
  }

  interface CreateImportChainBlockSession {
    messageType: 'CreateImportChainBlockSession'
    messageTo: 'background'
    request: ImportBlockSessionRequest
  }

  interface Cancel {
    messageType: 'Cancel'
    messageTo: 'background'
    sessionId: string
  }

  interface Start {
    messageType: 'Start'
    messageTo: 'background'
    sessionId: string
  }

  interface Stop {
    messageType: 'StopChainBlock'
    messageTo: 'background'
    sessionId: string
  }

  interface StopAll {
    messageType: 'StopAllChainBlock'
    messageTo: 'background'
  }

  interface Rewind {
    messageType: 'RewindChainBlock'
    messageTo: 'background'
    sessionId: string
  }

  interface InsertUserToStorage {
    messageType: 'InsertUserToStorage'
    messageTo: 'background'
    user: TwitterUser
  }

  interface RemoveUserFromStorage {
    messageType: 'RemoveUserFromStorage'
    messageTo: 'background'
    user: TwitterUser
  }

  interface RequestProgress {
    messageType: 'RequestProgress'
    messageTo: 'background'
  }

  interface RequestCleanup {
    messageType: 'RequestCleanup'
    messageTo: 'background'
    cleanupWhat: 'inactive' | 'not-confirmed'
  }

  interface RefreshSavedUsers {
    messageType: 'RefreshSavedUsers'
    messageTo: 'background'
  }

  interface RequestResetCounter {
    messageType: 'RequestResetCounter'
    messageTo: 'background'
  }

  interface BlockSingleUser {
    messageType: 'BlockSingleUser'
    messageTo: 'background'
    user: TwitterUser
  }

  interface UnblockSingleUser {
    messageType: 'UnblockSingleUser'
    messageTo: 'background'
    user: TwitterUser
  }
}

declare type RBMessageToBackgroundType =
  | RBMessageToBackground.CreateFollowerChainBlockSession
  | RBMessageToBackground.CreateTweetReactionChainBlockSession
  | RBMessageToBackground.CreateImportChainBlockSession
  | RBMessageToBackground.Cancel
  | RBMessageToBackground.Start
  | RBMessageToBackground.Stop
  | RBMessageToBackground.StopAll
  | RBMessageToBackground.Rewind
  | RBMessageToBackground.InsertUserToStorage
  | RBMessageToBackground.RemoveUserFromStorage
  | RBMessageToBackground.RequestProgress
  | RBMessageToBackground.RequestCleanup
  | RBMessageToBackground.RefreshSavedUsers
  | RBMessageToBackground.RequestResetCounter
  | RBMessageToBackground.BlockSingleUser
  | RBMessageToBackground.UnblockSingleUser

declare namespace RBMessageToPopup {
  interface ChainBlockInfo {
    messageType: 'ChainBlockInfo'
    messageTo: 'popup'
    sessions: SessionInfo[]
    limiter: BlockLimiterStatus
  }

  interface PopupSwitchTab {
    messageType: 'PopupSwitchTab'
    messageTo: 'popup'
    page: PageEnum[keyof PageEnum]
  }
  interface ConfirmChainBlockInPopup {
    messageType: 'ConfirmChainBlockInPopup'
    messageTo: 'popup'
    confirmMessage: DialogMessageObj
    sessionId: string
  }
}

declare type RBMessageToPopupType =
  | RBMessageToPopup.ChainBlockInfo
  | RBMessageToPopup.PopupSwitchTab
  | RBMessageToPopup.ConfirmChainBlockInPopup

declare namespace RBMessageToContent {
  interface MarkUser {
    messageType: 'MarkUser'
    messageTo: 'content'
    userId: string
    verb: VerbSomething
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
    sessionId: string
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
  verb: VerbSomething
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
}

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
