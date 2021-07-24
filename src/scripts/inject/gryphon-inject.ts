import { getAddedElementsFromMutations } from './inject-common'
import {
  getMyselfUserId,
  getTweetEntityById,
  getUserEntityById,
  toastMessage,
  markUser,
  isLoggedIn,
} from './reactredux'

void (() => {
  function findTweetIdFromElement(elem: HTMLElement): string | null {
    if (!elem.matches('[data-testid=tweet]')) {
      throw new Error('unexpected non-tweet elem?')
    }
    const article = elem.closest('article[role=article]')! as HTMLElement
    const permalinks = article.querySelectorAll<HTMLAnchorElement>('a[href^="/"][href*="/status/"')
    for (const plink of permalinks) {
      const tweetIdMatch = /\/status\/(\d+)/.exec(plink.pathname)
      const tweetId = tweetIdMatch![1]
      const firstChild = plink.firstElementChild
      if (firstChild?.tagName === 'TIME') {
        return tweetId
      }
      const viaLabel = article.querySelector(
        'a[href="https://help.twitter.com/using-twitter/how-to-tweet#source-labels"]'
      )
      if (viaLabel?.parentElement!.contains(plink)) {
        return tweetId
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
          markUser({ userId, userAction: 'Block' })
        }
        // @ts-ignore
      }, rafTimeout)
    })
    document.addEventListener('RedBlock->ToastMessage', event => {
      const customEvent = event as CustomEvent<ToastMessageParam>
      toastMessage(customEvent.detail)
    })
  }

  function inspectTweetElement(elem: HTMLElement) {
    const myselfUserId = getMyselfUserId()
    const tweetId = findTweetIdFromElement(elem)
    if (!tweetId) {
      return null
    }
    const tweetEntity = getTweetEntityById(tweetId)
    if (!tweetEntity) {
      return null
    }
    const user = getUserEntityById(tweetEntity.user)
    if (!user) {
      return null
    }
    if (user.id_str === myselfUserId) {
      return null
    }
    let quotedTweet: Tweet | null = null
    if (tweetEntity.is_quote_status) {
      const quotedTweetEntity = getTweetEntityById(tweetEntity.quoted_status!)
      if (quotedTweetEntity) {
        const user = getUserEntityById(quotedTweetEntity.user)
        if (user && user.id_str !== myselfUserId) {
          quotedTweet = Object.assign({}, quotedTweetEntity, {
            user,
          })
        }
      }
    }
    const tweet: Tweet = Object.assign({}, tweetEntity, {
      user,
      quoted_status: quotedTweet,
    })
    return tweet
  }

  function initializeTweetElementInspecter(reactRoot: Element) {
    new MutationObserver(mutations => {
      for (const elem of getAddedElementsFromMutations(mutations)) {
        const tweetElems = elem.querySelectorAll<HTMLElement>('[data-testid=tweet]')
        tweetElems.forEach(elem => {
          if (elem.querySelector('.redblock-btn')) {
            return
          }
          const tweet = inspectTweetElement(elem)
          if (!tweet) {
            return
          }
          elem.dispatchEvent(
            new CustomEvent<OneClickBlockableTweetElement>('RedBlock<-OnTweetElement', {
              bubbles: true,
              detail: {
                tweet,
              },
            })
          )
          if (tweet.is_quote_status && tweet.quoted_status) {
            elem.dispatchEvent(
              new CustomEvent<OneClickBlockableTweetElement>('RedBlock<-OnQuotedTweetElement', {
                bubbles: true,
                detail: {
                  tweet: tweet.quoted_status,
                },
              })
            )
          }
        })
      }
    }).observe(reactRoot, {
      subtree: true,
      childList: true,
    })
  }

  function initializeUserCellElementInspecter(reactRoot: Element) {
    function handleElem(elem: HTMLElement) {
      if (elem.querySelector('.redblock-btn')) {
        return
      }
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
    if (!isLoggedIn()) {
      console.info('redblock: not logged in. does nothing.')
      return
    }
    const reactRoot = document.getElementById('react-root')
    if (!reactRoot) {
      return
    }
    if ('_reactRootContainer' in reactRoot) {
      initializeListener()
      initializeTweetElementInspecter(reactRoot)
      initializeUserCellElementInspecter(reactRoot)
    } else {
      setTimeout(initialize, 500)
    }
  }

  requestIdleCallback(initialize, {
    timeout: 10000,
  })
})()
