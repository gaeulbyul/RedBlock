import { loadOptions } from './storage/options'

const url = 'https://twitter.com'
const firstPartyDomain = 'twitter.com'

async function getCookie({ name, storeId }: { name: string; storeId: string }) {
  const options = await loadOptions()
  const cookieGetDetails: Parameters<typeof browser.cookies.get>[0] = {
    url,
    name,
    storeId,
  }
  if (options.firstPartyIsolationCompatibleMode) {
    cookieGetDetails.firstPartyDomain = firstPartyDomain
  }
  return browser.cookies.get(cookieGetDetails)
}

export async function getAllCookies({ storeId }: { storeId: string }) {
  const options = await loadOptions()
  const cookieGetAllDetails: Parameters<typeof browser.cookies.getAll>[0] = {
    url,
    storeId,
  }
  if (options.firstPartyIsolationCompatibleMode) {
    cookieGetAllDetails.firstPartyDomain = firstPartyDomain
  }
  return browser.cookies.getAll(cookieGetAllDetails)
}

export async function removeCookie({ name, storeId }: { name: string; storeId: string }) {
  const options = await loadOptions()
  const cookieRemoveDetails: Parameters<typeof browser.cookies.remove>[0] = {
    url,
    name,
    storeId,
  }
  if (options.firstPartyIsolationCompatibleMode) {
    cookieRemoveDetails.firstPartyDomain = firstPartyDomain
  }
  return browser.cookies.remove(cookieRemoveDetails)
}

export async function getMultiAccountCookies({
  cookieStoreId,
}: TwClientOptions): Promise<MultiAccountCookies | null> {
  const authMultiCookie = await getCookie({
    name: 'auth_multi',
    storeId: cookieStoreId,
  })
  if (!authMultiCookie) {
    return null
  }
  return parseAuthMultiCookie(authMultiCookie.value)
}

export async function generateCookiesForAltAccountRequest(
  clientOptions: TwClientOptions
): Promise<ActAsExtraCookies> {
  const { actAsUserId } = clientOptions
  if (!actAsUserId) {
    throw new Error('unreachable - `actAsUserId` is missing')
  }
  const authMultiCookie = await getMultiAccountCookies(clientOptions)
  if (!authMultiCookie) {
    throw new Error(
      'auth_multi cookie unavailable. this feature requires logged in with two or more account.'
    )
  }
  const authTokenCookie = await getCookie({
    name: 'auth_token',
    storeId: clientOptions.cookieStoreId,
  }).then(coo => coo!.value)
  const twidCookie = await getCookie({
    name: 'twid',
    storeId: clientOptions.cookieStoreId,
  }).then(coo => /u%3D([0-9]+)\b/.exec(coo!.value)![1])
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
