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
  requestProgress,
} from '../../scripts/background/request-sender.js'
import { UIContext, MyselfContext, AvailablePages } from './contexts.js'
import { statusToString } from '../../scripts/text-generate.js'
import { BlockLimiterUI, PleaseLoginBox, LinearProgressWithLabel } from './components.js'
import * as i18n from '../../scripts/i18n.js'

const M = MaterialUI
const T = MaterialUI.Typography

const newSessionTypesToShow = [
  PageEnum.NewSession,
  PageEnum.NewTweetReactionBlock,
  PageEnum.NewSearchChainBlock,
]

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
    expand: {
      marginLeft: 'auto',
    },
  })
)

const downloadedIdsStr = sessionStorage.getItem('exported sessions') || ''
const downloadedIds = downloadedIdsStr.split('\n')

function ChainBlockSessionItem(props: { sessionInfo: SessionInfo }) {
  const { sessionInfo } = props
  const { sessionId } = sessionInfo
  const { purpose, target } = sessionInfo.request
  const uiContext = React.useContext(UIContext)
  const classes = useStylesForSessionItem()
  const [expanded, setExpanded] = React.useState(false)
  const downloaded = downloadedIds.includes(sessionId)
  const running = isRunningSession(sessionInfo)
  function markAsDownloaded() {
    downloadedIds.push(sessionId)
    sessionStorage.setItem('exported sessions', downloadedIds.join('\n'))
  }
  function toggleExpand() {
    setExpanded(!expanded)
  }
  let user: TwitterUser | null
  let localizedTarget = ''
  switch (target.type) {
    case 'follower':
    case 'lockpicker':
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
  const localizedPurpose = i18n.getMessage(purpose.type)
  const cardTitle = `${localizedPurpose} ${statusToString(sessionInfo.status)}`
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
    //function requestRewindChainBlock() {
    //  rewindChainBlock(sessionId)
    //}
    //const rewindable = isRewindableStatus(status)
    //<M.Button style={{ display: 'none' }} disabled={!rewindable} onClick={requestRewindChainBlock}>
    //  {i18n.getMessage('rewind')}
    //</M.Button>
    function requestStopChainBlock() {
      if (running) {
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
      if (purpose.type === 'export' && !downloaded) {
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
      markAsDownloaded()
    }
    let closeButtonTitleText = i18n.getMessage('tooltip_close_session')
    let closeButtonIcon = 'close'
    if (running) {
      closeButtonTitleText = i18n.getMessage('tooltip_stop_session')
      closeButtonIcon = 'power_settings_new'
    }
    let downloadButton: React.ReactNode = null
    let expandButton: React.ReactNode = null
    if (purpose.type === 'export') {
      const disabled = sessionInfo.progress.scraped <= 0
      downloadButton = (
        <M.IconButton
          title={i18n.getMessage('save_button_description')}
          onClick={downloadBlocklist}
          disabled={disabled}
          color={downloaded ? 'default' : 'primary'}
        >
          <M.Icon>save</M.Icon>
        </M.IconButton>
      )
    } else {
      expandButton = (
        <M.IconButton className={classes.expand} onClick={toggleExpand}>
          <M.Icon>{expanded ? 'expand_less' : 'expand_more'}</M.Icon>
        </M.IconButton>
      )
    }
    if (user) {
      return (
        <M.CardHeader
          action={
            <React.Fragment>
              {downloadButton}
              {expandButton}
              <M.IconButton title={closeButtonTitleText} onClick={requestStopChainBlock}>
                <M.Icon>{closeButtonIcon}</M.Icon>
              </M.IconButton>
            </React.Fragment>
          }
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
      <LinearProgressWithLabel value={percentage} />
    ) : (
      <M.LinearProgress variant="indeterminate" />
    )
  const succProgress = sessionInfo.progress.success
  let shortProgress: string
  switch (purpose.type) {
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
      break
    case 'chainmute':
      shortProgress = `${i18n.getMessage('mute')}: ${succProgress.Mute.toLocaleString()}`
      break
    case 'unchainmute':
      shortProgress = `${i18n.getMessage('unmute')}: ${succProgress.UnMute.toLocaleString()}`
      break
  }
  let notSavedYet = ''
  if (purpose.type === 'export' && !downloaded) {
    notSavedYet = `(${i18n.getMessage('not_saved_yet')})`
  }
  return (
    <M.Box my={1}>
      <M.Card>
        {renderCardHeader(user)}
        <M.CardContent>
          {progressBar}
          <T>
            {i18n.getMessage('status')}: {statusToString(sessionInfo.status)} {notSavedYet} /{' '}
            {shortProgress}
          </T>
          {sessionInfo.limit && (
            <T color="textSecondary">
              {i18n.getMessage('rate_limit_reset_time')} (±5m):{' '}
              {getLimitResetTime(sessionInfo.limit)}
            </T>
          )}
        </M.CardContent>
        <M.Collapse in={expanded} unmountOnExit>
          <M.CardContent>{renderTable()}</M.CardContent>
        </M.Collapse>
      </M.Card>
    </M.Box>
  )
}

function GlobalControls() {
  const uiContext = React.useContext(UIContext)
  const [anchorEl, setAnchorEl] = React.useState<Element | null>(null)
  function openMenu(event: React.MouseEvent<HTMLButtonElement>) {
    setAnchorEl(event.currentTarget)
  }
  function confirmStopAllChainBlock() {
    uiContext.openDialog({
      dialogType: 'confirm',
      message: {
        title: i18n.getMessage('confirm_all_stop'),
      },
      callbackOnOk() {
        stopAllChainBlock()
        requestProgress()
      },
    })
  }
  function cleanupAndRefresh() {
    cleanupInactiveSessions()
    requestProgress()
  }
  return (
    <div>
      <M.ButtonGroup fullWidth>
        <M.Button startIcon={<M.Icon>highlight_off</M.Icon>} onClick={confirmStopAllChainBlock}>
          {i18n.getMessage('stop_all')}
        </M.Button>
        <M.Button startIcon={<M.Icon>clear_all</M.Icon>} onClick={cleanupAndRefresh}>
          {i18n.getMessage('cleanup_sessions')}
        </M.Button>
        <M.Button
          startIcon={<M.Icon>add_circle_outline</M.Icon>}
          onClick={openMenu}
          variant="contained"
        >
          새 세션
        </M.Button>
      </M.ButtonGroup>
      <NewSessionMenu {...{ anchorEl, setAnchorEl }} />
    </div>
  )
}

function NewSessionMenu(props: {
  anchorEl: Element | null
  setAnchorEl(elem: Element | null): void
}) {
  const { anchorEl, setAnchorEl } = props
  const uiContext = React.useContext(UIContext)
  function handleClose() {
    setAnchorEl(null)
  }
  function handleNewSessionButton(event: React.MouseEvent, page: PageEnum) {
    event.preventDefault()
    uiContext.switchPage(page)
    handleClose()
  }
  return (
    <M.Menu keepMounted anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={handleClose}>
      {newSessionTypesToShow.map((page, index) => (
        <M.MenuItem
          key={index}
          dense
          disabled={!uiContext.availablePages[pageAvailabilityKey(page)]}
          onClick={e => handleNewSessionButton(e, page)}
        >
          <M.ListItemIcon>{pageIcon(page)}</M.ListItemIcon>
          {pageLabel(page)}
        </M.MenuItem>
      ))}
    </M.Menu>
  )
}

function pageAvailabilityKey(page: PageEnum): keyof AvailablePages {
  switch (page) {
    case PageEnum.NewSession:
      return 'followerChainBlock'
    case PageEnum.NewTweetReactionBlock:
      return 'tweetReactionChainBlock'
    case PageEnum.NewSearchChainBlock:
      return 'userSearchChainBlock'
    default:
      // 위에 3가지만 쓸 거다.
      throw new Error('unreachable')
  }
}

function NewSessionButtons() {
  const uiContext = React.useContext(UIContext)
  function handleNewSessionButton(event: React.MouseEvent, page: PageEnum) {
    event.preventDefault()
    uiContext.switchPage(page)
  }
  return (
    <M.Box display="flex" flexDirection="row" justifyContent="center" my={1}>
      <M.Box minWidth="150px" maxWidth="300px">
        {newSessionTypesToShow.map((page, index) => (
          <M.Box key={index} my={1}>
            <M.Button
              fullWidth
              variant="contained"
              startIcon={pageIcon(page)}
              disabled={!uiContext.availablePages[pageAvailabilityKey(page)]}
              onClick={e => handleNewSessionButton(e, page)}
            >
              {pageLabel(page)}
            </M.Button>
          </M.Box>
        ))}
      </M.Box>
    </M.Box>
  )
}

export default function ChainBlockSessionsPage(props: { sessions: SessionInfo[] }) {
  const { sessions } = props
  const myself = React.useContext(MyselfContext)
  const uiContext = React.useContext(UIContext)
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
      <M.Box display="flex" flexDirection="column" justifyContent="center" px={2} py={1.5}>
        <M.Box display="flex" justifyContent="center" p={1}>
          <M.Icon color="disabled" style={{ fontSize: '100pt' }}>
            pause_circle_filled_icon
          </M.Icon>
        </M.Box>
        <M.Box
          display="flex"
          flexDirection="column"
          justifyContent="center"
          textAlign="center"
          my={1}
        >
          {i18n.getMessage('session_is_empty')} {i18n.getMessage('press_plus_to_start_new_session')}
        </M.Box>
        <M.Divider variant="middle" />
        <NewSessionButtons />
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
              <M.Box my={1}>
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
