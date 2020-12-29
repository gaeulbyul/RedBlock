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
    return response.json()
  } else {
    throw new APIFailError('error', response)
  }
}

export async function getRateLimitStatus(): Promise<LimitStatus> {
  const response = await requestAPI('get', '/application/rate_limit_status.json')
  const { resources } = await response.json()
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
    // 2020-11-28
    // - include_entities:
    // 멘션한 유저 체인블락 기능을 구현하기 위해
    // entities 속성이 필요하다
    // - tweet_mode: 'extended'
    // 트윗이 길면 텍스트 뿐만 아니라 멘션한 유저도 적게 가져오더라.
    include_entities: true,
    tweet_mode: 'extended',
    include_ext_alt_text: false,
    include_card_uri: false,
  })
  if (response.ok) {
    return response.json()
  } else {
    throw new APIFailError('error', response)
  }
}

export async function getFollowsIds(
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
  return response.json()
}

export async function getFollowsUserList(
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
      count: 200,
      skip_status: false,
      include_user_entities: false,
      cursor,
    },
    actAsUserId
  )
  return response.json()
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
  return response.json()
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
  return response.json()
}

export async function getSingleUserByName(userName: string): Promise<TwitterUser> {
  const response = await requestAPI('get', '/users/show.json', {
    // user_id: user.id_str,
    screen_name: userName,
    skip_status: true,
    include_entities: false,
  })
  return response.json()
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
  return response.json()
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
  return response.json()
}

export async function getRelationship(
  sourceUser: TwitterUser,
  targetUser: TwitterUser
): Promise<Relationship> {
  const source_id = sourceUser.id_str
  const target_id = targetUser.id_str
  const response = await requestAPI('get', '/friendships/show.json', {
    source_id,
    target_id,
  })
  return (await response.json()).relationship
}

export async function getReactedUserList(
  reaction: ReactionKind,
  tweet: Tweet,
  cursor = '-1'
): Promise<UserListResponse> {
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
    return response.json()
  } else {
    throw new APIFailError('error', response)
  }
}

export async function getRetweetersIds(tweet: Tweet): Promise<UserIdsResponse> {
  const response = await requestAPI('get', '/statuses/retweeters/ids.json', {
    id: tweet.id_str,
    count: 100,
    // cursor: <- 한 번 요청에 최대치(100명)을 가져올 수 있으므로 굳이 cursor를 쓰는 의미가 없다.
    stringify_ids: true,
  })
  if (response.ok) {
    return response.json()
  } else {
    throw new APIFailError('error', response)
  }
}

export async function searchUsers(query: string, cursor?: string): Promise<APIv2Response> {
  const response = await requestAPIv2('get', '/search/adaptive.json', {
    q: query,
    result_filter: 'user',
    count: 200,
    query_source: 'typed_query',
    pc: 1,
    spelling_corrections: 0,
    cursor,
    // ext: 'mediaStats,highlightedLabel',
  })
  if (response.ok) {
    return response.json()
  } else {
    throw new APIFailError('error', response)
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

async function generateTwitterAPIOptions(
  obj: RequestInit,
  actAsUserId: string
): Promise<RequestInit> {
  const csrfToken = await getCsrfTokenFromCookies()
  const headers = new Headers()
  headers.set('authorization', `Bearer ${BEARER_TOKEN}`)
  headers.set('x-csrf-token', csrfToken)
  headers.set('x-twitter-active-user', 'yes')
  headers.set('x-twitter-auth-type', 'OAuth2Session')
  if (actAsUserId) {
    const extraCookies = await generateCookiesForAltAccountRequest(actAsUserId)
    const encodedExtraCookies = new URLSearchParams(
      (extraCookies as unknown) as Record<string, string>
    )
    headers.set('x-act-as-cookies', encodedExtraCookies.toString())
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

export async function getMultiAccountCookies(): Promise<MultiAccountCookies | null> {
  const url = 'https://twitter.com'
  const authMultiCookie = await browser.cookies.get({
    url,
    name: 'auth_multi',
  })
  if (!authMultiCookie) {
    return null
  }
  return parseAuthMultiCookie(authMultiCookie.value)
}

async function generateCookiesForAltAccountRequest(
  actAsUserId: string
): Promise<ActAsExtraCookies> {
  const url = 'https://twitter.com'
  const authMultiCookie = await getMultiAccountCookies()
  if (!authMultiCookie) {
    throw new Error(
      'auth_multi cookie unavailable. this feature requires logged in with two or more account.'
    )
  }
  const authTokenCookie = await browser.cookies
    .get({
      url,
      name: 'auth_token',
    })
    .then(coo => coo!.value)
  const twidCookie = await browser.cookies
    .get({
      url,
      name: 'twid',
    })
    .then(coo => /u%3D([0-9]+)\b/.exec(coo!.value)![1])
  const actAsUserToken = authMultiCookie![actAsUserId]
  // 새로 만들 auth_multi 쿠키엔 현재 계정인 twid를 넣고...
  // actAsUser가 될 유저를 뺀다.
  authMultiCookie[twidCookie] = authTokenCookie
  delete authMultiCookie[actAsUserId]
  const newAuthMultiCookie = Object.entries(authMultiCookie)
    .map(([key, value]) => `${key}:${value}`)
    .join('|')
  const newCookies = {
    auth_token: actAsUserToken,
    twid: `u%3D${actAsUserId}`,
    // auth_multi에서 "큰 따옴표"에 주의
    auth_multi: `"${newAuthMultiCookie}"`,
  }
  return newCookies
}

export function parseAuthMultiCookie(authMulti: string): MultiAccountCookies {
  // "{userid}:{token}|{userid}:{token}|..."
  const userTokenPairs = authMulti
    .replace(/^"|"$/g, '')
    .split('|')
    .map(pair => pair.split(':') as [string, string])
  return Object.fromEntries(userTokenPairs)
}

function prepareParams(params: URLSearchParams, additional: URLParamsObj = {}): void {
  setDefaultParams(params)
  for (const [key, value] of Object.entries(additional)) {
    if (value == null) {
      continue
    }
    params.set(key, value.toString())
  }
}

function prepareMoreParams(params: URLSearchParams) {
  params.set('include_can_media_tag', '1')
  params.set('skip_status', '1')
  params.set('cards_platform', 'Web-12')
  params.set('include_cards', '1')
  params.set('include_ext_alt_text', 'true')
  params.set('include_quote_count', 'true')
  params.set('include_reply_count', '1')
  params.set('tweet_mode', 'extended')
  params.set('include_entities', 'true')
  params.set('include_user_entities', 'true')
  params.set('include_ext_media_color', 'true')
  params.set('include_ext_media_availability', 'true')
  params.set('send_error_codes', 'true')
  params.set('simple_quoted_tweet', 'true')
}

export function getNextCursorFromAPIv2Response(response: APIv2Response): string | null {
  try {
    const { instructions } = response.timeline
    const entries: any[] = []
    for (const inst of instructions) {
      if ('addEntries' in inst) {
        entries.push(...inst.addEntries.entries)
      } else if ('replaceEntry' in inst) {
        entries.push(inst.replaceEntry.entry)
      }
    }
    entries.reverse()
    const bottomEntry = entries.find(entry => entry.entryId === 'sq-cursor-bottom')
    if (!bottomEntry) {
      return null
    }
    return bottomEntry.content.operation.cursor.value
  } catch (err) {
    console.warn('failed to find v2 cursor in %o', response)
    if (err instanceof TypeError) {
      return null
    } else {
      throw err
    }
  }
}

async function requestAPIv2(
  method: HTTPMethods,
  path: string,
  paramsObj: URLParamsObj = {}
): Promise<Response> {
  const fetchOptions = await generateTwitterAPIOptions({ method }, '')
  const url = new URL('https://twitter.com/i/api/2' + path)
  let params: URLSearchParams
  if (method === 'get') {
    params = url.searchParams
  } else {
    params = new URLSearchParams()
    fetchOptions.body = params
  }
  prepareParams(params, paramsObj)
  prepareMoreParams(params)
  const response = await fetch(url.toString(), fetchOptions)
  if (response.status === 429) {
    throw new RateLimitError('rate limited')
  } else if (!response.ok) {
    throw new APIFailError('api response is not ok', response)
  }
  return response
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
  prepareParams(params, paramsObj)
  const response = await fetch(url.toString(), fetchOptions)
  if (response.status === 429) {
    throw new RateLimitError('rate limited')
  } else if (!response.ok) {
    response
      .clone()
      .json()
      .then(
        json => {
          console.error('api error', json)
        },
        err => {
          console.error('unknown error', err)
        }
      )
    throw new APIFailError('api response is not ok', response)
  }
  return response
}

type HTTPMethods = 'get' | 'delete' | 'post' | 'put'
type URLParamsObj = { [key: string]: string | number | boolean | null | undefined }

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
  location: string
  status?: Tweet
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

export interface UserListResponse {
  next_cursor_str: string
  users: TwitterUser[]
}

export interface UserIdsResponse {
  next_cursor_str: string
  ids: string[]
}

export interface Tweet {
  id_str: string
  // conversation_id_str: string
  user: TwitterUser
  // 트윗이 140자 넘으면 얘가 undefined로 나오더라.
  // text: string
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
  quoted_status?: Tweet
  quoted_status_permalink?: {
    // url, display
    expanded: string
  }
  in_reply_to_status_id_str?: string
  in_reply_to_user_id_str?: string
  in_reply_to_screen_name?: string
  entities: {
    user_mentions?: UserMentionEntity[]
  }
}

interface UserMentionEntity {
  id_str: string
  name: string
  screen_name: string
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
  users: {
    '/users/lookup': Limit
  }
  search: {
    '/search/adaptive': Limit
  }
}

export interface MultiAccountCookies {
  [userId: string]: string
}

export interface ActAsExtraCookies {
  auth_token: string
  auth_multi: string
  twid: string
}

export interface APIv2Response {
  globalObjects: {
    tweets: { [tweetId: string]: Tweet }
    users: { [userId: string]: TwitterUser }
  }
  timeline: {
    // TODO
    id: string
    instructions: any[]
  }
}
