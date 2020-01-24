import * as TwitterAPI from '../scripts/background/twitter-api.js'
import { TwitterUser } from '../scripts/background/twitter-api.js'
import { getCurrentTab, getUserNameFromTab, requestProgress } from './popup.js'
import ChainBlockSessionsPage from './popup-ui/chainblock-sessions-page.js'
import NewChainBlockPage from './popup-ui/new-chainblock-page.js'
import { PageEnum, UI_UPDATE_DELAY, isRunningStatus } from '../scripts/common.js'
import { ModalContext, ModalContent, SnackBarContext } from './popup-ui/contexts.js'
import { RBModal, TabPanel } from './popup-ui/ui-common.js'

function PopupApp(props: { currentUser: TwitterUser | null }) {
  const { currentUser } = props
  const [tabIndex, setTabIndex] = React.useState<PageEnum>(PageEnum.Sessions)
  const [sessions, setSessions] = React.useState<SessionInfo[]>([])
  const [modalOpened, setModalOpened] = React.useState(false)
  const [modalContent, setModalContent] = React.useState<ModalContent | null>(null)
  const [snackBarMessage, setSnackBarMessage] = React.useState('')
  const [snackBarOpen, setSnackBarOpen] = React.useState(false)
  function openModal(content: ModalContent) {
    console.debug(content)
    setModalOpened(true)
    setModalContent(content)
  }
  function closeModal() {
    setModalOpened(false)
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
  React.useEffect(() => {
    const messageListener = (msgobj: any) => {
      if (!(typeof msgobj === 'object' && 'messageType' in msgobj)) {
        console.debug('unknown msg?', msgobj)
        return
      }
      const msg = msgobj as RBMessage
      switch (msg.messageType) {
        case 'ChainBlockInfo':
          setSessions(msg.infos)
          break
        case 'PopupSwitchTab':
          setTabIndex(msg.page)
          break
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
    <div>
      <React.StrictMode>
        <SnackBarContext.Provider value={{ snack }}>
          <ModalContext.Provider value={{ openModal }}>
            <M.AppBar position="fixed">
              <M.Tabs value={tabIndex} onChange={(_ev, val) => setTabIndex(val)}>
                <M.Tab label={`실행중인 세션 (${runningSessions.length})`} />
                <M.Tab label={'새 세션'} />
              </M.Tabs>
            </M.AppBar>
            <div className="page">
              <TabPanel value={tabIndex} index={PageEnum.Sessions}>
                <ChainBlockSessionsPage sessions={sessions} />
              </TabPanel>
              <TabPanel value={tabIndex} index={PageEnum.NewSession}>
                <NewChainBlockPage currentUser={currentUser} />
              </TabPanel>
            </div>
          </ModalContext.Provider>
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
        <RBModal isOpen={modalOpened} closeModal={closeModal} content={modalContent} />
      </React.StrictMode>
    </div>
  )
}

function showVersionOnFooter() {
  const manifest = browser.runtime.getManifest()
  document.querySelector('footer.info')!.textContent = `${manifest.name} v${manifest.version}`
}

export async function initializeUI() {
  const tab = await getCurrentTab()
  const userName = tab ? getUserNameFromTab(tab) : null
  const appRoot = document.getElementById('app')!
  const targetUser = await (userName ? TwitterAPI.getSingleUserByName(userName) : null)
  const app = <PopupApp currentUser={targetUser} />
  ReactDOM.render(app, appRoot)
  ReactModal.setAppElement(appRoot)
  showVersionOnFooter()
}

initializeUI()
