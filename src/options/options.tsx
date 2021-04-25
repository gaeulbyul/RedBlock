import * as Storage from '../scripts/background/storage.js'
import { TabPanel } from '../popup/popup-ui/components.js'
import { RedBlockOptionsContext } from './pages/contexts.js'
import ChainBlockOptionsPage from './pages/chainblock.js'
import OneClickBlockOptionsPage from './pages/oneclickblock.js'
import ExperimentalOptionsPage from './pages/experimentals.js'
import UserInterfaceOptionsPage from './pages/userinterface.js'

const M = MaterialUI

const optionsTabPages = ['chainblock', 'oneclickblock', 'userinterface', 'experimental'] as const
type OptionsTabPage = typeof optionsTabPages[number]

function RedBlockOptionsUITheme(darkMode: boolean) {
  return MaterialUI.createMuiTheme({
    typography: {
      fontSize: 14,
    },
    palette: {
      type: darkMode ? 'dark' : 'light',
      primary: MaterialUI.colors.pink,
      secondary: darkMode ? MaterialUI.colors.lightBlue : MaterialUI.colors.indigo,
    },
  })
}

function OptionsApp() {
  const darkMode = MaterialUI.useMediaQuery('(prefers-color-scheme:dark)')
  const theme = React.useMemo(() => RedBlockOptionsUITheme(darkMode), [darkMode])
  const [options, setOptions] = React.useState<RedBlockOptions>(Storage.defaultOptions)
  const [uiOptions, setUIOptions] = React.useState<RedBlockUIOptions>(Storage.defaultUIOptions)
  const [tabPage, setTabPage] = React.useState<OptionsTabPage>('chainblock')
  async function updateOptions(newOptionsPart: Partial<RedBlockOptions>) {
    const newOptions: RedBlockOptions = { ...options, ...newOptionsPart }
    await Storage.saveOptions(newOptions)
    setOptions(newOptions)
  }
  async function updateUIOptions(newOptionsPart: Partial<RedBlockUIOptions>) {
    const newOptions: RedBlockUIOptions = { ...uiOptions, ...newOptionsPart }
    await Storage.saveUIOptions(newOptions)
    setUIOptions(newOptions)
  }
  React.useEffect(() => {
    Storage.loadOptions().then(setOptions)
    return Storage.onStorageChanged('options', setOptions)
  }, [])
  React.useEffect(() => {
    Storage.loadUIOptions().then(setUIOptions)
    return Storage.onStorageChanged('uiOptions', setUIOptions)
  }, [])
  return (
    <M.ThemeProvider theme={theme}>
      <RedBlockOptionsContext.Provider
        value={{ options, updateOptions, uiOptions, updateUIOptions }}
      >
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
          <TabPanel value={tabPage} index="userinterface">
            <UserInterfaceOptionsPage />
          </TabPanel>
          <TabPanel value={tabPage} index="experimental">
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
