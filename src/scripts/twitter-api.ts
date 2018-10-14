
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
    let cacheKeyName  = ''
    if (method === 'get') {
      params = url.searchParams
      cacheKeyName = `rbcache??${url.toString()}`
      const cached = window.sessionStorage.getItem(cacheKeyName)
      if (cached) {
        const lastCall = new Date(cached).getTime()
        const now = new Date().getTime()
        const thirtyMinutes = 1800000
        if (lastCall + thirtyMinutes < now) {
          fetchOptions.cache = 'force-cache'
          console.warn('TwitterAPI#requestAPI: "force-cache" mode applied!')
        }
      }
    } else {
      params = new URLSearchParams()
      // 타입 정의가 잘못된 걸로 보인다...
      // @ts-ignore
      fetchOptions.body = params
    }
    setDefaultParams(params)
    for (const [key, value] of Object.entries(paramsObj)) {
      params.set(key, value.toString())
    }
    const response = await fetch(url.toString(), fetchOptions)
    if (method === 'get') {
      const lastModified = response.headers.get('Last-Modified')
      if (lastModified) {
        window.sessionStorage.setItem(cacheKeyName, lastModified)
      }
    }
    if (rateLimited(response)) {
      throw new RateLimitError('rate limited')
    }
    return response
  }

  /*
  export async function blockUserById (id: string): Promise<Response> {
    const url = 'https://api.twitter.com/1.1/blocks/create.json'
  }
  */
  /*
  async function sendBlockRequest(userId: string): Promise<boolean> {
    const fetchOptions = generateTwitterAPIOptions({
      method: 'post'
    })
    const body = new URLSearchParams()
    body.set('user_id', userId)
    body.set('include_entities', 'false')
    body.set('skip_status', 'true')
    fetchOptions.body = body
    const url = 'https://api.twitter.com/1.1/blocks/create.json'
    const response = await fetch(url, fetchOptions)
    return response.ok
  }
  */
  /*
  async function getFollowersIds (userName: string, cursor: string = '-1'): Promise<FollowsIdsResponse> {
    const response = await requestAPI('get', '/followers/ids.json', {
      screen_name: userName,
      count: 5000,
      stringify_ids: true,
      cursor
    })
    if (response.ok) {
      return response.json() as Promise<FollowsIdsResponse>
    } else {
      throw new Error('response is not ok')
    }
  }
  */

  async function getFollowersList (userName: string, cursor: string = '-1'): Promise<FollowsListResponse> {
    const response = await requestAPI('get', '/followers/list.json', {
      // user_id: userId
      screen_name: userName,
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

  export async function* getAllFollowers (userName: string): AsyncIterableIterator<RateLimited<TwitterUser>> {
    let cursor: string = '-1'
    while (true) {
      try {
        const json = await getFollowersList(userName, cursor)
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
      // break
    }
  }

  export async function getSingleUserByName (userName: string): Promise<TwitterUser> {
    const response = await requestAPI('get', '/users/show.json', {
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
