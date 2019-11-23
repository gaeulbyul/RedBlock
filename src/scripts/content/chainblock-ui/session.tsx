namespace RedBlock.Content.UI.Session {
  interface RedBlockSessionUIProps {
    session: ChainBlockSessionInfo
  }
  interface RedBlockSessionUIState {}
  function isRunningStatus(status: ChainBlockSessionStatus): boolean {
    const runningStatuses = [
      ChainBlockSessionStatus.Initial,
      ChainBlockSessionStatus.Running,
      ChainBlockSessionStatus.RateLimited,
    ]
    return runningStatuses.includes(status)
  }
  export class RedBlockSessionUI extends React.Component<RedBlockSessionUIProps, RedBlockSessionUIState> {
    public state: RedBlockSessionUIState = {}
    private requestStopChainBlock(event: React.MouseEvent<HTMLButtonElement>) {
      event.preventDefault()
      const { session } = this.props
      const shouldConfirm = isRunningStatus(session.status)
      if (shouldConfirm) {
        const { screen_name: userName } = session.target.user
        const confirmMessage = `@${userName}에게 실행한 체인블락을 중단하시겠습니까?`
        if (!window.confirm(confirmMessage)) {
          return
        }
      }
      const sessionId = session.sessionId
      browser.runtime.sendMessage<RBStopAction>({
        action: Action.StopChainBlock,
        sessionId,
      })
    }
    private renderProgressBar(): JSX.Element {
      const {
        session: {
          status,
          progress,
          target: { totalCount },
        },
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
        session: {
          target: { user },
          status,
          options,
        },
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
          <span>
            {statusMessage} {progressMessage}
          </span>
        </div>
      )
    }
    private renderLimited(): JSX.Element | null {
      const {
        session: { limit },
      } = this.props
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
    private renderTitle(): JSX.Element {
      const x = '\u00d7'
      const clickCloseEvent = this.requestStopChainBlock.bind(this)
      return (
        <div>
          <button className="redblock-close" onClick={clickCloseEvent}>
            {x}
          </button>
          {this.renderStatus()}
        </div>
      )
    }
    private renderText(): JSX.Element {
      const {
        session: { status, progress },
      } = this.props
      const isLimited = status === ChainBlockSessionStatus.RateLimited
      const sep = ' / '
      return (
        <div>
          <small>
            <b>차단: {progress.blockSuccess}</b> {sep}
            이미 차단함: {progress.alreadyBlocked} {sep}
            스킵: {progress.skipped} {sep}
            실패: {progress.blockFail}
          </small>
          {isLimited && this.renderLimited()}
        </div>
      )
    }
    public render() {
      return (
        <div className="redblock-dialog">
          {this.renderTitle()}
          {this.renderProgressBar()}
          {this.renderText()}
        </div>
      )
    }
  }
}
