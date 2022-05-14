import * as MaterialUI from '@mui/material'
import React from 'react'

import {
  cleanupInactiveSessions,
  requestProgress,
  stopAllChainBlock,
} from '../../scripts/background/request-sender'
import * as i18n from '../../scripts/i18n'
import { UIContext } from '../popup-ui/contexts'

const M = MaterialUI

export default function SessionListControlbar() {
  const uiContext = React.useContext(UIContext)
  function confirmStopAllChainBlock() {
    uiContext.dispatchUIStates({
      type: 'open-modal',
      content: {
        dialogType: 'confirm',
        message: {
          title: i18n.getMessage('confirm_all_stop'),
        },
        callbackOnOk() {
          stopAllChainBlock()
          requestProgress()
        },
      },
    })
  }
  function cleanupAndRefresh() {
    cleanupInactiveSessions()
    requestProgress()
  }
  return (
    <div>
      <M.ButtonGroup fullWidth>
        <M.Button startIcon={<M.Icon>highlight_off</M.Icon>} onClick={confirmStopAllChainBlock}>
          {i18n.getMessage('stop_all')}
        </M.Button>
        <M.Button startIcon={<M.Icon>clear_all</M.Icon>} onClick={cleanupAndRefresh}>
          {i18n.getMessage('cleanup_sessions')}
        </M.Button>
      </M.ButtonGroup>
    </div>
  )
}
