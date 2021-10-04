import {
  getAllCookies,
  getDefaultCookieStoreId,
  generateCookiesForAltAccountRequest,
} from './cookie-handler'
import { stripSensitiveInfo } from '../common'

const BEARER_TOKEN = `AAAAAAAAAAAAAAAAAAAAANRILgAAAAAAnNwIzUejRCOuH5E6I8xnZz4puTs%3D1Zv7ttfk8LF81IUq16cHjhLTvJu4FA33AGWWjCpTnA`
const TD_BEARER_TOKEN = `AAAAAAAAAAAAAAAAAAAAAF7aAAAAAAAASCiRjWvh7R5wxaKkFp7MM%2BhYBqM%3DbQ0JPmjU9F6ZoMhDfI4uTNAaQuTDm2uO9x3WFVr2xBZ2nhjdP0`
// const TD2_BEARER_TOKEN = `AAAAAAAAAAAAAAAAAAAAAFQODgEAAAAAVHTp76lzh3rFzcHbmHVvQxYYpTw%3DckAlMINMjmCwxUcaXbAN4XqJVdgMJaHqNOFgPMK0zN1qLqLQCF`

const gqlDataMap = new Map<string, GraphQLQueryData>()
function stripSensitiveInfoFromArrayOfUsers(users: TwitterUser[]): TwitterUser[] {
  return users.map(stripSensitiveInfo)
}

function stripSensitiveInfoFromResponse(response: UserListResponse): UserListResponse {
  return {
    users: stripSensitiveInfoFromArrayOfUsers(response.users),
    next_cursor_str: response.next_cursor_str,
  }
}

export class TwClient {
  public prefix = 'api.twitter.com'
  // prefix = 'twitter.com/i/api'
  public constructor(private readonly ctorOptions: TwClientOptions) {}
  public get options(): TwClientOptions {
    const { actAsUserId, cookieStoreId, asTweetDeck } = this.ctorOptions
    return { actAsUserId, cookieStoreId, asTweetDeck }
  }

  public async getMyself(): Promise<TwitterUser> {
    return await this.request1('get', '/account/verify_credentials.json').then(stripSensitiveInfo)
  }

  public async getRateLimitStatus(): Promise<LimitStatus> {
    const response = await this.request1('get', '/application/rate_limit_status.json')
    return response.resources
  }

  public async blockUser(user: TwitterUser): Promise<TwitterUser> {
    if (user.blocking) {
      return user
    }
    return this.blockUserById(user.id_str)
  }

  public async unblockUser(user: TwitterUser): Promise<TwitterUser> {
    if (!user.blocking) {
      return user
    }
    return this.unblockUserById(user.id_str)
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

  public async blockUserById(userId: string): Promise<TwitterUser> {
    return await this.request1('post', '/blocks/create.json', {
      user_id: userId,
      include_entities: false,
      skip_status: true,
    })
  }

  public async unblockUserById(userId: string): Promise<TwitterUser> {
    return await this.request1('post', '/blocks/destroy.json', {
      user_id: userId,
      include_entities: false,
      skip_status: true,
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
    }).then(stripSensitiveInfoFromResponse)
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
    return await this.request1('get', '/users/lookup.json', requestParams).then(
      stripSensitiveInfoFromArrayOfUsers
    )
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
    return await this.request1('get', '/users/show.json', requestParams).then(stripSensitiveInfo)
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
    }).then(stripSensitiveInfoFromResponse)
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
      vertical: 'tweet_detail_quote',
      count: 200,
      pc: 1,
      spelling_corrections: 0,
      cursor,
    })
  }

  public async getAudioSpaceById(spaceId: string): Promise<AudioSpace> {
    const queryData = await getQueryDataByOperationName('AudioSpaceById')
    return await this.requestGraphQL(queryData, {
      id: spaceId,
      isMetatagsQuery: false,
      withTweetResult: true,
      withReactions: true,
      withSuperFollowsTweetFields: true,
      withSuperFollowsUserFields: true,
      withUserResults: true,
      withBirdwatchPivots: true,
      withScheduledSpaces: true,
    }).then(response => {
      const { audioSpace } = response.data
      if ('metadata' in audioSpace) {
        return audioSpace
      } else {
        throw new Error("This space is expired or doesn't exists.")
      }
    })
  }

  public async getTweetReactionV2Timeline(tweet: Tweet): Promise<ReactionV2Timeline> {
    const queryData = await getQueryDataByOperationName('GetTweetReactionTimeline')
    return await this.requestGraphQL(queryData, {
      tweetId: tweet.id_str,
      withHighlightedLabel: false,
      withSuperFollowsUserFields: false,
    }).then(response => response.data.tweet_result_by_rest_id.result.reaction_timeline)
  }

  public async getTweetDeckContributees(): Promise<Contributee[]> {
    if (!this.options.asTweetDeck) {
      throw new Error('this should call from tweetdeck')
    }
    return await this.request1('get', '/users/contributees.json')
  }

  public async removeFollower(user: TwitterUser) {
    const queryData = await getQueryDataByOperationName('RemoveFollower')
    return await this.requestGraphQL(queryData, {
      target_user_id: user.id_str,
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
    const fetchOptions = await prepareTwitterRequest({ method }, this.options)
    const url = new URL(`https://${this.prefix}/1.1${path}`)
    let params: URLSearchParams
    if (method === 'get') {
      params = url.searchParams
    } else {
      params = new URLSearchParams()
      fetchOptions.body = params
    }
    prepareParams(params, paramsObj)
    const cookieStoreId = this.options.cookieStoreId || (await getDefaultCookieStoreId())
    // 파이어폭스 외의 다른 브라우저에선 webRequest의 request details에서 cookieStoreId 속성이 없다.
    // 따라서 헤더를 통해 알아낼 수 있도록 여기서 헤더를 추가한다.
    if (path === '/blocks/create.json') {
      insertHeader(fetchOptions.headers!, 'x-redblock-cookie-store-id', cookieStoreId)
    }
    return this.sendRequest(fetchOptions, url)
  }

  private async request2(method: HTTPMethods, path: string, paramsObj: URLParamsObj = {}) {
    const fetchOptions = await prepareTwitterRequest({ method }, this.options)
    const url = new URL(`https://${this.prefix}/2${path}`)
    let params: URLSearchParams
    if (method === 'get') {
      params = url.searchParams
    } else {
      params = new URLSearchParams()
      fetchOptions.body = params
    }
    prepareParams(params, paramsObj)
    return this.sendRequest(fetchOptions, url)
  }

  private async requestGraphQL(
    { queryId, operationName, operationType }: GraphQLQueryData,
    variables: URLParamsObj = {}
  ) {
    const method = operationType === 'query' ? 'get' : 'post'
    const fetchOptions = await prepareTwitterRequest({ method }, this.options)
    const url = new URL(`https://${this.prefix}/graphql/${queryId}/${operationName}`)
    const encodedVariables = JSON.stringify(variables)
    if (method === 'get') {
      url.searchParams.set('variables', encodedVariables)
    } else {
      const headers = fetchOptions.headers as Headers
      headers.set('content-type', 'application/json')
      fetchOptions.body = JSON.stringify({
        queryId,
        variables: encodedVariables,
      })
    }
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
async function prepareTwitterRequest(
  obj: RequestInit,
  clientOptions: TwClientOptions
): Promise<RequestInit> {
  const headers = new Headers()
  // x-csrf-token 헤더는 webrequest.ts 에서 채워줌
  if (clientOptions.asTweetDeck) {
    headers.set('authorization', `Bearer ${TD_BEARER_TOKEN}`)
    headers.set(
      'x-twitter-client-version',
      'Twitter-TweetDeck-blackbird-chrome/4.0.200604103812 web/'
    )
  } else {
    headers.set('authorization', `Bearer ${BEARER_TOKEN}`)
  }
  headers.set('x-twitter-active-user', 'yes')
  headers.set('x-twitter-auth-type', 'OAuth2Session')
  headers.set('x-redblock-request', 'UwU')
  const storeId = clientOptions.cookieStoreId
  // 컨테이너 탭의 인증정보를 담아 요청하기 위해 덮어씌우는 쿠키
  const cookies = await getAllCookies({ storeId })
  headers.set(
    'x-redblock-override-cookies',
    cookies.map(({ name, value }) => `${name}=${value}`).join('; ')
  )
  // 다계정 로그인 관련
  if (clientOptions.actAsUserId) {
    if (clientOptions.asTweetDeck) {
      headers.set('x-act-as-user-id', clientOptions.actAsUserId)
    } else {
      const extraCookies = await generateCookiesForAltAccountRequest(clientOptions)
      const encodedExtraCookies = new URLSearchParams(
        extraCookies as unknown as Record<string, string>
      )
      headers.set('x-redblock-act-as-cookies', encodedExtraCookies.toString())
    }
  }
  const result: RequestInit = {
    method: 'get',
    mode: 'cors',
    credentials: 'include',
    referrer: 'https://twitter.com/',
    headers,
  }
  if (clientOptions.asTweetDeck) {
    result.referrer = 'https://tweetdeck.twitter.com/'
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
  params.set(
    'ext',
    'mediaStats,highlightedLabel,signalsReactionPerspective,signalsReactionMetadata,voiceInfo,birdwatchPivot,superFollowMetadata'
  )
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

interface GraphQLQueryData {
  queryId: string
  operationName: string
  operationType: 'query' | 'mutation'
}

async function fetchGraphQLQueryData() {
  if (gqlDataMap.size > 0) {
    return
  }
  const twitter = await fetch('https://twitter.com/').then(resp => resp.text())
  const domparser = new DOMParser()
  const parsed = domparser.parseFromString(twitter, 'text/html')
  const mainScriptTag = parsed.querySelector<HTMLScriptElement>('script[src*="client-web/main."]')!
  const mainScript = await fetch(mainScriptTag.src).then(resp => resp.text())
  const regexp =
    /{queryId:"(?<queryId>[0-9A-Za-z_-]+)",operationName:"(?<operationName>\w+)",operationType:"(?<operationType>\w+)"/g
  for (const match of mainScript.matchAll(regexp)) {
    const { queryId, operationName, operationType } = match.groups as unknown as GraphQLQueryData
    gqlDataMap.set(operationName, { queryId, operationName, operationType })
  }
}

async function getQueryDataByOperationName(operationName: string): Promise<GraphQLQueryData> {
  if (gqlDataMap.size <= 0) {
    await fetchGraphQLQueryData()
  }
  const queryData = gqlDataMap.get(operationName)
  if (!queryData) {
    throw new Error('failed to find gql data for: ' + operationName)
  }
  return queryData
}

export function isTwitterErrorMessage(obj: any): obj is ErrorResponse {
  if (obj == null || typeof obj !== 'object') {
    return false
  }
  if (!('errors' in obj && Array.isArray(obj.errors))) {
    return false
  }
  return true
}

export function errorToString(error: unknown): string {
  console.error(error)
  if (isTwitterErrorMessage(error)) {
    return error.errors[0]?.message || '?'
  } else if (error instanceof Error) {
    return `${error.name}: ${error.message}`
  } else {
    return String(error)
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
    urls?: UrlEntity[]
  }
  ext: {
    // 남들의 반응
    signalsReactionMetadata: SignalsReactionMetadata
    // 내 반응. 당장 안 쓰이므로 생략
    // signalsReactionPerspective
  }
}

interface UserMentionEntity {
  id_str: string
  name: string
  screen_name: string
}

interface UrlEntity {
  expanded_url: string
}

export interface AudioSpace {
  metadata: {
    rest_id: string
    state: 'Running' | 'Ended' | 'NotStarted'
    title: string
    created_at: number // timestamp (ex. 1621037312345)
    started_at: number
    updated_at: number
    scheduled_start: number
    is_locked: boolean
  }
  participants: {
    total: number
    admins: AudioSpaceParticipant[]
    speakers: AudioSpaceParticipant[]
    listeners: AudioSpaceParticipant[]
  }
}

interface AudioSpaceParticipant {
  twitter_screen_name: string
  display_name: string
  avatar_url: string
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

interface Contributee {
  admin: boolean
  user: TwitterUser
}

export type ReactionV2Kind = 'Like' | 'Cheer' | 'Hmm' | 'Sad' | 'Haha'

interface SignalsReactionMetadata {
  r: {
    ok: {
      reactionTypeMap: [ReactionV2Kind, number][]
    }
  }
}

interface ReactionV2MapItem {
  type: ReactionV2Kind
  count: number
}

interface ReactionV2TimelineEntry {
  user_results: {
    // 프로텍트 계정 등에서 반응한 경우 유저정보가 없는 빈 object가 온다.
    result:
      | {
          // id: string
          rest_id: string
          legacy: Omit<TwitterUser, 'id_str'>
        }
      | {}
  }
  reaction_type: ReactionV2Kind
}

interface ReactionV2Timeline {
  reactionTypeMap: ReactionV2MapItem[]
  tweet_reaction_timeline_entries: ReactionV2TimelineEntry[]
}

interface ErrorResponseItem {
  code: number
  message: string
}

export interface ErrorResponse {
  errors: ErrorResponseItem[]
}

type GetMultipleUsersOption = { user_id: string[] } | { screen_name: string[] }
type GetSingleUserOption = { user_id: string } | { screen_name: string }
