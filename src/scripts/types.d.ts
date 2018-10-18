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

interface BlockAllResult {
  blocked: string[],
  failed: string[]
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
    '/blocks/create': Limit,
    '/blocks/destroy': Limit,
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
  action: Action.Start,
  userName: string
}

interface RBStopMessage {
  action: Action.Stop
}

interface RBConfirmMessage {
  action: Action.ConfirmChainBlock
}

interface RBNotifyMessage {
  action: Action.ShowNotify,
  title: string,
  message: string
}

type RBMessage = RBStartMessage
  | RBStopMessage
  | RBConfirmMessage
  | RBNotifyMessage

declare namespace uuid {
  function v1 (): string;
}
