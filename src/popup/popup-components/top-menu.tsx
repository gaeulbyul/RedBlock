import * as MaterialUI from '@mui/material'
import React from 'react'
import browser from 'webextension-polyfill'

import * as i18n from '\\/scripts/i18n'
import { UIContext } from '../popup-ui/contexts'
import { pageIcon, PageId, pageLabel } from '../popup-ui/pages'

const M = MaterialUI

function getVersionAndName() {
  const manifest = browser.runtime.getManifest()
  return `${manifest.name} v${manifest.version}`
}

export default function PopupUITopMenu() {
  const { uiStates, dispatchUIStates, popupOpenedInTab, availablePages } = React
    .useContext(UIContext)
  const { countOfRunningSessions } = uiStates
  function handleOpenInTabClick() {
    browser.tabs.create({
      active: true,
      url: '/popup/popup.html?istab=1',
    })
    closeMenu()
  }
  function handleSettingsClick() {
    browser.runtime.openOptionsPage()
    closeMenu()
  }
  function switchPageFromMenu(page: PageId) {
    dispatchUIStates({ type: 'switch-tab-page', tabPage: page })
    closeMenu()
  }
  function closeMenu() {
    dispatchUIStates({ type: 'close-menu' })
  }
  const MenuItem = React.forwardRef(
    (
      {
        pageId,
        count,
        disabled,
      }: {
        pageId: PageId
        count?: number
        disabled?: boolean
      },
      ref: React.Ref<any>,
    ) => (
      <M.MenuItem ref={ref} dense disabled={disabled} onClick={() => switchPageFromMenu(pageId)}>
        <M.ListItemIcon>{pageIcon(pageId)}</M.ListItemIcon>
        {pageLabel(pageId, count)}
      </M.MenuItem>
    ),
  )
  return (
    <M.Menu
      keepMounted
      anchorEl={uiStates.menuAnchorElem}
      open={Boolean(uiStates.menuAnchorElem)}
      onClose={closeMenu}
    >
      <MenuItem pageId="chainblock-sessions-page" count={countOfRunningSessions} />
      <MenuItem
        pageId="new-session-followers-page"
        disabled={!availablePages['new-session-followers-page']}
      />
      <MenuItem
        pageId="new-session-tweet-page"
        disabled={!availablePages['new-session-tweet-page']}
      />
      <MenuItem
        pageId="new-session-searchresult-page"
        disabled={!availablePages['new-session-searchresult-page']}
      />
      <MenuItem
        pageId="new-session-audiospace-page"
        disabled={!availablePages['new-session-audiospace-page']}
      />
      <MenuItem
        pageId="new-session-blocklist-page"
        disabled={!availablePages['new-session-blocklist-page']}
      />
      <MenuItem
        pageId="new-session-lockpicker-page"
        disabled={!availablePages['new-session-lockpicker-page']}
      />
      <MenuItem pageId="misc-page" />

      {!popupOpenedInTab && (
        <M.MenuItem dense onClick={handleOpenInTabClick}>
          <M.ListItemIcon>
            <M.Icon>open_in_new</M.Icon>
          </M.ListItemIcon>
          {i18n.getMessage('open_in_new_tab')}
        </M.MenuItem>
      )}
      <M.MenuItem dense onClick={handleSettingsClick}>
        <M.ListItemIcon>
          <M.Icon>settings</M.Icon>
        </M.ListItemIcon>
        {i18n.getMessage('open_settings_ui')}
      </M.MenuItem>
      <M.Divider />
      <M.MenuItem disabled>{getVersionAndName()}</M.MenuItem>
    </M.Menu>
  )
}
