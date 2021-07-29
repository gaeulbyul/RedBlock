import React from 'react'
import * as MaterialUI from '@material-ui/core'

import {
  toggleOneClickBlockMode,
  getCurrentTab,
  deleteTwitterCookies,
} from '../../scripts/background/misc'
import { UIContext, MyselfContext } from './contexts'
import { RBAccordion } from './components'

import * as i18n from '~~/scripts/i18n'

const M = MaterialUI

function openOptions() {
  browser.runtime.openOptionsPage()
  window.close()
}

export default function MiscPage() {
  const uiContext = React.useContext(UIContext)
  const myself = React.useContext(MyselfContext)
  function onClickOneClickBlockModeButtons(enable: boolean) {
    getCurrentTab().then(tab => {
      toggleOneClickBlockMode(tab, enable)
    })
    const modeState = enable ? 'ON' : 'OFF'
    uiContext.openSnackBar(`${i18n.getMessage('oneclick_block_mode')}: ${modeState}!`)
  }
  function confirmCookieDeletion() {
    uiContext.openDialog({
      dialogType: 'confirm',
      message: {
        title: i18n.getMessage('delete_cookie'),
        contentLines: [i18n.getMessage('confirm_delete_cookie')],
      },
      callbackOnOk() {
        getCurrentTab()
          .then(deleteTwitterCookies)
          .then(() => {
            uiContext.openSnackBar(i18n.getMessage('cookie_delete_complete'))
          })
      },
    })
  }
  const disabledOneClickBlockRelatedButtons = !myself
  return (
    <div>
      <RBAccordion summary={i18n.getMessage('oneclick_block_mode')} defaultExpanded>
        <div style={{ width: '100%' }}>
          <M.FormControl component="fieldset">
            <M.ButtonGroup
              variant="contained"
              color="primary"
              disabled={disabledOneClickBlockRelatedButtons}
            >
              <M.Button onClick={() => onClickOneClickBlockModeButtons(true)}>
                <span>ON</span>
              </M.Button>
              <M.Button onClick={() => onClickOneClickBlockModeButtons(false)}>
                <span>OFF</span>
              </M.Button>
            </M.ButtonGroup>
          </M.FormControl>
          <p>{i18n.getMessage('oneclick_block_mode_description')}</p>
        </div>
      </RBAccordion>
      <RBAccordion summary={i18n.getMessage('troubleshooting')} defaultExpanded>
        <div style={{ width: '100%' }}>
          <M.FormControl component="fieldset">
            <M.Button variant="outlined" onClick={confirmCookieDeletion}>
              <span>{i18n.getMessage('delete_cookie')}</span>
            </M.Button>
          </M.FormControl>
          <p>{i18n.getMessage('delete_cookie_description')}</p>
        </div>
      </RBAccordion>
      <RBAccordion summary={i18n.getMessage('open_settings_ui')} defaultExpanded>
        <M.Button variant="outlined" startIcon={<M.Icon>settings</M.Icon>} onClick={openOptions}>
          <span>{i18n.getMessage('open_settings_ui')}</span>
        </M.Button>
      </RBAccordion>
    </div>
  )
}
