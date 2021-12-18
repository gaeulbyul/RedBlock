import * as i18n from '../../scripts/i18n'
import {
  blockUserById,
  injectBundle,
  listenExtensionMessages,
  toastMessage,
} from './content-common'

function generateTweetDeckBlockButton(user: TweetDeckUser) {
  const btn = document.createElement('button')
  btn.type = 'button'
  btn.className = 'redblock-btn redblock-block-btn manual'
  btn.textContent = i18n.getMessage('block')
  btn.title = `[Red Block] ${i18n.getMessage('block_xxx', user.screenName)}`
  /* TODO
  const badWordCheckResult = checkBadWordFromUserProfile(user)
  if (badWordCheckResult) {
    btn.className += ' suggested'
    btn.title += '\n'
    btn.title += i18n.getMessage('user_profile_contains', badWordCheckResult.word)
  } else {
    btn.className += ' manual'
  }
  */
  btn.setAttribute('data-redblock-btn-user', user.id)
  btn.addEventListener('click', event => {
    event.preventDefault()
    blockUserById(user.id)
    toastMessage({
      text: `${i18n.getMessage('blocked_xxx', user.screenName)}`,
    })
  })
  return btn
}

function addBlockButtonForTweetDeck(elem: HTMLElement, user: TweetDeckUser) {
  const btn = generateTweetDeckBlockButton(user)
  btn.classList.add('redblock-btn-under-profile')
  const accountSummary = elem.querySelector('.js-tweet-detail .account-summary')
  if (accountSummary) {
    return
  }
  const tweetHeader = elem.querySelector('header.tweet-header')
  if (tweetHeader) {
    tweetHeader.appendChild(btn)
  }
}

export function initializeForBlackBird() {
  injectBundle('blackbird_inject')
  listenExtensionMessages(null)
  document.addEventListener('RedBlock<-OneClickBlockTweetDeckUser', event => {
    const customEvent = event as CustomEvent<OneClickBlockTweetDeckUser>
    const elem = customEvent.target as HTMLElement
    const { tdUser } = customEvent.detail
    addBlockButtonForTweetDeck(elem, tdUser)
  })
}
