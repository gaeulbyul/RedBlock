import * as i18n from '../../scripts/i18n'
import { isEdge2EdgeLayout } from '../inject/edge2edge-layout'
import { injectBundle, listenExtensionMessages, toastMessage } from './content-common'
import { generateBlockButton, shouldSkip, unblockUserById } from './oneclick-block'

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
    return
  }
  caret.before(btn)
}

function addBlockButtonUnderProfileImage(elem: HTMLElement, user: TwitterUser) {
  const btn = generateBlockButton(user)
  btn.classList.add('redblock-btn-under-profile')
  // for tweet
  const profileImage = elem.querySelector<HTMLElement>('div[data-testid=Tweet-User-Avatar]')
  if (profileImage) {
    profileImage.appendChild(btn)
    return
  }
  // for UserCell
  const profileImage2 = elem.querySelector<HTMLElement>('div[data-testid^=UserAvatar-Container-]')
  if (profileImage2) {
    profileImage2.parentElement!.appendChild(btn)
    return
  }
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
