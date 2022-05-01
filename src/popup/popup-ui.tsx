import * as MaterialUI from '@mui/material'

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
import { checkMessage, getCurrentTabInfo, infoless, TabInfo as TabInfo } from './popup'
import ChainBlockSessionsPage from './popup-ui/chainblock-sessions-page'
import { RedBlockPopupUITheme, TabPanel } from './popup-ui/components'
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
import { AvailablePages, isValidPageId, PageId } from './popup-ui/pages'
import {
  AudioSpaceChainBlockPageStatesProvider,
  FollowerChainBlockPageStatesProvider,
  ImportChainBlockPageStatesProvider,
  LockPickerPageStatesProvider,
  TweetReactionChainBlockPageStatesProvider,
  uiStateReducer,
  UIStates,
  UserSearchChainBlockPageStatesProvider,
} from './popup-ui/ui-states'

import MainWrapper from './popup-components/main-wrapper'
import ModalDialog from './popup-components/modal-dialog'
import PopupUITopBar from './popup-components/top-bar'
import PopupUITopMenu from './popup-components/top-menu'

const M = MaterialUI

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
  const initialUIStates: UIStates = {
    tabPage: initialPage,
    modalOpened: false,
    modalContent: null,
    snackBarMessage: '',
    snackBarOpened: false,
    initialLoading: true,
    countOfRunningSessions: 0,
    menuAnchorElem: null,
  }
  const [uiStates, dispatchUIStates] = React.useReducer(uiStateReducer, initialUIStates)
  const { tabPage } = uiStates
  const [limiterStatus, setLimiterStatus] = React.useState<BlockLimiterStatus>({
    current: 0,
    max: 500,
  })
  const darkMode = MaterialUI.useMediaQuery('(prefers-color-scheme:dark)')
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
      dispatchUIStates({ type: 'finish-initial-loading' })
    })
  }, [])
  function handleSnackBarClose(_event: any, reason?: string) {
    if (reason === 'clickaway') {
      return
    }
    dispatchUIStates({ type: 'close-snack-bar' })
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
      requestProgress().catch(() => {})
      requestBlockLimiterStatus().catch(() => {})
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
          dispatchUIStates({ type: 'finish-initial-loading' })
          const runningSessionsLength = msg.sessions.filter(isRunningSession).length
          dispatchUIStates({ type: 'set-count-of-running-sessions', count: runningSessionsLength })
          if (tabPage === 'chainblock-sessions-page') {
            setSessions(msg.sessions)
            setRecurringInfos(msg.recurringAlarmInfos)
          }
          break
        case 'BlockLimiterInfo':
          if (myself) {
            const newStatus = msg.statuses[myself.user.id_str]!
            const oldValue = limiterStatus.current
            const newValue = newStatus.current
            if (oldValue !== newValue) {
              setLimiterStatus(newStatus)
            }
          }
          break
        case 'PopupSwitchTab':
          dispatchUIStates({ type: 'switch-tab-page', tabPage: msg.page })
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
  return (
    <M.ThemeProvider theme={theme}>
      <UIContext.Provider
        value={{
          uiStates,
          dispatchUIStates,
          shrinkedPopup,
          popupOpenedInTab,
          availablePages,
        }}
      >
        <TabInfoContext.Provider value={currentTabInfo}>
          <RedBlockOptionsContext.Provider value={redblockOptions}>
            <BlockLimiterContext.Provider value={limiterStatus}>
              <PopupUITopBar />
              <PopupUITopMenu />
              <MainWrapper isLoading={uiStates.initialLoading}>
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
                </M.Container>
              </MainWrapper>
            </BlockLimiterContext.Provider>
          </RedBlockOptionsContext.Provider>
        </TabInfoContext.Provider>
      </UIContext.Provider>
      <M.Snackbar
        anchorOrigin={{
          horizontal: 'center',
          vertical: 'bottom',
        }}
        open={uiStates.snackBarOpened}
        onClose={handleSnackBarClose}
        autoHideDuration={5000}
        message={uiStates.snackBarMessage}
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
      <ModalDialog
        isOpen={uiStates.modalOpened}
        closeModal={() => dispatchUIStates({ type: 'close-modal' })}
        content={uiStates.modalContent}
      />
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
  setInterval(() => {
    requestProgress().catch(() => {})
    // TODO
    requestBlockLimiterStatus().catch(() => {})
  }, 800)
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
