import BlockLimiter from './block-limiter.js'
import type { ActAsExtraCookies } from './cookie-handler.js'
import { notify } from './background.js'
import * as i18n from '../i18n.js'

const extraInfoSpec: any = ['requestHeaders', 'blocking']
const extraInfoSpecResponse: any = ['responseHeaders', 'blocking']
try {
  // @ts-ignore
  const requireExtraHeadersSpec = browser.webRequest.OnBeforeSendHeadersOptions.hasOwnProperty(
    'EXTRA_HEADERS'
  )
  if (requireExtraHeadersSpec) {
    extraInfoSpec.push('extraHeaders')
    extraInfoSpecResponse.push('extraHeaders')
  }
} catch (e) {}

const blockLimitReachedNotifyMessage = i18n.getMessage('notify_on_block_limit')
const notifyAboutBlockLimitation = _.debounce(
  () => {
    notify(blockLimitReachedNotifyMessage)
  },
  5000,
  {
    leading: true,
    trailing: false,
  }
)

function generateApiUrls(path: string) {
  return [
    'https://api.twitter.com/',
    'https://twitter.com/i/api/',
    'https://mobile.twitter.com/i/api/',
  ].map(prefix => prefix + path)
}

function fromWebRequestHeaders(headersArray: browser.webRequest.HttpHeaders): Headers {
  const headers = new Headers()
  headersArray.forEach(item => {
    if (!item.value) {
      return
    }
    headers.set(item.name, item.value)
  })
  return headers
}

function toWebRequestHeaders(headers: Headers): browser.webRequest.HttpHeaders {
  return Array.from(headers.entries()).map(([name, value]) => ({ name, value }))
}

function stripOrigin(headers: Headers) {
  const origin = headers.get('origin')
  if (!/^https:/.test(origin || '')) {
    headers.set('origin', 'https://twitter.com')
  }
}

function filterInvalidHeaders(headers: Headers) {
  for (const name of headers.keys()) {
    if (name.length <= 0 || /redblock/i.test(name)) {
      headers.delete(name)
    }
  }
}

function overrideWholeCookiesWithCookieStore(headers: Headers) {
  const overrideCookies = headers.get('x-redblock-override-cookies')
  if (!overrideCookies) {
    return
  }
  headers.set('cookie', overrideCookies)
}

function overrideActorCookies(
  headers: Headers,
  { auth_token, auth_multi, twid }: ActAsExtraCookies
) {
  const cookie = headers.get('cookie')!
  const newCookie = cookie
    .replace(/\bauth_token=\S+\b/g, `auth_token=${auth_token}`)
    .replace(/\bauth_multi="\S+"/g, `auth_multi=${auth_multi}`)
    .replace(/\btwid=\S+\b/g, `twid=${twid}`)
  headers.set('cookie', newCookie)
}

function handleCsrfHeader(headers: Headers) {
  const cookie = headers.get('cookie')!
  const overrideCookie = headers.get('x-redblock-override-ct0')
  const ct0 = overrideCookie || /\bct0=([0-9a-f]+)\b/.exec(cookie)![1]
  headers.set('cookie', cookie.replace(/\bct0=[0-9a-f]+\b/g, `ct0=${ct0}`))
  headers.set('x-csrf-token', ct0)
}

function extractActAsCookies(headers: Headers): ActAsExtraCookies | null {
  const actAsCookies = headers.get('x-redblock-act-as-cookies')
  if (!actAsCookies) {
    return null
  }
  const params = new URLSearchParams(actAsCookies)
  const decoded = Object.fromEntries(params.entries())
  return (decoded as unknown) as ActAsExtraCookies
}

const redblockRequestIds = new Set<string>()

function initializeTwitterAPIRequestHeaderModifier() {
  const reqFilters = {
    urls: generateApiUrls('*'),
  }
  browser.webRequest.onBeforeSendHeaders.addListener(
    details => {
      const isRedblockRequest = details.requestHeaders!.find(({ name }) => /redblock/i.test(name))
      if (isRedblockRequest) {
        redblockRequestIds.add(details.requestId)
      } else {
        return {}
      }
      const headers = fromWebRequestHeaders(details.requestHeaders!)
      stripOrigin(headers)
      overrideWholeCookiesWithCookieStore(headers)
      handleCsrfHeader(headers)
      const actAsCookies = extractActAsCookies(headers)
      if (actAsCookies) {
        overrideActorCookies(headers, actAsCookies)
      }
      filterInvalidHeaders(headers)
      return {
        requestHeaders: toWebRequestHeaders(headers),
      }
    },
    reqFilters,
    extraInfoSpec
  )
}

function initializeTwitterAPISetCookieHeaderHandler() {
  const reqFilters = {
    urls: generateApiUrls('*'),
  }
  browser.webRequest.onHeadersReceived.addListener(
    details => {
      const isRedblockRequest = redblockRequestIds.has(details.requestId)
      if (isRedblockRequest) {
        redblockRequestIds.delete(details.requestId)
      } else {
        return
      }
      if (details.statusCode !== 403) {
        return
      }
      const headers = details.responseHeaders!
      const setCookieHeader = headers.find(({ name }) => name === 'set-cookie')
      if (!(setCookieHeader && setCookieHeader.value)) {
        return
      }
      const actualCt0Value = /ct0=([0-9a-f]+)/.exec(setCookieHeader.value)![1]
      headers.push({
        name: 'x-redblock-new-ct0',
        value: actualCt0Value,
      })
      return {
        responseHeaders: headers,
      }
    },
    reqFilters,
    extraInfoSpecResponse
  )
}

function generateBlockLimiterOptions(
  headersArray: browser.webRequest.HttpHeaders,
  cookieStoreIdFromRequest?: string
): BlockLimiterOptions | null {
  /* FIXME
   * 레드블락 외의 차단요청(가령, 사용자가 직접 차단 메뉴를 클릭)한 경우
   * x-redblock- 어쩌고 헤더가 없다
   * 어떻게 `cookieStoreId`를 얻어내는가...
   * */
  let cookieStoreId = cookieStoreIdFromRequest || ''
  if (!cookieStoreId) {
    const cookieStoreIdHeader = headersArray.find(
      ({ name }) => name === 'x-redblock-cookie-store-id'
    )
    cookieStoreId = cookieStoreIdHeader ? cookieStoreIdHeader.value! : ''
    if (!cookieStoreId) {
      return null
    }
  }
  const cookieHeader = headersArray.find(({ name }) => name.toLowerCase() === 'cookie')!
  const match = /\btwid=u%3D(\d+)\b/.exec(cookieHeader.value!)!
  const userId = match[1]
  return { cookieStoreId, userId }
}

function initializeBlockAPILimiter() {
  const reqFilters = {
    urls: generateApiUrls('1.1/blocks/create.json'),
  }
  browser.webRequest.onBeforeSendHeaders.addListener(
    details => {
      const { originUrl, method, requestHeaders } = details
      // Service Worker에서 실행한 건 안 쳐준다. (중복 카운팅 방지)
      const shouldCount = originUrl !== 'https://twitter.com/sw.js' && method === 'POST'
      if (!shouldCount) {
        return { cancel: false }
      }
      // @ts-ignore
      const blockLimiterOptions = generateBlockLimiterOptions(
        requestHeaders!,
        details.cookieStoreId
      )
      if (!blockLimiterOptions) {
        return { cancel: false }
      }
      const limiter = new BlockLimiter(blockLimiterOptions)
      const cancel = limiter.check() !== 'ok'
      // console.log('block limiter: [%d +1/%d] (cancel=%s)', limiter.count, limiter.max, cancel)
      // console.dir(details)
      if (cancel) {
        notifyAboutBlockLimitation()
      } else {
        limiter.increment()
      }
      return {
        cancel,
      }
    },
    reqFilters,
    extraInfoSpec
  )
}

export function initializeWebRequest() {
  initializeTwitterAPIRequestHeaderModifier()
  initializeTwitterAPISetCookieHeaderHandler()
  initializeBlockAPILimiter()
}
