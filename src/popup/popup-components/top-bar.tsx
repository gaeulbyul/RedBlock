import * as MaterialUI from '@mui/material'
import React from 'react'

import { TabInfoContext, UIContext } from '../popup-ui/contexts'
import type { AvailablePages } from '../popup-ui/pages'

import PopupUIMyselfIcon from './myself-icon'
import PopupUITopTab from './top-tab'

const M = MaterialUI

export default function PopupUITopbar() {
  const { dispatchUIStates, uiStates } = React.useContext(UIContext)
  const currentTabInfo = React.useContext(TabInfoContext)
  const { myself } = currentTabInfo
  const availablePages: AvailablePages = {
    'new-session-followers-page': !!myself,
    'new-session-tweet-page': !!(myself && currentTabInfo.tweet),
    'new-session-searchresult-page': !!(myself && currentTabInfo.searchQuery),
    'new-session-blocklist-page': !!myself,
    'new-session-audiospace-page': !!(myself && currentTabInfo.audioSpace),
    'new-session-lockpicker-page': !!myself,
  }
  function handleMenuButtonClick(event: React.MouseEvent<HTMLButtonElement>) {
    dispatchUIStates({ type: 'open-menu', menuAnchorElem: event.currentTarget })
  }
  return (
    <M.AppBar position="fixed">
      <M.Toolbar variant="dense" disableGutters>
        <M.IconButton color="inherit" onClick={handleMenuButtonClick}>
          <M.Icon>menu</M.Icon>
        </M.IconButton>
        <M.Tabs
          style={{ flexGrow: 1 }}
          textColor="inherit"
          indicatorColor="secondary"
          value={uiStates.tabPage}
          onChange={(_ev, val) =>
            dispatchUIStates({
              type: 'switch-tab-page',
              tabPage: val,
            })}
        >
          <PopupUITopTab
            value="chainblock-sessions-page"
            count={uiStates.countOfRunningSessions}
          />
          <PopupUITopTab
            value="new-session-followers-page"
            disabled={!availablePages['new-session-followers-page']}
          />
          <PopupUITopTab
            value="new-session-tweet-page"
            disabled={!availablePages['new-session-tweet-page']}
          />
          <PopupUITopTab
            value="new-session-searchresult-page"
            disabled={!availablePages['new-session-searchresult-page']}
          />
          {availablePages['new-session-audiospace-page'] && (
            <PopupUITopTab
              value="new-session-audiospace-page"
              disabled={!availablePages['new-session-audiospace-page']}
            />
          )}
          <PopupUITopTab
            value="new-session-blocklist-page"
            disabled={!availablePages['new-session-blocklist-page']}
          />
          <PopupUITopTab
            value="new-session-lockpicker-page"
            disabled={!availablePages['new-session-lockpicker-page']}
          />
          <PopupUITopTab value="misc-page" />
        </M.Tabs>
        {myself && <PopupUIMyselfIcon {...{ myself: myself.user }} />}
      </M.Toolbar>
    </M.AppBar>
  )
}
