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
  public state: ChainBlockUIState = ChainBlockUIState.Initial
  // public scraper: AsyncIterableIterator<TwitterUser>
  constructor () {
    super()
    this.rootElem.innerHTML = CHAINBLOCK_UI_HTML
  }
  public show (appendTarget: HTMLElement) {
    this.attachEvent()
    appendTarget.appendChild(this.rootElem)
  }
  public start () {
    this.updateState(ChainBlockUIState.Running)
  }
  public updateTarget (targetUser: TwitterUser) {
    const rootElem = this.rootElem
    const txt = setText(rootElem)
    txt('.redblock-target-username', targetUser.screen_name)
    txt('.redblock-target-total-followers', targetUser.followers_count)
    rootElem.querySelector<HTMLProgressElement>('.redblock-progress')!.max = targetUser.followers_count
  }
  public updateProgress (progress: ChainBlockProgress) {
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
    rootElem.querySelector<HTMLProgressElement>('.redblock-progress')!.value = progressBarValue
  }
  public updateState (state: ChainBlockUIState) {
    this.emit('update-state', state)
    this.state = state
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
    this.updateState(ChainBlockUIState.RateLimited)
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
    this.updateState(ChainBlockUIState.Running)
    this.rootElem.querySelector<HTMLElement>('.redblock-ratelimit')!.hidden = true
  }
  public complete (progress: ChainBlockProgress) {
    const currentState = this.state
    this.updateState(ChainBlockUIState.Completed)
    this.updateProgress(progress)
    const reason = currentState === ChainBlockUIState.Running ? '완료' : '중단'
    const message = `체인블락 ${reason}! 총 ${progress.blockSuccess}명의 사용자를 차단했습니다.`
    browser.runtime.sendMessage({
      action: Action.ShowNotify,
      title: 'RedBlock',
      message
    })
    // window.alert(msg)
  }
  public error (message: string) {
    this.updateState(ChainBlockUIState.Error)
    window.alert(`체인블락 오류 발생!\n메시지: "${message}"`)
  }
  public stop () {
    this.updateState(ChainBlockUIState.Stopped)
  }
  public close () {
    this.updateState(ChainBlockUIState.Closed)
    this.rootElem.remove()
  }
  private attachEvent() {
    this.rootElem.addEventListener('redblock::stop-chainblock', () => { })
    this.rootElem.querySelector('.redblock-close')!.addEventListener('click', event => {
      event.preventDefault()
      const shouldNotCloseState = [
        ChainBlockUIState.Running,
        ChainBlockUIState.RateLimited,
        ChainBlockUIState.Initial
      ]
      const shouldNotClose = (shouldNotCloseState.includes(this.state) && !window.confirm('체인블락을 중단할까요?'))
      if (!shouldNotClose) {
        this.close()
      }
    })
  }
}
