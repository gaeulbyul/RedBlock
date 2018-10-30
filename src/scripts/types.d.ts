type HTTPMethods = 'get' | 'delete' | 'post' | 'put'
type URLParamsObj = { [key: string]: string | number | boolean }

interface TwitterUser {
  id_str: string,
  screen_name: string,
  name: string,
  blocked_by: boolean,
  blocking: boolean,
  muting: boolean,
  followed_by: boolean,
  following: boolean,
  follow_request_sent: boolean,
  friends_count: number,
  followers_count: number,
  protected: boolean,
  verified: boolean,
  created_at: string, // datetime example: 'Sun Jun 29 05:52:09 +0000 2014'
  description: string
}

interface FollowsListResponse {
  next_cursor_str: string,
  users: TwitterUser[]
}

interface FollowsIdsResponse {
  next_cursor_str: string,
  ids: string[]
}

interface FollowsScraperOptions {
  delay: number
}

interface Limit {
  limit: number,
  remaining: number,
  reset: number
}

interface LimitStatus {
  application: {
    '/application/rate_limit_status': Limit
  },
  blocks: {
    // note: POST API (create, destroy) not exists.
    '/blocks/list': Limit,
    '/blocks/ids': Limit
  },
  followers: {
    '/followers/ids': Limit,
    '/followers/list': Limit
  },
  friends: {
    '/friends/list': Limit,
    '/friends/ids': Limit
  }
}

type RateLimited<T> = T | 'RateLimitError'

interface EventStore {
  [eventName: string]: Function[]
}

interface RBStartMessage {
  action: Action.StartChainBlock,
  userName: string
}

interface RBStopMessage {
  action: Action.StopChainBlock
}

interface RBConfirmMessage {
  action: Action.ConfirmChainBlock
}

interface RBNotifyMessage {
  action: Action.ShowNotify,
  notification: BrowserNotification | { message: string }
}

type RBMessage =
  | RBStartMessage
  | RBStopMessage
  | RBConfirmMessage
  | RBNotifyMessage

declare namespace uuid {
  function v1 (): string
}
