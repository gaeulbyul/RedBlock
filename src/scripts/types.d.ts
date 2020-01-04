type Action = typeof import('./common').Action
type PageEnum = typeof import('./common').PageEnum
type SessionInfo = import('./background/chainblock-session/session-common').SessionInfo
type FollowerBlockSessionRequest = import('./background/chainblock-session/follower').FollowerBlockSessionRequest
type TweetReactionBlockSessionRequest = import('./background/chainblock-session/tweet-reaction').TweetReactionBlockSessionRequest
type SessionRequest = import('./background/chainblock-session/session-common').SessionRequest
type TwitterUser = import('./background/twitter-api').TwitterUser

// ---- vendor modules ----
declare var _: typeof import('lodash')
declare var React: typeof import('react')
declare var ReactDOM: typeof import('react-dom')
declare var ReactTabs: typeof import('react-tabs')

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

interface FollowerChainParams {
  userName: string
  purpose: ChainKind
  targetList: FollowKind
  options: FollowerBlockSessionRequest['options']
}

interface TweetReactionChainParams {
  tweetId: string
  reaction: ReactionKind
  options: TweetReactionBlockSessionRequest['options']
}

declare namespace RBActions {
  interface StartFollowerChainBlock {
    action: Action['StartFollowerChainBlock']
    params: FollowerChainParams
  }

  interface StartTweetReactionChainBlock {
    action: Action['StartTweetReactionChainBlock']
    params: TweetReactionChainParams
  }

  interface Stop {
    action: Action['StopChainBlock']
    sessionId: string
  }

  interface StopAll {
    action: Action['StopAllChainBlock']
  }

  interface ConnectToBackground {
    action: Action['ConnectToBackground']
  }

  interface DisconnectToBackground {
    action: Action['DisconnectToBackground']
  }

  interface InsertUserToStorage {
    action: Action['InsertUserToStorage']
    user: TwitterUser
  }

  interface RemoveUserFromStorage {
    action: Action['RemoveUserFromStorage']
    user: TwitterUser
  }

  interface RequestProgress {
    action: Action['RequestProgress']
  }
}

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

interface RBChainBlockInfoMessage {
  messageType: 'ChainBlockInfoMessage'
  infos: SessionInfo[]
}

interface RBMarkUserMessage {
  messageType: 'MarkUserMessage'
  userId: string
  verb: VerbSomething
}

interface RBPopupSwitchTabMessage {
  messageType: 'PopupSwitchTabMessage'
  page: PageEnum[keyof PageEnum]
}

type RBMessage = RBChainBlockInfoMessage | RBMarkUserMessage | RBPopupSwitchTabMessage

interface MarkUserParams {
  userId: string
  verb: VerbSomething
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
