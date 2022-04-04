import * as MaterialUI from '@mui/material'
import { withStyles } from '@mui/styles'

import React from 'react'
import ReactDOM from 'react-dom'
import browser from 'webextension-polyfill'

import { requestBlockLimiterStatus, requestProgress } from '../scripts/background/request-sender'
import { onStorageChanged } from '../scripts/background/storage'
import {
  defaultOptions as defaultRedBlockOptions,
  loadOptions as loadRedBlockOptions,
} from '../scripts/background/storage/options'

import { isRunningSession } from '../scripts/common/utilities'
import * as i18n from '../scripts/i18n'
import { checkMessage, getCurrentTabInfo, infoless, TabInfo as TabInfo } from './popup'
import ChainBlockSessionsPage from './popup-ui/chainblock-sessions-page'
import {
  DialogContent,
  MyTooltip,
  RBDialog,
  RedBlockPopupUITheme,
  TabPanel,
} from './popup-ui/components'
import {
  BlockLimiterContext,
  RedBlockOptionsContext,
  TabInfoContext,
  UIContext,
} from './popup-ui/contexts'
import MiscPage from './popup-ui/misc-page'
import NewSessionAudioSpacePage from './popup-ui/new-session-audiospace-page'
import BlocklistPage from './popup-ui/new-session-blocklist-page'
import NewSessionFollowersPage from './popup-ui/new-session-followers-page'
import NewSessionLockPickerPage from './popup-ui/new-session-lockpicker-page'
import NewSessionSearchresultPage from './popup-ui/new-session-searchresult-page'
import NewSessionTweetPage from './popup-ui/new-session-tweet-page'
import { AvailablePages, isValidPageId, pageIcon, PageId, pageLabel } from './popup-ui/pages'
import {
  AudioSpaceChainBlockPageStatesProvider,
  FollowerChainBlockPageStatesProvider,
  ImportChainBlockPageStatesProvider,
  LockPickerPageStatesProvider,
  TweetReactionChainBlockPageStatesProvider,
  UserSearchChainBlockPageStatesProvider,
} from './popup-ui/ui-states'

const UI_UPDATE_DELAY_ON_BUSY = 500
const UI_UPDATE_DELAY_ON_IDLE = 1500

const M = MaterialUI

function getVersionAndName() {
  const manifest = browser.runtime.getManifest()
  return `${manifest.name} v${manifest.version}`
}

// https://overreacted.io/making-setinterval-declarative-with-react-hooks/
function useInterval(callback: Function, delay: number | null) {
  const savedCallback = React.useRef<Function>()

  // Remember the latest callback.
  React.useEffect(() => {
    savedCallback.current = callback
  }, [callback])

  // Set up the interval.
  React.useEffect(() => {
    function tick() {
      savedCallback.current?.()
    }
    if (delay === null) {
      return () => {}
    }
    const id = setInterval(tick, delay)
    return () => clearInterval(id)
  }, [delay])
}

const StyledTab = withStyles({
  root: {
    minWidth: '48px',
    '&:disabled': {
      opacity: 0.5,
      filter: 'blur(1px)',
    },
  },
})(MaterialUI.Tab)

function PopupTopTab({
  value,
  disabled,
  count,
  ...props
}: {
  value: PageId
  count?: number
  disabled?: boolean
}) {
  const icon = (
    <M.Badge
      color="secondary"
      badgeContent={count}
      anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
    >
      {pageIcon(value)}
    </M.Badge>
  )
  return (
    <MyTooltip arrow title={pageLabel(value, count)}>
      <div>
        <StyledTab {...props} {...{ value, icon, disabled }} />
      </div>
    </MyTooltip>
  )
}

function PopupUITopMenu({ countOfRunningSessions }: { countOfRunningSessions: number }) {
  const { menuAnchorElem, setMenuAnchorElem, switchPage, popupOpenedInTab, availablePages } = React
    .useContext(UIContext)
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
  function switchPageFromMenu(page: PageId) {
    switchPage(page)
    closeMenu()
  }
  function closeMenu() {
    setMenuAnchorElem(null)
  }
  const MenuItem = React.forwardRef(
    (
      {
        pageId,
        count,
        disabled,
      }: {
        pageId: PageId
        count?: number
        disabled?: boolean
      },
      ref: React.Ref<any>,
    ) => (
      <M.MenuItem ref={ref} dense disabled={disabled} onClick={() => switchPageFromMenu(pageId)}>
        <M.ListItemIcon>{pageIcon(pageId)}</M.ListItemIcon>
        {pageLabel(pageId, count)}
      </M.MenuItem>
    ),
  )
  return (
    <M.Menu
      keepMounted
      anchorEl={menuAnchorElem}
      open={Boolean(menuAnchorElem)}
      onClose={closeMenu}
    >
      <MenuItem pageId="chainblock-sessions-page" count={countOfRunningSessions} />
      <MenuItem
        pageId="new-session-followers-page"
        disabled={!availablePages['new-session-followers-page']}
      />
      <MenuItem
        pageId="new-session-tweet-page"
        disabled={!availablePages['new-session-tweet-page']}
      />
      <MenuItem
        pageId="new-session-searchresult-page"
        disabled={!availablePages['new-session-searchresult-page']}
      />
      <MenuItem
        pageId="new-session-audiospace-page"
        disabled={!availablePages['new-session-audiospace-page']}
      />
      <MenuItem
        pageId="new-session-blocklist-page"
        disabled={!availablePages['new-session-blocklist-page']}
      />
      <MenuItem
        pageId="new-session-lockpicker-page"
        disabled={!availablePages['new-session-lockpicker-page']}
      />
      <MenuItem pageId="misc-page" />

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
  // myself,
  // tabContext: { currentUser, currentTweet, currentSearchQuery, currentAudioSpace },
  popupOpenedInTab,
  initialPage,
}: {
  // myself: Actor | null
  // tabContext: TabContext
  popupOpenedInTab: boolean
  initialPage: PageId
}) {
  const [tabPage, setTabPage] = React.useState<PageId>(initialPage)
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
  const [redblockOptions, setRedBlockOptions] = React.useState(defaultRedBlockOptions)
  const [sessions, setSessions] = React.useState<SessionInfo[]>([])
  const [recurringInfos, setRecurringInfos] = React.useState<RecurringAlarmInfosObject>({})
  const [currentTabInfo, setCurrentTabInfo] = React.useState<TabInfo>(infoless)
  const { myself } = currentTabInfo
  // 파이어폭스의 팝업 가로폭 문제
  // 참고: popup.css
  const shrinkedPopup = MaterialUI.useMediaQuery('(width:348px), (width:425px)')
  const theme = React.useMemo(() => RedBlockPopupUITheme(darkMode), [darkMode])
  React.useEffect(() => {
    getCurrentTabInfo().then(tabInfo => {
      console.debug('tabInfo: %o', tabInfo)
      setCurrentTabInfo(tabInfo)
      setInitialLoading(false)
    })
  }, [])
  const [countOfRunningSessions, setCountOfRunningSessions] = React.useState(0)
  const [delay, setDelay] = React.useState<number | null>(null)
  useInterval(async () => {
    if (!myself) {
      setDelay(null)
      return
    }
    requestProgress().catch(() => {})
    requestBlockLimiterStatus(myself.user.id_str).catch(() => {})
  }, delay)
  function openDialog(content: DialogContent) {
    setModalOpened(true)
    setModalContent(content)
  }
  function closeModal() {
    setModalOpened(false)
  }
  function switchPage(page: PageId) {
    setTabPage(page)
  }
  function handleMenuButtonClick(event: React.MouseEvent<HTMLButtonElement>) {
    setMenuAnchorElem(event.currentTarget)
  }
  function openSnackBar(message: string) {
    setSnackBarMessage(message)
    setSnackBarOpen(true)
  }
  function handleSnackBarClose(_event: any, reason?: string) {
    if (reason === 'clickaway') {
      return
    }
    setSnackBarOpen(false)
  }
  const availablePages: AvailablePages = {
    'new-session-followers-page': !!myself,
    'new-session-tweet-page': !!(myself && currentTabInfo.tweet),
    'new-session-searchresult-page': !!(myself && currentTabInfo.searchQuery),
    'new-session-blocklist-page': !!myself,
    'new-session-audiospace-page': !!(myself && currentTabInfo.audioSpace),
    'new-session-lockpicker-page': !!myself,
  }
  React.useEffect(() => {
    if (myself) {
      requestBlockLimiterStatus(myself.user.id_str).catch(() => {})
      requestProgress().catch(() => {})
    }
  }, [myself])
  React.useEffect(() => {
    const messageListener = (msg: object) => {
      if (!checkMessage(msg)) {
        console.debug('unknown message?', msg)
        return
      }
      switch (msg.messageType) {
        case 'ChainBlockInfo':
          setInitialLoading(false)
          const runningSessionsLength = msg.sessions.filter(isRunningSession).length
          setCountOfRunningSessions(runningSessionsLength)
          if (tabPage === 'chainblock-sessions-page') {
            setSessions(msg.sessions)
            setRecurringInfos(msg.recurringAlarmInfos)
            if (runningSessionsLength > 0) {
              setDelay(UI_UPDATE_DELAY_ON_BUSY)
            } else {
              setDelay(UI_UPDATE_DELAY_ON_IDLE)
            }
          } else {
            setDelay(UI_UPDATE_DELAY_ON_IDLE)
          }
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
          setTabPage(msg.page)
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
  }, [limiterStatus, tabPage, myself])
  React.useEffect(() => {
    loadRedBlockOptions().then(setRedBlockOptions)
    return onStorageChanged('options', setRedBlockOptions)
  }, [])
  function renderMain(children: React.ReactElement) {
    if (initialLoading) {
      return (
        <div
          style={{
            display: 'flex',
            height: '100%',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <M.CircularProgress size={60} color="secondary" />
        </div>
      )
    }
    return children
  }
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
        <TabInfoContext.Provider value={currentTabInfo}>
          <RedBlockOptionsContext.Provider value={redblockOptions}>
            <BlockLimiterContext.Provider value={limiterStatus}>
              <M.AppBar position="fixed">
                <M.Toolbar variant="dense" disableGutters>
                  <M.IconButton color="inherit" onClick={handleMenuButtonClick}>
                    <M.Icon>menu</M.Icon>
                  </M.IconButton>
                  <M.Tabs
                    style={{ flexGrow: 1 }}
                    textColor="inherit"
                    indicatorColor="secondary"
                    value={tabPage}
                    onChange={(_ev, val) => setTabPage(val)}
                  >
                    <PopupTopTab value="chainblock-sessions-page" count={countOfRunningSessions} />
                    <PopupTopTab
                      value="new-session-followers-page"
                      disabled={!availablePages['new-session-followers-page']}
                    />
                    <PopupTopTab
                      value="new-session-tweet-page"
                      disabled={!availablePages['new-session-tweet-page']}
                    />
                    <PopupTopTab
                      value="new-session-searchresult-page"
                      disabled={!availablePages['new-session-searchresult-page']}
                    />
                    {availablePages['new-session-audiospace-page'] && (
                      <PopupTopTab
                        value="new-session-audiospace-page"
                        disabled={!availablePages['new-session-audiospace-page']}
                      />
                    )}
                    <PopupTopTab
                      value="new-session-blocklist-page"
                      disabled={!availablePages['new-session-blocklist-page']}
                    />
                    <PopupTopTab
                      value="new-session-lockpicker-page"
                      disabled={!availablePages['new-session-lockpicker-page']}
                    />
                    <PopupTopTab value="misc-page" />
                  </M.Tabs>
                  {myself && <PopupMyselfIcon {...{ myself: myself.user }} />}
                </M.Toolbar>
              </M.AppBar>
              <PopupUITopMenu {...{ countOfRunningSessions }} />
              <main className="page">
                {renderMain(
                  <M.Container maxWidth="sm" disableGutters>
                    <TabPanel value={tabPage} index="chainblock-sessions-page">
                      <ChainBlockSessionsPage {...{ sessions, recurringInfos }} />
                    </TabPanel>
                    <FollowerChainBlockPageStatesProvider initialUser={currentTabInfo.user}>
                      <TabPanel value={tabPage} index="new-session-followers-page">
                        <NewSessionFollowersPage />
                      </TabPanel>
                    </FollowerChainBlockPageStatesProvider>
                    <TweetReactionChainBlockPageStatesProvider initialTweet={currentTabInfo.tweet}>
                      <TabPanel value={tabPage} index="new-session-tweet-page">
                        <NewSessionTweetPage />
                      </TabPanel>
                    </TweetReactionChainBlockPageStatesProvider>
                    <UserSearchChainBlockPageStatesProvider
                      currentSearchQuery={currentTabInfo.searchQuery}
                    >
                      <TabPanel value={tabPage} index="new-session-searchresult-page">
                        <NewSessionSearchresultPage />
                      </TabPanel>
                    </UserSearchChainBlockPageStatesProvider>
                    {availablePages['new-session-audiospace-page'] && (
                      <AudioSpaceChainBlockPageStatesProvider
                        audioSpace={currentTabInfo.audioSpace!}
                      >
                        <TabPanel value={tabPage} index="new-session-audiospace-page">
                          <NewSessionAudioSpacePage />
                        </TabPanel>
                      </AudioSpaceChainBlockPageStatesProvider>
                    )}
                    <LockPickerPageStatesProvider>
                      <TabPanel value={tabPage} index="new-session-lockpicker-page">
                        <NewSessionLockPickerPage />
                      </TabPanel>
                    </LockPickerPageStatesProvider>
                    <ImportChainBlockPageStatesProvider>
                      <TabPanel value={tabPage} index="new-session-blocklist-page">
                        <BlocklistPage />
                      </TabPanel>
                    </ImportChainBlockPageStatesProvider>
                    <TabPanel value={tabPage} index="misc-page">
                      <MiscPage />
                    </TabPanel>
                  </M.Container>,
                )}
              </main>
            </BlockLimiterContext.Provider>
          </RedBlockOptionsContext.Provider>
        </TabInfoContext.Provider>
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

export function initializeUI() {
  const popupOpenedInTab = /\bistab=1\b/.test(location.search)
  let initialPage: PageId
  const initialPageMatch = /\bpage=(\S+)\b/.exec(location.search)
  if (initialPageMatch && isValidPageId(initialPageMatch[1]!)) {
    initialPage = initialPageMatch[1]
  } else {
    initialPage = 'chainblock-sessions-page'
  }
  const appRoot = document.getElementById('app')!
  const app = (
    <PopupApp
      {...{
        popupOpenedInTab,
        initialPage,
      }}
    />
  )
  ReactDOM.render(app, appRoot)
  if (popupOpenedInTab) {
    document.body.classList.add('ui-tab')
  } else {
    document.body.classList.add('ui-popup')
  }
  fixOverlayScroll(appRoot)
}

initializeUI()

// https://davidwalsh.name/detect-scrollbar-width
// Whale 브라우저 등 Overlay 스크롤바 모드에선 스크롤이 안 되는 버그 고침
function fixOverlayScroll(appRoot: HTMLElement) {
  if (window.innerHeight > 0) {
    appRoot.parentElement!.style.height = `${window.innerHeight}px`
  }
  const div = document.createElement('div')
  Object.assign(div.style, {
    width: '100px',
    height: '100px',
    overflow: 'scroll',
    position: 'absolute',
    top: '-9999px',
  })
  document.body.appendChild(div)
  const result = div.offsetWidth - div.clientWidth
  document.body.removeChild(div)
  if (result !== 0) {
    return
  }
  appRoot.parentElement!.style.overflowY = 'auto'
}
