import type { BlockLimiter } from './block-limiter.js'
import { notify } from './background.js'
import * as i18n from '../i18n.js'

type HttpHeaders = browser.webRequest.HttpHeaders

const blockLimitReachedNotifyMessage = i18n.getMessage('notify_on_block_limit')

const isFirefox = browser.runtime.getURL('/').startsWith('moz-extension://')
const extraInfoSpec: any = ['requestHeaders', 'blocking']
if (!isFirefox) {
  extraInfoSpec.push('extraHeaders')
}

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

function changeActor(cookies: string, _actAsUserId: string, actAsUserToken: string): string {
  const authTokenPattern = /\bauth_token=([0-9a-f]+)\b/
  const authTokenMatch = authTokenPattern.exec(cookies)
  authTokenPattern.lastIndex = 0
  if (!authTokenMatch) {
    return cookies
  }
  const newCookie = cookies.replace(new RegExp(authTokenPattern, 'g'), `auth_token=${actAsUserToken}`)
  return newCookie
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
      const actAsUserId = headers
        .filter(({ name }) => name === 'x-act-as-user-id')
        .map(({ value }) => value)
        .pop()
      const actAsUserToken = headers
        .filter(({ name }) => name === 'x-act-as-user-token')
        .map(({ value }) => value)
        .pop()
      if (actAsUserId && actAsUserToken) {
        for (let i = 0; i < headers.length; i++) {
          const name = headers[i].name.toLowerCase()
          const value = headers[i].value!
          switch (name) {
            case 'x-act-as-user-id':
            case 'x-act-as-user-token':
              headers[i].name = ''
              break
            case 'cookie':
              headers[i].value = changeActor(value, actAsUserId, actAsUserToken)
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
