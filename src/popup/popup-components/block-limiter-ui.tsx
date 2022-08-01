import * as MaterialUI from '@mui/material'
import * as i18n from '\\/scripts/i18n'
import React from 'react'

import { requestResetCounter } from '\\/scripts/background/request-sender'
import { BlockLimiterContext, TabInfoContext } from '../popup-ui/contexts'

import Accordion from './accordion'

const M = MaterialUI
const T = MaterialUI.Typography

export default function BlockLimiterUI() {
  const { current, max } = React.useContext(BlockLimiterContext)
  const { myself } = React.useContext(TabInfoContext)
  function handleResetButtonClick(event: React.MouseEvent<HTMLButtonElement>) {
    event.preventDefault()
    requestResetCounter(myself!.user.id_str)
  }
  const exceed = current >= max
  const warningIcon = exceed ? '\u26a0\ufe0f' : ''
  return (
    <Accordion
      summary={`${warningIcon} ${i18n.getMessage('block_counter')}: [${current} / ${max}]`}
      warning={exceed}
    >
      <M.Box display="flex" flexDirection="row">
        <M.Box flexGrow="1">
          <T component="div" variant="body2">
            {i18n.getMessage('wtf_twitter')}
          </T>
        </M.Box>
        <M.Button
          type="button"
          variant="outlined"
          onClick={handleResetButtonClick}
          disabled={current <= 0}
        >
          Reset
        </M.Button>
      </M.Box>
    </Accordion>
  )
}
