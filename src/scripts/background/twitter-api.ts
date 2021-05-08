import { getAllCookies, generateCookiesForAltAccountRequest } from './cookie-handler.js'

const BEARER_TOKEN = `AAAAAAAAAAAAAAAAAAAAANRILgAAAAAAnNwIzUejRCOuH5E6I8xnZz4puTs%3D1Zv7ttfk8LF81IUq16cHjhLTvJu4FA33AGWWjCpTnA`

interface TwClientOptions extends CookieOptions {
  // prefix: 'api.twitter.com' | 'twitter.com'
}

interface ErrorResponseItem {
  code: number
  message: string
}

interface ErrorResponse {
  errors: ErrorResponseItem[]
}

type GetMultipleUsersOption = { user_id: string[] } | { screen_name: string[] }
type GetSingleUserOption = { user_id: string } | { screen_name: string }

export class TwClient {
  public prefix = 'api.twitter.com'
  // prefix = 'twitter.com/i/api'
  public constructor(private options: TwClientOptions) {}
  public get cookieOptions(): CookieOptions {
    const { actAsUserId, cookieStoreId } = this.options
    return { actAsUserId, cookieStoreId }
  }
  public async getMyself(): Promise<TwitterUser> {
    return await this.request1('get', '/account/verify_credentials.json')
  }
  public async getRateLimitStatus(): Promise<LimitStatus> {
    const response = await this.request1('get', '/application/rate_limit_status.json')
    return response.resources
  }
  public async blockUser(user: TwitterUser): Promise<TwitterUser> {
    if (user.blocking) {
      return user
    }
    return await this.request1('post', '/blocks/create.json', {
      user_id: user.id_str,
      include_entities: false,
      skip_status: true,
    })
  }
  public async unblockUser(user: TwitterUser): Promise<TwitterUser> {
    if (!user.blocking) {
      return user
    }
    return await this.request1('post', '/blocks/destroy.json', {
      user_id: user.id_str,
      include_entities: false,
      skip_status: true,
    })
  }
  public async muteUser(user: TwitterUser): Promise<TwitterUser> {
    if (user.muting) {
      return user
    }
    return await this.request1('post', '/mutes/users/create.json', {
      user_id: user.id_str,
    })
  }
  public async unmuteUser(user: TwitterUser): Promise<TwitterUser> {
    if (!user.muting) {
      return user
    }
    return await this.request1('post', '/mutes/users/destroy.json', {
      user_id: user.id_str,
    })
  }
  public async unfollowUser(user: TwitterUser): Promise<TwitterUser> {
    if (!user.following) {
      return user
    }
    return await this.request1('post', '/friendships/destroy.json', {
      user_id: user.id_str,
    })
  }
  public async getTweetById(tweetId: string): Promise<Tweet> {
    return await this.request1('get', '/statuses/show.json', {
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
  }
  public async getFollowsIds(
    followKind: FollowKind,
    user: TwitterUser,
    cursor = '-1'
  ): Promise<UserIdsResponse> {
    return await this.request1('get', `/${followKind}/ids.json`, {
      user_id: user.id_str,
      stringify_ids: true,
      count: 5000,
      cursor,
    })
  }
  public async getFollowsUserList(
    followKind: FollowKind,
    user: TwitterUser,
    cursor = '-1'
  ): Promise<UserListResponse> {
    return await this.request1('get', `/${followKind}/list.json`, {
      user_id: user.id_str,
      count: 200,
      skip_status: false,
      include_user_entities: false,
      cursor,
    })
  }
  public async getMultipleUsers(options: GetMultipleUsersOption): Promise<TwitterUser[]> {
    const user_id = 'user_id' in options ? options.user_id : []
    const screen_name = 'screen_name' in options ? options.screen_name : []
    if (user_id.length <= 0 && screen_name.length <= 0) {
      console.warn('warning: empty user_id/screen_name')
      return []
    }
    if (user_id.length > 100 || screen_name.length > 100) {
      throw new Error('too many users! (> 100)')
    }
    const requestParams: URLParamsObj = {}
    if (user_id.length > 0) {
      requestParams.user_id = user_id
    } else if (screen_name.length > 0) {
      requestParams.screen_name = screen_name
    } else {
      throw new Error('unreachable')
    }
    return await this.request1('get', '/users/lookup.json', requestParams)
  }
  public async getSingleUser(options: GetSingleUserOption): Promise<TwitterUser> {
    const requestParams: URLParamsObj = {
      skip_status: true,
      include_entities: false,
    }
    if ('user_id' in options) {
      requestParams.user_id = options.user_id
    } else if ('screen_name' in options) {
      requestParams.screen_name = options.screen_name
    }
    return await this.request1('get', '/users/show.json', requestParams)
  }

  public async getFriendships(users: TwitterUser[]): Promise<FriendshipResponse> {
    const userIds = users.map(user => user.id_str)
    if (userIds.length === 0) {
      return []
    }
    if (userIds.length > 100) {
      throw new Error('too many users! (> 100)')
    }
    return await this.request1('get', '/friendships/lookup.json', {
      user_id: userIds,
    })
  }

  public async getRelationship(
    sourceUser: TwitterUser,
    targetUser: TwitterUser
  ): Promise<Relationship> {
    const source_id = sourceUser.id_str
    const target_id = targetUser.id_str
    const response = await this.request1('get', '/friendships/show.json', {
      source_id,
      target_id,
    })
    return response.relationship
  }

  public async getReactedUserList(
    reaction: ReactionKind,
    tweet: Tweet,
    cursor = '-1'
  ): Promise<UserListResponse> {
    let requestPath = ''
    switch (reaction) {
      case 'retweeted':
        requestPath = '/statuses/retweeted_by.json'
        break
      case 'liked':
        requestPath = '/statuses/favorited_by.json'
        break
    }
    return await this.request1('get', requestPath, {
      id: tweet.id_str,
      count: 200,
      cursor,
    })
  }

  public async getRetweetersIds(tweet: Tweet): Promise<UserIdsResponse> {
    return await this.request1('get', '/statuses/retweeters/ids.json', {
      id: tweet.id_str,
      count: 100,
      // cursor: <- 한 번 요청에 최대치(100명)을 가져올 수 있으므로 굳이 cursor를 쓰는 의미가 없다.
      stringify_ids: true,
    })
  }

  public async getBlockedUsersIds(cursor = '-1'): Promise<UserIdsResponse> {
    return await this.request1('get', '/blocks/ids.json', {
      stringify_ids: true,
      cursor,
    })
  }

  public async searchUsers(query: string, cursor?: string): Promise<APIv2Response> {
    return await this.request2('get', '/search/adaptive.json', {
      q: query,
      result_filter: 'user',
      count: 200,
      query_source: 'typed_query',
      pc: 1,
      spelling_corrections: 0,
      cursor,
      // ext: 'mediaStats,highlightedLabel',
    })
  }
  public async searchQuotedUsers(tweetId: string, cursor?: string): Promise<APIv2Response> {
    return await this.request2('get', '/search/adaptive.json', {
      q: `quoted_tweet_id:${tweetId}`,
      vertial: 'tweet_detail_quote',
      count: 200,
      pc: 1,
      spelling_corrections: 0,
      cursor,
    })
  }
  private async sendRequest(request: RequestInit, url: URL) {
    let newCsrfToken = ''
    let maxRetryCount = 3
    while (maxRetryCount-- > 0) {
      if (newCsrfToken) {
        insertHeader(request.headers!, 'x-redblock-override-ct0', newCsrfToken)
      }
      const response = await fetch(url.toString(), request)
      const responseJson = await response.json()
      if (response.ok) {
        return responseJson
      } else {
        if (!newCsrfToken) {
          newCsrfToken = response.headers.get('x-redblock-new-ct0') || ''
          if (newCsrfToken) {
            continue
          }
        }
        return Promise.reject(responseJson as Promise<ErrorResponse>)
      }
    }
  }
  private async request1(method: HTTPMethods, path: string, paramsObj: URLParamsObj = {}) {
    const fetchOptions = await generateTwitterAPIOptions({ method }, this.cookieOptions)
    const url = new URL(`https://${this.prefix}` + '/1.1' + path)
    let params: URLSearchParams
    if (method === 'get') {
      params = url.searchParams
    } else {
      params = new URLSearchParams()
      fetchOptions.body = params
    }
    prepareParams(params, paramsObj)
    // 파이어폭스 외의 다른 브라우저에선 webRequest의 request details에서 cookieStoreId 속성이 없다.
    // 따라서 헤더를 통해 알아낼 수 있도록 여기서 헤더를 추가한다.
    if (path === '/blocks/create.json') {
      insertHeader(
        fetchOptions.headers!,
        'x-redblock-cookie-store-id',
        this.cookieOptions.cookieStoreId
      )
    }
    return this.sendRequest(fetchOptions, url)
  }
  private async request2(method: HTTPMethods, path: string, paramsObj: URLParamsObj = {}) {
    const fetchOptions = await generateTwitterAPIOptions({ method }, this.cookieOptions)
    const url = new URL(`https://${this.prefix}` + '/2' + path)
    let params: URLSearchParams
    if (method === 'get') {
      params = url.searchParams
    } else {
      params = new URLSearchParams()
      fetchOptions.body = params
    }
    prepareParams(params, paramsObj)
    prepareMoreParams(params)
    return this.sendRequest(fetchOptions, url)
  }
}

function insertHeader(
  headers: Headers | Record<string, string> | string[][],
  name: string,
  value: string
) {
  if (headers instanceof Headers) {
    headers.set(name, value)
  } else if (Array.isArray(headers)) {
    headers.push([name, value])
  } else {
    headers[name] = value
  }
}
async function generateTwitterAPIOptions(
  obj: RequestInit,
  cookieOptions: CookieOptions
): Promise<RequestInit> {
  const headers = new Headers()
  // x-csrf-token 헤더는 webrequest.ts 에서 채워줌
  headers.set('authorization', `Bearer ${BEARER_TOKEN}`)
  headers.set('x-twitter-active-user', 'yes')
  headers.set('x-twitter-auth-type', 'OAuth2Session')
  headers.set('x-redblock-request', 'UwU')
  const storeId = cookieOptions.cookieStoreId
  // 컨테이너 탭의 인증정보를 담아 요청하기 위해 덮어씌우는 쿠키
  const cookies = await getAllCookies({ storeId })
  headers.set(
    'x-redblock-override-cookies',
    cookies.map(({ name, value }) => `${name}=${value}`).join('; ')
  )
  // 다계정 로그인 관련
  if (cookieOptions.actAsUserId) {
    const extraCookies = await generateCookiesForAltAccountRequest(cookieOptions)
    const encodedExtraCookies = new URLSearchParams(
      (extraCookies as unknown) as Record<string, string>
    )
    headers.set('x-redblock-act-as-cookies', encodedExtraCookies.toString())
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
  params.set('include_quote_count', '1')
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

export class RateLimitError extends Error {
  public constructor(message: string, public readonly response?: Response) {
    super(message)
  }
}

type HTTPMethods = 'get' | 'delete' | 'post' | 'put'
type URLParamsObj = {
  [key: string]: string | number | boolean | null | undefined | string[] | number[]
}

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
  display_text_range: [number, number]
  quote_count: number
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

export interface APIv2Response {
  globalObjects: {
    tweets: { [tweetId: string]: Tweet }
    users: { [userId: string]: TwitterUser }
  }
  timeline: {
    id: string
    instructions: any[]
  }
}
