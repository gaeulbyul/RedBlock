import { UI_UPDATE_DELAY } from '../scripts/common.js'
import { redBlockMaterialTheme } from '../ui-common/ui-common.js'
import { requestProgress } from '../ui-common/message-sender.js'
import { ChainBlockSessionsGlobalControl, ChainBlockSessionItem } from '../ui-common/sessions-ui.js'

const M = MaterialUI

function ChainBlockSessionsPage() {
  const [sessions, setSessions] = React.useState<SessionInfo[]>([])
  React.useEffect(() => {
    const messageListener = (msgobj: any) => {
      if (!(typeof msgobj === 'object' && 'messageType' in msgobj)) {
        console.debug('unknown msg?', msgobj)
        return
      }
      const msg = msgobj as RBMessage
      switch (msg.messageType) {
        case 'ChainBlockInfo':
          setSessions(msg.infos)
          break
      }
    }
    browser.runtime.onMessage.addListener(messageListener)
    const interval = window.setInterval(() => {
      requestProgress().catch(() => {})
    }, UI_UPDATE_DELAY)
    // clean-up
    return () => {
      browser.runtime.onMessage.removeListener(messageListener)
      window.clearInterval(interval)
    }
  }, [])
  function renderSessions() {
    return (
      <div className="chainblock-sessions">
        {sessions.map(session => (
          <ChainBlockSessionItem session={session as SessionInfo} key={session.sessionId} />
        ))}
      </div>
    )
  }
  const isSessionExist = sessions.length > 0
  return (
    <div>
      <M.ThemeProvider theme={redBlockMaterialTheme}>
        <M.AppBar position="fixed">
          <M.Toolbar variant="dense">
            <M.Typography>Red Block / 세션 목록</M.Typography>
          </M.Toolbar>
        </M.AppBar>
        <M.Container maxWidth="sm">
          <div className="page">
            <ChainBlockSessionsGlobalControl showPageOpenButton={false} />
            <hr />
            {isSessionExist ? renderSessions() : <div>현재 진행중인 세션이 없습니다.</div>}
          </div>
        </M.Container>
      </M.ThemeProvider>
    </div>
  )
}

async function initializeUI() {
  const appRoot = document.getElementById('app')!
  const app = <ChainBlockSessionsPage />
  ReactDOM.render(app, appRoot)
}

initializeUI()
