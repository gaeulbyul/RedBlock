import type BlockLimiter from './block-limiter.js'
import type { ActAsExtraCookies } from './twitter-api.js'
import { notify } from './background.js'
import * as i18n from '../i18n.js'

type HttpHeaders = browser.webRequest.HttpHeaders

const extraInfoSpec: any = ['requestHeaders', 'blocking']
try {
  // @ts-ignore
  const requireExtraHeadersSpec = browser.webRequest.OnBeforeSendHeadersOptions.hasOwnProperty(
    'EXTRA_HEADERS'
  )
  if (requireExtraHeadersSpec) {
    extraInfoSpec.push('extraHeaders')
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
  return headers.filter(({ name }) => name.length > 0)
}

function changeActor(cookies: string, { auth_token, auth_multi, twid }: ActAsExtraCookies): string {
  return cookies
    .replace(/\bauth_token=\S+\b/g, `auth_token=${auth_token}`)
    .replace(/\bauth_multi="\S+"/g, `auth_multi=${auth_multi}`)
    .replace(/\btwid=\S+\b/g, `twid=${twid}`)
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

function initializeTwitterAPIRequestHeaderModifier() {
  const reqFilters = {
    urls: ['https://api.twitter.com/*'],
  }
  browser.webRequest.onBeforeSendHeaders.addListener(
    details => {
      // console.debug('block_all api', details)
      const headers = details.requestHeaders!
      stripOrigin(headers)
      const actAsCookies = extractActAsCookies(headers)
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

export function initializeBlockAPILimiter(limiter: BlockLimiter) {
  const reqFilters = {
    urls: ['https://api.twitter.com/1.1/blocks/create.json'],
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
}
