namespace RedBlock.Content.UI {
  const {
    Session: { RedBlockSessionUI },
  } = RedBlock.Content.UI
  interface RedBlockUIState {
    sessions: ChainBlockSessionInfo[]
  }
  class RedBlockUI extends React.Component<{}, RedBlockUIState> {
    public state: RedBlockUIState = { sessions: [] }
    public componentWillMount() {
      browser.runtime.sendMessage<RBConnectToBackgroundAction>({
        action: Action.ConnectToBackground,
      })
      browser.runtime.onMessage.addListener((msg: any) => {
        if (!(typeof msg === 'object' && 'messageType' in msg)) {
          return
        }
        if (msg.messageType === 'ChainBlockInfoMessage') {
          this.setState({
            sessions: msg.infos,
          })
        }
      })
    }
    public componentWillUnmount() {
      browser.runtime.sendMessage<RBDisconnectToBackgroundAction>({
        action: Action.DisconnectToBackground,
      })
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
