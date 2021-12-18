import browser from 'webextension-polyfill'

import * as CookieHandler from './cookie-handler'
import { TwClient } from './twitter-api'

interface AvailableAccount {
  client: TwClient
  user: TwitterUser
}

export interface IterateCondition {
  includeTweetDeck: boolean
  includeAnotherCookieStores: boolean
}

async function getCookieStoreIdsToIterate(includeAnotherCookieStores: boolean): Promise<string[]> {
  if (includeAnotherCookieStores) {
    const stores = await browser.cookies.getAllCookieStores()
    return stores.map(({ id }) => id)
  } else {
    const defaultId = await CookieHandler.getDefaultCookieStoreId()
    return [defaultId]
  }
}

async function* iterateMultiAccountCookies(
  cookieStoreId: string,
  multiCookies: CookieHandler.MultiAccountCookies,
): AsyncIterableIterator<AvailableAccount> {
  for (const actAsUserId of Object.keys(multiCookies)) {
    const secondaryTwClient = new TwClient({
      cookieStoreId,
      actAsUserId,
    })
    const secondaryUser = await secondaryTwClient.getMyself().catch(() => null)
    if (secondaryUser) {
      yield {
        client: secondaryTwClient,
        user: secondaryUser,
      }
    }
  }
}

async function* iterateTweetDeckContributees(
  cookieStoreId: string,
): AsyncIterableIterator<AvailableAccount> {
  const tdTwClient = new TwClient({
    cookieStoreId,
    asTweetDeck: true,
  })
  const contributees = await tdTwClient.getTweetDeckContributees().catch(() => [])
  console.debug('[] contributees= %o', contributees)
  if (contributees.length <= 0) {
    return
  }
  for (const ctee of contributees) {
    const secondaryTwClient = new TwClient({
      cookieStoreId,
      asTweetDeck: true,
      actAsUserId: ctee.user.id_str,
    })
    const secondaryUser = await secondaryTwClient.getMyself().catch(() => null)
    if (secondaryUser) {
      yield {
        client: secondaryTwClient,
        user: secondaryUser,
      }
    }
  }
}

export async function* iterateAvailableTwClients({
  includeTweetDeck,
  includeAnotherCookieStores,
}: IterateCondition): AsyncIterableIterator<AvailableAccount> {
  const cookieStoreIds = await getCookieStoreIdsToIterate(includeAnotherCookieStores)
  for (const cookieStoreId of cookieStoreIds) {
    const client = new TwClient({ cookieStoreId })
    const user = await client.getMyself().catch(() => null)
    if (user) {
      yield { client, user }
    }
    const multiCookies = await CookieHandler.getMultiAccountCookies({ cookieStoreId })
    // 컨테이너에 트위터 계정을 하나만 로그인한 경우, auth_multi 쿠키가 없어 서
    // getMultiAccountCookies 함수가 null 을 리턴한다.
    if (multiCookies) {
      yield* iterateMultiAccountCookies(cookieStoreId, multiCookies)
    }
    if (includeTweetDeck) {
      yield* iterateTweetDeckContributees(cookieStoreId)
    }
  }
}
