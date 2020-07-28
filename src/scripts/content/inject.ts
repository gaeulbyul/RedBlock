interface ReduxStore {
  getState(): any
  dispatch(payload: { type: string; [key: string]: any }): any
  subscribe(callback: () => void): void
}

{
  let reduxStore: ReduxStore
  let myselfUserId = ''
  function dig(obj: () => unknown): unknown {
    try {
      return obj()
    } catch (err) {
      if (err instanceof TypeError) {
        return null
      } else {
        throw err
      }
    }
  }

  function* getAddedElementsFromMutations(mutations: MutationRecord[]): IterableIterator<HTMLElement> {
    for (const mut of mutations) {
      for (const node of mut.addedNodes) {
        if (node instanceof HTMLElement) {
          yield node
        }
      }
    }
  }

  function getReactEventHandlers(target: Element): any {
    const key = Object.keys(target)
      .filter((k: string) => k.startsWith('__reactEventHandlers'))
      .pop()
    return key ? (target as any)[key] : null
  }

  function findReduxStore(): ReduxStore {
    if (reduxStore) {
      return reduxStore
    }
    const reactRoot = document.getElementById('react-root')!.children[0]
    const rEventHandler = getReactEventHandlers(reactRoot)
    reduxStore = rEventHandler.children.props.children.props.store
    return reduxStore
  }

  function getMyselfUserId(): string {
    if (myselfUserId) {
      return myselfUserId
    }
    const reduxStore = findReduxStore()
    const state = reduxStore.getState()
    myselfUserId = state.session.user_id
    return myselfUserId
  }

  function getTweetEntityById(tweetId: string) {
    const entities = findReduxStore().getState().entities.tweets.entities
    for (const entity_ of Object.values(entities)) {
      const entity = entity_ as any
      if (entity.id_str.toLowerCase() === tweetId) {
        return entity as TweetEntity
      }
    }
    return null
  }

  function getUserEntityById(userId: string): TwitterUser | null {
    const entities = findReduxStore().getState().entities.users.entities
    return entities[userId] || null
  }

  function toastMessage(text: string) {
    findReduxStore().dispatch({
      type: `rweb/toasts/ADD_TOAST`,
      payload: {
        text,
      },
    })
  }

  function markUser({ userId, verb }: MarkUserParams) {
    const id = uuid.v1()
    const verbUpperCase = verb.toUpperCase()
    findReduxStore().dispatch({
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

  function findTweetIdFromElement(elem: HTMLElement): string | null {
    if (!elem.matches('[data-testid=tweet]')) {
      throw new Error('unexpected non-tweet elem?')
    }
    const article = elem.closest('article[role=article]')
    if (!(article && article.parentElement)) {
      throw new Error()
    }
    // tweet-detail
    const parentReh = getReactEventHandlers(article.parentElement)
    const maybeTweetId1 = dig(() => parentReh.children.props.entry.entryId)
    if (typeof maybeTweetId1 === 'string') {
      const maybeTweetId1Match = /^tweet-(\d+)$/.exec(maybeTweetId1 || '')
      if (maybeTweetId1Match) {
        return maybeTweetId1Match[1]
      }
    }
    const permalink = elem.querySelector('a[href^="/"][href*="/status/"')
    if (!(permalink instanceof HTMLAnchorElement)) {
      return null
    }
    const maybeTimeElem = permalink.children[0]
    if (maybeTimeElem.tagName === 'TIME') {
      const maybeTweetId2Match = /\/status\/(\d+)$/.exec(permalink.pathname)
      if (maybeTweetId2Match) {
        return maybeTweetId2Match[1]
      }
    }
    // 신고한 트윗이나 안 보이는 트윗 등의 경우, 여기서 트윗 ID를 못 찾는다.
    return null
  }

  function initializeListener() {
    document.addEventListener('RedBlock->MarkUser', event => {
      const customEvent = event as CustomEvent<MarkUserParams>
      const rafTimeout = { timeout: 30000 }
      window.requestAnimationFrame(() => {
        markUser(customEvent.detail)
        // @ts-ignore
      }, rafTimeout)
    })
    document.addEventListener('RedBlock->MarkManyUsersAsBlocked', event => {
      const customEvent = event as CustomEvent<MarkManyUsersAsBlockedParams>
      const rafTimeout = { timeout: 30000 }
      window.requestAnimationFrame(() => {
        for (const userId of customEvent.detail.userIds) {
          markUser({ userId, verb: 'Block' })
        }
        // @ts-ignore
      }, rafTimeout)
    })
    document.addEventListener('RedBlock->ToastMessage', event => {
      const customEvent = event as CustomEvent<string>
      toastMessage(customEvent.detail)
    })
    console.debug('[RedBlock] page script: injected!')
  }

  function inspectTweetElement(elem: HTMLElement) {
    const tweetId = findTweetIdFromElement(elem)
    if (!tweetId) {
      return
    }
    const tweetEntity = getTweetEntityById(tweetId)
    if (!tweetEntity) {
      return
    }
    const user = getUserEntityById(tweetEntity.user)
    if (!user) {
      return
    }
    if (user.id_str === getMyselfUserId()) {
      return
    }
    const tweet = Object.assign({}, tweetEntity, {
      user,
    })

    elem.dispatchEvent(
      new CustomEvent<OneClickBlockableTweetElement>('RedBlock<-OnTweetElement', {
        bubbles: true,
        detail: {
          tweet,
        },
      })
    )
  }

  function initializeTweetElementInspecter(reactRoot: Element) {
    new MutationObserver(mutations => {
      for (const elem of getAddedElementsFromMutations(mutations)) {
        const tweetElems = elem.querySelectorAll<HTMLElement>('[data-testid=tweet]')
        tweetElems.forEach(elem => inspectTweetElement(elem))
      }
    }).observe(reactRoot, {
      subtree: true,
      childList: true,
    })
  }

  function initializeUserCellElementInspecter(reactRoot: Element) {
    function handleElem(elem: HTMLElement) {
      const btn = elem.querySelector('[role=button][data-testid]')
      if (!btn) {
        return
      }
      const testid = btn.getAttribute('data-testid')
      const maybeUserId = /^(\d+)-/.exec(testid || '')
      if (!maybeUserId) {
        console.warn('failed to find userId from ', elem)
        return
      }
      const user = getUserEntityById(maybeUserId[1])
      if (!user) {
        return
      }
      elem.dispatchEvent(
        new CustomEvent<OneClickBlockableUserCellElement>('RedBlock<-OnUserCellElement', {
          bubbles: true,
          detail: {
            user,
          },
        })
      )
    }
    new MutationObserver(mutations => {
      for (const elem of getAddedElementsFromMutations(mutations)) {
        const userCellElems = elem.querySelectorAll<HTMLElement>('[data-testid=UserCell]')
        userCellElems.forEach(handleElem)
      }
    }).observe(reactRoot, {
      subtree: true,
      childList: true,
    })
  }

  function initialize() {
    const reactRoot = document.getElementById('react-root')
    if (!reactRoot) {
      return
    }
    if ('_reactRootContainer' in reactRoot) {
      console.debug('[RedBlock] inject')
      initializeListener()
      initializeTweetElementInspecter(reactRoot)
      initializeUserCellElementInspecter(reactRoot)
    } else {
      console.debug('[RedBlock] waiting...')
      setTimeout(initialize, 500)
    }
  }

  requestIdleCallback(initialize, {
    timeout: 10000,
  })
}
