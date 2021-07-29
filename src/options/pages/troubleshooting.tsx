import React from 'react'
import * as MaterialUI from '@material-ui/core'
import * as i18n from '~~/scripts/i18n'

import { RedBlockOptionsContext } from './contexts'
import { SwitchItem } from '../components'
import { getCurrentTab, deleteTwitterCookies } from '../../scripts/background/misc'

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

export default function TroubleShootingsPage() {
  const { options, updateOptions } = React.useContext(RedBlockOptionsContext)
  const firstPartyIsolatableBrowser = checkFirstPartyIsolationSupport()
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
  return (
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
                <M.Button variant="outlined" onClick={confirmCookieDeletion}>
                  <span>{i18n.getMessage('delete_cookie')}</span>
                </M.Button>
              </div>
            </M.FormControl>
            <M.FormHelperText>{i18n.getMessage('delete_cookie_description')}</M.FormHelperText>
          </M.FormGroup>
        </M.FormControl>
      </M.Box>
    </M.Paper>
  )
}
