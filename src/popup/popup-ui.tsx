import * as TwitterAPI from '../scripts/background/twitter-api.js'
import { getCurrentTab, getUserNameFromTab, requestProgress } from './popup.js'
import ChainBlockSessionsPage from './popup-ui/chainblock-sessions-page.js'
import NewChainBlockPage from './popup-ui/new-chainblock-page.js'
import { PageEnum, UI_UPDATE_DELAY, isRunningStatus } from '../scripts/common.js'
import * as i18n from '../scripts/i18n.js'
import { DialogContext, SnackBarContext, PageSwitchContext } from './popup-ui/contexts.js'
import { RBDialog, TabPanel, DialogContent } from './popup-ui/ui-common.js'

type TwitterUser = TwitterAPI.TwitterUser

const popupMuiTheme = MaterialUI.createMuiTheme({
  palette: {
    primary: MaterialUI.colors.pink,
    secondary: MaterialUI.colors.indigo,
  },
})

const useStylesForAppBar = MaterialUI.makeStyles(() =>
  MaterialUI.createStyles({
    toolbar: {
      padding: 0,
    },
  })
)

function PopupApp(props: { currentUser: TwitterUser | null; popupAsTab: boolean }) {
  const { currentUser, popupAsTab } = props
  const [tabIndex, setTabIndex] = React.useState<PageEnum>(PageEnum.Sessions)
  const [sessions, setSessions] = React.useState<SessionInfo[]>([])
  const [modalOpened, setModalOpened] = React.useState(false)
  const [modalContent, setModalContent] = React.useState<DialogContent | null>(null)
  const [snackBarMessage, setSnackBarMessage] = React.useState('')
  const [snackBarOpen, setSnackBarOpen] = React.useState(false)
  const [menuAnchorEl, setMenuAnchorEl] = React.useState<HTMLElement | null>(null)
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
  React.useEffect(() => {
    const messageListener = (msgobj: any) => {
      if (typeof msgobj !== 'object') {
        return
      }
      if ('messageType' in msgobj) {
        const msg = msgobj as RBMessage
        switch (msg.messageType) {
          case 'ChainBlockInfo':
            setSessions(msg.infos)
            break
          case 'PopupSwitchTab':
            setTabIndex(msg.page)
            break
          default:
            console.debug('unknown message', msgobj)
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
  const runningSessions = React.useMemo(() => sessions.filter(session => isRunningStatus(session.status)), [sessions])
  const M = MaterialUI
  return (
    <M.ThemeProvider theme={popupMuiTheme}>
      <SnackBarContext.Provider value={{ snack }}>
        <DialogContext.Provider value={{ openModal }}>
          <PageSwitchContext.Provider value={{ switchPage }}>
            <M.AppBar position="fixed">
              <M.Toolbar variant="dense" className={classes.toolbar}>
                <M.IconButton color="inherit" onClick={handleMenuButtonClick}>
                  <M.Icon>menu</M.Icon>
                </M.IconButton>
                <M.Tabs value={tabIndex} onChange={(_ev, val) => setTabIndex(val)}>
                  <M.Tab label={`${i18n.getMessage('running_sessions')} (${runningSessions.length})`} />
                  <M.Tab label={i18n.getMessage('new_session')} />
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
                  <ChainBlockSessionsPage sessions={sessions} />
                </TabPanel>
                <TabPanel value={tabIndex} index={PageEnum.NewSession}>
                  <NewChainBlockPage currentUser={currentUser} />
                </TabPanel>
              </M.Container>
            </div>
          </PageSwitchContext.Provider>
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

export async function initializeUI() {
  const tab = await getCurrentTab()
  const isPopupOpenedAsTab = /\bistab=1\b/.test(location.search)
  const userName = tab ? getUserNameFromTab(tab) : null
  const appRoot = document.getElementById('app')!
  const targetUser = await (userName ? TwitterAPI.getSingleUserByName(userName) : null)
  const app = <PopupApp currentUser={targetUser} popupAsTab={isPopupOpenedAsTab} />
  ReactDOM.render(app, appRoot)
  showVersionOnFooter()
}

initializeUI()
