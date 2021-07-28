import { TwitterURL } from '../scripts/common'
import { loadOptions } from '../scripts/background/storage'
import type { TwClient } from '../scripts/background/twitter-api'
import { examineRetrieverByTweetId } from '../scripts/background/blockbuster'

export { toggleOneClickBlockMode } from '../scripts/background/misc'

type Tab = browser.tabs.Tab

export function getUserNameFromTab(tab: Tab): string | null {
  if (!tab.url) {
    return null
  }
  return new TwitterURL(tab.url).getUserName()
}

function getCurrentSearchQueryFromTab(tab: Tab): string | null {
  if (!tab.url) {
    return null
  }
  const twURL = TwitterURL.nullable(tab.url)
  if (!twURL) {
    return null
  }
  if (twURL.searchParams.get('f') !== 'user') {
    return null
  }
  if (twURL.pathname.startsWith('/hashtag/')) {
    return '#' + twURL.getHashTag()
  } else if (twURL.pathname === '/search' || twURL.pathname === '/search/') {
    return twURL.searchParams.get('q')
  } else {
    return null
  }
}

// 트윗 신고화면에선 사용자 이름 대신 ID가 나타난다.
function getUserIdFromTab(tab: Tab): string | null {
  if (!tab.url) {
    return null
  }
  const twURL = TwitterURL.nullable(tab.url)
  if (!twURL) {
    return null
  }
  const match1 = /^\/i\/report\/user\/(\d+)/.exec(twURL.pathname)
  if (match1) {
    return match1[1]
  }
  const reportedUserId = twURL.pathname.startsWith('/i/safety/report')
    ? twURL.searchParams.get('reported_user_id')
    : null
  if (reportedUserId) {
    return reportedUserId
  }
  return null
}

function getTweetIdFromTab(tab: Tab): string | null {
  if (!tab.url) {
    return null
  }
  const twURL = TwitterURL.nullable(tab.url)
  if (!twURL) {
    return null
  }
  const tweetId = twURL.getTweetId()
  if (tweetId) {
    return tweetId
  }
  // 신고화면에서
  const reportedTweetId = twURL.pathname.startsWith('/i/safety/report')
    ? twURL.searchParams.get('reported_tweet_id')
    : null
  if (reportedTweetId) {
    return reportedTweetId
  }
  return null
}

export function determineInitialPurposeType<T extends Purpose>(
  myself: TwitterUser | null,
  givenUser: TwitterUser | null
): T['type'] {
  if (!(myself && givenUser)) {
    return 'chainblock'
  }
  if (givenUser.following) {
    return 'unchainblock'
  }
  return 'chainblock'
}

export function checkMessage(msg: object): msg is RBMessageToPopupType {
  if (msg == null) {
    return false
  }
  if (!('messageTo' in msg)) {
    return false
  }
  if ((msg as any).messageTo !== 'popup') {
    return false
  }
  return true
}

export interface TabContext {
  currentUser: TwitterUser | null
  currentTweet: Tweet | null
  currentSearchQuery: string | null
  currentAudioSpace: AudioSpace | null
}

export async function getTabContext(
  tab: browser.tabs.Tab,
  myself: Actor,
  twClient: TwClient
): Promise<TabContext> {
  const turl = TwitterURL.nullable(tab.url!)
  if (!turl) {
    return {
      currentTweet: null,
      currentUser: null,
      currentSearchQuery: null,
      currentAudioSpace: null,
    }
  }
  const tweetId = getTweetIdFromTab(tab)
  const userId = getUserIdFromTab(tab)
  const userName = getUserNameFromTab(tab)
  const options = await loadOptions()
  let currentTweet: Tweet | null = null
  let currentUser: TwitterUser | null = null
  let currentAudioSpace: AudioSpace | null = null
  if (tweetId) {
    if (options.enableBlockBuster) {
      const result = await examineRetrieverByTweetId(myself, tweetId)
      if (result) {
        currentTweet = result.targetTweet
        if (result.tweetRetrievedFromPrimary) {
          currentUser = currentTweet.user
        }
      }
    } else {
      currentTweet = await twClient.getTweetById(tweetId).catch(() => null)
      currentUser = currentTweet?.user || null
    }
  } else {
    currentTweet = null
  }
  if (!currentUser) {
    if (userName) {
      currentUser = await twClient.getSingleUser({ screen_name: userName }).catch(() => null)
    } else if (userId) {
      currentUser = await twClient.getSingleUser({ user_id: userId }).catch(() => null)
    }
  }
  const currentSearchQuery = getCurrentSearchQueryFromTab(tab)
  const audioSpaceId = new TwitterURL(tab.url!).getAudioSpaceId()
  if (audioSpaceId) {
    currentAudioSpace = await twClient.getAudioSpaceById(audioSpaceId).catch(() => null)
  } else if (currentTweet) {
    const spaceUrl = (currentTweet.entities.urls || [])
      .map(({ expanded_url }) => TwitterURL.nullable(expanded_url))
      .find(twURL => twURL?.getAudioSpaceId())
    if (spaceUrl) {
      const audioSpaceId = new TwitterURL(spaceUrl).getAudioSpaceId()!
      currentAudioSpace = await twClient.getAudioSpaceById(audioSpaceId).catch(() => null)
    }
  }
  return {
    currentTweet,
    currentUser,
    currentSearchQuery,
    currentAudioSpace,
  }
}
