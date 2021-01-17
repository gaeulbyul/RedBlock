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

export interface MultiAccountCookies {
  [userId: string]: string
}

export interface ActAsExtraCookies {
  auth_token: string
  auth_multi: string
  twid: string
}
