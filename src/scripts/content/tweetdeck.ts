import * as i18n from '~~/scripts/i18n'
import {
  listenExtensionMessages,
  injectScriptToPage,
  blockUserById,
  toastMessage,
} from './content-common'

listenExtensionMessages(null)

injectScriptToPage('bundled/tweetdeck_inject.bun.js')

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
  const tweetHeader = elem.querySelector('header.tweet-header')!
  tweetHeader.appendChild(btn)
}

document.addEventListener('RedBlock<-OneClickBlockTweetDeckUser', event => {
  const customEvent = event as CustomEvent<OneClickBlockTweetDeckUser>
  const elem = customEvent.target as HTMLElement
  const { tdUser } = customEvent.detail
  addBlockButtonForTweetDeck(elem, tdUser)
})