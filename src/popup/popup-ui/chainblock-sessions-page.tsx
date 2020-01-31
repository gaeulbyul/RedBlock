import { PageEnum } from './popup-ui-common.js'
import { PageSwitchContext } from '../../ui-common/contexts.js'
import { ChainBlockSessionItem, ChainBlockSessionsGlobalControl } from '../../ui-common/sessions-ui.js'

const M = MaterialUI

const useStylesForFabButton = MaterialUI.makeStyles(theme =>
  MaterialUI.createStyles({
    fab: {
      position: 'fixed',
      bottom: theme.spacing(5),
      right: theme.spacing(2),
    },
  })
)

export default function ChainBlockSessionsPopupPage(props: { sessions: SessionInfo[] }) {
  const { sessions } = props
  const pageSwitchCtx = React.useContext(PageSwitchContext)
  const classes = useStylesForFabButton()
  function handleFabButtonClicked() {
    pageSwitchCtx.switchPage(PageEnum.NewSession)
  }
  function renderSessions() {
    return (
      <div className="chainblock-sessions">
        {sessions.map(session => (
          <ChainBlockSessionItem session={session as SessionInfo} key={session.sessionId} />
        ))}
      </div>
    )
  }
  function renderEmptySessions() {
    return (
      <div className="chainblock-suggest-start">
        현재 진행중인 세션이 없습니다. 체인블락을 시작하려면 아래의 + 버튼을 눌러주세요.
      </div>
    )
  }
  const isSessionExist = sessions.length > 0
  return (
    <div>
      <ChainBlockSessionsGlobalControl showPageOpenButton={true} />
      <hr />
      {isSessionExist ? renderSessions() : renderEmptySessions()}
      <M.Tooltip placement="left" title="세션 추가">
        <M.Fab className={classes.fab} color="primary" onClick={handleFabButtonClicked}>
          <M.Icon>add</M.Icon>
        </M.Fab>
      </M.Tooltip>
    </div>
  )
}
