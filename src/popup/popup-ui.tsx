import { requestProgress } from '../scripts/background/request-sender.js'
import { loadOptions, RedBlockStorage } from '../scripts/background/storage.js'
import * as TwitterAPI from '../scripts/background/twitter-api.js'
import { isRunningSession, UI_UPDATE_DELAY } from '../scripts/common.js'
import * as i18n from '../scripts/i18n.js'

import BlocklistPage from './popup-ui/blocklist-page.js'
import ChainBlockSessionsPage from './popup-ui/chainblock-sessions-page.js'
import {
  DialogContext,
  PageSwitchContext,
  RedBlockOptionsContext,
  SnackBarContext,
  LoginStatusContext,
} from './popup-ui/contexts.js'
import MiscPage from './popup-ui/misc-page.js'
import NewChainBlockPage from './popup-ui/new-chainblock-page.js'
import NewTweetReactionBlockPage from './popup-ui/new-tweetreactionblock-page.js'
import { DialogContent, RBDialog, RedBlockUITheme, TabPanel } from './popup-ui/ui-common.js'

import { getCurrentTab, getTweetIdFromTab, getUserNameFromTab, getUserIdFromTab, PageEnum } from './popup.js'

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
  loggedIn: boolean
  currentUser: TwitterAPI.TwitterUser | null
  currentTweet: TwitterAPI.Tweet | null
  popupAsTab: boolean
  initialPage: PageEnum
  redblockOptions: RedBlockStorage['options']
}
function PopupApp(props: PopupAppProps) {
  const { loggedIn, currentUser, currentTweet, popupAsTab, initialPage, redblockOptions } = props
  const [tabIndex, setTabIndex] = React.useState<PageEnum>(initialPage)
  const [sessions, setSessions] = React.useState<SessionInfo[]>([])
  const [limiterStatus, setLimiterStatus] = React.useState<BlockLimiterStatus>({ current: 0, max: 0 })
  const [modalOpened, setModalOpened] = React.useState(false)
  const [modalContent, setModalContent] = React.useState<DialogContent | null>(null)
  const [snackBarMessage, setSnackBarMessage] = React.useState('')
  const [snackBarOpen, setSnackBarOpen] = React.useState(false)
  const [menuAnchorEl, setMenuAnchorEl] = React.useState<HTMLElement | null>(null)
  const darkMode = MaterialUI.useMediaQuery('(prefers-color-scheme:dark)')
  const theme = React.useMemo(() => RedBlockUITheme(darkMode), [darkMode])
  const classes = useStylesForAppBar()
  function openModal(content: DialogContent) {
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
  function snack(message: string) {
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
  function handleConfirm({ confirmMessage, sessionId }: RBMessages.ConfirmChainBlockInPopup) {
    openModal({
      dialogType: 'confirm',
      message: confirmMessage,
      callbackOnOk() {
        return browser.runtime.sendMessage<RBActions.Start>({
          actionType: 'Start',
          sessionId,
        })
      },
      callbackOnCancel() {
        return browser.runtime.sendMessage<RBActions.Cancel>({
          actionType: 'Cancel',
          sessionId,
        })
      },
    })
  }
  React.useEffect(() => {
    const messageListener = (msgobj: any) => {
      if (typeof msgobj !== 'object') {
        return
      }
      if ('messageType' in msgobj) {
        const msg = msgobj as RBMessageToPopup
        if (msg.messageTo !== 'popup') {
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
          case 'ConfirmChainBlockInPopup':
            handleConfirm(msg)
            break
          default:
            break
        }
        return
      } else if ('actionType' in msgobj) {
        // reach here if popup opened as tab
        // silently ignore
        return
      } else {
        console.debug('unknown message', msgobj)
        return
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
  const runningSessions = React.useMemo(() => sessions.filter(session => isRunningSession(session)), [sessions])
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
      <SnackBarContext.Provider value={{ snack }}>
        <DialogContext.Provider value={{ openModal }}>
          <LoginStatusContext.Provider value={{ loggedIn }}>
            <RedBlockOptionsContext.Provider value={redblockOptions}>
              <PageSwitchContext.Provider value={{ switchPage }}>
                <M.AppBar position="fixed">
                  <M.Toolbar variant="dense" className={classes.toolbar}>
                    <M.IconButton color="inherit" onClick={handleMenuButtonClick}>
                      <M.Icon>menu</M.Icon>
                    </M.IconButton>
                    <M.Tabs value={tabIndex} onChange={(_ev, val) => setTabIndex(val)}>
                      <M.Tooltip arrow title={`${i18n.getMessage('running_sessions')} (${runningSessions.length})`}>
                        <M.Tab className={classes.tab} icon={runningSessionsTabIcon} />
                      </M.Tooltip>
                      <M.Tooltip arrow title={i18n.getMessage('new_follower_session')}>
                        <M.Tab className={classes.tab} icon={<M.Icon>group</M.Icon>} />
                      </M.Tooltip>
                      <M.Tooltip arrow title={i18n.getMessage('new_tweetreaction_session')}>
                        <M.Tab className={classes.tab} disabled={!currentTweet} icon={<M.Icon>repeat</M.Icon>} />
                      </M.Tooltip>
                      <M.Tooltip arrow title={i18n.getMessage('blocklist_page')}>
                        <M.Tab className={classes.tab} icon={<M.Icon>list_alt</M.Icon>} />
                      </M.Tooltip>
                      <M.Tooltip arrow title={i18n.getMessage('miscellaneous')}>
                        <M.Tab className={classes.tab} icon={<M.Icon>build</M.Icon>} />
                      </M.Tooltip>
                    </M.Tabs>
                  </M.Toolbar>
                </M.AppBar>
                <M.Menu keepMounted anchorEl={menuAnchorEl} open={Boolean(menuAnchorEl)} onClose={closeMenu}>
                  {!popupAsTab && (
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
                      <ChainBlockSessionsPage sessions={sessions} limiterStatus={limiterStatus} />
                    </TabPanel>
                    <TabPanel value={tabIndex} index={PageEnum.NewSession}>
                      <NewChainBlockPage currentUser={currentUser} />
                    </TabPanel>
                    <TabPanel value={tabIndex} index={PageEnum.NewTweetReactionBlock}>
                      <NewTweetReactionBlockPage currentTweet={currentTweet} />
                    </TabPanel>
                    <TabPanel value={tabIndex} index={PageEnum.Blocklist}>
                      <BlocklistPage />
                    </TabPanel>
                    <TabPanel value={tabIndex} index={PageEnum.Utilities}>
                      <MiscPage />
                    </TabPanel>
                  </M.Container>
                </div>
              </PageSwitchContext.Provider>
            </RedBlockOptionsContext.Provider>
          </LoginStatusContext.Provider>
        </DialogContext.Provider>
      </SnackBarContext.Provider>
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
          <M.IconButton size="small" aria-label="close" color="inherit" onClick={handleSnackBarClose}>
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
  currentUser: TwitterUser | null
  currentTweet: Tweet | null
}

async function getTabContext(): Promise<TabContext> {
  const tab = await getCurrentTab()
  const tweetId = tab ? getTweetIdFromTab(tab) : null
  const userId = tab ? getUserIdFromTab(tab) : null
  const userName = tab ? getUserNameFromTab(tab) : null
  const currentTweet = await (tweetId ? TwitterAPI.getTweetById(tweetId).catch(() => null) : null)
  let currentUser: TwitterUser | null = null
  if (currentTweet) {
    currentUser = currentTweet.user
  } else if (userName) {
    currentUser = await TwitterAPI.getSingleUserByName(userName).catch(() => null)
  } else if (userId) {
    currentUser = await TwitterAPI.getSingleUserById(userId).catch(() => null)
  }
  return {
    currentTweet,
    currentUser,
  }
}

export async function initializeUI() {
  browser.runtime.sendMessage<RBActions.RequestCleanup>({
    actionType: 'RequestCleanup',
    cleanupWhat: 'not-confirmed',
  })
  const redblockOptions = loadOptions()
  const loggedIn = TwitterAPI.getMyself().then(
    () => true,
    () => false
  )
  const isPopupOpenedAsTab = /\bistab=1\b/.test(location.search)
  let initialPage: PageEnum
  const initialPageMatch = /\bpage=([0-4])\b/.exec(location.search)
  if (initialPageMatch) {
    initialPage = parseInt(initialPageMatch[1]) as PageEnum
  } else {
    initialPage = PageEnum.Sessions
  }
  const { currentTweet, currentUser } = await getTabContext()
  const appRoot = document.getElementById('app')!
  const app = (
    <PopupApp
      loggedIn={await loggedIn}
      currentUser={currentUser}
      currentTweet={currentTweet}
      popupAsTab={isPopupOpenedAsTab}
      initialPage={initialPage}
      redblockOptions={await redblockOptions}
    />
  )
  ReactDOM.render(app, appRoot)
  showVersionOnFooter()
  if (isPopupOpenedAsTab) {
    document.body.classList.add('ui-tab')
  } else {
    document.body.classList.add('ui-popup')
  }
}

initializeUI()
