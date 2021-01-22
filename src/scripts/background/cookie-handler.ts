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

export async function generateCookiesForAltAccountRequest(
  cookieOptions: CookieOptions
): Promise<ActAsExtraCookies> {
  const { actAsUserId } = cookieOptions
  if (!actAsUserId) {
    throw new Error('unreachable - `actAsUserId` is missing')
  }
  const url = 'https://twitter.com'
  const authMultiCookie = await getMultiAccountCookies()
  if (!authMultiCookie) {
    throw new Error(
      'auth_multi cookie unavailable. this feature requires logged in with two or more account.'
    )
  }
  const storeId = cookieOptions.cookieStoreId || undefined
  const authTokenCookie = await browser.cookies
    .get({
      url,
      name: 'auth_token',
      storeId,
    })
    .then(coo => coo!.value)
  const twidCookie = await browser.cookies
    .get({
      url,
      name: 'twid',
      storeId,
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

export async function getCookieStoreIdFromTab(tab: browser.tabs.Tab): Promise<string> {
  if (tab.cookieStoreId) {
    return tab.cookieStoreId
  }
  const tabId = tab.id!
  const cookieStores = await browser.cookies.getAllCookieStores()
  const foundStore = cookieStores.find(store => store.tabIds.includes(tabId))!
  return foundStore.id!
}

export interface MultiAccountCookies {
  [userId: string]: string
}

export interface ActAsExtraCookies {
  auth_token: string
  auth_multi: string
  twid: string
}
