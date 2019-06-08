const enum Action {
  StartChainBlock = 'RedBlock/Start',
  StopChainBlock = 'RedBlock/Stop',
  ConfirmChainBlock = 'RedBlock/ConfirmedChainBlock',
  ShowNotify = 'RedBlock/ShowNotify',
}

abstract class EventEmitter {
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
  on<T>(eventName: string, handler: (t: T) => any) {
    this.events[eventName].push(handler)
    return this
  }
  emit<T>(eventName: string, eventHandlerParameter?: T) {
    const handlers = [...this.events[eventName], ...this.events['*']]
    // console.info('EventEmitter: emit "%s" with %o', eventName, eventHandlerParameter)
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
    return new TwitterUserMap(
      users.map((user): [string, TwitterUser] => [user.id_str, user])
    )
  }
  public filter(fn: (user: TwitterUser) => boolean): TwitterUserMap {
    return TwitterUserMap.fromUsersArray(this.toUserArray().filter(fn))
  }
}

function sleep(time: number): Promise<void> {
  return new Promise(resolve => window.setTimeout(resolve, time))
}

function copyFrozenObject<T extends object>(obj: T): Readonly<T> {
  return Object.freeze(Object.assign({}, obj))
}

function isSafeToBlock(user: TwitterUser): boolean {
  if (user.followed_by) {
    return false
  }
  const userDep = user as TwitterUserWithDeprecatedProps
  if (typeof userDep.following === 'boolean') {
    const following = userDep.following || userDep.follow_request_sent
    if (following) {
      return false
    }
  }
  return true
}

async function collectAsync<T>(
  generator: AsyncIterableIterator<T>
): Promise<T[]> {
  const result: T[] = []
  for await (const val of generator) {
    result.push(val)
  }
  return result
}
