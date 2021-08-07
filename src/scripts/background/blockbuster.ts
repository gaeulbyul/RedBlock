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

export async function examineRetrieverByTargetUser(
  primaryActor: Actor,
  targetUser: TwitterUser
): Promise<Actor> {
  if (!targetUser.blocked_by) {
    // 차단당하지 않았다면 primary 그대로 사용
    return primaryActor
  }
  const twClients = iterateAvailableTwClients()
  for await (const { client, user } of twClients) {
    if (user.id_str === primaryActor.user.id_str) {
      continue
    }
    const target = await client.getSingleUser({ user_id: targetUser.id_str }).catch(() => null)
    if (target && !target.blocked_by) {
      console.debug('[BlockBuster]: Found! will use %o', client)
      return { user, clientOptions: client.options }
    }
  }
  console.warn('[BlockBuster]: Failed to Found!')
  return primaryActor
}

export async function examineRetrieverByTweetId(
  primaryActor: Actor,
  tweetId: string
): Promise<ExamineTweetResult> {
  const primaryTwClient = new TwClient(primaryActor.clientOptions)
  const tweetRetrievedFromPrimaryActor = await primaryTwClient
    .getTweetById(tweetId)
    .catch(() => null)
  if (tweetRetrievedFromPrimaryActor) {
    return {
      actor: primaryActor,
      targetTweet: tweetRetrievedFromPrimaryActor,
      tweetRetrievedFromPrimary: true,
    }
  }
  const twClients = iterateAvailableTwClients()
  for await (const { client, user } of twClients) {
    if (user.id_str === primaryActor.user.id_str) {
      continue
    }
    const targetTweet = await client.getTweetById(tweetId).catch(() => null)
    if (targetTweet && !targetTweet.user.blocked_by) {
      console.debug('[BlockBuster]: Found! will use %o', client)
      return {
        actor: {
          user,
          clientOptions: client.options,
        },
        targetTweet,
        tweetRetrievedFromPrimary: false,
      }
    }
  }
  return {
    actor: primaryActor,
    targetTweet: null,
    tweetRetrievedFromPrimary: true,
  }
}

interface ExamineTweetResult {
  actor: Actor
  targetTweet: Tweet | null
  tweetRetrievedFromPrimary: boolean
}
