const enum Action {
  Start = 'RedBlock/Start',
  Stop = 'RedBlock/Stop',
  ConfirmChainBlock = 'RedBlock/ConfirmedChainBlock'
}

class EventEmitter {
  protected events: EventStore = {}
  on<T> (eventName: string, handler: (t: T) => any) {
    if (!(eventName in this.events)) {
      this.events[eventName] = []
    }
    this.events[eventName].push(handler)
    return this
  }
  emit<T> (eventName: string, eventHandlerParameter?: T) {
    const handlers = this.events[eventName] || []
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
