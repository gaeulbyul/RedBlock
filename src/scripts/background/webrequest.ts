import * as BlockAllAPI from './block-all.js'
// import { parseAuthMultiCookie } from './twitter-api.js'

type HttpHeaders = browser.webRequest.HttpHeaders

const isFirefox = browser.runtime.getURL('/').startsWith('moz-extension://')
const extraInfoSpec: any = ['requestHeaders', 'blocking']
if (!isFirefox) {
  extraInfoSpec.push('extraHeaders')
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
  return headers.filter(({ name }) => name.length > 0)
}

function initializeBlockAllRequestHeaderModifier() {
  const reqFilters = {
    urls: ['https://twitter.com/i/user/block_all'],
  }
  browser.webRequest.onBeforeSendHeaders.addListener(
    (details) => {
      // console.debug('block_all api', details)
      const headers = details.requestHeaders!
      stripOrigin(headers)
      for (let i = 0; i < headers.length; i++) {
        const name = headers[i].name.toLowerCase()
        const value = headers[i].value!
        switch (name) {
          case 'user-agent':
            headers[i].value = BlockAllAPI.userAgent
            break
          case 'cookie':
            headers[i].value = value
              .replace(/\brweb_optin=(?:\S+?)\b/i, 'rweb_optin=off')
              .replace(/\bcsrf_same_site_set=1;/i, '')
            break
        }
      }
      // in HTTP Headers, Referrer should be "Referer"
      headers.push({
        name: 'referer',
        value: 'https://twitter.com/settings/imported_blocked',
      })
      return {
        requestHeaders: headers,
      }
    },
    reqFilters,
    extraInfoSpec
  )
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
    (details) => {
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

export function initializeWebRequest() {
  initializeBlockAllRequestHeaderModifier()
  initializeTwitterAPIRequestHeaderModifier()
}
