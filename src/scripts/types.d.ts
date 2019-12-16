type Action = typeof import('./common').Action
type SessionInfo = import('./background/chainblock-session').SessionInfo
type SessionRequest = import('./background/chainblock-session').SessionRequest
type TwitterUser = import('./background/twitter-api').TwitterUser

// ---- vendor modules ----
declare var _: typeof import('lodash')
declare var React: typeof import('react')
declare var ReactDOM: typeof import('react-dom')
declare var ReactTabs: typeof import('react-tabs')

type FollowKind = 'followers' | 'friends' | 'mutual-followers'
type ChainKind = 'chainblock' | 'unchainblock'

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

interface ChainParams {
  userName: string
  purpose: ChainKind
  targetList: FollowKind
  options: SessionRequest['options']
}

declare namespace RBActions {
  interface Start {
    action: Action['StartChainBlock']
    params: ChainParams
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
  infos: SessionInfo[]
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
