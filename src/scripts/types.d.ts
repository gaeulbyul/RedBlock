type PageEnum = typeof import('./common').PageEnum
type SessionInfo = import('./background/chainblock-session/session').SessionInfo
type SessionRequest = import('./background/chainblock-session/session').SessionRequest
type FollowerBlockSessionRequest = import('./background/chainblock-session/session').FollowerBlockSessionRequest
type TweetReactionBlockSessionRequest = import('./background/chainblock-session/session').TweetReactionBlockSessionRequest
type TwitterUser = import('./background/twitter-api').TwitterUser
type Tweet = import('./background/twitter-api').Tweet

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
  interface StartFollowerChainBlock {
    actionType: 'StartFollowerChainBlock'
    request: FollowerBlockSessionRequest
  }

  interface StartTweetReactionChainBlock {
    actionType: 'StartTweetReactionChainBlock'
    request: TweetReactionBlockSessionRequest
  }

  interface Stop {
    actionType: 'StopChainBlock'
    sessionId: string
  }

  interface StopAll {
    actionType: 'StopAllChainBlock'
  }

  interface ConnectToBackground {
    actionType: 'ConnectToBackground'
  }

  interface DisconnectToBackground {
    actionType: 'DisconnectToBackground'
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
  | RBActions.StartFollowerChainBlock
  | RBActions.StartTweetReactionChainBlock
  | RBActions.Stop
  | RBActions.StopAll
  | RBActions.ConnectToBackground
  | RBActions.DisconnectToBackground
  | RBActions.InsertUserToStorage
  | RBActions.RemoveUserFromStorage
  | RBActions.RequestProgress
  | RBActions.RequestCleanup
  | RBActions.BlockSingleUser
  | RBActions.UnblockSingleUser

declare namespace RBMessages {
  interface ChainBlockInfo {
    messageType: 'ChainBlockInfo'
    infos: SessionInfo[]
  }

  interface MarkUser {
    messageType: 'MarkUser'
    userId: string
    verb: VerbSomething
  }

  interface MarkManyUsersAsBlocked {
    messageType: 'MarkManyUsersAsBlocked'
    userIds: string[]
  }

  interface PopupSwitchTab {
    messageType: 'PopupSwitchTab'
    page: PageEnum[keyof PageEnum]
  }

  interface Alert {
    messageType: 'Alert'
    message: string
  }

  interface ConfirmChainBlock {
    messageType: 'ConfirmChainBlock'
    confirmMessage: string
    action: RBActions.StartFollowerChainBlock | RBActions.StartTweetReactionChainBlock
  }

  interface ToggleOneClickBlockMode {
    messageType: 'ToggleOneClickBlockMode'
    enabled: boolean
  }
}

// content측으로 보내는 메시지
type RBMessage =
  | RBMessages.ChainBlockInfo
  | RBMessages.MarkUser
  | RBMessages.MarkManyUsersAsBlocked
  | RBMessages.PopupSwitchTab
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
