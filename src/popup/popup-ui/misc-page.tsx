import * as MaterialUI from '@mui/material'
import React from 'react'
import browser from 'webextension-polyfill'

import {
  deleteTwitterCookies,
  getCurrentTab,
  toggleOneClickBlockMode,
} from '\\/scripts/common/utilities'
import * as i18n from '\\/scripts/i18n'
import { TabInfoContext, UIContext } from './contexts'

import Accordion from '../popup-components/accordion'

const M = MaterialUI

function openOptions() {
  browser.runtime.openOptionsPage()
  window.close()
}

export default function MiscPage() {
  const { dispatchUIStates } = React.useContext(UIContext)
  const { myself } = React.useContext(TabInfoContext)
  function onClickOneClickBlockModeButtons(enable: boolean) {
    getCurrentTab().then(tab => {
      toggleOneClickBlockMode(tab, enable)
    })
    const modeState = enable ? 'ON' : 'OFF'
    dispatchUIStates({
      type: 'open-snack-bar',
      message: `${i18n.getMessage('oneclick_block_mode')}: ${modeState}!`,
    })
  }
  function confirmCookieDeletion() {
    dispatchUIStates({
      type: 'open-modal',
      content: {
        dialogType: 'confirm',
        message: {
          title: i18n.getMessage('delete_cookie'),
          contentLines: [i18n.getMessage('confirm_delete_cookie')],
        },
        callbackOnOk() {
          getCurrentTab()
            .then(deleteTwitterCookies)
            .then(() => {
              dispatchUIStates({
                type: 'open-snack-bar',
                message: i18n.getMessage('cookie_delete_complete'),
              })
            })
        },
      },
    })
  }
  const disabledOneClickBlockRelatedButtons = !myself
  return (
    <div>
      <Accordion summary={i18n.getMessage('oneclick_block_mode')} defaultExpanded>
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
      </Accordion>
      <Accordion summary={i18n.getMessage('troubleshooting')} defaultExpanded>
        <div style={{ width: '100%' }}>
          <M.FormControl component="fieldset">
            <M.Button variant="outlined" onClick={confirmCookieDeletion}>
              <span>{i18n.getMessage('delete_cookie')}</span>
            </M.Button>
          </M.FormControl>
          <p>{i18n.getMessage('delete_cookie_description')}</p>
        </div>
      </Accordion>
      <Accordion summary={i18n.getMessage('open_settings_ui')} defaultExpanded>
        <M.Button variant="outlined" startIcon={<M.Icon>settings</M.Icon>} onClick={openOptions}>
          <span>{i18n.getMessage('open_settings_ui')}</span>
        </M.Button>
      </Accordion>
    </div>
  )
}
