{
  const setOfBadWords: BadWordItem[] = []

  function loadBadWords(badWords: BadWordItem[]) {
    setOfBadWords.length = 0
    setOfBadWords.push(...badWords)
  }

  browser.storage.local.get('badWords').then(storage => {
    const { badWords } = (storage as unknown) as Partial<RedBlockStorage>
    loadBadWords(badWords || [])
  })

  browser.storage.onChanged.addListener(changes => {
    if (!changes.badWords) {
      return
    }
    const newBadWords = changes.badWords.newValue as BadWordItem[]
    loadBadWords(newBadWords || [])
  })

  function checkBadWord(text: string): BadWordItem | null {
    for (const badWord of setOfBadWords) {
      if (!badWord.enabled) {
        continue
      }
      if (badWord.regexp) {
        const pattern = new RegExp(badWord.word, 'i')
        if (pattern.test(text)) {
          return badWord
        }
      } else {
        const loweredText = text.toLowerCase()
        const loweredWord = badWord.word.toLowerCase()
        if (loweredText.includes(loweredWord)) {
          return badWord
        }
      }
    }
    return null
  }

  function checkBadWordFromUserProfile({
    description,
    name,
    screen_name,
  }: TwitterUser): BadWordItem | null {
    const textsToFind = [description, name, screen_name]
    for (const text of textsToFind) {
      const bw = checkBadWord(text)
      if (bw) {
        return bw
      }
    }
    return null
  }

  function markUser(detail: MarkUserParams) {
    const event = new CustomEvent<MarkUserParams>('RedBlock->MarkUser', {
      detail,
    })
    document.dispatchEvent(event)
    const { userId, userAction } = detail
    if (userAction === 'Block') {
      const oneclickButton = document.querySelector(`[data-redblock-btn-user="${userId}"]`)
      oneclickButton?.remove()
    }
  }

  function toastMessage(detail: string) {
    const event = new CustomEvent<string>('RedBlock->ToastMessage', {
      detail,
    })
    document.dispatchEvent(event)
  }

  async function blockUser(user: TwitterUser) {
    return browser.runtime.sendMessage<RBMessageToBackground.BlockSingleUser>({
      messageType: 'BlockSingleUser',
      messageTo: 'background',
      user,
    })
  }

  //async function unblockUser(user: TwitterUser) {
  //  return browser.runtime.sendMessage<RBActions.UnblockSingleUser>({
  //    actionType: 'UnblockSingleUser',
  //    user,
  //  })
  //}

  function generateBlockButton(user: TwitterUser): HTMLButtonElement {
    const btn = document.createElement('button')
    btn.type = 'button'
    btn.className = 'redblock-btn redblock-block-btn'
    btn.textContent = i18n.getMessage('block')
    btn.title = `[Red Block] ${i18n.getMessage('block_xxx', user.screen_name)}`
    const badWordCheckResult = checkBadWordFromUserProfile(user)
    if (badWordCheckResult) {
      btn.className += ' suggested'
      btn.title += '\n'
      btn.title += i18n.getMessage('user_profile_contains', badWordCheckResult.word)
    } else {
      btn.className += ' manual'
    }
    btn.setAttribute('data-redblock-btn-user', user.id_str)
    btn.addEventListener('click', event => {
      event.preventDefault()
      blockUser(user)
      user.blocking = true
      markUser({
        userAction: 'Block',
        userId: user.id_str,
      })
      toastMessage(`[Red Block] ${i18n.getMessage('blocked_xxx', user.screen_name)}`)
    })
    return btn
  }

  function addBlockButtonToTweetElem(elem: HTMLElement, user: TwitterUser) {
    const caret = elem.querySelector('[data-testid=caret]')!
    const btn = generateBlockButton(user)
    btn.classList.add('redblock-btn-tweet')
    caret.before(btn)
  }

  function addBlockButtonToQuotedTweetElem(elem: HTMLElement, user: TwitterUser) {
    const article = elem.closest('article[role=article]')!
    const blockquote = article.querySelector('div[role=link]')!
    const timestamp = blockquote.querySelector('time')!
    const btn = generateBlockButton(user)
    btn.classList.add('redblock-btn-tweet')
    timestamp.after(btn)
  }

  function addBlockButtonToUserCellElem(elem: HTMLElement, user: TwitterUser) {
    const maybeUserNameElem = elem.querySelector('[dir=ltr] > span')!
    const btn = generateBlockButton(user)
    btn.classList.add('redblock-btn-usercell')
    maybeUserNameElem.after(btn)
  }

  function shouldSkip(user: TwitterUser) {
    return user.following || user.follow_request_sent || user.blocking
  }

  document.addEventListener('RedBlock<-OnTweetElement', event => {
    const customEvent = event as CustomEvent<OneClickBlockableTweetElement>
    const elem = customEvent.target as HTMLElement
    const { user } = customEvent.detail.tweet
    if (shouldSkip(user)) {
      return
    }
    addBlockButtonToTweetElem(elem, user)
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
    addBlockButtonToUserCellElem(elem, user)
  })
}
