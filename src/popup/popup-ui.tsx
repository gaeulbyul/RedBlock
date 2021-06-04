import { requestProgress, requestBlockLimiterStatus } from '../scripts/background/request-sender.js'
import { loadOptions, onStorageChanged } from '../scripts/background/storage.js'
import { TwClient } from '../scripts/background/twitter-api.js'
import BlocklistPage from './popup-ui/new-session-blocklist-page.js'
import ChainBlockSessionsPage from './popup-ui/chainblock-sessions-page.js'
import { PageEnum, pageIcon, pageLabel } from './popup-ui/pages.js'
import {
  UIContext,
  RedBlockOptionsContext,
  BlockLimiterContext,
  AvailablePages,
  MyselfContext,
} from './popup-ui/contexts.js'
import {
  FollowerChainBlockPageStatesProvider,
  TweetReactionChainBlockPageStatesProvider,
  ImportChainBlockPageStatesProvider,
  UserSearchChainBlockPageStatesProvider,
  AudioSpaceChainBlockPageStatesProvider,
  LockPickerPageStatesProvider,
} from './popup-ui/ui-states.js'
import MiscPage from './popup-ui/misc-page.js'
import NewSessionFollowersPage from './popup-ui/new-session-followers-page.js'
import NewSessionTweetPage from './popup-ui/new-session-tweet-page.js'
import NewSessionSearchresultPage from './popup-ui/new-session-searchresult-page.js'
import NewSessionAudioSpacePage from './popup-ui/new-session-audiospace-page.js'
import NewSessionLockPickerPage from './popup-ui/new-session-lockpicker-page.js'
import {
  DialogContent,
  RBDialog,
  RedBlockPopupUITheme,
  TabPanel,
  MyTooltip,
} from './popup-ui/components.js'
import { isRunningSession } from '../scripts/common.js'
import { getCurrentTab, checkMessage, getTabContext, TabContext } from './popup.js'
import { getCookieStoreIdFromTab } from '../scripts/background/cookie-handler.js'

const UI_UPDATE_DELAY = 750

const M = MaterialUI

function getVersionAndName() {
  const manifest = browser.runtime.getManifest()
  return `${manifest.name} v${manifest.version}`
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
  myself: Actor | null
  tabContext: TabContext
  // currentUser: TwitterUser | null
  // currentTweet: Tweet | null
  // currentSearchQuery: string | null
  popupOpenedInTab: boolean
  initialPage: PageEnum
  initialRedBlockOptions: RedBlockStorage['options']
}

function PopupUITopMenu({ countOfSessions }: { countOfSessions: number }) {
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
        {pageLabel(PageEnum.Sessions, countOfSessions)}
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
        disabled={!availablePages.newAudioSpaceSession}
        onClick={() => switchPageFromMenu(PageEnum.NewAudioSpaceSession)}
      >
        <M.ListItemIcon>{pageIcon(PageEnum.NewAudioSpaceSession)}</M.ListItemIcon>
        {pageLabel(PageEnum.NewAudioSpaceSession)}
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
      <M.Divider />
      <M.MenuItem disabled>{getVersionAndName()}</M.MenuItem>
    </M.Menu>
  )
}

function PopupMyselfIcon({ myself }: { myself: TwitterUser }) {
  const description = i18n.getMessage('current_account', [myself.screen_name, myself.name])
  return (
    <MyTooltip arrow placement="left" title={description}>
      <M.Button>
        <M.Avatar
          style={{
            width: 24,
            height: 24,
            borderRadius: '50%',
          }}
          src={myself.profile_image_url_https}
        />
      </M.Button>
    </MyTooltip>
  )
}

function PopupApp({
  myself,
  tabContext: { currentUser, currentTweet, currentSearchQuery, currentAudioSpace },
  popupOpenedInTab,
  initialPage,
  initialRedBlockOptions,
}: PopupAppProps) {
  const [tabIndex, setTabIndex] = React.useState<PageEnum>(initialPage)
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
  const [initialLoading, setInitialLoading] = React.useState(true)
  const [redblockOptions, setRedBlockOptions] = React.useState(initialRedBlockOptions)
  const [countOfSessions, setCountOfSessions] = React.useState(0)
  // 파이어폭스의 팝업 가로폭 문제
  // 참고: popup.css
  const shrinkedPopup = MaterialUI.useMediaQuery('(width:348px), (width:425px)')
  const theme = React.useMemo(() => RedBlockPopupUITheme(darkMode), [darkMode])
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
    newAudioSpaceSession: !!(
      myself &&
      currentAudioSpace &&
      redblockOptions.experimentallyEnableAudioSpace
    ),
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
          setCountOfSessions(msg.sessions.filter(isRunningSession).length)
          break
        case 'BlockLimiterInfo':
          if (myself && msg.userId === myself.user.id_str) {
            const oldValue = limiterStatus.current
            const newValue = msg.status.current
            if (oldValue !== newValue) {
              setLimiterStatus(msg.status)
            }
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
  }, [limiterStatus])
  React.useEffect(() => onStorageChanged('options', setRedBlockOptions), [])
  const runningSessionsTabIcon = (
    <M.Badge
      color="secondary"
      badgeContent={countOfSessions}
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
                    <MyTooltip arrow title={pageLabel(PageEnum.Sessions, countOfSessions)}>
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
                    {availablePages.newAudioSpaceSession && (
                      <MyTooltip arrow title={pageLabel(PageEnum.NewAudioSpaceSession)}>
                        <PopupTopTab
                          icon={pageIcon(PageEnum.NewAudioSpaceSession)}
                          disabled={!availablePages.newAudioSpaceSession}
                        />
                      </MyTooltip>
                    )}
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
                  {myself && <PopupMyselfIcon {...{ myself: myself.user }} />}
                </M.Toolbar>
              </M.AppBar>
              <PopupUITopMenu {...{ countOfSessions }} />
              <div className="page">
                <M.Container maxWidth="sm" disableGutters>
                  <TabPanel value={tabIndex} index={PageEnum.Sessions}>
                    <ChainBlockSessionsPage />
                  </TabPanel>
                  <FollowerChainBlockPageStatesProvider initialUser={currentUser}>
                    <TabPanel value={tabIndex} index={PageEnum.NewSession}>
                      <NewSessionFollowersPage />
                    </TabPanel>
                  </FollowerChainBlockPageStatesProvider>
                  <TweetReactionChainBlockPageStatesProvider initialTweet={currentTweet}>
                    <TabPanel value={tabIndex} index={PageEnum.NewTweetReactionBlock}>
                      <NewSessionTweetPage />
                    </TabPanel>
                  </TweetReactionChainBlockPageStatesProvider>
                  <UserSearchChainBlockPageStatesProvider currentSearchQuery={currentSearchQuery}>
                    <TabPanel value={tabIndex} index={PageEnum.NewSearchChainBlock}>
                      <NewSessionSearchresultPage />
                    </TabPanel>
                  </UserSearchChainBlockPageStatesProvider>
                  {availablePages.newAudioSpaceSession && (
                    <AudioSpaceChainBlockPageStatesProvider audioSpace={currentAudioSpace!}>
                      <TabPanel value={tabIndex} index={PageEnum.NewAudioSpaceSession}>
                        <NewSessionAudioSpacePage />
                      </TabPanel>
                    </AudioSpaceChainBlockPageStatesProvider>
                  )}
                  <LockPickerPageStatesProvider>
                    <TabPanel value={tabIndex} index={PageEnum.LockPicker}>
                      <NewSessionLockPickerPage />
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

export async function initializeUI() {
  const initialRedBlockOptions = await loadOptions()
  const popupOpenedInTab = /\bistab=1\b/.test(location.search)
  let initialPage: PageEnum
  const initialPageMatch = /\bpage=([0-7])\b/.exec(location.search)
  if (initialPageMatch) {
    initialPage = parseInt(initialPageMatch[1]) as PageEnum
  } else {
    initialPage = PageEnum.Sessions
  }
  const tabContext: TabContext = {
    currentUser: null,
    currentTweet: null,
    currentSearchQuery: null,
    currentAudioSpace: null,
  }
  const currentTab = await getCurrentTab()
  const cookieStoreId = await getCookieStoreIdFromTab(currentTab)
  const twClient = new TwClient({ cookieStoreId })
  const me = await twClient.getMyself().catch(() => null)
  let myself: Actor | null
  if (me) {
    myself = {
      user: me,
      cookieOptions: twClient.cookieOptions,
    }
    const {
      currentTweet,
      currentUser,
      currentSearchQuery,
      currentAudioSpace,
    } = await getTabContext(currentTab, myself, twClient)
    Object.assign(tabContext, {
      currentTweet,
      currentUser,
      currentSearchQuery,
      currentAudioSpace,
    })
  } else {
    myself = null
  }
  const appRoot = document.getElementById('app')!
  const app = (
    <PopupApp
      {...{
        myself,
        tabContext,
        popupOpenedInTab,
        initialPage,
        initialRedBlockOptions,
      }}
    />
  )
  ReactDOM.render(app, appRoot)
  if (popupOpenedInTab) {
    document.body.classList.add('ui-tab')
  } else {
    document.body.classList.add('ui-popup')
  }
  if (me) {
    requestBlockLimiterStatus(me.id_str).catch(() => {})
  }
  window.setInterval(() => {
    requestProgress().catch(() => {})
    if (me) {
      requestBlockLimiterStatus(me.id_str).catch(() => {})
    }
  }, UI_UPDATE_DELAY)
}

initializeUI()
