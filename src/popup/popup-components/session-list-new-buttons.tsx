import * as MaterialUI from '@mui/material'
import React from 'react'

import { UIContext } from '../popup-ui/contexts'
import { AvailablePages, newSessionsLabel, pageIcon, PageId } from '../popup-ui/pages'

const M = MaterialUI

const newSessionPagesToShow: (keyof AvailablePages)[] = [
  'new-session-followers-page',
  'new-session-tweet-page',
  'new-session-searchresult-page',
  'new-session-audiospace-page',
]

export default function NewSessionButtons() {
  const uiContext = React.useContext(UIContext)
  function handleNewSessionButton(event: React.MouseEvent, page: PageId) {
    event.preventDefault()
    uiContext.dispatchUIStates({ type: 'switch-tab-page', tabPage: page })
  }
  return (
    <M.Box display="flex" flexDirection="row" justifyContent="center" flexWrap="wrap" my={1}>
      {newSessionPagesToShow.map((page, index) => (
        <M.Box key={index} width="50%" minWidth="100px" maxWidth="200px" m={1}>
          <M.Button
            fullWidth
            variant="contained"
            startIcon={pageIcon(page)}
            disabled={!uiContext.availablePages[page]}
            onClick={e =>
              handleNewSessionButton(e, page)}
          >
            {newSessionsLabel(page)}
          </M.Button>
        </M.Box>
      ))}
    </M.Box>
  )
}
