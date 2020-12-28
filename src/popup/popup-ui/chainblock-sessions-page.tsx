import {
  isRunningSession,
  SessionStatus,
  getLimitResetTime,
  getCountOfUsersToBlock,
} from '../../scripts/common.js'
import { PageEnum } from '../popup.js'
import {
  cleanupInactiveSessions,
  stopAllChainBlock,
  stopChainBlock,
  downloadFromExportSession,
} from '../../scripts/background/request-sender.js'
import { DialogContext, PageSwitchContext, BlockLimiterContext } from './contexts.js'
import { statusToString } from '../../scripts/text-generate.js'
import { BlockLimiterUI } from './ui-common.js'
import * as i18n from '../../scripts/i18n.js'

const M = MaterialUI
const T = MaterialUI.Typography

function calculatePercentage(session: SessionInfo): number | null {
  const { status } = session
  const { scraped } = session.progress
  if (status === SessionStatus.Completed) {
    return 100
  }
  const max = session.progress.total ?? getCountOfUsersToBlock(session.request)
  if (typeof max === 'number') {
    // Math.min : bioBlock모드로 인해 total보다 더 많은 유저를 수집할 수도 있다.
    // 100%가 안 넘도록 함
    return Math.min(100, Math.round((scraped / max) * 1000) / 10)
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

function ChainBlockSessionItem(props: { sessionInfo: SessionInfo }) {
  const { sessionInfo } = props
  const { sessionId } = sessionInfo
  const { purpose, target } = sessionInfo.request
  const modalContext = React.useContext(DialogContext)
  const classes = useStylesForSessionItem()
  const [expanded, setExpanded] = React.useState(false)
  const [downloadButtonClicked, setDownloadButtonClicked] = React.useState(false)
  function toggleExpand() {
    setExpanded(!expanded)
  }
  let user: TwitterUser | null
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
    case 'tweet_reaction':
      user = target.tweet.user
      localizedTarget = i18n.getMessage('reacted_xxxs_tweet', user.screen_name)
      break
    case 'import':
      user = null
      localizedTarget = i18n.getMessage('from_imported_blocklist')
      break
  }
  const localizedPurpose = i18n.getMessage(purpose)
  const cardTitle = `${localizedPurpose} ${statusToString(sessionInfo.status)}`
  function renderControls() {
    function requestStopChainBlock() {
      if (isRunningSession(sessionInfo)) {
        modalContext.openModal({
          dialogType: 'confirm',
          message: {
            title: i18n.getMessage('confirm_session_stop_message'),
          },
          callbackOnOk() {
            stopChainBlock(sessionId)
          },
        })
        return
      }
      if (purpose === 'export' && !downloadButtonClicked) {
        modalContext.openModal({
          dialogType: 'confirm',
          message: {
            title: i18n.getMessage('confirm_closing_export_session_notyet_save'),
          },
          callbackOnOk() {
            stopChainBlock(sessionId)
          },
        })
        return
      } else {
        stopChainBlock(sessionId)
      }
    }
    //function requestRewindChainBlock() {
    //  rewindChainBlock(sessionId)
    //}
    //const rewindable = isRewindableStatus(status)
    //<M.Button style={{ display: 'none' }} disabled={!rewindable} onClick={requestRewindChainBlock}>
    //  {i18n.getMessage('rewind')}
    //</M.Button>
    function downloadBlocklist() {
      if (sessionInfo.progress.scraped > 0) {
        downloadFromExportSession(sessionInfo.sessionId)
      } else {
        modalContext.openModal({
          dialogType: 'alert',
          message: {
            title: i18n.getMessage('blocklist_is_empty'),
          },
        })
      }
      setDownloadButtonClicked(true)
    }
    let downloadButton: React.ReactNode
    if (purpose === 'export') {
      const disabled = sessionInfo.progress.scraped <= 0
      downloadButton = (
        <M.Button
          title={i18n.getMessage('save_button_description')}
          onClick={downloadBlocklist}
          variant="contained"
          disabled={disabled}
        >
          {i18n.getMessage('save')}
        </M.Button>
      )
    } else {
      downloadButton = ''
    }
    let closeButtonText = i18n.getMessage('close')
    let closeButtonTitleText = i18n.getMessage('tooltip_close_session')
    if (isRunningSession(sessionInfo)) {
      closeButtonText = i18n.getMessage('stop')
      closeButtonTitleText = i18n.getMessage('tooltip_stop_session')
    }
    return (
      <React.Fragment>
        {downloadButton}
        <M.Button title={closeButtonTitleText} onClick={requestStopChainBlock}>
          {closeButtonText}
        </M.Button>
        <M.IconButton className={classes.expand} onClick={toggleExpand}>
          <M.Icon>{expanded ? 'expand_less' : 'expand_more'}</M.Icon>
        </M.IconButton>
      </React.Fragment>
    )
  }
  function renderTable() {
    const { progress: p } = sessionInfo
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
  function renderCardHeader(user: TwitterUser | null) {
    if (user) {
      return (
        <M.CardHeader
          avatar={<M.Avatar src={biggerProfileImageUrl} />}
          title={cardTitle}
          subheader={localizedTarget}
        />
      )
    } else {
      return (
        <M.CardHeader
          avatar={<M.Icon>import_export</M.Icon>}
          title={cardTitle}
          subheader={localizedTarget}
        />
      )
    }
  }
  let name = ''
  let biggerProfileImageUrl = ''
  if (user) {
    name = user.name
    biggerProfileImageUrl = user.profile_image_url_https.replace('_normal', '_bigger')
    if (target.type === 'tweet_reaction') {
      name = `<${i18n.getMessage('tweet')}> ${name}`
    }
  }
  const percentage = calculatePercentage(sessionInfo)
  const progressBar =
    typeof percentage === 'number' ? (
      <M.LinearProgress variant="determinate" value={percentage} />
    ) : (
      <M.LinearProgress variant="indeterminate" />
    )
  const succProgress = sessionInfo.progress.success
  let shortProgress: string
  switch (purpose) {
    case 'chainblock':
      shortProgress = `${i18n.getMessage('block')}: ${succProgress.Block.toLocaleString()}`
      break
    case 'unchainblock':
      shortProgress = `${i18n.getMessage('unblock')}: ${succProgress.UnBlock.toLocaleString()}`
      break
    case 'export':
      shortProgress = `${i18n.getMessage(
        'export'
      )}: ${sessionInfo.progress.scraped.toLocaleString()}`
      break
    case 'selfchainblock':
      shortProgress = `${i18n.getMessage('block')}: ${succProgress.Block.toLocaleString()}`
      break
  }
  return (
    <M.Card className={classes.card}>
      {renderCardHeader(user)}
      <M.CardContent>
        {progressBar}
        <T>
          {i18n.getMessage('status')}: {statusToString(sessionInfo.status)} / {shortProgress}
        </T>
        {sessionInfo.limit && (
          <T color="textSecondary">
            {i18n.getMessage('rate_limit_reset_time')} (±5m): {getLimitResetTime(sessionInfo.limit)}
          </T>
        )}
      </M.CardContent>
      <M.Divider variant="middle" />
      <M.CardActions disableSpacing>{renderControls()}</M.CardActions>
      <M.Collapse in={expanded} unmountOnExit>
        <M.CardContent>{renderTable()}</M.CardContent>
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
  const limiterStatus = React.useContext(BlockLimiterContext)
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
        callbackOnOk: stopAllChainBlock,
      })
    }
    return (
      <M.ButtonGroup>
        <M.Button onClick={requestStopAllChainBlock}>
          <M.Icon>highlight_off</M.Icon>
          {i18n.getMessage('stop_all')}
        </M.Button>
        <M.Button onClick={cleanupInactiveSessions}>
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
          <ChainBlockSessionItem sessionInfo={session} key={session.sessionId} />
        ))}
      </div>
    )
  }
  function renderEmptySessions() {
    return (
      <M.Box display="flex" flexDirection="column" justifyContent="center" padding="12px 16px">
        <M.Box display="flex" justifyContent="center" padding="10px">
          <M.Icon color="disabled" style={{ fontSize: '120pt' }}>
            pause_circle_filled_icon
          </M.Icon>
        </M.Box>
        <M.Box display="flex" justifyContent="center" textAlign="center">
          {i18n.getMessage('session_is_empty')} {i18n.getMessage('press_plus_to_start_new_session')}
        </M.Box>
      </M.Box>
    )
  }
  const isSessionExist = sessions.length > 0
  return (
    <div>
      <M.Box marginBottom="15px">{renderGlobalControls()}</M.Box>
      <BlockLimiterUI status={limiterStatus} />
      {isSessionExist ? renderSessions() : renderEmptySessions()}
      <M.Tooltip placement="left" title={i18n.getMessage('new_follower_session')}>
        <M.Fab className={classes.fab} color="primary" onClick={handleFabButtonClicked}>
          <M.Icon>add</M.Icon>
        </M.Fab>
      </M.Tooltip>
    </div>
  )
}
