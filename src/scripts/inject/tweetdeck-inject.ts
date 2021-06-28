declare var TD: any

void (() => {
  const windowAsAny = window as any
  const id = `\n${Date.now().toString()}`
  const blackMagic = windowAsAny.webpackJsonp.push([
    [],
    {
      // @ts-ignore
      [id]: (m, e, exports) => Object.assign(m, { exports }),
    },
    [[id]],
  ])
  delete blackMagic.m[id]
  delete blackMagic.c[id]

  let myselfUserId = ''

  function isLoggedIn(): boolean {
    return !!getMyselfUserId()
  }

  function* getAddedElementsFromMutations(
    mutations: MutationRecord[]
  ): IterableIterator<HTMLElement> {
    for (const mut of mutations) {
      for (const node of mut.addedNodes) {
        if (node instanceof HTMLElement) {
          yield node
        }
      }
    }
  }

  function getMyselfUserId(): string {
    if (myselfUserId) {
      return myselfUserId
    }
    const sessionData = TD.storage.store.getSessionData()
    // 로그인 하지 않으면 null이다.
    myselfUserId = sessionData.uid || ''
    return myselfUserId
  }

  function toastMessage(message: string) {
    const { showNotification } = blackMagic(19)
    showNotification({
      title: 'Red Block',
      message,
    })
  }

  function initializeListener() {
    document.addEventListener('RedBlock->ToastMessage', event => {
      const customEvent = event as CustomEvent<ToastMessageParam>
      toastMessage(customEvent.detail.text)
    })
  }

  function initializeTweetElementInspecter() {
    const touched = new WeakSet()
    const myselfId = getMyselfUserId()
    new MutationObserver(mutations => {
      for (const elem of getAddedElementsFromMutations(mutations)) {
        if (touched.has(elem)) {
          continue
        }
        if (!elem.matches('article[data-tweet-id]')) {
          continue
        }
        if (elem.querySelector('.redblock-btn')) {
          continue
        }
        touched.add(elem)
        const avatar = elem.querySelector('.avatar')!
        const userLink = avatar.closest<HTMLAnchorElement>('a[rel=user]')!
        const userName = userLink.pathname.slice(1)
        TD.cache.twitterUsers
          .getByScreenName(userName)
          .toPromise()
          .then((user: TweetDeckUser) => {
            const tdUser: TweetDeckUser = JSON.parse(JSON.stringify(user))
            if (tdUser.id === myselfId) {
              return
            }
            elem.dispatchEvent(
              new CustomEvent<OneClickBlockTweetDeckUser>('RedBlock<-OneClickBlockTweetDeckUser', {
                bubbles: true,
                detail: {
                  tdUser,
                },
              })
            )
          })
      }
    }).observe(document.body, {
      subtree: true,
      childList: true,
    })
  }

  function initialize() {
    if (!isLoggedIn()) {
      console.info('redblock: not logged in. does nothing.')
      return
    }
    console.info('injecting...')
    initializeListener()
    initializeTweetElementInspecter()
  }

  requestIdleCallback(initialize, {
    timeout: 10000,
  })
})()
