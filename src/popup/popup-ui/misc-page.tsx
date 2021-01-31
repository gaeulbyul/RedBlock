import { toggleOneClickBlockMode } from '../popup.js'
import { UIContext, TwitterAPIClientContext, MyselfContext } from './contexts.js'
import { RBExpansionPanel } from './components.js'
import * as i18n from '../../scripts/i18n.js'

const M = MaterialUI

async function deleteTwitterRelatedCookies(cookieOptions: CookieOptions) {
  const url = 'https://twitter.com'
  const storeId = cookieOptions.cookieStoreId
  const cookies = await browser.cookies.getAll({
    url,
    storeId,
  })
  const promises: Promise<any>[] = []
  for (const cookie of cookies) {
    promises.push(
      browser.cookies.remove({
        url,
        storeId,
        name: cookie.name,
      })
    )
  }
  await Promise.allSettled(promises)
}

export default function MiscPage() {
  const uiContext = React.useContext(UIContext)
  const myself = React.useContext(MyselfContext)
  const { cookieOptions } = React.useContext(TwitterAPIClientContext)
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
        deleteTwitterRelatedCookies(cookieOptions)
      },
    })
  }
  const disabledOneClickBlockRelatedButtons = !myself
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
    </div>
  )
}
