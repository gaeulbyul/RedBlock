import * as CookieHandler from './cookie-handler.js'
import { TwClient } from './twitter-api.js'

async function* iterateAvailableTwClients(): AsyncIterableIterator<TwClient> {
  const cookieStores = await browser.cookies.getAllCookieStores()
  for (const store of cookieStores) {
    const cookieStoreId = store.id
    yield new TwClient({ cookieStoreId })
    const multiCookies = await CookieHandler.getMultiAccountCookies({ cookieStoreId })
    // 컨테이너에 트위터 계정을 하나만 로그인한 경우, auth_multi 쿠키가 없어 서
    // getMultiAccountCookies 함수가 null 을 리턴한다.
    if (!multiCookies) {
      continue
    }
    for (const actAsUserId of Object.keys(multiCookies)) {
      yield new TwClient({
        cookieStoreId,
        actAsUserId,
      })
    }
  }
}

export async function examineRetrieverByTargetUser(
  primaryActor: Actor,
  targetUser: TwitterUser
): Promise<Actor | null> {
  if (!targetUser.blocked_by) {
    // 차단당하지 않았다면 primary 그대로 사용
    return primaryActor
  }
  const twClients = iterateAvailableTwClients()
  for await (const client of twClients) {
    console.debug('[AntiBlock]: secondaryTwClient:%o', client)
    const clientSelf = await client.getMyself().catch(() => null)
    if (!clientSelf) {
      console.debug('[AntiBlock]: login check fail. skip.')
      continue
    }
    if (clientSelf.id_str === primaryActor.user.id_str) {
      continue
    }
    const target = await client.getSingleUser({ user_id: targetUser.id_str }).catch(() => null)
    if (target && !target.blocked_by) {
      console.debug('[AntiBlock]: Found! will use %o', client)
      return { user: clientSelf, cookieOptions: client.cookieOptions }
    }
  }
  // TODO: unreachable 처리? (차단당해도 유저정보정도는 가져올 수 있다.)
  return null
}

export async function examineRetrieverByTweetId(
  primaryActor: Actor,
  tweetId: string
): Promise<ExamineTweetResult | null> {
  const primaryTwClient = new TwClient(primaryActor.cookieOptions)
  const tweetRetrievedFromPrimaryActor = await primaryTwClient
    .getTweetById(tweetId)
    .catch(() => null)
  if (tweetRetrievedFromPrimaryActor) {
    return {
      ...primaryActor,
      targetTweet: tweetRetrievedFromPrimaryActor,
      tweetRetrievedFromPrimary: true,
    }
  }
  const twClients = iterateAvailableTwClients()
  for await (const client of twClients) {
    console.debug('[AntiBlock]: secondaryTwClient:%o', client)
    const clientSelf = await client.getMyself().catch(() => null)
    if (!clientSelf) {
      console.debug('[AntiBlock]: login check fail. skip.')
      continue
    }
    if (clientSelf.id_str === primaryActor.user.id_str) {
      continue
    }
    const targetTweet = await client.getTweetById(tweetId).catch(() => null)
    if (targetTweet && !targetTweet.user.blocked_by) {
      console.debug('[AntiBlock]: Found! will use %o', client)
      return {
        targetTweet,
        tweetRetrievedFromPrimary: false,
        user: clientSelf,
        cookieOptions: client.cookieOptions,
      }
    }
  }
  return null
}

type ExamineTweetResult = Actor & {
  targetTweet: Tweet
  tweetRetrievedFromPrimary: boolean
}
