{
  function markUser(detail: MarkUserParams) {
    const event = new CustomEvent<MarkUserParams>('RedBlock->MarkUser', {
      detail,
    })
    document.dispatchEvent(event)
  }

  function toastMessage(detail: string) {
    const event = new CustomEvent<string>('RedBlock->ToastMessage', {
      detail,
    })
    document.dispatchEvent(event)
  }

  async function blockUser(user: TwitterUser) {
    return browser.runtime.sendMessage<RBActions.BlockSingleUser>({
      actionType: 'BlockSingleUser',
      user,
    })
  }

  async function unblockUser(user: TwitterUser) {
    return browser.runtime.sendMessage<RBActions.UnblockSingleUser>({
      actionType: 'UnblockSingleUser',
      user,
    })
  }

  function addBlockButton(elem: HTMLElement, data: OneClickBlockableTweetElement) {
    const { user } = data
    const btn = elem.querySelector<HTMLButtonElement>('button.redblock-btn') || document.createElement('button')
    btn.type = 'button'
    // L10N-ME (content-script로 옮겼으므로 i18n API 사용가능)
    if (user.blocking) {
      btn.className = 'redblock-btn redblock-unblock-btn'
      btn.textContent = 'Unblock'
      btn.title = `[Red Block] Unblock @${user.screen_name}.` // L10N-ME
    } else {
      btn.className = 'redblock-btn redblock-block-btn'
      btn.textContent = 'Block'
      btn.title = `[Red Block] Block @${user.screen_name}.` // L10N-ME
    }
    function clickEventHandler(event: MouseEvent) {
      event.preventDefault()
      const userId = user.id_str
      const blurme: HTMLElement = elem.closest('article[role=article]') || elem
      if (user.blocking) {
        unblockUser(user)
        user.blocking = false
        markUser({
          verb: 'UnBlock',
          userId,
        })
        blurme.removeAttribute('data-redblock-blocked-tweet')
        toastMessage(`[Red Block] Unblocked @${user.screen_name}.`) // L10N-ME
      } else {
        blockUser(user)
        user.blocking = true
        markUser({
          verb: 'Block',
          userId,
        })
        blurme.setAttribute('data-redblock-blocked-tweet', '1')
        toastMessage(`[Red Block] Blocked @${user.screen_name}.`) // L10N-ME
      }
      // 버튼을 다시 만든다. 이 땐 차단여부가 바뀌었으므로
      // 차단대신 차단해제버튼이, 차단해제 대신 차단버튼이 나타난다.
      btn.removeEventListener('click', clickEventHandler)
      btn.remove()
      addBlockButton(elem, data)
    }
    btn.addEventListener('click', clickEventHandler, { once: true })
    const caret = elem.querySelector('[data-testid=caret]')
    if (caret) {
      caret.before(btn)
    }
  }

  document.addEventListener('RedBlock:onTweetElement', event => {
    const customEvent = event as CustomEvent<OneClickBlockableTweetElement>
    const elem = customEvent.target as HTMLElement
    addBlockButton(elem, customEvent.detail)
  })
}
