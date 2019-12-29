import { SessionInfo } from '../../scripts/background/chainblock-session/session-common.js'
import { SessionStatus, UI_UPDATE_DELAY } from '../../scripts/common.js'
import { requestProgress, stopAllChainBlock, stopChainBlock } from '../popup.js'
import * as TextGenerate from '../../scripts/text-generate.js'

function calculatePercentage(session: SessionInfo): number {
  const { status, count } = session
  if (status === SessionStatus.Completed) {
    return 100
  }
  const max = count.total
  if (typeof max === 'number') {
    return Math.round((count.scraped / max) * 1000) / 10
  } else {
    return 0
  }
}

function renderProfileImageWithProgress(session: SessionInfo) {
  const {
    request: { purpose, target },
  } = session
  let user: TwitterUser
  switch (target.type) {
    case 'follower':
      user = target.user
      break
    case 'tweetReaction':
      user = target.tweet.user
      break
  }
  const width = 72
  const strokeWidth = 4
  const radius = width / 2 - strokeWidth * 2
  const circumference = radius * 2 * Math.PI
  const percent = calculatePercentage(session)
  const strokeDasharray = `${circumference} ${circumference}`
  const strokeDashoffset = circumference - (percent / 100) * circumference
  // if omit _${size}, will get original-size image
  const strokeColor = purpose === 'chainblock' ? 'crimson' : 'seagreen'
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
          stroke={strokeColor}
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
  const { purpose, target } = session.request
  let user: TwitterUser
  switch (target.type) {
    case 'follower':
      user = target.user
      break
    case 'tweetReaction':
      user = target.tweet.user
      break
  }
  const isChainBlock = purpose === 'chainblock'
  const isUnChainBlock = purpose === 'unchainblock'
  const purposeKor = isChainBlock ? '체인블락' : '언체인블락'
  function statusToString(status: SessionStatus): string {
    const statusMessageObj: { [key: number]: string } = {
      [SessionStatus.Initial]: '대기 중',
      [SessionStatus.Completed]: '완료',
      [SessionStatus.Running]: '실행 중…',
      [SessionStatus.RateLimited]: '리밋',
      [SessionStatus.Stopped]: '정지',
      [SessionStatus.Error]: '오류 발생!',
    }
    const statusMessage = statusMessageObj[status]
    return statusMessage
  }
  function renderText({ progress, status }: SessionInfo) {
    const statusMessage = statusToString(status)
    return (
      <div className="session-status">
        상태: {purposeKor} {statusMessage}
        <ul className="detail-progress">
          {isChainBlock && (
            <li>
              <b>차단: {progress.success.Block.toLocaleString()}</b>
            </li>
          )}
          {isUnChainBlock && (
            <li>
              <b>차단해제: {progress.success.UnBlock.toLocaleString()}</b>
            </li>
          )}
          {progress.success.Mute > 0 && <li>뮤트함: {progress.success.Mute.toLocaleString}</li>}
          {isChainBlock && progress.already > 0 && <li>이미 차단/뮤트함: {progress.already.toLocaleString()}</li>}
          {isUnChainBlock && progress.already > 0 && <li>이미 차단해제함: {progress.already.toLocaleString()}</li>}
          {progress.skipped > 0 && <li>스킵: {progress.skipped.toLocaleString()}</li>}
          {progress.failure > 0 && <li>실패: {progress.failure.toLocaleString()}</li>}
        </ul>
      </div>
    )
  }
  function isRunning(status: SessionStatus): boolean {
    const runningStatuses = [SessionStatus.Initial, SessionStatus.Running, SessionStatus.RateLimited]
    return runningStatuses.includes(status)
  }
  function renderControls({ sessionId, status, request }: SessionInfo) {
    function requestStopChainBlock() {
      if (isRunning(status)) {
        const confirmMessage = TextGenerate.confirmStopMessage(request)
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
      closeButtonTitleText = TextGenerate.stopButtonTitleMessage(request)
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
    <div className="session session-follower">
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

export default class ChainBlockSessionsPage extends React.Component<{}, ChainBlockSessionsPageState> {
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
      const confirmMessage = `실행중인 체인블락 및 언체인블락을 모두 중단하시겠습니까?`
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
          <ChainBlockSessionItem session={session as SessionInfo} key={session.sessionId} />
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
