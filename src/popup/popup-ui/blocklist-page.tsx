import { SnackBarContext } from './contexts.js'
import * as i18n from '../../scripts/i18n.js'

import { importBlocklist } from '../../scripts/background/blocklist-process.js'

const M = MaterialUI
const T = MaterialUI.Typography

//const useStylesForBlocklistImportUI = MaterialUI.makeStyles(() =>
//  MaterialUI.createStyles({
//    fullWidth: {
//      width: '100%',
//    },
//  })
//)

export default function BlocklistPage() {
  const snackBarCtx = React.useContext(SnackBarContext)
  const [fileInput] = React.useState(React.createRef<HTMLInputElement>())
  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
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
          <div className="description">{i18n.getMessage('blocklist_import_description')}</div>
        </div>
      </M.ExpansionPanelDetails>
    </M.ExpansionPanel>
  )
}
