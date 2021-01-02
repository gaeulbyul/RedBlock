import { requestProgress } from '../scripts/background/request-sender.js'
import { loadOptions } from '../scripts/background/storage.js'
import * as TwitterAPI from '../scripts/background/twitter-api.js'
import { isRunningSession, UI_UPDATE_DELAY } from '../scripts/common.js'
import * as i18n from '../scripts/i18n.js'

import BlocklistPage from './popup-ui/blocklist-page.js'
import ChainBlockSessionsPage from './popup-ui/chainblock-sessions-page.js'
import {
  UIContext,
  RedBlockOptionsContext,
  MyselfContext,
  BlockLimiterContext,
} from './popup-ui/contexts.js'
import {
  FollowerChainBlockPageStatesProvider,
  TweetReactionChainBlockPageStatesProvider,
  ImportChainBlockPageStatesProvider,
  UserSearchChainBlockPageStatesProvider,
} from './popup-ui/ui-states.js'
import MiscPage from './popup-ui/misc-page.js'
import NewChainBlockPage from './popup-ui/new-chainblock-page.js'
import NewTweetReactionBlockPage from './popup-ui/new-tweetreactionblock-page.js'
import NewSearchChainBlockPage from './popup-ui/new-searchblock-page.js'
import { DialogContent, RBDialog, RedBlockUITheme, TabPanel } from './popup-ui/components.js'

import {
  getCurrentTab,
  getTweetIdFromTab,
  getUserNameFromTab,
  getUserIdFromTab,
  getCurrentSearchQueryFromTab,
  PageEnum,
} from './popup.js'

function checkMessage(msg: object): msg is RBMessageToPopupType {
  if (msg == null) {
    return false
  }
  if (!('messageTo' in msg)) {
    return false
  }
  if ((msg as any).messageTo !== 'popup') {
    return false
  }
  return true
}

const useStylesForAppBar = MaterialUI.makeStyles(() =>
  MaterialUI.createStyles({
    toolbar: {
      padding: 0,
    },
    tab: {
      minWidth: '60px',
    },
  })
)

interface PopupAppProps {
  myself: TwitterAPI.TwitterUser | null
  currentUser: TwitterAPI.TwitterUser | null
  currentTweet: TwitterAPI.Tweet | null
  currentSearchQuery: string | null
  isPopupOpenedInTab: boolean
  initialPage: PageEnum
  redblockOptions: RedBlockStorage['options']
}

function PopupApp(props: PopupAppProps) {
  const {
    myself,
    currentUser,
    currentTweet,
    currentSearchQuery,
    isPopupOpenedInTab,
    initialPage,
    redblockOptions,
  } = props
  const [tabIndex, setTabIndex] = React.useState<PageEnum>(initialPage)
  const [sessions, setSessions] = React.useState<SessionInfo[]>([])
  const [limiterStatus, setLimiterStatus] = React.useState<BlockLimiterStatus>({
    current: 0,
    max: 500,
    remained: 500,
  })
  const [modalOpened, setModalOpened] = React.useState(false)
  const [modalContent, setModalContent] = React.useState<DialogContent | null>(null)
  const [snackBarMessage, setSnackBarMessage] = React.useState('')
  const [snackBarOpen, setSnackBarOpen] = React.useState(false)
  const [menuAnchorEl, setMenuAnchorEl] = React.useState<HTMLElement | null>(null)
  const darkMode = MaterialUI.useMediaQuery('(prefers-color-scheme:dark)')
  const theme = React.useMemo(() => RedBlockUITheme(darkMode), [darkMode])
  const classes = useStylesForAppBar()
  function openDialog(content: DialogContent) {
    console.debug(content)
    setModalOpened(true)
    setModalContent(content)
  }
  function closeModal() {
    setModalOpened(false)
  }
  function switchPage(page: PageEnum) {
    setTabIndex(page)
  }
  function openSnackBar(message: string) {
    setSnackBarMessage(message)
    setSnackBarOpen(true)
  }
  function handleSnackBarClose(_event: React.SyntheticEvent | React.MouseEvent, reason?: string) {
    if (reason === 'clickaway') {
      return
    }
    setSnackBarOpen(false)
  }
  function handleMenuButtonClick(event: React.MouseEvent<HTMLButtonElement>) {
    setMenuAnchorEl(event.currentTarget)
  }
  function handleOpenInTabClick() {
    browser.tabs.create({
      active: true,
      url: '/popup/popup.html?istab=1',
    })
    closeMenu()
  }
  function handleSettingsClick() {
    browser.runtime.openOptionsPage()
    closeMenu()
  }
  function closeMenu() {
    setMenuAnchorEl(null)
  }
  React.useEffect(() => {
    const messageListener = (msg: object) => {
      if (!checkMessage(msg)) {
        console.debug('unknown message?', msg)
        return
      }
      switch (msg.messageType) {
        case 'ChainBlockInfo':
          setSessions(msg.sessions)
          setLimiterStatus(msg.limiter)
          break
        case 'PopupSwitchTab':
          setTabIndex(msg.page)
          break
        default:
          break
      }
    }
    browser.runtime.onMessage.addListener(messageListener)
    // clean-up
    return () => {
      browser.runtime.onMessage.removeListener(messageListener)
    }
  }, [])
  const runningSessions = sessions.filter(session => isRunningSession(session))
  const M = MaterialUI
  const runningSessionsTabIcon = (
    <M.Badge
      color="secondary"
      badgeContent={runningSessions.length}
      anchorOrigin={{
        vertical: 'bottom',
        horizontal: 'right',
      }}
    >
      <M.Icon>play_circle_filled_white_icon</M.Icon>
    </M.Badge>
  )
  return (
    <M.ThemeProvider theme={theme}>
      <UIContext.Provider value={{ openDialog, openSnackBar, switchPage }}>
        <MyselfContext.Provider value={myself}>
          <RedBlockOptionsContext.Provider value={redblockOptions}>
            <BlockLimiterContext.Provider value={limiterStatus}>
              <M.AppBar position="fixed">
                <M.Toolbar variant="dense" className={classes.toolbar}>
                  <M.IconButton color="inherit" onClick={handleMenuButtonClick}>
                    <M.Icon>menu</M.Icon>
                  </M.IconButton>
                  <M.Tabs value={tabIndex} onChange={(_ev, val) => setTabIndex(val)}>
                    <M.Tooltip
                      arrow
                      title={`${i18n.getMessage('running_sessions')} (${runningSessions.length})`}
                    >
                      <M.Tab className={classes.tab} icon={runningSessionsTabIcon} />
                    </M.Tooltip>
                    <M.Tooltip arrow title={i18n.getMessage('new_follower_session')}>
                      <M.Tab
                        className={classes.tab}
                        icon={<M.Icon>group</M.Icon>}
                        disabled={!myself}
                      />
                    </M.Tooltip>
                    <M.Tooltip arrow title={i18n.getMessage('new_tweetreaction_session')}>
                      <M.Tab
                        className={classes.tab}
                        icon={<M.Icon>repeat</M.Icon>}
                        disabled={!(myself && currentTweet)}
                      />
                    </M.Tooltip>
                    <M.Tooltip arrow title={i18n.getMessage('new_searchblock_session')}>
                      <M.Tab
                        className={classes.tab}
                        icon={<M.Icon>search</M.Icon>}
                        disabled={!(myself && currentSearchQuery)}
                      />
                    </M.Tooltip>
                    <M.Tooltip arrow title={i18n.getMessage('blocklist_page')}>
                      <M.Tab
                        className={classes.tab}
                        icon={<M.Icon>list_alt</M.Icon>}
                        disabled={!myself}
                      />
                    </M.Tooltip>
                    <M.Tooltip arrow title={i18n.getMessage('miscellaneous')}>
                      <M.Tab
                        className={classes.tab}
                        icon={<M.Icon>build</M.Icon>}
                        disabled={!myself}
                      />
                    </M.Tooltip>
                  </M.Tabs>
                </M.Toolbar>
              </M.AppBar>
              <M.Menu
                keepMounted
                anchorEl={menuAnchorEl}
                open={Boolean(menuAnchorEl)}
                onClose={closeMenu}
              >
                {!isPopupOpenedInTab && (
                  <M.MenuItem onClick={handleOpenInTabClick}>
                    <M.Icon>open_in_new</M.Icon> {i18n.getMessage('open_in_new_tab')}
                  </M.MenuItem>
                )}
                <M.MenuItem onClick={handleSettingsClick}>
                  <M.Icon>settings</M.Icon> {i18n.getMessage('open_settings_ui')}
                </M.MenuItem>
              </M.Menu>
              <div className="page">
                <M.Container maxWidth="sm">
                  <TabPanel value={tabIndex} index={PageEnum.Sessions}>
                    <ChainBlockSessionsPage sessions={sessions} />
                  </TabPanel>
                  <FollowerChainBlockPageStatesProvider initialUser={currentUser}>
                    <TabPanel value={tabIndex} index={PageEnum.NewSession}>
                      <NewChainBlockPage />
                    </TabPanel>
                  </FollowerChainBlockPageStatesProvider>
                  <TweetReactionChainBlockPageStatesProvider initialTweet={currentTweet}>
                    <TabPanel value={tabIndex} index={PageEnum.NewTweetReactionBlock}>
                      <NewTweetReactionBlockPage />
                    </TabPanel>
                  </TweetReactionChainBlockPageStatesProvider>
                  <UserSearchChainBlockPageStatesProvider currentSearchQuery={currentSearchQuery}>
                    <TabPanel value={tabIndex} index={PageEnum.NewSearchChainBlock}>
                      <NewSearchChainBlockPage />
                    </TabPanel>
                  </UserSearchChainBlockPageStatesProvider>
                  <ImportChainBlockPageStatesProvider>
                    <TabPanel value={tabIndex} index={PageEnum.Blocklist}>
                      <BlocklistPage />
                    </TabPanel>
                  </ImportChainBlockPageStatesProvider>
                  <TabPanel value={tabIndex} index={PageEnum.Utilities}>
                    <MiscPage />
                  </TabPanel>
                </M.Container>
              </div>
            </BlockLimiterContext.Provider>
          </RedBlockOptionsContext.Provider>
        </MyselfContext.Provider>
      </UIContext.Provider>
      <M.Snackbar
        anchorOrigin={{
          horizontal: 'center',
          vertical: 'bottom',
        }}
        open={snackBarOpen}
        onClose={handleSnackBarClose}
        autoHideDuration={5000}
        message={snackBarMessage}
        action={
          <M.IconButton
            size="small"
            aria-label="close"
            color="inherit"
            onClick={handleSnackBarClose}
          >
            <M.Icon fontSize="small">close</M.Icon>
          </M.IconButton>
        }
      />
      <RBDialog isOpen={modalOpened} closeModal={closeModal} content={modalContent} />
    </M.ThemeProvider>
  )
}

function showVersionOnFooter() {
  const manifest = browser.runtime.getManifest()
  const footer = document.querySelector('footer.info')!
  footer.textContent = `${manifest.name} v${manifest.version}`
}

interface TabContext {
  myself: TwitterUser | null
  currentUser: TwitterUser | null
  currentTweet: Tweet | null
  currentSearchQuery: string | null
}

async function getTabContext(): Promise<TabContext> {
  const myself = await TwitterAPI.getMyself().catch(() => null)
  if (!myself) {
    return {
      myself,
      currentUser: null,
      currentTweet: null,
      currentSearchQuery: null,
    }
  }
  const tab = await getCurrentTab()
  if (!tab) {
    return {
      myself,
      currentUser: null,
      currentTweet: null,
      currentSearchQuery: null,
    }
  }
  const tweetId = getTweetIdFromTab(tab)
  const userId = getUserIdFromTab(tab)
  const userName = getUserNameFromTab(tab)
  const currentTweet = await (tweetId ? TwitterAPI.getTweetById(tweetId).catch(() => null) : null)
  let currentUser: TwitterUser | null = null
  if (currentTweet) {
    currentUser = currentTweet.user
  } else if (userName) {
    currentUser = await TwitterAPI.getSingleUserByName(userName).catch(() => null)
  } else if (userId) {
    currentUser = await TwitterAPI.getSingleUserById(userId).catch(() => null)
  }
  const currentSearchQuery = getCurrentSearchQueryFromTab(tab)
  return {
    myself,
    currentTweet,
    currentUser,
    currentSearchQuery,
  }
}

export async function initializeUI() {
  const redblockOptions = loadOptions()
  const isPopupOpenedInTab = /\bistab=1\b/.test(location.search)
  let initialPage: PageEnum
  const initialPageMatch = /\bpage=([0-5])\b/.exec(location.search)
  if (initialPageMatch) {
    initialPage = parseInt(initialPageMatch[1]) as PageEnum
  } else {
    initialPage = PageEnum.Sessions
  }
  const { myself, currentTweet, currentUser, currentSearchQuery } = await getTabContext()
  const appRoot = document.getElementById('app')!
  const app = (
    <PopupApp
      myself={myself}
      currentUser={currentUser}
      currentTweet={currentTweet}
      currentSearchQuery={currentSearchQuery}
      isPopupOpenedInTab={isPopupOpenedInTab}
      initialPage={initialPage}
      redblockOptions={await redblockOptions}
    />
  )
  ReactDOM.render(app, appRoot)
  showVersionOnFooter()
  if (isPopupOpenedInTab) {
    document.body.classList.add('ui-tab')
  } else {
    document.body.classList.add('ui-popup')
  }
  window.setInterval(() => {
    requestProgress().catch(() => {})
  }, UI_UPDATE_DELAY)
}

initializeUI()
