import type BlockLimiter from './block-limiter.js'
import type { ActAsExtraCookies } from './cookie-handler.js'
import { notify } from './background.js'
import * as i18n from '../i18n.js'

type HttpHeaders = browser.webRequest.HttpHeaders

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

function stripOrigin(headers: HttpHeaders) {
  for (let i = 0; i < headers.length; i++) {
    const name = headers[i].name.toLowerCase()
    switch (name) {
      case 'origin':
        if (!/^https?:/.test(headers[i].value || '')) {
          headers[i].value = 'https://twitter.com'
        }
        break
    }
  }
  return headers
}

function filterInvalidHeaders(headers: HttpHeaders): HttpHeaders {
  return headers.filter(({ name }) => name.length > 0 || /redblock/i.test(name))
}

function changeActor(cookies: string, { auth_token, auth_multi, twid }: ActAsExtraCookies): string {
  return cookies
    .replace(/\bauth_token=\S+\b/g, `auth_token=${auth_token}`)
    .replace(/\bauth_multi="\S+"/g, `auth_multi=${auth_multi}`)
    .replace(/\btwid=\S+\b/g, `twid=${twid}`)
}

function overrideCsrfCookie(headers: HttpHeaders) {
  const overrideCookieHeader = headers.find(({ name }) => name === 'x-redblock-override-ct0')
  if (!(overrideCookieHeader && overrideCookieHeader.value)) {
    return
  }
  const ct0 = overrideCookieHeader.value
  const cookieHeader = headers.find(({ name }) => name.toLowerCase() === 'cookie')!
  cookieHeader.value = cookieHeader.value!.replace(/\bct0=[0-9a-f]+\b/g, `ct0=${ct0}`)
  const csrfTokenHeader = headers.find(({ name }) => name.toLowerCase() === 'x-csrf-token')!
  csrfTokenHeader.value = ct0
  return headers
}

function extractActAsCookies(headers: HttpHeaders): ActAsExtraCookies | null {
  const actAsCookiesHeader = headers.find(({ name }) => name === 'x-act-as-cookies')
  if (!actAsCookiesHeader) {
    return null
  }
  const params = new URLSearchParams(actAsCookiesHeader.value)
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
      // console.debug('block_all api', details)
      const headers = details.requestHeaders!
      const isRedblockRequest = headers.find(({ name }) => name === 'x-redblock-request')
      if (isRedblockRequest) {
        redblockRequestIds.add(details.requestId)
      } else {
        return {}
      }
      const actAsCookies = extractActAsCookies(headers)
      stripOrigin(headers)
      overrideCsrfCookie(headers)
      if (actAsCookies) {
        for (let i = 0; i < headers.length; i++) {
          const name = headers[i].name.toLowerCase()
          const value = headers[i].value!
          switch (name) {
            case 'x-act-as-cookies':
              headers[i].name = ''
              break
            case 'cookie':
              headers[i].value = changeActor(value, actAsCookies)
              break
          }
        }
      }
      return {
        requestHeaders: filterInvalidHeaders(headers),
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
      if (details.statusCode !== 403) {
        return
      }
      const isRedblockRequest = redblockRequestIds.has(details.requestId)
      if (isRedblockRequest) {
        redblockRequestIds.delete(details.requestId)
      } else {
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

export function initializeBlockAPILimiter(limiter: BlockLimiter) {
  const reqFilters = {
    urls: generateApiUrls('1.1/blocks/create.json'),
  }
  browser.webRequest.onBeforeRequest.addListener(
    details => {
      const { originUrl, method } = details
      // Service Worker에서 실행한 건 안 쳐준다. (중복 카운팅 방지)
      const shouldCount = originUrl !== 'https://twitter.com/sw.js' && method === 'POST'
      if (!shouldCount) {
        return { cancel: false }
      }
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
    ['blocking']
  )
}

export function initializeWebRequest() {
  initializeTwitterAPIRequestHeaderModifier()
  initializeTwitterAPISetCookieHeaderHandler()
}
