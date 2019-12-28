interface ReduxStore {
  getState(): any
  dispatch(payload: { type: string; [key: string]: any }): any
  subscribe(callback: () => void): void
}

function getReactEventHandler(target: Element): any {
  const key = Object.keys(target)
    .filter((k: string) => k.startsWith('__reactEventHandlers'))
    .pop()
  return key ? (target as any)[key] : null
}

function findReduxStore(): ReduxStore {
  const reactRoot = document.querySelector('[data-reactroot]')!.children[0]
  const rEventHandler = getReactEventHandler(reactRoot)
  return rEventHandler.children.props.store
}

function markUser(reduxStore: ReduxStore, { userId, verb }: MarkUserParams) {
  const id = uuid.v1()
  const verbUpperCase = verb.toUpperCase()
  reduxStore.dispatch({
    type: `rweb/entities/users/${verbUpperCase}_REQUEST`,
    optimist: {
      type: 'BEGIN',
      id,
    },
    meta: {
      entityId: userId,
    },
  })
}

function initializeListener() {
  const reduxStore = findReduxStore()
  document.addEventListener('RedBlock->MarkUser', event => {
    const customEvent = event as CustomEvent<MarkUserParams>
    markUser(reduxStore, customEvent.detail)
  })
  console.debug('[RedBlock] page script: injected!')
}

function initialize() {
  const reactRoot = document.getElementById('react-root')
  if (!reactRoot) {
    // probably old-version twitter
    return
  }
  if ('_reactRootContainer' in reactRoot) {
    console.debug('[RedBlock] inject')
    initializeListener()
  } else {
    console.debug('[RedBlock] waiting...')
    setTimeout(initialize, 500)
  }
}

requestIdleCallback(initialize, {
  timeout: 10000,
})
