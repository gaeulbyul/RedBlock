namespace RedBlock.Popup.UI.Pages.ChainBlockSessions {
  function calculatePercentage(session: SessionInfo): number {
    const { target, progress, status } = session
    const isCompleted = status === SessionStatus.Completed
    const max = (isCompleted ? progress.totalScraped : target.totalCount) || undefined
    if (isCompleted) {
      return 100
    } else if (typeof max === 'number') {
      return Math.round((progress.totalScraped / max) * 1000) / 10
    } else {
      return 0
    }
  }

  function renderProfileImageWithProgress(session: SessionInfo) {
    const {
      target: { user },
    } = session
    const width = 72
    const strokeWidth = 4
    const radius = width / 2 - strokeWidth * 2
    const circumference = radius * 2 * Math.PI
    const percent = calculatePercentage(session)
    const strokeDasharray = `${circumference} ${circumference}`
    const strokeDashoffset = circumference - (percent / 100) * circumference
    // if omit _${size}, will get original-size image
    const biggerProfileImageUrl = user.profile_image_url_https.replace('_normal', '_bigger')
    return (
      <svg width={width} height={width}>
        <defs>
          <circle id="profile-circle" cx={width / 2} cy={width / 2} r={radius}></circle>
          <clipPath id="profile-circle-clip">
            <use href="#profile-circle" />
          </clipPath>
        </defs>
        <g clipPath="url(#profile-circle-clip)">
          <image
            clipPath="url(#profile-circle-clip)"
            width={width}
            height={width}
            href={biggerProfileImageUrl}
            transform="scale(0.9)"
            style={{
              transformOrigin: '50% 50%',
            }}
          />
          <use
            href="#profile-circle"
            stroke="crimson"
            strokeWidth={strokeWidth}
            fill="transparent"
            style={{
              strokeDasharray,
              strokeDashoffset,
              transform: 'rotate(-90deg)',
              transformOrigin: '50% 50%',
              transition: 'stroke-dashoffset 400ms ease-in-out',
            }}
          ></use>
        </g>
      </svg>
    )
  }

  function ChainBlockSessionItem(props: { session: SessionInfo }) {
    const { session } = props
    const { user } = session.target
    function statusToString(status: SessionStatus): string {
      const statusMessageObj: { [key: number]: string } = {
        [SessionStatus.Initial]: '대기 중',
        [SessionStatus.Completed]: '완료',
        [SessionStatus.Running]: '실행 중…',
        [SessionStatus.RateLimited]: '리밋',
        [SessionStatus.Stopped]: '정지',
        [SessionStatus.Error]: '오류 발생!',
      }
      const statusMessage = `[${statusMessageObj[status]}]`
      return statusMessage
    }
    function renderText({ progress, status }: SessionInfo) {
      const statusMessage = statusToString(status)
      return (
        <div>
          <small>
            {statusMessage} {' / '}
            <b>차단: {progress.blockSuccess.toLocaleString()}</b>
            {progress.alreadyBlocked > 0 && ` / 이미 차단함: ${progress.alreadyBlocked.toLocaleString()}`}
            {progress.skipped > 0 && ` / 스킵: ${progress.skipped.toLocaleString()}`}
            {progress.blockFail > 0 && ` / 실패: ${progress.blockFail.toLocaleString()}`}
          </small>
        </div>
      )
    }
    function isRunning(status: SessionStatus): boolean {
      const runningStatuses = [SessionStatus.Initial, SessionStatus.Running, SessionStatus.RateLimited]
      return runningStatuses.includes(status)
    }
    function renderControls({ sessionId, status, target }: SessionInfo) {
      const userName = target.user.screen_name
      function requestStopChainBlock() {
        if (isRunning(status)) {
          const confirmMessage = `@${userName}에게 실행중인 체인블락을 중단하시겠습니까?`
          if (!window.confirm(confirmMessage)) {
            return
          }
        }
        stopChainBlock(sessionId)
      }
      let closeButtonText = '닫기'
      let closeButtonTitleText = ''
      if (isRunning(status)) {
        closeButtonText = '중지'
        closeButtonTitleText = `@${userName}에게 실행중인 체인블락을 중지합니다.`
      }
      return (
        <div className="controls align-to-end">
          <button type="button" title={closeButtonTitleText} onClick={requestStopChainBlock}>
            {closeButtonText}
          </button>
        </div>
      )
    }
    return (
      <div className="session" key={session.sessionId}>
        <div className="target-user-info">
          <div className="profile-image-area">{renderProfileImageWithProgress(session)}</div>
          <div className="profile-right-area">
            <div className="profile-right-info">
              <div className="ellipsis nickname" title={user.name}>
                {user.name}
              </div>
              <div className="username" title={'@' + user.screen_name}>
                <a
                  target="_blank"
                  rel="noopener noreferer"
                  href={`https://twitter.com/${user.screen_name}`}
                  title={`https://twitter.com/${user.screen_name} 로 이동`}
                >
                  @{user.screen_name}
                </a>
              </div>
              {renderText(session)}
            </div>
          </div>
        </div>
        {renderControls(session)}
      </div>
    )
  }

  interface ChainBlockSessionsPageState {
    sessions: SessionInfo[]
  }

  export class ChainBlockSessionsPage extends React.Component<{}, ChainBlockSessionsPageState> {
    public state: ChainBlockSessionsPageState = { sessions: [] }
    private _interval = -1
    private __msgListener_real(msgobj: any) {
      if (!(typeof msgobj === 'object' && 'messageType' in msgobj)) {
        return
      }
      if (msgobj.messageType === 'ChainBlockInfoMessage') {
        const msg = msgobj as RBChainBlockInfoMessage
        this.setState({
          sessions: msg.infos,
        })
      }
    }
    private _msgListener = this.__msgListener_real.bind(this)
    public componentDidMount() {
      browser.runtime.onMessage.addListener(this._msgListener)
      this._interval = window.setInterval(() => {
        requestProgress().catch(() => {})
      }, UI_UPDATE_DELAY)
    }
    public componentWillUnmount() {
      browser.runtime.onMessage.removeListener(this._msgListener)
      window.clearInterval(this._interval)
    }
    private renderGlobalControls() {
      function requestStopAllChainBlock() {
        const confirmMessage = `실행중인 체인블락을 모두 중단하시겠습니까?`
        if (!window.confirm(confirmMessage)) {
          return
        }
        stopAllChainBlock()
      }
      return (
        <div className="controls align-to-end">
          <button type="button" onClick={requestStopAllChainBlock}>
            모두 정지
          </button>
        </div>
      )
    }
    renderSessions() {
      return (
        <div className="chainblock-sessions">
          {this.state.sessions.map(session => (
            <ChainBlockSessionItem session={session} />
          ))}
        </div>
      )
    }
    renderEmptySessions() {
      return (
        <div className="chainblock-suggest-start">
          현재 진행중인 세션이 없습니다. 체인블락을 실행하려면 "세 세션" 탭을 눌러주세요.
        </div>
      )
    }
    render() {
      const isSessionExist = this.state.sessions.length > 0
      return (
        <div>
          {this.renderGlobalControls()}
          <hr />
          {isSessionExist ? this.renderSessions() : this.renderEmptySessions()}
        </div>
      )
    }
  }
}
