import * as TwitterAPI from '../scripts/background/twitter-api.js'
import { TwitterUser } from '../scripts/background/twitter-api.js'
import { getCurrentTab, getUserNameFromTab, requestProgress } from './popup.js'
import ChainBlockSessionsPage from './popup-ui/chainblock-sessions-page.js'
import NewChainBlockPage from './popup-ui/new-chainblock-page.js'
import { PageEnum, UI_UPDATE_DELAY } from '../scripts/common.js'

function PopupApp(props: { currentUser: TwitterUser | null }) {
  const { Tabs, TabList, Tab, TabPanel } = ReactTabs
  const { currentUser } = props
  const [tabIndex, setTabIndex] = React.useState<PageEnum>(PageEnum.Sessions)
  const [sessions, setSessions] = React.useState<SessionInfo[]>([])
  React.useEffect(() => {
    const messageListener = (msgobj: any) => {
      if (!(typeof msgobj === 'object' && 'messageType' in msgobj)) {
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
  return (
    <div>
      <React.StrictMode>
        <Tabs className="top-tabs" selectedIndex={tabIndex} onSelect={setTabIndex}>
          <TabList>
            <Tab>&#9939; 실행중인 세션({sessions.length})</Tab>
            <Tab>&#10133; 새 세션</Tab>
          </TabList>
          <TabPanel>
            <ChainBlockSessionsPage sessions={sessions} />
          </TabPanel>
          <TabPanel>
            <NewChainBlockPage currentUser={currentUser} />
          </TabPanel>
        </Tabs>
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
  showVersionOnFooter()
}

initializeUI()
