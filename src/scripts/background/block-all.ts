import { TwitterUserMap } from '../common.js'

// (taken from GoodTwitter extension source code)
// https://github.com/ZusorCode/GoodTwitterChrome/blob/c2637657ba64e3ea290813da4fba66c9f95764ec/background.js#L17
export const userAgent = 'Mozilla/5.0 (Windows NT 6.1; WOW64; Trident/7.0; AS; rv:11.0) Waterfox/56.2'

export interface BlockAllResult {
  blocked: string[]
  failed: string[]
}

function generateAuthenticityToken() {
  return uuid.v1().replace(/-/g, '')
}

function generateFetchOptions(ids: string[]): RequestInit {
  const headers = new Headers()
  headers.set('X-Requested-With', 'XMLHttpRequest')
  headers.set('X-Twitter-Active-User', 'yes')
  const body = new URLSearchParams()
  const authenticityToken = generateAuthenticityToken()
  body.set('authenticity_token', authenticityToken)
  ids.forEach(id => body.append('user_ids[]', id))
  return {
    method: 'post',
    mode: 'cors',
    credentials: 'include',
    headers,
    body,
    // 여기서 user-agent/referrer 설정해도 안 먹힌다. webRequest API를 갖고 추가할 것.
    // referrer: 'https://twitter.com/settings/import_blocked',
  }
}

function requestBlockAll(ids: string[]) {
  const options = generateFetchOptions(ids)
  return fetch('https://twitter.com/i/user/block_all', options)
}

export async function blockMultipleUsersById(ids: string[]): Promise<BlockAllResult> {
  // const requests: Promise<Response | null>[] = []
  const totalBlocked = []
  const totalFailed = []
  const chunkedIds = _.chunk(ids, 800)
  for (const chunk of chunkedIds) {
    const blockAllResponse = await requestBlockAll(chunk)
    const { result } = (await blockAllResponse.json()) as { result: BlockAllResult }
    totalBlocked.push(...result.blocked)
    totalFailed.push(...result.failed)
  }
  return {
    blocked: totalBlocked,
    failed: totalFailed,
  }
}

export async function blockMultipleUsers(users: TwitterUserMap): Promise<BlockAllResult> {
  if (users.size <= 0) {
    return {
      blocked: [],
      failed: [],
    }
  }
  const ids = users.map(user => user.id_str)
  return blockMultipleUsersById(ids)
}
