interface RedBlockUIState {
  sessions: ChainBlockSessionInfo
}
interface RedBlockSessionUIProps {
  sessionId: string
  targetUser: TwitterUser
  status: ChainBlockSessionStatus
  progress: ChainBlockSessionProgress
}
namespace RedBlock.Content.UI {
  const UI_UPDATE_DELAY = 1000
  class RedBlockSessionUI extends React.Component<RedBlockSessionUIProps, {}> {
    requestStopChainBlock(event: React.MouseEvent<HTMLButtonElement>) {
      event.preventDefault()
      const { status } = this.props
      const shouldConfirmStatuses = [
        ChainBlockSessionStatus.Initial,
        ChainBlockSessionStatus.Running,
        ChainBlockSessionStatus.RateLimited,
      ]
      const shouldConfirm = shouldConfirmStatuses.includes(status)
      if (shouldConfirm) {
        const { screen_name: userName } = this.props.targetUser
        const confirmMessage = `@${userName}에게 실행한 체인블락을 중단하시겠습니까?`
        if (!window.confirm(confirmMessage)) {
          return
        }
      }
      const sessionId = this.props.sessionId
      browser.runtime.sendMessage<RBStopMessage>({
        action: Action.StopChainBlock,
        sessionId,
      })
    }
    render() {
      const { targetUser, status, progress } = this.props
      const isInitial = status === ChainBlockSessionStatus.Initial
      const isCompleted = status === ChainBlockSessionStatus.Completed
      const statusMessageObj: { [key: number]: string } = {
        [ChainBlockSessionStatus.Initial]: '대기 중',
        [ChainBlockSessionStatus.Completed]: '완료',
        [ChainBlockSessionStatus.Running]: '실행 중…',
        [ChainBlockSessionStatus.RateLimited]: '리밋',
        [ChainBlockSessionStatus.Stopped]: '정지',
        [ChainBlockSessionStatus.Error]: '오류 발생!',
      }
      const statusMessage = statusMessageObj[status]
      const progressBarVal = isInitial ? undefined : progress.totalScraped
      const progressBarMax = isCompleted ? progress.totalScraped : targetUser.followers_count
      const percentage = isCompleted ? 100 : Math.round((progress.totalScraped / progressBarMax) * 1000) / 10
      return (
        <div className="redblock-dialog">
          <progress className="redblock-progress" value={progressBarVal} max={progressBarMax} />
          <div>
            (<span className="redblock-state">{statusMessage}</span>): @{targetUser.screen_name}의 팔로워{' '}
            {progress.blockSuccess}명 차단
            <br />
            <small>
              진행율: {percentage}%, 이미 차단: {progress.alreadyBlocked}, 스킵: {progress.skipped}, 실패:{' '}
              {progress.blockFail}
            </small>
            <div hidden className="redblock-ratelimit">
              리밋입니다. 잠시만 기다려주세요. (예상리셋시각: <span className="redblock-ratelimit-reset" />)
            </div>
          </div>
          <div className="redblock-controls">
            <button className="redblock-close" onClick={this.requestStopChainBlock.bind(this)}>
              닫기
            </button>
          </div>
        </div>
      )
    }
  }
  class RedBlockUI extends React.Component<{}, RedBlockUIState> {
    private intervals: number[] = []
    public state: RedBlockUIState = { sessions: {} }
    registerIntervalFunc(func: () => void, delay: number) {
      this.intervals.push(window.setInterval(func, delay))
    }
    clearAllIntervalFuncs() {
      this.intervals.forEach(n => window.clearInterval(n))
    }
    componentWillMount() {
      // this.intervals = []
      this.registerIntervalFunc(async () => {
        const cbSessionsInfoObj: ChainBlockSessionInfo = await browser.runtime
          .sendMessage({
            action: Action.RequestProgress,
          })
          .catch(err => {
            console.error(err)
            this.clearAllIntervalFuncs()
          })
        this.setState({
          sessions: cbSessionsInfoObj,
        })
      }, UI_UPDATE_DELAY)
    }
    componentWillUnmount() {
      this.clearAllIntervalFuncs()
    }
    render() {
      return (
        <div className="redblock-ui">
          {Array.from(Object.entries(this.state.sessions)).map(
            ([sessionId, { status, progress, targetUser }], index) => (
              <RedBlockSessionUI
                sessionId={sessionId}
                key={index}
                status={status}
                progress={progress}
                targetUser={targetUser}
              />
            )
          )}
        </div>
      )
    }
  }
  export function initialize() {
    const uiContainer = document.body.appendChild(document.createElement('div'))
    uiContainer.className = 'redblock-bg'
    ReactDOM.render(<RedBlockUI />, uiContainer)
  }
}

RedBlock.Content.UI.initialize()
