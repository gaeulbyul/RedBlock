import * as TwitterAPI from '../scripts/background/twitter-api.js'
import { TwitterUser } from '../scripts/background/twitter-api.js'
import { getCurrentTab, getUserNameFromTab, requestProgress } from './popup.js'
import ChainBlockSessionsPage from './popup-ui/chainblock-sessions-page.js'
import NewChainBlockPage from './popup-ui/new-chainblock-page.js'
import { PageEnum, UI_UPDATE_DELAY, isRunningStatus } from '../scripts/common.js'
import { ModalContext, ModalContent } from './popup-ui/modal-context.js'

const modalStyle = Object.assign({}, ReactModal.defaultStyles)
modalStyle.overlay!.backgroundColor = 'rgba(33, 33, 33, .50)'

function RBModal(props: { isOpen: boolean; content: ModalContent | null; closeModal: () => void }) {
  const { isOpen, content, closeModal } = props
  if (!content) {
    return <div></div>
  }
  const { message, callback, modalType } = content
  function confirmOk() {
    callback!()
    closeModal()
  }
  function renderControls() {
    switch (modalType) {
      case 'confirm':
        return (
          <React.Fragment>
            <button onClick={confirmOk}>네</button>
            <button onClick={closeModal}>아니오</button>
          </React.Fragment>
        )
      case 'alert':
        return (
          <React.Fragment>
            <button onClick={closeModal}>닫기</button>
          </React.Fragment>
        )
    }
  }
  return (
    <ReactModal isOpen={isOpen} style={modalStyle}>
      <div className="modal-content">
        <div className="confirm-message">{message}</div>
        <div className="controls modal-controls">{renderControls()}</div>
      </div>
    </ReactModal>
  )
}

function PopupApp(props: { currentUser: TwitterUser | null }) {
  const { Tabs, TabList, Tab, TabPanel } = ReactTabs
  const { currentUser } = props
  const [tabIndex, setTabIndex] = React.useState<PageEnum>(PageEnum.Sessions)
  const [sessions, setSessions] = React.useState<SessionInfo[]>([])
  const [modalOpened, setModalOpened] = React.useState(false)
  const [modalContent, setModalContent] = React.useState<ModalContent | null>(null)
  function openModal(content: ModalContent) {
    console.debug(content)
    setModalOpened(true)
    setModalContent(content)
  }
  function closeModal() {
    setModalOpened(false)
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
  return (
    <div>
      <React.StrictMode>
        <ModalContext.Provider value={{ openModal }}>
          <Tabs className="top-tabs" selectedIndex={tabIndex} onSelect={setTabIndex}>
            <TabList>
              <Tab>&#9939; 실행중인 세션({runningSessions.length})</Tab>
              <Tab>&#10133; 새 세션</Tab>
            </TabList>
            <TabPanel>
              <ChainBlockSessionsPage sessions={sessions} />
            </TabPanel>
            <TabPanel>
              <NewChainBlockPage currentUser={currentUser} />
            </TabPanel>
          </Tabs>
        </ModalContext.Provider>
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
