import { listenExtensionMessages, injectBundle, toastMessage } from './content-common'
import { generateBlockButton, shouldSkip, unblockUserById } from './oneclick-block'
import { isEdge2EdgeLayout } from '../inject/edge2edge-layout'
import * as i18n from '../../scripts/i18n'

const reactRoot = document.getElementById('react-root')
listenExtensionMessages(reactRoot)

if (reactRoot) {
  injectBundle('twitter_inject')
}

function addBlockButtonOnTweet(elem: HTMLElement, user: TwitterUser) {
  const btn = generateBlockButton(user)
  btn.classList.add('redblock-btn-on-tweet')
  const caret = elem.querySelector('[data-testid=caret]')
  if (!caret) {
    debugger
    return
  }
  caret.before(btn)
}

function addBlockButtonUnderProfileImage(elem: HTMLElement, user: TwitterUser) {
  const btn = generateBlockButton(user)
  btn.classList.add('redblock-btn-under-profile')
  let elementToPlaceBlockButton: HTMLElement | null = null
  const profileImage = elem.querySelector('a[role=link][href^="/"][style^="height:"]')
  if (profileImage) {
    elementToPlaceBlockButton = profileImage.parentElement!
  }
  const profileImagePlaceholder = elem.querySelector('div[style^="background-color:"]')
  if (profileImagePlaceholder) {
    if (isEdge2EdgeLayout()) {
      elementToPlaceBlockButton = elem.children[0]!.children[0]! as HTMLElement
    } else {
      const link = profileImagePlaceholder.closest('a[role=link]')!
      elementToPlaceBlockButton = link.parentElement!
    }
  }
  if (!elementToPlaceBlockButton) {
    console.warn('failed to find element')
    return
  }
  elementToPlaceBlockButton.appendChild(btn)
}

function addBlockButtonToQuotedTweetElem(elem: HTMLElement, user: TwitterUser) {
  const article = elem.closest('article[role=article]')!
  const blockquote = article.querySelector('div[role=link]')!
  const timestamp = blockquote.querySelector('time')!
  const btn = generateBlockButton(user)
  btn.classList.add('redblock-btn-tweet')
  timestamp.after(btn)
}

document.addEventListener('RedBlock<-OnTweetElement', event => {
  const customEvent = event as CustomEvent<OneClickBlockableTweetElement>
  const elem = customEvent.target as HTMLElement
  const { user } = customEvent.detail.tweet
  if (shouldSkip(user)) {
    return
  }
  if (isEdge2EdgeLayout()) {
    addBlockButtonOnTweet(elem, user)
  } else {
    addBlockButtonUnderProfileImage(elem, user)
  }
})

document.addEventListener('RedBlock<-OnQuotedTweetElement', event => {
  const customEvent = event as CustomEvent<OneClickBlockableTweetElement>
  const elem = customEvent.target as HTMLElement
  const { user } = customEvent.detail.tweet
  if (shouldSkip(user)) {
    return
  }
  addBlockButtonToQuotedTweetElem(elem, user)
})

document.addEventListener('RedBlock<-OnUserCellElement', event => {
  const customEvent = event as CustomEvent<OneClickBlockableUserCellElement>
  const elem = customEvent.target as HTMLElement
  const { user } = customEvent.detail
  if (shouldSkip(user)) {
    return
  }
  addBlockButtonUnderProfileImage(elem, user)
})

document.addEventListener('RedBlock<-RequestUnblockUserById', event => {
  const customEvent = event as CustomEvent<UndoOneClickBlockByIdParam>
  const { userId, userName } = customEvent.detail
  unblockUserById(userId)
  toastMessage({
    text: `[Red Block] ${i18n.getMessage('unblocked_xxx', userName)}`,
  })
})
