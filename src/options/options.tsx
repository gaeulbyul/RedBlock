import React from 'react'
import ReactDOM from 'react-dom'
import * as MaterialUI from '@material-ui/core'
import throttle from 'lodash-es/throttle'

import * as Storage from '../scripts/background/storage'
import { validateStorage } from '../scripts/background/storage/validator'
import { TabPanel } from '../popup/popup-ui/components'
import { RedBlockOptionsContext } from './pages/contexts'
import ChainBlockOptionsPage from './pages/chainblock'
import OneClickBlockOptionsPage from './pages/oneclickblock'
import ExperimentalOptionsPage from './pages/experimentals'
import UserInterfaceOptionsPage from './pages/userinterface'
import TroubleShootingsPage from './pages/troubleshooting'
import * as i18n from '~~/scripts/i18n'

const M = MaterialUI

const optionsTabPages = [
  'chainblock',
  'oneclickblock',
  'userinterface',
  'troubleshooting',
  'experimental',
] as const
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

function OptionsBackupUI() {
  const [fileInput] = React.useState(React.createRef<HTMLInputElement>())
  async function exportOptions() {
    const storage = await browser.storage.local.get()
    const manifest = browser.runtime.getManifest()
    const filename = `${manifest.name}-Settings-v${manifest.version}.json`
    const json = JSON.stringify(storage, null, '\t')
    const jsonFile = new File([json], filename, { type: 'application/json' })
    const objectUrl = URL.createObjectURL(jsonFile)
    await browser.downloads
      .download({
        url: objectUrl,
        filename,
      })
      .finally(() => {
        URL.revokeObjectURL(objectUrl)
      })
  }
  async function importOptions(event: React.FormEvent<HTMLInputElement>) {
    event.preventDefault()
    try {
      const files = fileInput.current!.files
      if (!(files && files.length > 0)) {
        window.alert(i18n.getMessage('pick_file_first'))
        return
      }
      const file = files[0]
      const text = await file.text()
      const json = JSON.parse(text)
      const rbStorage = validateStorage(json)
      // @ts-ignore
      await browser.storage.local.set(rbStorage)
    } catch (err: unknown) {
      let errorMessage = ''
      if (err instanceof Error) {
        errorMessage = `${err.name}: ${err.message}`
      }
      window.alert('Error detected in file!\n' + errorMessage)
    }
  }
  return (
    <M.Box mx={1} my={2}>
      <M.Paper>
        <M.Box p={2}>
          <form>
            <input
              ref={fileInput}
              id="input-file-to-import"
              name="input-file-to-import"
              type="file"
              onChange={importOptions}
              style={{ display: 'none' }}
              accept="application/json,.json"
            />
            <label htmlFor="input-file-to-import">
              <M.Button variant="contained" component="span">
                {i18n.getMessage('select_files')}
              </M.Button>
            </label>
            <M.Button variant="contained" onClick={exportOptions}>
              BACKUP
            </M.Button>
          </form>
        </M.Box>
      </M.Paper>
    </M.Box>
  )
}

function OptionsApp() {
  const darkMode = MaterialUI.useMediaQuery('(prefers-color-scheme:dark)')
  const theme = React.useMemo(() => RedBlockOptionsUITheme(darkMode), [darkMode])
  const [options, setOptions] = React.useState<RedBlockOptions>(Storage.defaultOptions)
  const [uiOptions, setUIOptions] = React.useState<RedBlockUIOptions>(Storage.defaultUIOptions)
  const [tabPage, setTabPage] = React.useState<OptionsTabPage>('chainblock')
  const throttledSaveOptions = throttle(
    (newOptions: RedBlockOptions) => Storage.saveOptions(newOptions),
    50
  )
  async function updateOptions(newOptionsPart: Partial<RedBlockOptions>) {
    const newOptions: RedBlockOptions = { ...options, ...newOptionsPart }
    throttledSaveOptions(newOptions)
  }
  async function updateUIOptions(newOptionsPart: Partial<RedBlockUIOptions>) {
    const newOptions: RedBlockUIOptions = { ...uiOptions, ...newOptionsPart }
    await Storage.saveUIOptions(newOptions)
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
          <M.Tabs
            variant="scrollable"
            scrollButtons="auto"
            value={tabPage}
            onChange={(_ev, val) => setTabPage(val)}
          >
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
          <TabPanel value={tabPage} index="troubleshooting">
            <TroubleShootingsPage />
          </TabPanel>
          <TabPanel value={tabPage} index="experimental">
            <ExperimentalOptionsPage />
          </TabPanel>
          <M.Divider />

          <OptionsBackupUI />
        </M.Container>
      </RedBlockOptionsContext.Provider>
    </M.ThemeProvider>
  )
}

document.addEventListener('DOMContentLoaded', () => {
  ReactDOM.render(<OptionsApp />, document.getElementById('app')!)
})
