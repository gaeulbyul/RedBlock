import { toggleOneClickBlockMode, getCurrentTab } from '../popup.js'
import { UIContext, ActorsContext } from './contexts.js'
import { RBExpansionPanel } from './components.js'
import {
  getAllCookies,
  removeCookie,
  getCookieStoreIdFromTab,
} from '../../scripts/background/cookie-handler.js'

const M = MaterialUI

async function deleteTwitterRelatedCookies() {
  const currentTab = await getCurrentTab()
  const storeId = await getCookieStoreIdFromTab(currentTab)
  const cookies = await getAllCookies({
    storeId,
  })
  const promises: Promise<any>[] = []
  for (const cookie of cookies) {
    promises.push(
      removeCookie({
        storeId,
        name: cookie.name,
      }).catch(() => {})
    )
  }
  await Promise.allSettled(promises)
}

function openOptions() {
  browser.runtime.openOptionsPage()
  window.close()
}

export default function MiscPage() {
  const uiContext = React.useContext(UIContext)
  const actors = React.useContext(ActorsContext)
  function onClickOneClickBlockModeButtons(enable: boolean) {
    toggleOneClickBlockMode(enable)
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
        deleteTwitterRelatedCookies().then(() => {
          uiContext.openSnackBar(i18n.getMessage('cookie_delete_complete'))
        })
      },
    })
  }
  const disabledOneClickBlockRelatedButtons = !actors
  return (
    <div>
      <RBExpansionPanel summary={i18n.getMessage('oneclick_block_mode')} defaultExpanded>
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
      </RBExpansionPanel>
      <RBExpansionPanel summary={i18n.getMessage('troubleshooting')} defaultExpanded>
        <div style={{ width: '100%' }}>
          <M.FormControl component="fieldset">
            <M.Button variant="outlined" onClick={confirmCookieDeletion}>
              <span>{i18n.getMessage('delete_cookie')}</span>
            </M.Button>
          </M.FormControl>
          <p>{i18n.getMessage('delete_cookie_description')}</p>
        </div>
      </RBExpansionPanel>
      <RBExpansionPanel summary={i18n.getMessage('open_settings_ui')} defaultExpanded>
        <M.Button variant="outlined" startIcon={<M.Icon>settings</M.Icon>} onClick={openOptions}>
          <span>{i18n.getMessage('open_settings_ui')}</span>
        </M.Button>
      </RBExpansionPanel>
    </div>
  )
}
