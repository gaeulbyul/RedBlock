import { TwitterUserEntities, Limit } from './background/twitter-api.js'

export const enum SessionStatus {
  Initial,
  Running,
  RateLimited,
  Completed,
  Stopped,
  Error,
}

export const UI_UPDATE_DELAY = 250

export class EventEmitter<T> {
  protected events: EventStore = new Proxy(
    {},
    {
      get(target: EventStore, name: string) {
        const originalValue = Reflect.get(target, name)
        if (Array.isArray(originalValue)) {
          return originalValue
        }
        Reflect.set(target, name, [])
        return Reflect.get(target, name)
      },
    }
  )
  on<K extends keyof T>(eventName: string & K, handler: (p: T[K]) => void) {
    this.events[eventName].push(handler)
    return this
  }
  emit<K extends keyof T>(eventName: string & K, eventHandlerParameter: T[K]) {
    const handlers = [...this.events[eventName], ...this.events['*']]
    // console.debug('EventEmitter: emit "%s" with %o', eventName, eventHandlerParameter)
    handlers.forEach(handler => handler(eventHandlerParameter))
    return this
  }
}

export class TwitterUserMap extends Map<string, TwitterUser> {
  public addUser(user: TwitterUser) {
    return this.set(user.id_str, user)
  }
  public hasUser(user: TwitterUser) {
    return this.has(user.id_str)
  }
  public toUserArray(): TwitterUser[] {
    return Array.from(this.values())
  }
  public toUserObject(): TwitterUserEntities {
    const usersObj: TwitterUserEntities = Object.create(null)
    for (const [userId, user] of this) {
      usersObj[userId] = user
    }
    return usersObj
  }
  public static fromUsersArray(users: TwitterUser[]): TwitterUserMap {
    return new TwitterUserMap(users.map((user): [string, TwitterUser] => [user.id_str, user]))
  }
  public map<T>(fn: (user: TwitterUser, index: number, array: TwitterUser[]) => T): T[] {
    return this.toUserArray().map(fn)
  }
  public filter(
    fn: (user: TwitterUser, index: number, array: TwitterUser[]) => boolean
  ): TwitterUserMap {
    return TwitterUserMap.fromUsersArray(this.toUserArray().filter(fn))
  }
}

export function getUserNameFromURL(url: URL | Location | HTMLAnchorElement): string | null {
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
  const supportingHostname = ['twitter.com', 'mobile.twitter.com']
  if (!/^https?/.test(url.protocol)) {
    return null
  }
  if (!supportingHostname.includes(url.hostname)) {
    return null
  }
  const nonUserPagePattern01 = /^\/\w\w\/(?:tos|privacy)/
  if (nonUserPagePattern01.test(url.pathname)) {
    return null
  }
  const pattern = /^\/([0-9A-Za-z_]{1,15})/i
  const match = pattern.exec(url.pathname)
  if (!match) {
    return null
  }
  const userName = match[1]
  if (userNameBlacklist.includes(userName.toLowerCase())) {
    return null
  }
  return userName
}

export function sleep(time: number): Promise<void> {
  return new Promise(resolve => window.setTimeout(resolve, time))
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

export function getReactionsCount(target: TweetReactionBlockSessionRequest['target']): number {
  let result = 0
  const { retweet_count, favorite_count } = target.tweet
  const mentions = target.tweet.entities.user_mentions || []
  if (target.blockRetweeters) {
    result += retweet_count
  }
  if (target.blockLikers) {
    result += favorite_count
  }
  if (target.blockMentionedUsers) {
    result += mentions.length
  }
  return result
}

export function getCountOfUsersToBlock({ target }: SessionRequest) {
  switch (target.type) {
    case 'follower':
      return getFollowersCount(target.user, target.list)
    case 'tweet_reaction':
      return getReactionsCount(target)
    case 'import':
      return target.userIds.length
  }
}

export function isRunningSession({ status }: SessionInfo): boolean {
  const runningStatuses = [SessionStatus.Initial, SessionStatus.Running, SessionStatus.RateLimited]
  return runningStatuses.includes(status)
}

export function isRewindableSession({ status }: SessionInfo): boolean {
  const rewindableStatus: SessionStatus[] = [
    SessionStatus.Completed,
    SessionStatus.Error,
    SessionStatus.Stopped,
  ]
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

export function assertNever(shouldBeNever: never) {
  console.error('triggered assertNever with: ', shouldBeNever)
  throw new Error('unreachable: assertNever')
}

/*
function* resumableIterate<T>(generator: Generator<T>) {
  while (true) {
    let item = generator.next()
    if (item.done) {
      return item.value
    } else {
      yield item.value
    }
  }
}
*/

// generator를 for-of loop등으로 iterate하는 도중 break를 걸면, 그 generator를 다시 iterate할 수 없더라.
// 이를 해결하기 위해 while loop과 .next()로 수동으로 iterate하는 함수 만듦
export async function* resumableAsyncIterate<T>(asyncGenerator: AsyncIterableIterator<T>) {
  while (true) {
    const item = await asyncGenerator.next()
    if (item.done) {
      return item.value
    } else {
      yield item.value
    }
  }
}
