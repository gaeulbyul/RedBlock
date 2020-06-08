import { TwitterUserEntities, Limit } from './background/twitter-api.js'

export const enum PageEnum {
  Sessions = 0,
  NewSession = 1,
  NewTweetReactionBlock = 2,
  Utilities = 3,
}

export const enum SessionStatus {
  Initial, // not confirmed yet
  Ready, // confirmed, probably prefetching...
  Running,
  RateLimited,
  Completed,
  Stopped,
  Error,
}

export const UI_UPDATE_DELAY = 250
export const MAX_USER_LIMIT = 100000
/* about MAX_USER_LIMIT:
Increasing value makes Red Block's chainblock scrapes more user.
However, I'm worried that Twitter may restrict user-block API futhermore.
If it became reality, Red Block become completely unusable.
( block_all API is LAST method for block massive users )
So I don't recommends modify its value.
*/

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
  public addUser(user: TwitterUser, forceUpdate = false) {
    const shouldUpdate = forceUpdate || !this.has(user.id_str)
    if (shouldUpdate) {
      this.set(user.id_str, user)
    }
  }
  public toUserArray(): TwitterUser[] {
    return Array.from(this.values())
  }
  public toUserObject(): TwitterUserEntities {
    const usersObj: TwitterUserEntities = {}
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
  public filter(fn: (user: TwitterUser, index: number, array: TwitterUser[]) => boolean): TwitterUserMap {
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
  if (target.blockRetweeters) {
    result += retweet_count
  }
  if (target.blockLikers) {
    result += favorite_count
  }
  return result
}

export function isRunningStatus(status: SessionStatus): boolean {
  const runningStatuses = [SessionStatus.Ready, SessionStatus.Running, SessionStatus.RateLimited]
  return runningStatuses.includes(status)
}

export function isRewindableStatus(status: SessionStatus): boolean {
  const rewindableStatus: SessionStatus[] = [SessionStatus.Completed, SessionStatus.Error, SessionStatus.Stopped]
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

export function wrapEither<T>(value: T): EitherRight<T> {
  return {
    ok: true,
    value,
  }
}
