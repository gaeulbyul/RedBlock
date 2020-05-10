import {
  PageEnum,
  isRunningStatus,
  isRewindableStatus,
  SessionStatus,
  getLimitResetTime,
} from '../../scripts/common.js'
import { cleanupSessions, stopAllChainBlock, stopChainBlock, rewindChainBlock } from '../popup.js'
import { DialogContext, PageSwitchContext } from './contexts.js'
import * as i18n from '../../scripts/i18n.js'

const M = MaterialUI
const T = MaterialUI.Typography

function calculatePercentage(session: SessionInfo): number | null {
  const { status, count } = session
  if (status === SessionStatus.Completed) {
    return 100
  }
  const max = count.total
  if (typeof max === 'number') {
    return Math.round((count.scraped / max) * 1000) / 10
  } else {
    return null
  }
}

const useStylesForSessionItem = MaterialUI.makeStyles(() =>
  MaterialUI.createStyles({
    card: {
      margin: '15px 0',
    },
    expand: {
      marginLeft: 'auto',
    },
  })
)

function ChainBlockSessionItem(props: { session: SessionInfo }) {
  const { session } = props
  const { purpose, target } = session.request
  const modalContext = React.useContext(DialogContext)
  const classes = useStylesForSessionItem()
  const [expanded, setExpanded] = React.useState(false)
  function toggleExpand() {
    setExpanded(!expanded)
  }
  const isChainBlock = purpose === 'chainblock'
  const isUnchainBlock = purpose === 'unchainblock'
  let user: TwitterUser
  let localizedTarget = ''
  switch (target.type) {
    case 'follower':
      user = target.user
      switch (target.list) {
        case 'followers':
          localizedTarget = i18n.getMessage('followers_of_xxx', user.screen_name)
          break
        case 'friends':
          localizedTarget = i18n.getMessage('followings_of_xxx', user.screen_name)
          break
        case 'mutual-followers':
          localizedTarget = i18n.getMessage('mutual_followers_of_xxx', user.screen_name)
          break
      }
      break
    case 'tweetReaction':
      user = target.tweet.user
      localizedTarget = i18n.getMessage('reacted_xxxs_tweet', user.screen_name)
      break
  }
  const localizedPurpose = i18n.getMessage(purpose)
  const cardTitle = `${localizedPurpose} ${statusToString(session.status)}`
  function statusToString(status: SessionStatus): string {
    const statusMessageObj: { [key: number]: string } = {
      [SessionStatus.Initial]: i18n.getMessage('session_status_initial'),
      [SessionStatus.Completed]: i18n.getMessage('session_status_completed'),
      [SessionStatus.Running]: i18n.getMessage('session_status_running'),
      [SessionStatus.RateLimited]: i18n.getMessage('session_status_rate_limited'),
      [SessionStatus.Stopped]: i18n.getMessage('session_status_stopped'),
      [SessionStatus.Error]: i18n.getMessage('session_status_error'),
    }
    const statusMessage = statusMessageObj[status]
    return statusMessage
  }
  function renderControls({ sessionId, status }: SessionInfo) {
    function requestStopChainBlock() {
      if (isRunningStatus(status)) {
        modalContext.openModal({
          dialogType: 'confirm',
          message: {
            title: i18n.getMessage('confirm_session_stop_message'),
          },
          callback() {
            stopChainBlock(sessionId)
          },
        })
        return
      }
      stopChainBlock(sessionId)
    }
    function requestRewindChainBlock() {
      rewindChainBlock(sessionId)
    }
    const rewindable = isRewindableStatus(status)
    let closeButtonText = i18n.getMessage('close')
    let closeButtonTitleText = i18n.getMessage('tooltip_close_session')
    if (isRunningStatus(status)) {
      closeButtonText = i18n.getMessage('stop')
      closeButtonTitleText = i18n.getMessage('tooltip_stop_session')
    }
    return (
      <React.Fragment>
        <M.Button title={closeButtonTitleText} onClick={requestStopChainBlock}>
          {closeButtonText}
        </M.Button>
        <M.Button style={{ display: 'none' }} disabled={!rewindable} onClick={requestRewindChainBlock}>
          {i18n.getMessage('rewind')}
        </M.Button>
        <M.IconButton className={classes.expand} onClick={toggleExpand}>
          <M.Icon>{expanded ? 'expand_less' : 'expand_more'}</M.Icon>
        </M.IconButton>
      </React.Fragment>
    )
  }
  function renderTable({ progress: p }: SessionInfo) {
    const { TableContainer, Table, TableBody, TableRow: Row, TableCell: Cell } = MaterialUI
    const { success: s } = p
    return (
      <TableContainer>
        <Table>
          <TableBody>
            <Row>
              <Cell>
                {i18n.getMessage('block')} / {i18n.getMessage('unblock')}
              </Cell>
              <Cell align="right">
                {s.Block.toLocaleString()} / {s.UnBlock.toLocaleString()}
              </Cell>
            </Row>
            <Row>
              <Cell>{i18n.getMessage('mute')}</Cell>
              <Cell align="right">{s.Mute.toLocaleString()}</Cell>
            </Row>
            <Row>
              <Cell>{i18n.getMessage('already_done')}</Cell>
              <Cell align="right">{p.already.toLocaleString()}</Cell>
            </Row>
            <Row>
              <Cell>{i18n.getMessage('skipped')}</Cell>
              <Cell align="right">{p.skipped.toLocaleString()}</Cell>
            </Row>
            <Row>
              <Cell>{i18n.getMessage('failed')}</Cell>
              <Cell align="right">{p.failure.toLocaleString()}</Cell>
            </Row>
          </TableBody>
        </Table>
      </TableContainer>
    )
  }
  let name = user.name
  if (target.type === 'tweetReaction') {
    name = `<${i18n.getMessage('tweet')}> ${name}`
  }
  const biggerProfileImageUrl = user.profile_image_url_https.replace('_normal', '_bigger')
  const percentage = calculatePercentage(session)
  const progressBar =
    typeof percentage === 'number' ? (
      <M.LinearProgress variant="determinate" value={percentage} />
    ) : (
      <M.LinearProgress variant="indeterminate" />
    )
  const succProgress = session.progress.success
  return (
    <M.Card className={classes.card}>
      <M.CardHeader avatar={<M.Avatar src={biggerProfileImageUrl} />} title={cardTitle} subheader={localizedTarget} />
      <M.CardContent>
        {progressBar}
        <T>
          <span>
            {i18n.getMessage('status')}: {statusToString(session.status)}
          </span>
          {isChainBlock && (
            <span>
              {' '}
              / {i18n.getMessage('block')}: {succProgress.Block.toLocaleString()}
            </span>
          )}
          {isUnchainBlock && (
            <span>
              {' '}
              / {i18n.getMessage('unblock')}: {succProgress.UnBlock.toLocaleString()}
            </span>
          )}
        </T>
        {session.limit && (
          <T color="textSecondary">
            {i18n.getMessage('rate_limit_reset_time')} (±5m): {getLimitResetTime(session.limit)}
          </T>
        )}
      </M.CardContent>
      <M.Divider variant="middle" />
      <M.CardActions disableSpacing>{renderControls(session)}</M.CardActions>
      <M.Collapse in={expanded} unmountOnExit>
        <M.CardContent>{renderTable(session)}</M.CardContent>
      </M.Collapse>
    </M.Card>
  )
}

const useStylesForFabButton = MaterialUI.makeStyles(theme =>
  MaterialUI.createStyles({
    fab: {
      position: 'fixed',
      bottom: theme.spacing(5),
      right: theme.spacing(2),
    },
  })
)

export default function ChainBlockSessionsPage(props: { sessions: SessionInfo[] }) {
  const { sessions } = props
  const modalContext = React.useContext(DialogContext)
  const pageSwitchCtx = React.useContext(PageSwitchContext)
  const classes = useStylesForFabButton()
  function handleFabButtonClicked() {
    pageSwitchCtx.switchPage(PageEnum.NewSession)
  }
  function renderGlobalControls() {
    function requestStopAllChainBlock() {
      modalContext.openModal({
        dialogType: 'confirm',
        message: {
          title: i18n.getMessage('confirm_all_stop'),
        },
        callback: stopAllChainBlock,
      })
    }
    return (
      <M.ButtonGroup>
        <M.Button onClick={requestStopAllChainBlock}>
          <M.Icon>highlight_off</M.Icon>
          {i18n.getMessage('stop_all')}
        </M.Button>
        <M.Button onClick={cleanupSessions}>
          <M.Icon>clear_all</M.Icon>
          {i18n.getMessage('cleanup_sessions')}
        </M.Button>
      </M.ButtonGroup>
    )
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
        {i18n.getMessage('session_is_empty')}
        {i18n.getMessage('press_plus_to_start_new_session')}
      </div>
    )
  }
  const isSessionExist = sessions.length > 0
  return (
    <div>
      {renderGlobalControls()}
      <hr />
      {isSessionExist ? renderSessions() : renderEmptySessions()}
      <M.Tooltip placement="left" title={i18n.getMessage('new_follower_session')}>
        <M.Fab className={classes.fab} color="primary" onClick={handleFabButtonClicked}>
          <M.Icon>add</M.Icon>
        </M.Fab>
      </M.Tooltip>
    </div>
  )
}
