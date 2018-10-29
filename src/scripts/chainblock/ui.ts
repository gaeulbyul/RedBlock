const CHAINBLOCK_UI_HTML = `
  <div class="redblock-dialog modal-content is-autoPosition">
    <progress class="redblock-progress"></progress>
    <div class="redblock-progress-text">
      (<span class="redblock-state"></span>):
      @<span class="redblock-target-username">?</span>의 팔로워
      <span class="redblock-target-total-followers">0</span>명 중
      <span class="redblock-blocked-user">0</span>명 차단
      <br>
      <small>
        진행율: <span class="redblock-progress-percentage">0</span>%,
        이미 차단: <span class="redblock-already-blocked-user">0</span>,
        스킵: <span class="redblock-skipped-user">0</span>,
        실패: <span class="redblock-failed-user">0</span>
      </small>
      <div hidden class="redblock-ratelimit">
        리밋입니다. (예상리셋시간: <span class="redblock-ratelimit-reset"></span>)
      </div>
      <div class="redblock-controls">
        <button class="redblock-close small btn normal-btn">닫기</button>
      </div>
    </div>
  </div>
`

// shortcut function to change element's textContent
function setText (root: Element) {
  return (query: string, text: string | number) => {
    const elem = root.querySelector(query)
    if (elem) {
      elem.textContent = text.toString()
    }
  }
}

class ChainBlockUI extends EventEmitter {
  private readonly rootElem: HTMLElement = document.createElement('div')
  constructor () {
    super()
    this.rootElem.innerHTML = CHAINBLOCK_UI_HTML
    this.updateState(ChainBlockUIState.Initial)
    this.applyStyleOnMobile()
  }
  private applyStyleOnMobile () {
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
  public show (appendTarget: HTMLElement) {
    this.attachEvents()
    appendTarget.appendChild(this.rootElem)
  }
  public updateTarget (targetUser: TwitterUser) {
    const rootElem = this.rootElem
    const txt = setText(rootElem)
    txt('.redblock-target-username', targetUser.screen_name)
    txt('.redblock-target-total-followers', targetUser.followers_count)
    rootElem.querySelector<HTMLProgressElement>('.redblock-progress')!.max = targetUser.followers_count
  }
  public updateProgress (progress: Readonly<ChainBlockProgress>) {
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
      progress.skipped
    ])
    const percentage = Math.round((progressBarValue / progress.total) * 1000) / 10
    txt('.redblock-progress-percentage', percentage)
    rootElem.querySelector<HTMLProgressElement>('.redblock-progress')!.value = progressBarValue
  }
  public updateState (state: ChainBlockUIState) {
    const rootElem = this.rootElem
    const message: {[key: number]: string} = {
      [ChainBlockUIState.Initial]: '대기 중',
      [ChainBlockUIState.Completed]: '완료',
      [ChainBlockUIState.Running]: '작동 중...',
      [ChainBlockUIState.RateLimited]: '일시정지(리밋)',
      [ChainBlockUIState.Stopped]: '정지',
      [ChainBlockUIState.Error]: '오류 발생!'
    }
    setText(rootElem)('.redblock-state', message[state] || '')
  }
  public rateLimited (limit: Limit) {
    const rootElem = this.rootElem
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone
    const formatter = new Intl.DateTimeFormat('ko-KR', {
      timeZone,
      hour: '2-digit',
      minute: '2-digit'
    })
    // 120000 = 1000 * 60 * 2 = 리밋상태에서 체인블락의 delay간격
    const datetime = new Date((limit.reset * 1000) + 120000)
    const dtstr = formatter.format(datetime)
    rootElem.querySelector<HTMLElement>('.redblock-ratelimit')!.hidden = false
    rootElem.querySelector('.redblock-ratelimit-reset')!.textContent = dtstr
  }
  public rateLimitResetted () {
    this.rootElem.querySelector<HTMLElement>('.redblock-ratelimit')!.hidden = true
  }
  public complete (progress: ChainBlockProgress) {
    this.updateProgress(progress)
    setText(this.rootElem)('.redblock-progress-percentage', 100)
    const message = `체인블락 완료! 총 ${progress.blockSuccess}명의 사용자를 차단했습니다.`
    browser.runtime.sendMessage<RBNotifyMessage>({
      action: Action.ShowNotify,
      notification: {
        message
      }
    })
  }
  public error (message: string) {
    window.alert(`체인블락 오류 발생!\n메시지: "${message}"`)
  }
  public stop (progress: ChainBlockProgress) {
    this.updateProgress(progress)
    const message = `체인블락 중지! 총 ${progress.blockSuccess}명의 사용자를 차단했습니다.`
    browser.runtime.sendMessage<RBNotifyMessage>({
      action: Action.ShowNotify,
      notification: {
        message
      }
    })
  }
  public close () {
    this.rootElem.remove()
  }
  private attachEvents () {
    this.rootElem.querySelector('.redblock-close')!.addEventListener('click', event => {
      event.preventDefault()
      this.emit('ui-close')
    })
  }
  public static changeUserProfileButtonToBlocked (user: TwitterUser) {
    const userId = user.id_str
    Array
      .from(document.querySelectorAll<HTMLElement>(`.ProfileCard[data-user-id="${userId}"] .user-actions`))
      .forEach(actions => {
        actions.classList.remove('not-following')
        actions.classList.add('blocked')
      })
    Array
      .from(document.querySelectorAll<HTMLElement>(`#react-root div[role=button][data-testid="${userId}-follow"]`))
      .forEach(elem => {
        elem.hidden = true
        Object.assign(elem.style, {
          visibility: 'hidden',
          display: 'none'
        })
      })
  }
}
