const CHAINBLOCK_UI_HTML = (() => {
  const msgTargetUserName = i18n`script_ui_target_username`
  const msgTotalFollowers = i18n`script_ui_total_followers${''}`
  const msgBlockedFollowers = i18n`script_ui_blocked_followers${''}`
  const msgProgress = i18n`script_ui_progress${''}`
  const msgAlreadyBlocked = i18n`script_ui_already_blocked${''}`
  const msgSkipped = i18n`script_ui_skipped${''}`
  const msgFailed = i18n`script_ui_failed${''}`
  const msgRateLimited = i18n`script_ui_rate_limited`
  const msgLimitReset = i18n`script_ui_limit_reset_time${''}`
  const msgClose = i18n`script_ui_close`
  return `\
    <div class="redblock-dialog modal-content is-autoPosition">
      <progress class="redblock-progress"></progress>
      <div class="redblock-progress-text">
        (<span class="redblock-state"></span>):
        ${msgTargetUserName}
        ${msgTotalFollowers}
        ${msgBlockedFollowers}
        <br>
        <small>
          ${msgProgress},
          ${msgAlreadyBlocked},
          ${msgSkipped},
          ${msgFailed}
        </small>
        <div hidden class="redblock-ratelimit">
          ${msgRateLimited} (${msgLimitReset})
        </div>
        <div class="redblock-controls">
          <button class="redblock-close small btn normal-btn">${msgClose}</button>
        </div>
      </div>
    </div>`
})()

// shortcut function to change element's textContent
function setText(root: Element) {
  return (query: string, text: string | number) => {
    const elem = root.querySelector(query)
    if (elem) {
      elem.textContent = text.toString()
    }
  }
}

class ChainBlockUI extends EventEmitter {
  private readonly rootElem: HTMLElement = document.createElement('div')
  constructor() {
    super()
    this.rootElem.innerHTML = CHAINBLOCK_UI_HTML
    this.updateState(ChainBlockUIState.Initial)
    this.applyStyleOnMobile()
  }
  private applyStyleOnMobile() {
    if (!document.getElementById('react-root')) {
      return
    }
    const rootElem = this.rootElem
    const backgroundColor = document.body.style.backgroundColor
    rootElem.style.backgroundColor = backgroundColor
    if (/\bnight_mode=1\b/.test(document.cookie)) {
      rootElem.style.color = 'white'
    }
  }
  public show(appendTarget: HTMLElement) {
    this.attachEvents()
    appendTarget.appendChild(this.rootElem)
  }
  public updateTarget(targetUser: TwitterUser) {
    const rootElem = this.rootElem
    const txt = setText(rootElem)
    txt('.redblock-target-username', targetUser.screen_name)
    txt('.redblock-target-total-followers', targetUser.followers_count)
    rootElem.querySelector<HTMLProgressElement>('.redblock-progress')!.max =
      targetUser.followers_count
  }
  public updateProgress(progress: Readonly<ChainBlockProgress>) {
    const rootElem = this.rootElem
    const txt = setText(rootElem)
    txt('.redblock-blocked-user', progress.blockSuccess)
    txt('.redblock-already-blocked-user', progress.alreadyBlocked)
    txt('.redblock-skipped-user', progress.skipped)
    txt('.redblock-failed-user', progress.blockFail)
    const progressBarValue = _.sum([
      progress.alreadyBlocked,
      progress.blockFail,
      progress.blockSuccess,
      progress.skipped,
    ])
    const percentage =
      Math.round((progressBarValue / progress.total) * 1000) / 10
    txt('.redblock-progress-percentage', percentage)
    rootElem.querySelector<HTMLProgressElement>(
      '.redblock-progress'
    )!.value = progressBarValue
  }
  public updateProgressUser(update: ChainBlockProgressUpdate) {
    if (update.reason === 'blockSuccess') {
      ChainBlockUI.changeUserProfileButtonToBlocked(update.user)
    } else if (update.reason === 'skipped') {
      const skipped = this.rootElem.querySelector<HTMLElement>(
        '.redblock-skipped-user'
      )
      skipped!.title += `@${update.user.screen_name}\n`
    }
  }
  public updateState(state: ChainBlockUIState) {
    const rootElem = this.rootElem
    const message: { [key: number]: string } = {
      [ChainBlockUIState.Initial]: i18n`script_ui_state_initial`,
      [ChainBlockUIState.Completed]: i18n`script_ui_state_completed`,
      [ChainBlockUIState.Running]: i18n`script_ui_state_running`,
      [ChainBlockUIState.RateLimited]: i18n`script_ui_state_rate_limited`,
      [ChainBlockUIState.Stopped]: i18n`script_ui_state_stopped`,
      [ChainBlockUIState.Error]: i18n`script_ui_state_error`,
    }
    setText(rootElem)('.redblock-state', message[state] || '')
  }
  public rateLimited(limit: Limit) {
    const rootElem = this.rootElem
    /*
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone
    const formatter = new Intl.DateTimeFormat('ko-KR', {
      timeZone,
      hour: '2-digit',
      minute: '2-digit'
    })
    // 120000 = 1000 * 60 * 2 = 리밋상태에서 체인블락의 delay간격
    const dtstr = formatter.format(datetime)
    */
    const datetime = new Date(limit.reset * 1000 + 120000)
    const dtstr = [datetime.getHours(), datetime.getMinutes()].join(':')
    rootElem.querySelector<HTMLElement>('.redblock-ratelimit')!.hidden = false
    rootElem.querySelector('.redblock-ratelimit-reset')!.textContent = dtstr
  }
  public rateLimitResetted() {
    this.rootElem.querySelector<HTMLElement>(
      '.redblock-ratelimit'
    )!.hidden = true
  }
  public complete(progress: ChainBlockProgress) {
    this.updateProgress(progress)
    setText(this.rootElem)('.redblock-progress-percentage', 100)
    const progressBar = this.rootElem.querySelector<HTMLProgressElement>(
      '.redblock-progress'
    )
    progressBar!.value = progressBar!.max
    const message = i18n`script_ui_after_complete${progress.blockSuccess}`
    if (!document.hidden) {
      sleep(500).then(() => window.alert(message))
    }
    browser.runtime.sendMessage<RBNotifyMessage>({
      action: Action.ShowNotify,
      notification: {
        message,
      },
    })
  }
  public stop(progress: ChainBlockProgress) {
    this.updateProgress(progress)
    const message = i18n`script_ui_after_stop${progress.blockSuccess}`
    if (!document.hidden) {
      sleep(500).then(() => window.alert(message))
    }
    browser.runtime.sendMessage<RBNotifyMessage>({
      action: Action.ShowNotify,
      notification: {
        message,
      },
    })
  }
  public error(errorMessage: string) {
    window.alert(i18n`script_ui_alert_error${errorMessage}`)
  }
  public close() {
    this.rootElem.remove()
  }
  private attachEvents() {
    this.rootElem
      .querySelector('.redblock-close')!
      .addEventListener('click', event => {
        event.preventDefault()
        this.emit('ui-close')
      })
  }
  public static changeUserProfileButtonToBlocked(user: TwitterUser) {
    const userId = user.id_str
    Array.from(
      document.querySelectorAll<HTMLElement>(
        `.ProfileCard[data-user-id="${userId}"] .user-actions`
      )
    ).forEach(actions => {
      actions.classList.remove('not-following')
      actions.classList.add('blocked')
    })
    Array.from(
      document.querySelectorAll<HTMLElement>(
        `#react-root div[role=button][data-testid="${userId}-follow"]`
      )
    ).forEach(elem => {
      elem.hidden = true
      Object.assign(elem.style, {
        visibility: 'hidden',
        display: 'none',
      })
    })
  }
}
