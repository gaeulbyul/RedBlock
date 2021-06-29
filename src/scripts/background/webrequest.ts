import debounce from 'lodash-es/debounce'

import BlockLimiter from './block-limiter'
import type { ActAsExtraCookies } from './cookie-handler'
import { notify } from './background'
import * as i18n from '~~/scripts/i18n'

const extraInfoSpec: any = ['requestHeaders', 'blocking']
const extraInfoSpecResponse: any = ['responseHeaders', 'blocking']
try {
  // @ts-ignore
  // prettier-ignore
  const requireExtraHeadersSpec = browser.webRequest.OnBeforeSendHeadersOptions.hasOwnProperty('EXTRA_HEADERS')
  if (requireExtraHeadersSpec) {
    extraInfoSpec.push('extraHeaders')
    extraInfoSpecResponse.push('extraHeaders')
  }
} catch {}

const blockLimitReachedNotifyMessage = i18n.getMessage('notify_on_block_limit')
const notifyAboutBlockLimitation = debounce(
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

function filterInvalidHeaders(headers: Headers) {
  const keysToRemove = new Set<string>()
  for (const name of headers.keys()) {
    if (name.length <= 0 || /redblock/i.test(name)) {
      // 여기서 곧장 headers.delete하면 iterate중인 headers를 건드리게 되고,
      // 그러고나면 일부 key를 건너뛰더라.
      // Set에 모았다가 한꺼번에 지우도록 고침
      keysToRemove.add(name)
    }
  }
  keysToRemove.forEach(key => headers.delete(key))
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
  return decoded as unknown as ActAsExtraCookies
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

function findCookieHeader(headersArray: browser.webRequest.HttpHeaders): string | null {
  // 그냥 'cookie'에서만 찾으면 수정전 쿠키가 들어온다. 다중로그인 등의 상황을 위해 수정한 쿠키인 override-cookies를 먼저 찾자.
  let cookie: string | undefined
  let overridenCookie: string | undefined
  for (const header of headersArray) {
    const name = header.name.toLowerCase()
    if (name === 'x-redblock-override-cookies') {
      overridenCookie = header.value!
      return overridenCookie
    } else if (name === 'cookie') {
      cookie = header.value!
    }
  }
  return overridenCookie || cookie || null
}

function generateBlockLimiterOptions(headersArray: browser.webRequest.HttpHeaders): string | null {
  const cookieHeader = findCookieHeader(headersArray)!
  const match = /\btwid=u%3D(\d+)\b/.exec(cookieHeader)!
  const userId = match[1]
  return userId
}

function initializeBlockAPILimiter() {
  const reqFilters = {
    urls: generateApiUrls('1.1/blocks/create.json'),
  }
  browser.webRequest.onBeforeSendHeaders.addListener(
    details => {
      const { originUrl, method, requestHeaders } = details
      // Service Worker에서 실행한 건 안 쳐준다. (중복 카운팅 방지)
      const shouldCount = originUrl !== 'https://twitter.com/sw' && method === 'POST'
      if (!shouldCount) {
        return { cancel: false }
      }
      // cookieStoreId는 반드시 헤더에서 가져올 것.
      // (background에서 보내는 API 요청은 무조건 default cookie store를 사용하게 되므로)
      const blockLimiterOptions = generateBlockLimiterOptions(requestHeaders!)
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
