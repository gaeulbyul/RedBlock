const CHAINBLOCK_UI_HTML = `
  <div class="redblock-bg modal-container block-dialog" style="display:flex">
    <div class="redblock-dialog modal modal-content is-autoPosition">
      <div class="redblock-titlebar">
        <span class="redblock-title">§체인블락</span>
      </div>
      <div class="redblock-progress-container">
        <progress class="redblock-progress"></progress>
        <div class="redblock-progress-text">
          <span class="redblock-target-name">?</span>의 팔로워
          <span class="redblock-target-total-followers">0</span>명 중
          <span class="redblock-blocked-user">0</span>명 차단함.
          <br>
          <small>
            진행율: <span class="redblock-progress-percentage">0</span>%,
            이미 차단: <span class="redblock-already-blocked-user">0</span>명,
            스킵: <span class="redblock-skipped-user">0</span>명,
            실패: <span class="redblock-failed-user">0</span>명
          </small>
          <div hidden class="redblock-ratelimit">
            리밋입니다. (예상리셋시간: <span class="redblock-ratelimit-reset"></span>)
          </div>
        </div>
      </div>
      <hr class="redblock-hr">
      <div class="redblock-controls">
        <button class="redblock-close btn normal-btn">닫기</button>
      </div>
    </div>
  </div>
`

class ChainBlockUI {
  private ui: HTMLElement
  // public scraper: AsyncIterableIterator<TwitterUser>
  constructor () {
    const ui = this.ui = document.createElement('div')
    ui.innerHTML = CHAINBLOCK_UI_HTML
    document.body.appendChild(ui)
    this.attachEvent()
  }
  public updateTarget (targetUser: TwitterUser) {
    document.querySelector('.redblock-target-name')!.textContent = targetUser.name
    document.querySelector('.redblock-target-total-followers')!.textContent = targetUser.followers_count.toString()
  }
  public updateProgress (state: ChainBlockerProgressState) {
    document.querySelector('.redblock-blocked-user')!.textContent = state.blockSuccess.toString()
    document.querySelector('.redblock-already-blocked-user')!.textContent = state.alreadyBlocked.toString()
    document.querySelector('.redblock-skipped-user')!.textContent = state.skipped.toString()
    document.querySelector('.redblock-failed-user')!.textContent = state.blockFail.toString()
    const progressElem = this.ui.querySelector<HTMLProgressElement>('.redblock-progress')
    const prg = state.alreadyBlocked + state.skipped + state.blockSuccess + state.blockFail
    const percentage = Math.round(prg / state.total * 100)
    progressElem!.value = percentage
  }
  public rateLimited (limit: Limit) {
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone
    const formatter = new Intl.DateTimeFormat('ko-KR', {
      timeZone,
      hour: '2-digit',
      minute: '2-digit'
    })
    // 120000 = 1000 * 60 * 2 = 리밋상태에서 체인블락의 delay간격
    const datetime = new Date((limit.reset * 1000) + 120000)
    const dtstr = formatter.format(datetime)
    document.querySelector<HTMLElement>('.redblock-ratelimit')!.hidden = false
    document.querySelector('.redblock-ratelimit-reset')!.textContent = dtstr
  }
  public rateLimitResetted () {
    document.querySelector<HTMLElement>('.redblock-ratelimit')!.hidden = true
  }
  private attachEvent () {
    this.ui.querySelector('.redblock-close')!.addEventListener('click', event => {
      event.preventDefault()
      this.cleanup()
    })
  }
  cleanup () {
    this.ui.remove()
  }
}
