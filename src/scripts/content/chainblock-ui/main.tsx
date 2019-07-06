namespace RedBlock.Content.UI {
  const {
    Session: { RedBlockSessionUI },
  } = RedBlock.Content.UI
  interface RedBlockUIState {
    sessions: ChainBlockSessionInfo
  }
  const UI_UPDATE_DELAY = 1000

  class RedBlockUI extends React.Component<{}, RedBlockUIState> {
    private intervals: number[] = []
    public state: RedBlockUIState = { sessions: {} }
    private registerIntervalFunc(func: () => void, delay: number) {
      this.intervals.push(window.setInterval(func, delay))
    }
    private clearAllIntervalFuncs() {
      this.intervals.forEach(n => window.clearInterval(n))
    }
    public componentWillMount() {
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
    public componentWillUnmount() {
      this.clearAllIntervalFuncs()
    }
    public render() {
      const sessions = Array.from(Object.entries(this.state.sessions))
      return (
        <div className="redblock-ui">
          <div className="redblock-sessions">
            {sessions.map(([sessionId, state], index) => (
              <RedBlockSessionUI key={index} sessionId={sessionId} {...state} />
            ))}
          </div>
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
