import * as CookieHandler from './cookie-handler.js'
import { TwClient } from './twitter-api.js'

export async function prepareActor(request: SessionRequest, targetUserId: string) {
  const cookieStores = await browser.cookies.getAllCookieStores()
  for (const store of cookieStores) {
    const cookieStoreId = store.id
    // 컨테이너에 트위터 계정을 하나만 로그인한 경우, auth_multi 쿠키가 없어 서
    // getMultiAccountCookies 함수가 null 을 리턴한다.
    const secondaryTwClients: TwClient[] = [new TwClient({ cookieStoreId })]
    const multiCookies = await CookieHandler.getMultiAccountCookies({ cookieStoreId })
    if (multiCookies) {
      const actorUserIds = Object.keys(multiCookies)
      for (const actAsUserId of actorUserIds) {
        secondaryTwClients.push(
          new TwClient({
            cookieStoreId,
            actAsUserId,
          })
        )
      }
    }
    console.debug(
      '[AntiBlock]: storeId: "%s" multiCookies:%o clients:%o',
      cookieStoreId,
      multiCookies,
      secondaryTwClients
    )
    for (const secondaryTwClient of secondaryTwClients) {
      console.debug('[AntiBlock]: secondaryTwClient:%o', secondaryTwClient)
      const secondaryMyself = await secondaryTwClient.getMyself().catch(() => null)
      if (!secondaryMyself) {
        console.debug('[AntiBlock]: login check failed')
        continue
      }
      if (secondaryMyself.id_str === request.myself.id_str) {
        continue
      }
      const target = await secondaryTwClient
        .getSingleUser({ user_id: targetUserId })
        .catch(() => null)
      if (target && !target.blocked_by) {
        console.debug('[AntiBlock]: Found! will use %o', secondaryTwClient)
        return secondaryTwClient
      }
    }
  }
  return null
}
