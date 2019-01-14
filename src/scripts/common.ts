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

function sleep(time: number): Promise<void> {
  return new Promise(resolve => window.setTimeout(resolve, time))
}

function copyFrozenObject<T extends object>(obj: T): Readonly<T> {
  return Object.freeze(Object.assign({}, obj))
}

function i18n(
  strs: TemplateStringsArray,
  ...args: (string | number)[]
): string {
  const id = strs[0].trim()
  const argsString = args.map(e => e.toString())
  const message = browser.i18n.getMessage(id, ...argsString) as
    | string
    | undefined
  if (typeof message !== 'string' || message.length <= 0) {
    throw new Error(`Can't find i18n message from id "${id}"`)
  }
  return message
}
