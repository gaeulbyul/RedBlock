import * as Storage from '../scripts/background/storage.js'
import { RedBlockUITheme, TabPanel } from '../popup/popup-ui/components.js'
import { RedBlockOptionsContext } from './pages/contexts.js'
import ChainBlockOptionsPage from './pages/chainblock.js'
import OneClickBlockOptionsPage from './pages/oneclickblock.js'
import ExperimentalOptionsPage from './pages/experimentals.js'

const M = MaterialUI

const optionsTabPages = ['chainblock', 'oneclickblock', 'experimentals'] as const
type OptionsTabPage = typeof optionsTabPages[number]

function OptionsApp() {
  const darkMode = MaterialUI.useMediaQuery('(prefers-color-scheme:dark)')
  const theme = React.useMemo(() => RedBlockUITheme(darkMode), [darkMode])
  const [options, setOptions] = React.useState<RedBlockOptions>(Storage.defaultOptions)
  const [tabPage, setTabPage] = React.useState<OptionsTabPage>('chainblock')
  async function updateOptions(newOptionsPart: Partial<RedBlockOptions>) {
    const newOptions: RedBlockOptions = { ...options, ...newOptionsPart }
    await Storage.saveOptions(newOptions)
    setOptions(newOptions)
  }
  React.useEffect(() => {
    Storage.loadOptions().then(setOptions)
    return Storage.onStorageChanged('options', setOptions)
  }, [])
  return (
    <M.ThemeProvider theme={theme}>
      <RedBlockOptionsContext.Provider value={{ options, updateOptions }}>
        <M.AppBar position="static">
          <M.Tabs value={tabPage} onChange={(_ev, val) => setTabPage(val)}>
            {optionsTabPages.map((value, index) => (
              <M.Tab key={index} value={value} label={value} />
            ))}
          </M.Tabs>
        </M.AppBar>
        <M.Container maxWidth="md">
          <TabPanel value={tabPage} index="chainblock">
            <ChainBlockOptionsPage />
          </TabPanel>
          <TabPanel value={tabPage} index="oneclickblock">
            <OneClickBlockOptionsPage />
          </TabPanel>
          <TabPanel value={tabPage} index="experimentals">
            <ExperimentalOptionsPage />
          </TabPanel>
        </M.Container>
      </RedBlockOptionsContext.Provider>
    </M.ThemeProvider>
  )
}

document.addEventListener('DOMContentLoaded', () => {
  ReactDOM.render(<OptionsApp />, document.getElementById('app')!)
})
