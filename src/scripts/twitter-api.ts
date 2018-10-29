namespace TwitterAPI {
  const BEARER_TOKEN = `AAAAAAAAAAAAAAAAAAAAANRILgAAAAAAnNwIzUejRCOuH5E6I8xnZz4puTs%3D1Zv7ttfk8LF81IUq16cHjhLTvJu4FA33AGWWjCpTnA`

  class RateLimitError extends Error {}

  function rateLimited (resp: Response): boolean {
    return resp.status === 429
  }

  function generateTwitterAPIOptions (obj?: RequestInit): RequestInit {
    let csrfToken: string
    const match = /\bct0=([0-9a-f]{32})\b/.exec(document.cookie)
    if (match && match[1]) {
      csrfToken = match[1]
    } else {
      throw new Error('Failed to get CSRF token.')
    }
    const headers = new Headers()
    headers.set('authorization', `Bearer ${BEARER_TOKEN}`)
    headers.set('x-csrf-token', csrfToken)
    headers.set('x-twitter-active-user', 'yes')
    headers.set('x-twitter-auth-type', 'OAuth2Session')
    const result: RequestInit = {
      method: 'get',
      mode: 'cors',
      credentials: 'include',
      referrer: location.href,
      headers
    }
    Object.assign(result, obj)
    return result
  }

  function setDefaultParams (params: URLSearchParams): void {
    params.set('include_profile_interstitial_type', '1')
    params.set('include_blocking', '1')
    params.set('include_blocked_by', '1')
    params.set('include_followed_by', '1')
    params.set('include_want_retweets', '1')
    params.set('include_mute_edge', '1')
    params.set('include_can_dm', '1')
  }

  async function requestAPI (method: HTTPMethods, path: string, paramsObj: URLParamsObj = {}): Promise<Response> {
    const fetchOptions = generateTwitterAPIOptions({
      method
    })
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
    if (rateLimited(response)) {
      throw new RateLimitError('rate limited')
    }
    return response
  }

  export async function blockUser (user: TwitterUser): Promise<boolean> {
    if (user.blocking) {
      return true
    }
    const shouldNotBlock = _.some([
      user.following,
      user.followed_by,
      user.follow_request_sent
    ])
    if (shouldNotBlock) {
      throw new Error('!!!!! FATAL!!!!!: attempted to block user that should NOT block!!')
    }
    return blockUserUnsafe(user)
  }

  export async function blockUserUnsafe (user: TwitterUser): Promise<boolean> {
    const response = await requestAPI('post', '/blocks/create.json', {
      user_id: user.id_str,
      include_entities: false,
      skip_status: true
    })
    return response.ok
  }

  async function getFollowersList (user: TwitterUser, cursor: string = '-1'): Promise<FollowsListResponse> {
    const response = await requestAPI('get', '/followers/list.json', {
      user_id: user.id_str,
      // screen_name: userName,
      count: 200,
      skip_status: true,
      include_user_entities: false,
      cursor
    })
    if (response.ok) {
      return response.json() as Promise<FollowsListResponse>
    } else {
      throw new Error('response is not ok')
    }
  }

  export async function* getAllFollowers (user: TwitterUser): AsyncIterableIterator<RateLimited<TwitterUser>> {
    let cursor: string = '-1'
    while (true) {
      try {
        const json = await getFollowersList(user, cursor)
        cursor = json.next_cursor_str
        yield* json.users
        if (cursor === '0') {
          break
        } else {
          await sleep(300)
          continue
        }
      } catch (e) {
        if (e instanceof RateLimitError) {
          yield 'RateLimitError'
        } else {
          throw e
        }
      }
    }
  }

  export async function getSingleUserByName (userName: string): Promise<TwitterUser> {
    const response = await requestAPI('get', '/users/show.json', {
      // user_id: user.id_str,
      screen_name: userName,
      skip_status: true,
      include_entities: false
    })
    if (response.ok) {
      return response.json() as Promise<TwitterUser>
    } else {
      throw new Error('response is not ok')
    }
  }

  export async function getMyself (): Promise<TwitterUser> {
    const response = await requestAPI('get', '/account/verify_credentials.json')
    if (response.ok) {
      return response.json() as Promise<TwitterUser>
    } else {
      throw new Error('response is not ok')
    }
  }

  export async function getRateLimitStatus (): Promise<LimitStatus> {
    const response = await requestAPI('get', '/application/rate_limit_status.json')
    const resources = (await response.json()).resources as LimitStatus
    return resources
  }
}
