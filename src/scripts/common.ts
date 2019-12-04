const enum Action {
  StartChainBlock = 'RedBlock/Start',
  StopChainBlock = 'RedBlock/Stop',
  RequestProgress = 'RedBlock/RequestProgress',
  ConnectToBackground = 'RedBlock/ConnectToBackground',
  DisconnectToBackground = 'RedBlock/DisconnectToBackground',
}

const UI_UPDATE_DELAY = 250

interface allHandlerParam<T, K extends keyof T> {
  name: keyof T
  params: T[K]
}
abstract class EventEmitter<T> {
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
    console.debug('EventEmitter: emit "%s" with %o', eventName, eventHandlerParameter)
    handlers.forEach(handler => handler(eventHandlerParameter))
    return this
  }
}

class TwitterUserMap extends Map<string, TwitterUser> {
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

function getUserNameFromURL(url: URL | Location | HTMLAnchorElement): string | null {
  const userNameBlacklist = [
    '1',
    'about',
    'account',
    'blog',
    'explore',
    'followers',
    'followings',
    'hashtag',
    'home',
    'i',
    'lists',
    'login',
    'logout',
    'messages',
    'notifications',
    'oauth',
    'privacy',
    'search',
    'tos',
  ]
  const supportingHostname = ['twitter.com', 'mobile.twitter.com']
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

function sleep(time: number): Promise<void> {
  return new Promise(resolve => window.setTimeout(resolve, time))
}

function copyFrozenObject<T extends object>(obj: T): Readonly<T> {
  return Object.freeze(Object.assign({}, obj))
}

async function collectAsync<T>(generator: AsyncIterableIterator<T>): Promise<T[]> {
  const result: T[] = []
  for await (const val of generator) {
    result.push(val)
  }
  return result
}

function formatNumber(input: unknown): string {
  if (typeof input === 'number') {
    const formatted = input.toLocaleString()
    return `${formatted}`
  } else {
    return '??'
  }
}

// namespace RedBlock.Content.Utils { }
