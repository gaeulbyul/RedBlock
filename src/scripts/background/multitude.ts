import * as CookieHandler from './cookie-handler'
import { TwClient } from './twitter-api'
import { loadOptions } from './storage/options'

interface AvailableAccount {
  client: TwClient
  user: TwitterUser
}

export async function* iterateAvailableTwClients(): AsyncIterableIterator<AvailableAccount> {
  const cookieStores = await browser.cookies.getAllCookieStores()
  for (const store of cookieStores) {
    const cookieStoreId = store.id
    const client = new TwClient({ cookieStoreId })
    const user = await client.getMyself().catch(() => null)
    if (user) {
      yield { client, user }
    }
    const multiCookies = await CookieHandler.getMultiAccountCookies({ cookieStoreId })
    // 컨테이너에 트위터 계정을 하나만 로그인한 경우, auth_multi 쿠키가 없어 서
    // getMultiAccountCookies 함수가 null 을 리턴한다.
    if (multiCookies) {
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
    const { enableBlockBusterWithTweetDeck } = await loadOptions()
    if (enableBlockBusterWithTweetDeck) {
      const tdTwClient = new TwClient({
        cookieStoreId,
        asTweetDeck: true,
      })
      const contributees = await tdTwClient.getTweetDeckContributees().catch(() => [])
      console.debug('[] contributees= %o', contributees)
      if (contributees.length <= 0) {
        continue
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
  }
}
