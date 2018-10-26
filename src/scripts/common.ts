const enum Action {
  Start = 'RedBlock/Start',
  Stop = 'RedBlock/Stop',
  ConfirmChainBlock = 'RedBlock/ConfirmedChainBlock',
  ShowNotify = 'RedBlock/ShowNotify'
}

abstract class EventEmitter {
  protected events: EventStore = new Proxy({}, {
    get (target: EventStore, name: string) {
      const originalValue = Reflect.get(target, name)
      if (Array.isArray(originalValue)) {
        return originalValue
      }
      Reflect.set(target, name, [])
      return Reflect.get(target, name)
    }
  })
  on<T> (eventName: string, handler: (t: T) => any) {
    this.events[eventName].push(handler)
    return this
  }
  emit<T> (eventName: string, eventHandlerParameter?: T) {
    const handlers = [
      ...this.events[eventName],
      ...this.events['*']
    ]
    // console.info('EventEmitter: emit "%s" with %o', eventName, eventHandlerParameter)
    handlers.forEach(handler => handler(eventHandlerParameter))
    return this
  }
}

function sleep (time: number): Promise<void> {
  return new Promise(resolve => window.setTimeout(resolve, time))
}

// 내가 차단한 사용자의 프로필에 "차단됨" 표시
function changeButtonToBlocked (profile: Element) { // eslint-disable-line no-unused-vars
  const actions = profile.querySelector('.user-actions')
  if (actions) {
    actions.classList.remove('not-following')
    actions.classList.add('blocked')
  }
}
