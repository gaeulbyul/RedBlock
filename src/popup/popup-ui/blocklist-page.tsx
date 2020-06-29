import { SnackBarContext } from './contexts.js'
import { PageEnum } from '../popup.js'
import * as i18n from '../../scripts/i18n.js'

import { importBlocklist } from '../../scripts/background/blocklist-process.js'

const M = MaterialUI
const T = MaterialUI.Typography

export default function BlocklistPage() {
  const snackBarCtx = React.useContext(SnackBarContext)
  const [fileInput] = React.useState(React.createRef<HTMLInputElement>())
  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const files = fileInput.current!.files
    if (!(files && files.length > 0)) {
      snackBarCtx.snack(i18n.getMessage('pick_file_first'))
      return
    }
    const file = files[0]
    const text = await file.text()
    importBlocklist(text)
  }
  async function openPopupUIInTab(event: React.MouseEvent<HTMLButtonElement, MouseEvent>) {
    event.preventDefault()
    browser.tabs.create({
      active: true,
      url: `/popup/popup.html?istab=1&page=${PageEnum.Blocklist}`,
    })
    window.close()
  }
  return (
    <M.ExpansionPanel defaultExpanded>
      <M.ExpansionPanelSummary>
        <T>{i18n.getMessage('import_blocklist')}</T>
      </M.ExpansionPanelSummary>
      <M.ExpansionPanelDetails>
        <div style={{ width: '100%' }}>
          <form onSubmit={onSubmit}>
            <M.FormControl component="fieldset" fullWidth>
              <M.Box display="flex" flexDirection="row" alignItems="center" justifyContent="space-between">
                <M.Box flexGrow="1">
                  <input
                    required
                    ref={fileInput}
                    id="input-file-to-import"
                    name="input-file"
                    type="file"
                    accept="text/plain,text/csv,application/json,.CSV"
                  />
                </M.Box>
                <M.Button type="submit" variant="contained" color="primary" component="button">
                  {i18n.getMessage('import')}
                </M.Button>
              </M.Box>
            </M.FormControl>
          </form>
          <div className="description">
            <p>{i18n.getMessage('blocklist_import_description')}</p>
            <div className="hide-on-tab">
              <p style={{ fontWeight: 'bold' }}>⚠ {i18n.getMessage('open_new_tab_for_file_picker')}</p>
              <M.Button type="button" variant="outlined" component="button" onClick={openPopupUIInTab}>
                {i18n.getMessage('open_in_new_tab')}
              </M.Button>
            </div>
          </div>
        </div>
      </M.ExpansionPanelDetails>
    </M.ExpansionPanel>
  )
}
