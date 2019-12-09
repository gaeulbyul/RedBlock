namespace RedBlock.Popup.UI {
  const { TwitterAPI } = RedBlock.Background
  const {
    ChainBlockSessions: { ChainBlockSessionsPage },
    NewChainBlock: { NewChainBlockPage },
  } = RedBlock.Popup.UI.Pages

  function PopupApp(props: { currentUser: TwitterUser | null }) {
    const { Tabs, TabList, Tab, TabPanel } = ReactTabs
    const { currentUser } = props
    return (
      <div>
        <React.StrictMode>
          <Tabs>
            <TabList>
              <Tab>&#9939; 실행중</Tab>
              <Tab>&#10133; 새 세션</Tab>
            </TabList>
            <TabPanel>
              <ChainBlockSessionsPage />
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
}

RedBlock.Popup.UI.initializeUI()
