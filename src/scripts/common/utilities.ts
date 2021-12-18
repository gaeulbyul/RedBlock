import browser from 'webextension-polyfill'

import { getAllCookies, getCookieStoreIdFromTab, removeCookie } from '../background/cookie-handler'
import { loadOptions } from '../background/storage/options'
import type { LimitStatus } from '../background/twitter-api'

const userNameBlacklist = [
  'about',
  'account',
  'blog',
  'compose',
  'download',
  'explore',
  'followers',
  'followings',
  'hashtag',
  'home',
  'i',
  'intent',
  'lists',
  'login',
  'logout',
  'messages',
  'notifications',
  'oauth',
  'privacy',
  'search',
  'session',
  'settings',
  'share',
  'signup',
  'tos',
  'welcome',
]

export function validateUserName(userName: string): boolean {
  const pattern = /[0-9A-Za-z_]{1,15}/i
  if (userNameBlacklist.includes(userName.toLowerCase())) {
    return false
  }
  return pattern.test(userName)
}

export function sleep(time: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, time))
}

export function copyFrozenObject<T extends object>(obj: T): Readonly<T> {
  return Object.freeze(Object.assign({}, obj))
}

export async function collectAsync<T>(generator: AsyncIterableIterator<T>): Promise<T[]> {
  const result: T[] = []
  for await (const val of generator) {
    result.push(val)
  }
  return result
}

export function getFollowersCount(user: TwitterUser, followKind: FollowKind): number | null {
  switch (followKind) {
    case 'followers':
      return user.followers_count
    case 'friends':
      return user.friends_count
    case 'mutual-followers':
      return null
  }
}

export function getReactionsV2CountsFromTweet(tweet: Tweet): { [react in ReactionV2Kind]: number } {
  const result: { [react in ReactionV2Kind]: number } = {
    Like: 0,
    Hmm: 0,
    Haha: 0,
    Sad: 0,
    Cheer: 0,
  } as const
  Object.assign(result, Object.fromEntries(tweet.ext.signalsReactionMetadata.r.ok.reactionTypeMap))
  return result
}

export function getTotalCountOfReactions(target: TweetReactionSessionTarget): number {
  let result = 0
  const { retweet_count, favorite_count } = target.tweet
  const mentions = target.tweet.entities.user_mentions || []
  if (target.includeRetweeters) {
    result += retweet_count
  }
  if (target.includeLikers) {
    result += favorite_count
  } else {
    const v2Reactions = getReactionsV2CountsFromTweet(target.tweet)
    target.includedReactionsV2.forEach(reaction => {
      result += v2Reactions[reaction]
    })
  }
  if (target.includeMentionedUsers) {
    result += mentions.length
  }
  if (target.includeQuotedUsers) {
    result += target.tweet.quote_count
  }
  if (target.includeNonLinkedMentions) {
    result += findNonLinkedMentionsFromTweet(target.tweet).length
  }
  return result
}

export function getParticipantsInAudioSpaceCount(target: AudioSpaceSessionTarget): number {
  const { audioSpace, includeHostsAndSpeakers, includeListeners } = target
  let count = 0
  if (includeHostsAndSpeakers) {
    count += audioSpace.participants.admins.length
    count += audioSpace.participants.speakers.length
  }
  if (includeListeners) {
    count += audioSpace.participants.listeners.length
  }
  return count
}

export function getCountOfUsersToBlock({
  target,
}: SessionRequest<AnySessionTarget>): number | null {
  switch (target.type) {
    case 'follower':
    case 'lockpicker':
      return getFollowersCount(target.user, target.list)
    case 'tweet_reaction':
      return getTotalCountOfReactions(target)
    case 'import':
      return target.userIds.length + target.userNames.length
    case 'audio_space':
      return getParticipantsInAudioSpaceCount(target)
    case 'user_search':
    case 'export_my_blocklist':
      return null
  }
}

export function getTargetUser(
  target: SessionRequest<AnySessionTarget>['target'],
): TwitterUser | null {
  switch (target.type) {
    case 'follower':
    case 'lockpicker':
      return target.user
    case 'tweet_reaction':
      return target.tweet.user
    /* NOTE: audio_space는 target의 유저정보가 없고 screen_name만 있음 */
    case 'audio_space':
    case 'import':
    case 'user_search':
    case 'export_my_blocklist':
      return null
  }
}

/* runningSession이면...
 * 확장기능버튼 뱃지숫자에 합산됨
 * 동일세션 실행여부에 포함
 * '완료세션 지우기'에서 예외가 됨.
 */
export function isRunningSession({ status }: SessionInfo): boolean {
  const runningStatuses = ['Initial', 'AwaitingUntilRecur', 'Running', 'RateLimited']
  return runningStatuses.includes(status)
}

export function isRewindableSession({ status, request }: SessionInfo): boolean {
  if (request.purpose.type === 'export') {
    return false
  }
  const rewindableStatus: SessionStatus[] = ['AwaitingUntilRecur', 'Completed', 'Stopped']
  return rewindableStatus.includes(status)
}

export function getLimitResetTime(limit: Limit): string {
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone
  const formatter = new Intl.DateTimeFormat('ko-KR', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
  })
  const datetime = new Date(limit.reset * 1000 + 120000)
  return formatter.format(datetime)
}

export function unwrap<T>(maybeValue: Either<Error, T>) {
  if (maybeValue.ok) {
    return maybeValue.value
  } else {
    const { error } = maybeValue
    console.error(error)
    throw error
  }
}

export function wrapEitherRight<T>(value: T): EitherRight<T> {
  return {
    ok: true,
    value,
  }
}

export function assertNever(shouldBeNever: never): never {
  console.error('triggered assertNever with: ', shouldBeNever)
  throw new Error('unreachable: assertNever')
}

function* iterateRegExpMatches(pattern: RegExp, text: string): Generator<string[]> {
  if (!pattern.global) {
    throw new TypeError('TypeError: pattern must set global flag')
  }
  let matches: RegExpExecArray | null
  let limitcounter = 5000
  while ((matches = pattern.exec(text))) {
    if (limitcounter-- <= 0) {
      throw new Error('too many loops?')
    }
    yield matches
  }
}

export function findMentionsFromText(text: string): string[] {
  const iterator = iterateRegExpMatches(/@([A-Za-z0-9_]{1,15})/gi, text)
  const result = new Set<string>()
  for (const matches of iterator) {
    const userName = matches[1]
    if (userName && validateUserName(userName)) {
      result.add(userName)
    }
  }
  return Array.from(result)
}

export function findNonLinkedMentions(text: string): string[] {
  const iterator = iterateRegExpMatches(/@[ ./]([A-Za-z0-9_]{1,15})\b/gi, text)
  const result = new Set<string>()
  for (const matches of iterator) {
    const userName = matches[1]
    if (userName && validateUserName(userName)) {
      result.add(userName)
    }
  }
  return Array.from(result)
}

export function findNonLinkedMentionsFromTweet(tweet: Tweet) {
  return findNonLinkedMentions(tweet.full_text)
}

export function stripSensitiveInfo(user: TwitterUser): TwitterUser {
  try {
    const userAsAny = user as any
    if (Object.isFrozen(userAsAny)) {
      const clonedUser = Object.assign(Object.create(null), userAsAny)
      return stripSensitiveInfo(clonedUser)
    }
    delete userAsAny.email
    delete userAsAny.phone
  } catch (err) {
    console.error(err)
  }
  return user
}

export function isExportableTarget(target: AnySessionTarget): target is ExportableSessionTarget {
  switch (target.type) {
    case 'follower':
    case 'tweet_reaction':
    case 'audio_space':
    case 'export_my_blocklist':
      return true
    case 'import':
    case 'lockpicker':
    case 'user_search':
      return false
  }
}

export function extractRateLimit(limitStatuses: LimitStatus, apiKind: ScrapingApiKind): Limit {
  switch (apiKind) {
    case 'followers':
      return limitStatuses.followers['/followers/list']
    case 'friends':
      return limitStatuses.friends['/friends/list']
    case 'mutual-followers':
      return limitStatuses.followers['/followers/list']
    case 'tweet-reactions':
      return limitStatuses.statuses['/statuses/retweeted_by']
    case 'lookup-users':
      return limitStatuses.users['/users/lookup']
    case 'search':
      return limitStatuses.search['/search/adaptive']
    case 'block-ids':
      return limitStatuses.blocks['/blocks/ids']
  }
}

export function sendBrowserRuntimeMessage<T>(message: T) {
  return browser.runtime.sendMessage(message)
}

export function sendBrowserTabMessage<T>(tabId: number, message: T) {
  return browser.tabs.sendMessage(tabId, message)
}

export async function markUser(params: MarkUserParams) {
  const tabs = await browser.tabs.query({
    discarded: false,
    url: [
      'https://twitter.com/*',
      'https://mobile.twitter.com/*',
      'https://tweetdeck.twitter.com/*',
    ],
  })
  tabs.forEach(tab => {
    const id = tab.id
    if (typeof id !== 'number') {
      return
    }
    sendBrowserTabMessage<RBMessageToContent.MarkUser>(id, {
      messageType: 'MarkUser',
      messageTo: 'content',
      ...params,
    }).catch(() => {})
  })
}

export async function getCurrentTab(): Promise<browser.Tabs.Tab> {
  const tabs = await browser.tabs.query({
    active: true,
    currentWindow: true,
  })
  const currentTab = tabs[0]!
  return currentTab
}

export async function toggleOneClickBlockMode(tab: browser.Tabs.Tab, enabled: boolean) {
  const tabIds: number[] = []
  const { oneClickBlockModeForAllTabs } = await loadOptions()
  if (oneClickBlockModeForAllTabs) {
    const tabs = await browser.tabs.query({
      discarded: false,
      url: [
        'https://twitter.com/*',
        'https://mobile.twitter.com/*',
        'https://tweetdeck.twitter.com/*',
      ],
    })
    tabs.forEach(tab => {
      if (typeof tab.id === 'number') {
        tabIds.push(tab.id)
      }
    })
  } else {
    const tabId = tab.id
    if (typeof tabId === 'number') {
      tabIds.push(tabId)
    }
  }
  return await Promise.all(
    tabIds.map(tabId =>
      sendBrowserTabMessage(tabId, {
        messageType: 'ToggleOneClickBlockMode',
        messageTo: 'content',
        enabled,
      })
    ),
  )
}

export async function deleteTwitterCookies(tab: browser.Tabs.Tab) {
  const storeId = await getCookieStoreIdFromTab(tab)
  const cookies = await getAllCookies({
    storeId,
  })
  const promises: Promise<any>[] = []
  for (const cookie of cookies) {
    promises.push(
      removeCookie({
        storeId,
        name: cookie.name,
      }).catch(() => {}),
    )
  }
  await Promise.allSettled(promises)
}

export async function nukeRedBlockSettings() {
  // sendMessage는 응답이 안 돌아오므로 await이 소용없겠더라.
  sendBrowserRuntimeMessage<RBMessageToBackground.RequestCleanup>({
    messageTo: 'background',
    messageType: 'RequestCleanup',
    cleanupWhat: 'nuke-all',
  })
  localStorage.clear()
  await browser.storage.local.clear()
  await sleep(1000)
}
