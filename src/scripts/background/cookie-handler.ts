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
  const storeId = await getCookieStoreId(cookieOptions)
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

export async function getCookieStoreId(cookieOptions: CookieOptions): Promise<string | undefined> {
  if (cookieOptions.cookieStoreId) {
    return cookieOptions.cookieStoreId
  } else if (typeof cookieOptions.incognitoTabId === 'number') {
    // 크롬 등 cookieStoreId 개념이 없는 브라우저에선
    // 주어진 탭에 연관된 cookieStore 관련 속성이 없더라.
    // cookieStore의 incognito속성도 파이어폭스 전용이더라!
    const tabId = cookieOptions.incognitoTabId
    const cookieStores = await browser.cookies.getAllCookieStores()
    const incognitoCookieStore = cookieStores.find(store => store.tabIds.includes(tabId))
    return incognitoCookieStore?.id
  } else {
    return undefined
  }
}

export function tabToCookieOptions(tab: browser.tabs.Tab): CookieOptions {
  return {
    cookieStoreId: tab.cookieStoreId,
    incognitoTabId: tab.incognito ? tab.id : undefined,
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
