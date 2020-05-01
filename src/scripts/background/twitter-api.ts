import { sleep, collectAsync, unwrap, wrapEither } from '../common.js'

const DELAY = 200
const BEARER_TOKEN = `AAAAAAAAAAAAAAAAAAAAANRILgAAAAAAnNwIzUejRCOuH5E6I8xnZz4puTs%3D1Zv7ttfk8LF81IUq16cHjhLTvJu4FA33AGWWjCpTnA`

export class RateLimitError extends Error {
  public constructor(message: string, public readonly response?: Response) {
    super(message)
  }
}

export class APIFailError extends Error {
  public constructor(message: string, public readonly response?: Response) {
    super(message)
  }
}

export async function getMyself(): Promise<TwitterUser> {
  const response = await requestAPI('get', '/account/verify_credentials.json')
  if (response.ok) {
    return response.json() as Promise<TwitterUser>
  } else {
    throw new APIFailError('error', response)
  }
}

export async function getRateLimitStatus(): Promise<LimitStatus> {
  const response = await requestAPI('get', '/application/rate_limit_status.json')
  const resources = (await response.json()).resources as LimitStatus
  return resources
}

export async function blockUser(user: TwitterUser) {
  if (user.blocking) {
    return true
  }
  const response = await requestAPI('post', '/blocks/create.json', {
    user_id: user.id_str,
    include_entities: false,
    skip_status: true,
  })
  if (response.ok) {
    return true
  } else {
    throw new APIFailError('error', response)
  }
}

export async function unblockUser(user: TwitterUser) {
  if (!user.blocking) {
    return true
  }
  const response = await requestAPI('post', '/blocks/destroy.json', {
    user_id: user.id_str,
    include_entities: false,
    skip_status: true,
  })
  if (response.ok) {
    return true
  } else {
    throw new APIFailError('error', response)
  }
}

export async function muteUser(user: TwitterUser) {
  if (user.muting) {
    return true
  }
  const response = await requestAPI('post', '/mutes/users/create.json', {
    user_id: user.id_str,
  })
  if (response.ok) {
    return true
  } else {
    throw new APIFailError('error', response)
  }
}

export async function unmuteUser(user: TwitterUser) {
  if (!user.muting) {
    return true
  }
  const response = await requestAPI('post', '/mutes/users/destroy.json', {
    user_id: user.id_str,
  })
  if (response.ok) {
    return true
  } else {
    throw new APIFailError('error', response)
  }
}

export async function getTweetById(tweetId: string): Promise<Tweet> {
  const response = await requestAPI('get', '/statuses/show.json', {
    id: tweetId,
    include_entities: false,
    include_ext_alt_text: false,
    include_card_uri: false,
  })
  if (response.ok) {
    return response.json() as Promise<Tweet>
  } else {
    throw new APIFailError('error', response)
  }
}

async function getFollowsIds(
  followKind: FollowKind,
  user: TwitterUser,
  cursor = '-1',
  actAsUserId = ''
): Promise<UserIdsResponse> {
  const response = await requestAPI(
    'get',
    `/${followKind}/ids.json`,
    {
      user_id: user.id_str,
      stringify_ids: true,
      count: 5000,
      cursor,
    },
    actAsUserId
  )
  return response.json() as Promise<UserIdsResponse>
}

export async function* getAllFollowsIds(
  followKind: FollowKind,
  user: TwitterUser,
  actAsUserId = ''
): AsyncIterableIterator<Either<Error, string>> {
  let cursor = '-1'
  while (true) {
    try {
      const json = await getFollowsIds(followKind, user, cursor, actAsUserId)
      cursor = json.next_cursor_str
      yield* json.ids.map(wrapEither)
      if (cursor === '0') {
        break
      } else {
        await sleep(DELAY)
        continue
      }
    } catch (error) {
      yield {
        ok: false,
        error,
      }
    }
  }
}

async function getFollowsUserList(
  followKind: FollowKind,
  user: TwitterUser,
  cursor = '-1',
  actAsUserId = ''
): Promise<UserListResponse> {
  const response = await requestAPI(
    'get',
    `/${followKind}/list.json`,
    {
      user_id: user.id_str,
      // screen_name: userName,
      count: 200,
      skip_status: true,
      include_user_entities: false,
      cursor,
    },
    actAsUserId
  )
  return response.json() as Promise<UserListResponse>
}

export async function* getAllFollowsUserList(
  followKind: FollowKind,
  user: TwitterUser,
  actAsUserId = ''
): AsyncIterableIterator<Either<Error, TwitterUser>> {
  let cursor = '-1'
  while (true) {
    try {
      const json = await getFollowsUserList(followKind, user, cursor, actAsUserId)
      cursor = json.next_cursor_str
      yield* json.users.map(wrapEither)
      if (cursor === '0') {
        break
      } else {
        await sleep(DELAY)
        continue
      }
    } catch (error) {
      yield {
        ok: false,
        error,
      }
    }
  }
}

export async function getAllMutualFollowersIds(user: TwitterUser, actAsUserId = ''): Promise<string[]> {
  const followingsIds = (await collectAsync(getAllFollowsIds('friends', user, actAsUserId))).map(unwrap)
  const followersIds = (await collectAsync(getAllFollowsIds('followers', user, actAsUserId))).map(unwrap)
  const mutualIds = _.intersection(followingsIds, followersIds)
  return mutualIds
}

export async function* lookupUsersByIds(userIds: string[]): AsyncIterableIterator<Either<Error, TwitterUser>> {
  const chunks = _.chunk(userIds, 100)
  for (const chunk of chunks) {
    const mutualUsers = await getMultipleUsersById(chunk)
    yield* mutualUsers.map(user => ({
      ok: true as const,
      value: user,
    }))
  }
}

export async function getMultipleUsersById(userIds: string[]): Promise<TwitterUser[]> {
  if (userIds.length === 0) {
    return []
  }
  if (userIds.length > 100) {
    throw new Error('too many users! (> 100)')
  }
  const joinedIds = Array.from(new Set(userIds)).join(',')
  const response = await requestAPI('get', '/users/lookup.json', {
    user_id: joinedIds,
  })
  return response.json() as Promise<TwitterUser[]>
}

export async function getMultipleUsersByName(userNames: string[]): Promise<TwitterUser[]> {
  if (userNames.length === 0) {
    return []
  }
  if (userNames.length > 100) {
    throw new Error('too many users! (> 100)')
  }
  const joinedNames = Array.from(new Set(userNames)).join(',')
  const response = await requestAPI('get', '/users/lookup.json', {
    screen_name: joinedNames,
  })
  return response.json() as Promise<TwitterUser[]>
}

export async function getSingleUserByName(userName: string): Promise<TwitterUser> {
  const response = await requestAPI('get', '/users/show.json', {
    // user_id: user.id_str,
    screen_name: userName,
    skip_status: true,
    include_entities: false,
  })
  return response.json() as Promise<TwitterUser>
}

export async function getSingleUserById(userId: string, actAsUserId = ''): Promise<TwitterUser> {
  const response = await requestAPI(
    'get',
    '/users/show.json',
    {
      user_id: userId,
      skip_status: true,
      include_entities: false,
    },
    actAsUserId
  )
  return response.json() as Promise<TwitterUser>
}

export async function getFriendships(users: TwitterUser[]): Promise<FriendshipResponse> {
  const userIds = users.map(user => user.id_str)
  if (userIds.length === 0) {
    return []
  }
  if (userIds.length > 100) {
    throw new Error('too many users! (> 100)')
  }
  const joinedIds = Array.from(new Set(userIds)).join(',')
  const response = await requestAPI('get', '/friendships/lookup.json', {
    user_id: joinedIds,
  })
  return response.json() as Promise<FriendshipResponse>
}

export async function getRelationship(sourceUser: TwitterUser, targetUser: TwitterUser): Promise<Relationship> {
  const source_id = sourceUser.id_str
  const target_id = targetUser.id_str
  const response = await requestAPI('get', '/friendships/show.json', {
    source_id,
    target_id,
  })
  return (await response.json()).relationship as Promise<Relationship>
}

async function getReactedUserList(reaction: ReactionKind, tweet: Tweet, cursor = '-1'): Promise<UserListResponse> {
  let reactionPath = ''
  switch (reaction) {
    case 'retweeted':
      reactionPath = '/statuses/retweeted_by.json'
      break
    case 'liked':
      reactionPath = '/statuses/favorited_by.json'
      break
  }
  const response = await requestAPI('get', reactionPath, {
    id: tweet.id_str,
    count: 200,
    cursor,
  })
  if (response.ok) {
    return response.json() as Promise<UserListResponse>
  } else {
    throw new APIFailError('error', response)
  }
}

export async function* getAllReactedUserList(
  reaction: ReactionKind,
  tweet: Tweet
): AsyncIterableIterator<Either<Error, TwitterUser>> {
  let cursor = '-1'
  while (true) {
    try {
      const json = await getReactedUserList(reaction, tweet, cursor)
      cursor = json.next_cursor_str
      yield* json.users.map(wrapEither)
      if (cursor === '0') {
        break
      } else {
        await sleep(DELAY)
        continue
      }
    } catch (error) {
      yield {
        ok: false,
        error,
      }
    }
  }
}

async function getCsrfTokenFromCookies(): Promise<string> {
  const csrfTokenCookie = await browser.cookies.get({
    url: 'https://twitter.com',
    name: 'ct0',
  })
  if (!csrfTokenCookie) {
    throw new Error('failed to get csrf token!')
  }
  return csrfTokenCookie.value
}

async function generateTwitterAPIOptions(obj: RequestInit, actAsUserId: string): Promise<RequestInit> {
  const csrfToken = await getCsrfTokenFromCookies()
  const headers = new Headers()
  headers.set('authorization', `Bearer ${BEARER_TOKEN}`)
  headers.set('x-csrf-token', csrfToken)
  headers.set('x-twitter-active-user', 'yes')
  headers.set('x-twitter-auth-type', 'OAuth2Session')
  if (actAsUserId) {
    const multiCookies = await getMultiAccountCookies()
    const token = multiCookies[actAsUserId]
    headers.set('x-act-as-user-id', actAsUserId)
    headers.set('x-act-as-user-token', token)
  }
  const result: RequestInit = {
    method: 'get',
    mode: 'cors',
    credentials: 'include',
    referrer: 'https://twitter.com/',
    headers,
  }
  Object.assign(result, obj)
  return result
}

function setDefaultParams(params: URLSearchParams): void {
  params.set('include_profile_interstitial_type', '1')
  params.set('include_blocking', '1')
  params.set('include_blocked_by', '1')
  params.set('include_followed_by', '1')
  params.set('include_want_retweets', '1')
  params.set('include_mute_edge', '1')
  params.set('include_can_dm', '1')
}

export async function getMultiAccountCookies(): Promise<MultiAccountCookies> {
  const url = 'https://twitter.com'
  const authMultiCookie = await browser.cookies.get({
    url,
    name: 'auth_multi',
  })
  if (!authMultiCookie) {
    return {}
  }
  return parseAuthMultiCookie(authMultiCookie.value)
}

export function parseAuthMultiCookie(authMulti: string): MultiAccountCookies {
  // "{userid}:{token}|{userid}:{token}|..."
  const userTokenPairs = authMulti
    .replace(/^"|"$/g, '')
    .split('|')
    .map(pair => pair.split(':') as [string, string])
  return Object.fromEntries(userTokenPairs)
}

async function requestAPI(
  method: HTTPMethods,
  path: string,
  paramsObj: URLParamsObj = {},
  actAsUserId = ''
): Promise<Response> {
  const fetchOptions = await generateTwitterAPIOptions({ method }, actAsUserId)
  const url = new URL('https://api.twitter.com/1.1' + path)
  let params: URLSearchParams
  if (method === 'get') {
    params = url.searchParams
  } else {
    params = new URLSearchParams()
    fetchOptions.body = params
  }
  setDefaultParams(params)
  for (const [key, value] of Object.entries(paramsObj)) {
    params.set(key, value.toString())
  }
  const response = await fetch(url.toString(), fetchOptions)
  if (response.status === 429) {
    throw new RateLimitError('rate limited')
  } else if (!response.ok) {
    throw new APIFailError('api response is not ok', response)
  }
  return response
}

type HTTPMethods = 'get' | 'delete' | 'post' | 'put'
type URLParamsObj = { [key: string]: string | number | boolean }

export interface TwitterUser {
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

export type TwitterUserEntities = Record<string, TwitterUser>

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

interface UserListResponse {
  next_cursor_str: string
  users: TwitterUser[]
}

interface UserIdsResponse {
  next_cursor_str: string
  ids: string[]
}

export interface Tweet {
  id_str: string
  // conversation_id_str: string
  user: TwitterUser
  text: string
  full_text: string
  lang: string
  source: string
  source_name: string
  source_url: string
  // possibly_sensitive_editable: boolean
  // user_id_str: string
  created_at: string
  reply_count: number
  retweet_count: number
  favorite_count: number
  favorited: boolean
  retweeted: boolean
  is_quote_status: boolean
  in_reply_to_status_id_str?: string
  in_reply_to_user_id_str?: string
  in_reply_to_screen_name?: string
}

export interface Limit {
  limit: number
  remaining: number
  reset: number
}

export interface LimitStatus {
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
  statuses: {
    '/statuses/retweeted_by': Limit
    '/statuses/retweeters/ids': Limit
    '/statuses/retweets/:id': Limit
    '/statuses/favorited_by': Limit
  }
}

export interface MultiAccountCookies {
  [userId: string]: string
}
