import { SnackBarContext } from './contexts.js'
import * as i18n from '../../scripts/i18n.js'

import { importBlocklist } from '../../scripts/background/blocklist-process.js'

const M = MaterialUI

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
    <M.Box padding="10px">
      <form onSubmit={onSubmit}>
        <M.FormControl component="fieldset">
          <M.FormLabel component="legend">{i18n.getMessage('import_blocklist')}</M.FormLabel>
          <div>
            <input
              required
              ref={fileInput}
              id="input-file-to-import"
              name="input-file"
              type="file"
              accept="text/plain,text/csv,application/json,.CSV"
            />
            <br />
            <M.Button type="submit" variant="contained" color="primary" component="button">
              {i18n.getMessage('import')}
            </M.Button>
          </div>
        </M.FormControl>
      </form>
      <div className="description">{i18n.getMessage('blocklist_import_description')}</div>
    </M.Box>
  )
}
