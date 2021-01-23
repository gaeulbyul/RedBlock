import {
  isRunningSession,
  SessionStatus,
  getLimitResetTime,
  getCountOfUsersToBlock,
} from '../../scripts/common.js'
import { PageEnum, pageIcon, pageLabel } from './pages.js'
import {
  cleanupInactiveSessions,
  stopAllChainBlock,
  stopChainBlock,
  downloadFromExportSession,
} from '../../scripts/background/request-sender.js'
import { UIContext, MyselfContext } from './contexts.js'
import { statusToString } from '../../scripts/text-generate.js'
import { BlockLimiterUI, PleaseLoginBox } from './components.js'
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
  const uiContext = React.useContext(UIContext)
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
    case 'user_search':
      user = null
      localizedTarget = i18n.getMessage('from_user_search_result')
      break
  }
  const localizedPurpose = i18n.getMessage(purpose)
  const cardTitle = `${localizedPurpose} ${statusToString(sessionInfo.status)}`
  function renderControls() {
    function requestStopChainBlock() {
      if (isRunningSession(sessionInfo)) {
        uiContext.openDialog({
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
        uiContext.openDialog({
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
        uiContext.openDialog({
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
  function progressTableRow(left: string, right: string | number) {
    const rightCell = typeof right === 'string' ? right : right.toLocaleString()
    return (
      <M.TableRow>
        <M.TableCell>{left}</M.TableCell>
        <M.TableCell align="right">{rightCell}</M.TableCell>
      </M.TableRow>
    )
  }
  function renderTable() {
    const { progress: p } = sessionInfo
    const { TableContainer, Table, TableBody } = MaterialUI
    const { success: s } = p
    return (
      <TableContainer>
        <Table size="small">
          <TableBody>
            {progressTableRow(
              `${i18n.getMessage('block')} / ${i18n.getMessage('unblock')}`,
              `${s.Block.toLocaleString()} / ${s.UnBlock.toLocaleString()}`
            )}
            {progressTableRow(i18n.getMessage('mute'), s.Mute)}
            {progressTableRow(i18n.getMessage('unfollow'), s.UnFollow)}
            {progressTableRow(i18n.getMessage('block_and_unblock'), s.BlockAndUnBlock)}
            {progressTableRow(i18n.getMessage('already_done'), p.already)}
            {progressTableRow(i18n.getMessage('skipped'), p.skipped)}
            {progressTableRow(i18n.getMessage('failed'), p.failure)}
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
    case 'lockpicker':
      shortProgress = `${i18n.getMessage('block')}: ${succProgress.Block.toLocaleString()}`
      break
    case 'chainunfollow':
      shortProgress = `${i18n.getMessage('unfollow')}: ${succProgress.UnFollow.toLocaleString()}`
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

function GlobalControls() {
  const uiContext = React.useContext(UIContext)
  function requestStopAllChainBlock() {
    uiContext.openDialog({
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

export default function ChainBlockSessionsPage(props: { sessions: SessionInfo[] }) {
  const { sessions } = props
  const myself = React.useContext(MyselfContext)
  const uiContext = React.useContext(UIContext)
  const { availablePages } = uiContext
  function isPageAvailable(page: PageEnum) {
    switch (page) {
      case PageEnum.NewSession:
        return availablePages.followerChainBlock
      case PageEnum.NewTweetReactionBlock:
        return availablePages.tweetReactionChainBlock
      case PageEnum.NewSearchChainBlock:
        return availablePages.userSearchChainBlock
      default:
        // 위에 3가지만 쓸 거다.
        throw new Error('unreachable')
    }
  }
  function handleNewSessionButton(event: React.MouseEvent, page: PageEnum) {
    event.preventDefault()
    uiContext.switchPage(page)
  }
  function renderSessions() {
    return (
      <div>
        {sessions.map(session => (
          <ChainBlockSessionItem sessionInfo={session} key={session.sessionId} />
        ))}
      </div>
    )
  }
  function renderWelcome() {
    return (
      <M.Box display="flex" flexDirection="column" justifyContent="center" padding="12px 16px">
        <M.Box display="flex" justifyContent="center" padding="10px">
          <M.Icon color="disabled" style={{ fontSize: '100pt' }}>
            pause_circle_filled_icon
          </M.Icon>
        </M.Box>
        <M.Box display="flex" flexDirection="column" justifyContent="center" textAlign="center">
          {i18n.getMessage('session_is_empty')} {i18n.getMessage('press_plus_to_start_new_session')}
          <M.Divider variant="middle" style={{ margin: '5px 0' }} />
          <M.Box display="flex" flexDirection="row" justifyContent="center">
            <M.Box minWidth="150px" maxWidth="300px">
              {[
                PageEnum.NewSession,
                PageEnum.NewTweetReactionBlock,
                PageEnum.NewSearchChainBlock,
              ].map((page, index) => (
                <M.Button
                  key={index}
                  fullWidth
                  style={{ margin: '5px 0' }}
                  variant="contained"
                  startIcon={pageIcon(page)}
                  disabled={!isPageAvailable(page)}
                  onClick={e => handleNewSessionButton(e, page)}
                >
                  {pageLabel(page)}
                </M.Button>
              ))}
            </M.Box>
          </M.Box>
        </M.Box>
      </M.Box>
    )
  }
  // 세션이 있어도 팝업 로딩 직후에 빈 세션이 잠깐 나타난다.
  const shouldShowWelcomeNewSession = sessions.length <= 0 && !uiContext.initialLoading
  const isSessionExist = sessions.length > 0
  return (
    <div>
      {myself ? (
        <React.Fragment>
          <BlockLimiterUI />
          {isSessionExist && (
            <React.Fragment>
              <M.Box margin="10px 0">
                <GlobalControls />
              </M.Box>
              {renderSessions()}
            </React.Fragment>
          )}
          {shouldShowWelcomeNewSession && renderWelcome()}
          {uiContext.initialLoading && <span>Loading...</span>}
        </React.Fragment>
      ) : (
        <PleaseLoginBox />
      )}
    </div>
  )
}
