namespace RedBlock.Background.TwitterAPI {
  const DELAY = 200
  const BEARER_TOKEN = `AAAAAAAAAAAAAAAAAAAAANRILgAAAAAAnNwIzUejRCOuH5E6I8xnZz4puTs%3D1Zv7ttfk8LF81IUq16cHjhLTvJu4FA33AGWWjCpTnA`
  export class RateLimitError extends Error {}
  export async function getMyself(): Promise<TwitterUser> {
    const response = await requestAPI('get', '/account/verify_credentials.json')
    if (response.ok) {
      return response.json() as Promise<TwitterUser>
    } else {
      throw new Error('response is not ok')
    }
  }

  export async function getRateLimitStatus(): Promise<LimitStatus> {
    const response = await requestAPI('get', '/application/rate_limit_status.json')
    const resources = (await response.json()).resources as LimitStatus
    return resources
  }

  export async function blockUser(user: TwitterUser): Promise<boolean> {
    if (user.blocking) {
      return true
    }
    const response = await requestAPI('post', '/blocks/create.json', {
      user_id: user.id_str,
      include_entities: false,
      skip_status: true,
    })
    const result = response.ok
    void response.text()
    return result
  }

  async function getFollowsIds(
    followKind: FollowKind,
    user: TwitterUser,
    cursor: string = '-1'
  ): Promise<UserIdsResponse> {
    const response = await requestAPI('get', `/${followKind}/ids.json`, {
      user_id: user.id_str,
      stringify_ids: true,
      count: 5000,
      cursor,
    })
    if (response.ok) {
      return response.json() as Promise<UserIdsResponse>
    } else {
      throw new Error('response is not ok')
    }
  }

  export async function* getAllFollowsIds(
    followKind: FollowKind,
    user: TwitterUser
  ): AsyncIterableIterator<Either<Error, string>> {
    let cursor: string = '-1'
    while (true) {
      try {
        const json = await getFollowsIds(followKind, user, cursor)
        cursor = json.next_cursor_str
        yield* json.ids.map(id => ({
          ok: true as const,
          value: id,
        }))
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
    cursor: string = '-1'
  ): Promise<FollowsListResponse> {
    const response = await requestAPI('get', `/${followKind}/list.json`, {
      user_id: user.id_str,
      // screen_name: userName,
      count: 200,
      skip_status: true,
      include_user_entities: false,
      cursor,
    })
    if (response.ok) {
      return response.json() as Promise<FollowsListResponse>
    } else {
      throw new Error('response is not ok')
    }
  }

  export async function* getAllFollowsUserList(
    followKind: FollowKind,
    user: TwitterUser
  ): AsyncIterableIterator<Either<Error, TwitterUser>> {
    let cursor: string = '-1'
    while (true) {
      try {
        const json = await getFollowsUserList(followKind, user, cursor)
        cursor = json.next_cursor_str
        yield* json.users.map(user => ({
          ok: true as const,
          value: user,
        }))
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

  export async function getAllMutualFollowersIds(user: TwitterUser): Promise<string[]> {
    function unwrap<T>(maybeValue: Either<Error, T>) {
      if (maybeValue.ok) {
        return maybeValue.value
      } else {
        const { error } = maybeValue
        console.error(error)
        throw error
      }
    }
    const followingsIds = (await collectAsync(getAllFollowsIds('friends', user))).map(unwrap)
    const followersIds = (await collectAsync(getAllFollowsIds('followers', user))).map(unwrap)
    const mutualIds = _.intersection(followingsIds, followersIds)
    return mutualIds
  }

  export async function* getAllMutualFollowersUsersList(
    user: TwitterUser
  ): AsyncIterableIterator<Either<Error, TwitterUser>> {
    const mutualIds = await getAllMutualFollowersIds(user)
    const chunks = _.chunk(mutualIds, 100)
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
    if (response.ok) {
      return response.json() as Promise<TwitterUser[]>
    } else {
      throw new Error('response is not ok')
    }
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
    if (response.ok) {
      return response.json() as Promise<TwitterUser[]>
    } else {
      throw new Error('response is not ok')
    }
  }

  export async function getSingleUserByName(userName: string): Promise<TwitterUser> {
    const response = await requestAPI('get', '/users/show.json', {
      // user_id: user.id_str,
      screen_name: userName,
      skip_status: true,
      include_entities: false,
    })
    if (response.ok) {
      return response.json() as Promise<TwitterUser>
    } else {
      throw new Error('response is not ok')
    }
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
    if (response.ok) {
      return response.json() as Promise<FriendshipResponse>
    } else {
      throw new Error('response is not ok')
    }
  }

  export async function getRelationship(sourceUser: TwitterUser, targetUser: TwitterUser): Promise<Relationship> {
    const source_id = sourceUser.id_str
    const target_id = targetUser.id_str
    const response = await requestAPI('get', '/friendships/show.json', {
      source_id,
      target_id,
    })
    if (response.ok) {
      return (await response.json()).relationship as Promise<Relationship>
    } else {
      throw new Error('response is not ok')
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

  async function generateTwitterAPIOptions(obj?: RequestInit): Promise<RequestInit> {
    const csrfToken = await getCsrfTokenFromCookies()
    const headers = new Headers()
    headers.set('authorization', `Bearer ${BEARER_TOKEN}`)
    headers.set('x-csrf-token', csrfToken)
    headers.set('x-twitter-active-user', 'yes')
    headers.set('x-twitter-auth-type', 'OAuth2Session')
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

  async function requestAPI(method: HTTPMethods, path: string, paramsObj: URLParamsObj = {}): Promise<Response> {
    const fetchOptions = await generateTwitterAPIOptions({
      method,
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
    if (response.status === 429) {
      throw new RateLimitError('rate limited')
    }
    return response
  }
  export function dummyUser(): TwitterUser {
    const rand = () =>
      Math.random()
        .toString(10)
        .slice(2)
    const id_str = rand()
    return {
      id_str,
      screen_name: 'dummyUser',
      created_at: 'Invalid Date?',
      name: `(DUMMY) ID:${id_str}`,
      description: `(DUMMY USER) ID:${id_str}`,
      profile_image_url_https: 'https://abs.twimg.com/sticky/default_profile_images/default_profile_bigger.png',
      verified: false,
      protected: false,
      blocked_by: false,
      blocking: true,
      muting: false,
      following: false,
      followed_by: false,
      followers_count: 2438,
      friends_count: 32553,
    }
  }
}
