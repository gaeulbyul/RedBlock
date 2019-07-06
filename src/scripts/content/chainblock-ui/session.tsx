namespace RedBlock.Content.UI.Session {
  interface RedBlockSessionUIProps {
    sessionId: string
    target: {
      user: TwitterUser
      totalCount: number | null
    }
    status: ChainBlockSessionStatus
    options: ChainBlockSessionOptions
    progress: ChainBlockSessionProgress
    limit: Limit | null
  }
  interface RedBlockSessionUIState {
    hidden: boolean
  }
  function isRunningStatus(status: ChainBlockSessionStatus): boolean {
    const runningStatuses = [
      ChainBlockSessionStatus.Initial,
      ChainBlockSessionStatus.Running,
      ChainBlockSessionStatus.RateLimited,
    ]
    return runningStatuses.includes(status)
  }
  export class RedBlockSessionUI extends React.Component<RedBlockSessionUIProps, RedBlockSessionUIState> {
    public state: RedBlockSessionUIState = {
      hidden: false,
    }
    private requestStopChainBlock(event: React.MouseEvent<HTMLButtonElement>) {
      event.preventDefault()
      const { status } = this.props
      const shouldConfirm = isRunningStatus(status)
      if (shouldConfirm) {
        const { screen_name: userName } = this.props.target.user
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
      this.setState({
        hidden: true,
      })
    }
    private renderProgressBar(): JSX.Element {
      const {
        target: { totalCount },
        status,
        progress,
      } = this.props
      const isInitial = status === ChainBlockSessionStatus.Initial
      const isCompleted = status === ChainBlockSessionStatus.Completed
      const value = isInitial ? undefined : progress.totalScraped
      const max = (isCompleted ? progress.totalScraped : totalCount) || undefined
      let percentage = '0'
      if (isCompleted) {
        percentage = '100'
      } else if (typeof max === 'number') {
        percentage = String(Math.round((progress.totalScraped / max) * 1000) / 10)
      } else {
        percentage = '??'
      }
      const pprops = { value, max, title: `진행율: ${percentage}%` }
      const elem = <progress className="redblock-progress" {...pprops} />
      return elem
    }
    private renderStatus(): JSX.Element {
      const {
        target: { user },
        status,
        options,
      } = this.props
      const statusMessageObj: { [key: number]: string } = {
        [ChainBlockSessionStatus.Initial]: '대기 중',
        [ChainBlockSessionStatus.Completed]: '완료',
        [ChainBlockSessionStatus.Running]: '실행 중…',
        [ChainBlockSessionStatus.RateLimited]: '리밋',
        [ChainBlockSessionStatus.Stopped]: '정지',
        [ChainBlockSessionStatus.Error]: '오류 발생!',
      }
      const statusMessage = `[${statusMessageObj[status]}]`
      const targetListMessage = options.targetList === 'followers' ? '팔로워' : '팔로잉'
      const progressMessage = `@${user.screen_name}의 ${targetListMessage}`
      return (
        <div>
          <span style={{ marginRight: '.1rem' }}>{statusMessage}</span>
          <span>{progressMessage}</span>
        </div>
      )
    }
    private renderLimited(): JSX.Element | null {
      const { limit } = this.props
      if (!limit) {
        return null
      }
      const { timeZone, locale } = Intl.DateTimeFormat().resolvedOptions()
      const formatter = new Intl.DateTimeFormat(locale, {
        timeZone,
        hour: '2-digit',
        minute: '2-digit',
      })
      const resetDateTime = formatter.format(limit.reset * 1000 + 120000)
      return <div>리밋입니다. 잠시만 기다려주세요. (예상 해제시각: {resetDateTime})</div>
    }
    private renderControls(): JSX.Element {
      return (
        <div className="redblock-controls">
          <button className="redblock-close" onClick={this.requestStopChainBlock.bind(this)}>
            닫기
          </button>
        </div>
      )
    }
    public render() {
      const { status, progress } = this.props
      const { hidden } = this.state
      const isLimited = status === ChainBlockSessionStatus.RateLimited
      const miniProgress = [
        `차단: ${progress.blockSuccess}`,
        `이미 차단함: ${progress.alreadyBlocked}`,
        `스킵: ${progress.skipped}`,
        `실패: ${progress.blockFail}`,
      ].join(', ')
      return (
        <div className="redblock-dialog" hidden={hidden}>
          {this.renderProgressBar()}
          <div>
            {this.renderStatus()}
            <small>{miniProgress}</small>
            {isLimited && this.renderLimited()}
          </div>
          {this.renderControls()}
        </div>
      )
    }
  }
}
