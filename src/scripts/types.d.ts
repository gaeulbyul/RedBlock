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

declare namespace RBActions {
  interface CreateFollowerChainBlockSession {
    actionType: 'CreateFollowerChainBlockSession'
    request: FollowerBlockSessionRequest
  }

  interface CreateTweetReactionChainBlockSession {
    actionType: 'CreateTweetReactionChainBlockSession'
    request: TweetReactionBlockSessionRequest
  }

  interface CreateImportChainBlockSession {
    actionType: 'CreateImportChainBlockSession'
    request: ImportBlockSessionRequest
  }

  interface Cancel {
    actionType: 'Cancel'
    sessionId: string
  }

  interface Start {
    actionType: 'Start'
    sessionId: string
  }

  interface Stop {
    actionType: 'StopChainBlock'
    sessionId: string
  }

  interface StopAll {
    actionType: 'StopAllChainBlock'
  }

  interface Rewind {
    actionType: 'RewindChainBlock'
    sessionId: string
  }

  interface InsertUserToStorage {
    actionType: 'InsertUserToStorage'
    user: TwitterUser
  }

  interface RemoveUserFromStorage {
    actionType: 'RemoveUserFromStorage'
    user: TwitterUser
  }

  interface RequestProgress {
    actionType: 'RequestProgress'
  }

  interface RequestCleanup {
    actionType: 'RequestCleanup'
    cleanupWhat: 'inactive' | 'not-confirmed'
  }

  interface RefreshSavedUsers {
    actionType: 'RefreshSavedUsers'
  }

  interface BlockSingleUser {
    actionType: 'BlockSingleUser'
    user: TwitterUser
  }

  interface UnblockSingleUser {
    actionType: 'UnblockSingleUser'
    user: TwitterUser
  }
}

// background 측으로 보내는 메시지
type RBAction =
  | RBActions.CreateFollowerChainBlockSession
  | RBActions.CreateTweetReactionChainBlockSession
  | RBActions.CreateImportChainBlockSession
  | RBActions.Cancel
  | RBActions.Start
  | RBActions.Stop
  | RBActions.StopAll
  | RBActions.Rewind
  | RBActions.InsertUserToStorage
  | RBActions.RemoveUserFromStorage
  | RBActions.RequestProgress
  | RBActions.RequestCleanup
  | RBActions.RefreshSavedUsers
  | RBActions.BlockSingleUser
  | RBActions.UnblockSingleUser

declare namespace RBMessages {
  interface ChainBlockInfo {
    messageType: 'ChainBlockInfo'
    messageTo: 'popup'
    infos: SessionInfo[]
  }

  interface MarkUser {
    messageType: 'MarkUser'
    messageTo: 'content'
    userId: string
    verb: VerbSomething
  }

  interface PopupSwitchTab {
    messageType: 'PopupSwitchTab'
    messageTo: 'popup'
    page: PageEnum[keyof PageEnum]
  }

  interface Alert {
    messageType: 'Alert'
    messageTo: 'content'
    message: string
  }

  interface ConfirmChainBlockInPopup {
    messageType: 'ConfirmChainBlockInPopup'
    messageTo: 'popup'
    confirmMessage: DialogMessageObj
    sessionId: string
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

// popup페이지로 보내는 메시지
type RBMessageToPopup = RBMessages.ConfirmChainBlockInPopup | RBMessages.PopupSwitchTab | RBMessages.ChainBlockInfo

// content측으로 보내는 메시지
type RBMessageToContent =
  | RBMessages.MarkUser
  | RBMessages.Alert
  | RBMessages.ConfirmChainBlock
  | RBMessages.ToggleOneClickBlockMode

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
