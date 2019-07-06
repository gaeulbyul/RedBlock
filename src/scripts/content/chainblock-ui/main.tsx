namespace RedBlock.Content.UI {
  const {
    Session: { RedBlockSessionUI },
  } = RedBlock.Content.UI
  interface RedBlockUIState {
    sessions: ChainBlockSessionInfo[]
  }
  const UI_UPDATE_DELAY = 1000

  class RedBlockUI extends React.Component<{}, RedBlockUIState> {
    private intervals: number[] = []
    public state: RedBlockUIState = { sessions: [] }
    private registerIntervalFunc(func: () => void, delay: number) {
      this.intervals.push(window.setInterval(func, delay))
    }
    private clearAllIntervalFuncs() {
      this.intervals.forEach(n => window.clearInterval(n))
    }
    public componentWillMount() {
      this.registerIntervalFunc(async () => {
        const sessions: ChainBlockSessionInfo[] = await browser.runtime
          .sendMessage({
            action: Action.RequestProgress,
          })
          .catch(err => {
            console.error(err)
            this.clearAllIntervalFuncs()
            return null
          })
        if (sessions) {
          this.setState({
            sessions,
          })
        }
      }, UI_UPDATE_DELAY)
    }
    public componentWillUnmount() {
      this.clearAllIntervalFuncs()
    }
    public render() {
      const { sessions } = this.state
      return (
        <div className="redblock-ui">
          <div className="redblock-sessions">
            {sessions.map((session, index) => (
              <RedBlockSessionUI key={index} session={session} />
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
