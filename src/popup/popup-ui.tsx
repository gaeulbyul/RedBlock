import {
  requestProgress,
  requestBlockLimiterStatus,
  refreshSavedUsers,
} from '../scripts/background/request-sender.js'
import { loadOptions, onStorageChanged } from '../scripts/background/storage.js'
import { TwClient } from '../scripts/background/twitter-api.js'
import { isRunningSession, UI_UPDATE_DELAY } from '../scripts/common.js'
import * as i18n from '../scripts/i18n.js'

import BlocklistPage from './popup-ui/blocklist-page.js'
import ChainBlockSessionsPage from './popup-ui/chainblock-sessions-page.js'
import { PageEnum, pageIcon, pageLabel } from './popup-ui/pages.js'
import {
  UIContext,
  RedBlockOptionsContext,
  MyselfContext,
  BlockLimiterContext,
  AvailablePages,
  TwitterAPIClientContext,
} from './popup-ui/contexts.js'
import {
  FollowerChainBlockPageStatesProvider,
  TweetReactionChainBlockPageStatesProvider,
  ImportChainBlockPageStatesProvider,
  UserSearchChainBlockPageStatesProvider,
  LockPickerPageStatesProvider,
} from './popup-ui/ui-states.js'
import MiscPage from './popup-ui/misc-page.js'
import NewChainBlockPage from './popup-ui/new-chainblock-page.js'
import NewTweetReactionBlockPage from './popup-ui/new-tweetreactionblock-page.js'
import NewSearchChainBlockPage from './popup-ui/new-searchblock-page.js'
import LockPickerPage from './popup-ui/lockpicker-page.js'
import {
  DialogContent,
  RBDialog,
  RedBlockUITheme,
  TabPanel,
  MyTooltip,
} from './popup-ui/components.js'

import {
  getCurrentTab,
  getTweetIdFromTab,
  getUserNameFromTab,
  getUserIdFromTab,
  getCurrentSearchQueryFromTab,
} from './popup.js'
import { getCookieStoreIdFromTab } from '../scripts/background/cookie-handler.js'

const M = MaterialUI

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

const PopupTopTab = MaterialUI.withStyles({
  root: {
    minWidth: '48px',
    '&:disabled': {
      opacity: 0.3,
    },
  },
})(MaterialUI.Tab)

interface PopupAppProps {
  myself: TwitterUser | null
  twClient: TwClient
  currentUser: TwitterUser | null
  currentTweet: Tweet | null
  currentSearchQuery: string | null
  popupOpenedInTab: boolean
  initialPage: PageEnum
  initialRedBlockOptions: RedBlockStorage['options']
}

function PopupUITopMenu(props: {
  runningSessions: SessionInfo[]
  currentTweet: Tweet | null
  currentSearchQuery: string | null
}) {
  const { runningSessions } = props
  const {
    menuAnchorElem,
    setMenuAnchorElem,
    switchPage,
    popupOpenedInTab,
    availablePages,
  } = React.useContext(UIContext)
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
  function switchPageFromMenu(page: PageEnum) {
    switchPage(page)
    closeMenu()
  }
  function closeMenu() {
    setMenuAnchorElem(null)
  }
  return (
    <M.Menu
      keepMounted
      anchorEl={menuAnchorElem}
      open={Boolean(menuAnchorElem)}
      onClose={closeMenu}
    >
      <M.MenuItem dense onClick={() => switchPageFromMenu(PageEnum.Sessions)}>
        <M.ListItemIcon>{pageIcon(PageEnum.Sessions)}</M.ListItemIcon>
        {pageLabel(PageEnum.Sessions, runningSessions.length)}
      </M.MenuItem>
      <M.MenuItem
        dense
        disabled={!availablePages.followerChainBlock}
        onClick={() => switchPageFromMenu(PageEnum.NewSession)}
      >
        <M.ListItemIcon>{pageIcon(PageEnum.NewSession)}</M.ListItemIcon>
        {pageLabel(PageEnum.NewSession)}
      </M.MenuItem>
      <M.MenuItem
        dense
        disabled={!availablePages.tweetReactionChainBlock}
        onClick={() => switchPageFromMenu(PageEnum.NewTweetReactionBlock)}
      >
        <M.ListItemIcon>{pageIcon(PageEnum.NewTweetReactionBlock)}</M.ListItemIcon>
        {pageLabel(PageEnum.NewTweetReactionBlock)}
      </M.MenuItem>
      <M.MenuItem
        dense
        disabled={!availablePages.userSearchChainBlock}
        onClick={() => switchPageFromMenu(PageEnum.NewSearchChainBlock)}
      >
        <M.ListItemIcon>{pageIcon(PageEnum.NewSearchChainBlock)}</M.ListItemIcon>
        {pageLabel(PageEnum.NewSearchChainBlock)}
      </M.MenuItem>
      <M.MenuItem
        dense
        disabled={!availablePages.importChainBlock}
        onClick={() => switchPageFromMenu(PageEnum.Blocklist)}
      >
        <M.ListItemIcon>{pageIcon(PageEnum.Blocklist)}</M.ListItemIcon>
        {pageLabel(PageEnum.Blocklist)}
      </M.MenuItem>
      <M.MenuItem
        dense
        disabled={!availablePages.lockPicker}
        onClick={() => switchPageFromMenu(PageEnum.LockPicker)}
      >
        <M.ListItemIcon>{pageIcon(PageEnum.LockPicker)}</M.ListItemIcon>
        {pageLabel(PageEnum.LockPicker)}
      </M.MenuItem>
      <M.MenuItem
        dense
        disabled={!availablePages.miscellaneous}
        onClick={() => switchPageFromMenu(PageEnum.Utilities)}
      >
        <M.ListItemIcon>{pageIcon(PageEnum.Utilities)}</M.ListItemIcon>
        {pageLabel(PageEnum.Utilities)}
      </M.MenuItem>
      <M.Divider />
      {!popupOpenedInTab && (
        <M.MenuItem dense onClick={handleOpenInTabClick}>
          <M.ListItemIcon>
            <M.Icon>open_in_new</M.Icon>
          </M.ListItemIcon>
          {i18n.getMessage('open_in_new_tab')}
        </M.MenuItem>
      )}
      <M.MenuItem dense onClick={handleSettingsClick}>
        <M.ListItemIcon>
          <M.Icon>settings</M.Icon>
        </M.ListItemIcon>
        {i18n.getMessage('open_settings_ui')}
      </M.MenuItem>
    </M.Menu>
  )
}

function PopupMyselfIcon(props: { myself: TwitterUser }) {
  const { myself } = props
  const description = i18n.getMessage('current_account', [myself.screen_name, myself.name])
  return (
    <MyTooltip arrow placement="bottom-end" title={description}>
      <M.Button>
        <img width="24" style={{ borderRadius: '50%' }} src={myself.profile_image_url_https} />
      </M.Button>
    </MyTooltip>
  )
}

function PopupApp({
  myself,
  twClient,
  currentUser,
  currentTweet,
  currentSearchQuery,
  popupOpenedInTab,
  initialPage,
  initialRedBlockOptions,
}: PopupAppProps) {
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
  const [menuAnchorElem, setMenuAnchorElem] = React.useState<HTMLElement | null>(null)
  const darkMode = MaterialUI.useMediaQuery('(prefers-color-scheme:dark)')
  // 파이어폭스의 팝업 가로폭 문제
  // 참고: popup.css
  const [initialLoading, setInitialLoading] = React.useState(true)
  const [redblockOptions, setRedBlockOptions] = React.useState(initialRedBlockOptions)
  const shrinkedPopup = MaterialUI.useMediaQuery('(width:348px), (width:425px)')
  const theme = React.useMemo(() => RedBlockUITheme(darkMode), [darkMode])
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
  function handleMenuButtonClick(event: React.MouseEvent<HTMLButtonElement>) {
    setMenuAnchorElem(event.currentTarget)
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
  const availablePages: AvailablePages = {
    followerChainBlock: !!myself,
    tweetReactionChainBlock: !!(myself && currentTweet),
    userSearchChainBlock: !!(myself && currentSearchQuery),
    importChainBlock: !!myself,
    lockPicker: !!myself,
    // 쿠키삭제 메뉴는 트위터 로그인상태가 아니어도 사용할 수 있도록
    miscellaneous: true,
  }
  React.useEffect(() => {
    const messageListener = (msg: object) => {
      if (!checkMessage(msg)) {
        console.debug('unknown message?', msg)
        return
      }
      switch (msg.messageType) {
        case 'ChainBlockInfo':
          setInitialLoading(false)
          setSessions(msg.sessions)
          break
        case 'BlockLimiterInfo':
          if (myself && msg.userId === myself.id_str) {
            setLimiterStatus(msg.status)
          }
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
  }, [twClient])
  React.useEffect(() => {
    return onStorageChanged('options', setRedBlockOptions)
  }, [])
  const runningSessions = sessions.filter(session => isRunningSession(session))
  const runningSessionsTabIcon = (
    <M.Badge
      color="secondary"
      badgeContent={runningSessions.length}
      anchorOrigin={{
        vertical: 'bottom',
        horizontal: 'right',
      }}
    >
      {pageIcon(PageEnum.Sessions)}
    </M.Badge>
  )
  return (
    <M.ThemeProvider theme={theme}>
      <UIContext.Provider
        value={{
          openDialog,
          openSnackBar,
          switchPage,
          shrinkedPopup,
          popupOpenedInTab,
          menuAnchorElem,
          setMenuAnchorElem,
          availablePages,
          initialLoading,
        }}
      >
        <TwitterAPIClientContext.Provider value={twClient}>
          <MyselfContext.Provider value={myself}>
            <RedBlockOptionsContext.Provider value={redblockOptions}>
              <BlockLimiterContext.Provider value={limiterStatus}>
                <M.AppBar position="fixed">
                  <M.Toolbar variant="dense" disableGutters>
                    <M.IconButton color="inherit" onClick={handleMenuButtonClick}>
                      <M.Icon>menu</M.Icon>
                    </M.IconButton>
                    <M.Tabs
                      style={{ flexGrow: 1 }}
                      value={tabIndex}
                      onChange={(_ev, val) => setTabIndex(val)}
                    >
                      <MyTooltip arrow title={pageLabel(PageEnum.Sessions, runningSessions.length)}>
                        <PopupTopTab icon={runningSessionsTabIcon} />
                      </MyTooltip>
                      <MyTooltip arrow title={pageLabel(PageEnum.NewSession)}>
                        <PopupTopTab
                          icon={pageIcon(PageEnum.NewSession)}
                          disabled={!availablePages.followerChainBlock}
                        />
                      </MyTooltip>
                      <MyTooltip arrow title={pageLabel(PageEnum.NewTweetReactionBlock)}>
                        <PopupTopTab
                          icon={pageIcon(PageEnum.NewTweetReactionBlock)}
                          disabled={!availablePages.tweetReactionChainBlock}
                        />
                      </MyTooltip>
                      <MyTooltip arrow title={pageLabel(PageEnum.NewSearchChainBlock)}>
                        <PopupTopTab
                          icon={pageIcon(PageEnum.NewSearchChainBlock)}
                          disabled={!availablePages.userSearchChainBlock}
                        />
                      </MyTooltip>
                      <MyTooltip arrow title={pageLabel(PageEnum.Blocklist)}>
                        <PopupTopTab
                          icon={pageIcon(PageEnum.Blocklist)}
                          disabled={!availablePages.importChainBlock}
                        />
                      </MyTooltip>
                      <MyTooltip arrow title={pageLabel(PageEnum.LockPicker)}>
                        <PopupTopTab
                          icon={pageIcon(PageEnum.LockPicker)}
                          disabled={!availablePages.lockPicker}
                        />
                      </MyTooltip>
                      <MyTooltip arrow title={pageLabel(PageEnum.Utilities)}>
                        <PopupTopTab
                          icon={pageIcon(PageEnum.Utilities)}
                          disabled={!availablePages.miscellaneous}
                        />
                      </MyTooltip>
                    </M.Tabs>
                    {myself && <PopupMyselfIcon {...{ myself }} />}
                  </M.Toolbar>
                </M.AppBar>
                <PopupUITopMenu {...{ runningSessions, currentTweet, currentSearchQuery }} />
                <div className="page">
                  <M.Container maxWidth="sm" disableGutters>
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
                    <LockPickerPageStatesProvider>
                      <TabPanel value={tabIndex} index={PageEnum.LockPicker}>
                        <LockPickerPage />
                      </TabPanel>
                    </LockPickerPageStatesProvider>
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
        </TwitterAPIClientContext.Provider>
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

async function getTabContext(tab: browser.tabs.Tab, twClient: TwClient): Promise<TabContext> {
  const myself = await twClient.getMyself().catch(() => null)
  if (!myself) {
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
  const currentTweet = await (tweetId ? twClient.getTweetById(tweetId).catch(() => null) : null)
  let currentUser: TwitterUser | null = null
  if (currentTweet) {
    currentUser = currentTweet.user
  } else if (userName) {
    currentUser = await twClient.getSingleUser({ screen_name: userName }).catch(() => null)
  } else if (userId) {
    currentUser = await twClient.getSingleUser({ user_id: userId }).catch(() => null)
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
  const initialRedBlockOptions = await loadOptions()
  const popupOpenedInTab = /\bistab=1\b/.test(location.search)
  let initialPage: PageEnum
  const initialPageMatch = /\bpage=([0-6])\b/.exec(location.search)
  if (initialPageMatch) {
    initialPage = parseInt(initialPageMatch[1]) as PageEnum
  } else {
    initialPage = PageEnum.Sessions
  }
  const currentTab = await getCurrentTab()
  const cookieStoreId = await getCookieStoreIdFromTab(currentTab)
  const twClient = new TwClient({ cookieStoreId })
  const { myself, currentTweet, currentUser, currentSearchQuery } = await getTabContext(
    currentTab,
    twClient
  )
  const appRoot = document.getElementById('app')!
  const app = (
    <PopupApp
      {...{
        myself,
        twClient,
        currentUser,
        currentTweet,
        currentSearchQuery,
        popupOpenedInTab,
        initialPage,
        initialRedBlockOptions,
      }}
    />
  )
  ReactDOM.render(app, appRoot)
  showVersionOnFooter()
  if (popupOpenedInTab) {
    document.body.classList.add('ui-tab')
  } else {
    document.body.classList.add('ui-popup')
  }
  requestProgress().catch(() => {})
  if (myself) {
    requestBlockLimiterStatus(myself.id_str).catch(() => {})
  }
  refreshSavedUsers({ cookieStoreId })
  window.setInterval(() => {
    requestProgress().catch(() => {})
    if (myself) {
      requestBlockLimiterStatus(myself.id_str).catch(() => {})
    }
  }, UI_UPDATE_DELAY)
}

initializeUI()
