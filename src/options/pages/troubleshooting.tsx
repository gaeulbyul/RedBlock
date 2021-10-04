import React from 'react'
import * as MaterialUI from '@material-ui/core'
import * as i18n from '../../scripts/i18n'

import { RedBlockOptionsContext } from './contexts'
import { SwitchItem } from '../../ui/components'
import {
  getCurrentTab,
  deleteTwitterCookies,
  nukeRedBlockSettings,
} from '../../scripts/background/misc'
import { dumpStorage } from '../../scripts/background/storage'
import { validateStorage } from '../../scripts/background/storage/validator'

function checkFirstPartyIsolationSupport() {
  try {
    // 크로미움계열에선 쿠키관련 API 사용시 firstPartyDomain을 사용할 수 없으며, TypeError가 발생한다.
    // 이를 통해 first party isolation 지원여부를 확인한다.
    // @ts-ignore
    chrome.cookies.getAll({ firstPartyDomain: undefined })
    return true
  } catch {
    return false
  }
}

const M = MaterialUI
const T = MaterialUI.Typography

function OptionsBackupUI() {
  const [fileInput] = React.useState(React.createRef<HTMLInputElement>())
  async function exportOptions() {
    const storage = await dumpStorage()
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
      const file = files[0]!
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
    <M.Paper>
      <M.Box p={2}>
        <M.FormControl component="fieldset" fullWidth>
          <M.FormLabel component="legend">백업 및 복원 / Backup &amp; Restore</M.FormLabel>
          <input
            ref={fileInput}
            id="input-file-to-import"
            name="input-file-to-import"
            type="file"
            onChange={importOptions}
            style={{ display: 'none' }}
            accept="application/json,.json"
          />
          <M.Divider />
          <M.Box my={1} display="flex">
            <M.Button
              variant="contained"
              onClick={exportOptions}
              startIcon={<M.Icon>backup</M.Icon>}
            >
              {i18n.getMessage('redblock_backup_settings')}
            </M.Button>
            <M.Divider orientation="vertical" flexItem />
            <label htmlFor="input-file-to-import">
              <M.Button variant="contained" component="span" startIcon={<M.Icon>restore</M.Icon>}>
                {i18n.getMessage('redblock_restore_settings')}
              </M.Button>
            </label>
          </M.Box>
        </M.FormControl>
      </M.Box>
    </M.Paper>
  )
}

export default function TroubleShootingsPage() {
  const { options, updateOptions } = React.useContext(RedBlockOptionsContext)
  const firstPartyIsolatableBrowser = checkFirstPartyIsolationSupport()
  const [resetInProgress, setResetInProgress] = React.useState(false)
  const [resetCompleted, setResetCompleted] = React.useState(false)
  function confirmCookieDeletion() {
    const ok = window.confirm(i18n.getMessage('confirm_delete_cookie'))
    if (!ok) {
      return
    }
    getCurrentTab()
      .then(deleteTwitterCookies)
      .then(() => {
        console.debug('cookie removed')
      })
  }
  function confirmFactoryReset() {
    const ok = window.confirm(i18n.getMessage('redblock_factory_reset_confirm'))
    if (!ok) {
      return
    }
    setResetCompleted(false)
    setResetInProgress(true)
    nukeRedBlockSettings().then(() => {
      setResetCompleted(true)
      setResetInProgress(false)
    })
  }
  return (
    <React.Fragment>
      <M.Paper>
        <M.Box padding="10px" margin="10px">
          <M.FormControl component="fieldset" fullWidth>
            <M.FormLabel component="legend">문제해결 / Troubleshooting</M.FormLabel>
            <M.Divider />
            <M.FormGroup>
              <SwitchItem
                checked={options.firstPartyIsolationCompatibleMode}
                disabled={!firstPartyIsolatableBrowser}
                label={i18n.getMessage('1st_party_isolation_compatible_mode')}
                onChange={checked =>
                  updateOptions({
                    firstPartyIsolationCompatibleMode: checked,
                  })
                }
              />
            </M.FormGroup>
            <M.FormHelperText>
              {i18n.getMessage('1st_party_isolation_compatible_mode_description')}
            </M.FormHelperText>
            <M.Divider />
            <M.FormGroup>
              <M.FormControl component="fieldset">
                <M.FormLabel>
                  <T>{i18n.getMessage('delete_cookie')}</T>
                </M.FormLabel>
                <div>
                  <M.Button
                    variant="contained"
                    onClick={confirmCookieDeletion}
                    startIcon={<M.Icon>delete_outline</M.Icon>}
                  >
                    <span>{i18n.getMessage('delete_cookie')}</span>
                  </M.Button>
                </div>
              </M.FormControl>
              <M.FormHelperText>{i18n.getMessage('delete_cookie_description')}</M.FormHelperText>
            </M.FormGroup>
            <M.Divider />
            <M.FormGroup>
              <M.FormControl component="fieldset">
                <M.FormLabel>
                  <T color="error">{i18n.getMessage('redblock_factory_reset')}</T>
                </M.FormLabel>
                <M.Box display="flex" flexDirection="row" alignItems="center">
                  <M.Button
                    variant="contained"
                    onClick={confirmFactoryReset}
                    color="primary"
                    startIcon={<M.Icon>error_outline</M.Icon>}
                    disabled={resetInProgress || resetCompleted}
                  >
                    <span>{resetCompleted ? 'Reseted!!' : 'RESET'}</span>
                  </M.Button>
                  {resetInProgress && (
                    <M.Box mx={1}>
                      <M.CircularProgress size={24} color="secondary" />
                    </M.Box>
                  )}
                </M.Box>
              </M.FormControl>
              <M.FormHelperText error={true}>
                {i18n.getMessage('redblock_factory_reset_description')}
              </M.FormHelperText>
            </M.FormGroup>
          </M.FormControl>
        </M.Box>
      </M.Paper>
      <OptionsBackupUI />
    </React.Fragment>
  )
}
