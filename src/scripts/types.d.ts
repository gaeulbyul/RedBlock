type PageEnum = typeof import('./common').PageEnum
type SessionInfo = import('./background/chainblock-session/session').SessionInfo
type SessionRequest = import('./background/chainblock-session/session').SessionRequest
type FollowerBlockSessionRequest = import('./background/chainblock-session/session').FollowerBlockSessionRequest
type TweetReactionBlockSessionRequest = import('./background/chainblock-session/session').TweetReactionBlockSessionRequest
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
  | RBActions.Cancel
  | RBActions.Start
  | RBActions.Stop
  | RBActions.StopAll
  | RBActions.Rewind
  | RBActions.InsertUserToStorage
  | RBActions.RemoveUserFromStorage
  | RBActions.RequestProgress
  | RBActions.RequestCleanup
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

  interface MarkManyUsersAsBlocked {
    messageType: 'MarkManyUsersAsBlocked'
    messageTo: 'content'
    userIds: string[]
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
  | RBMessages.MarkManyUsersAsBlocked
  | RBMessages.Alert
  | RBMessages.ConfirmChainBlock
  | RBMessages.ToggleOneClickBlockMode

interface MarkUserParams {
  userId: string
  verb: VerbSomething
}

interface MarkManyUsersAsBlockedParams {
  userIds: string[]
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
