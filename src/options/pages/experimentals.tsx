import { RedBlockOptionsContext } from './contexts.js'
// import * as i18n from '../../scripts/i18n.js'

const M = MaterialUI
const T = MaterialUI.Typography

export default function ExperimentalOptionsPages() {
  const { options } = React.useContext(RedBlockOptionsContext)
  return (
    <M.Paper>
      <M.Box padding="10px" margin="10px">
        <M.FormControl component="fieldset" fullWidth>
          <M.FormLabel component="legend">실험적 기능 / Experimental features</M.FormLabel>
          <M.Divider />
          <M.FormGroup>
            <M.FormControlLabel
              control={<M.Checkbox size="small" />}
              checked={options.removeSessionAfterComplete}
              label="AntiBlock"
            />
          </M.FormGroup>
          <M.FormControl>
            <M.FormLabel>
              <T>BioBlock TM</T>
            </M.FormLabel>
          </M.FormControl>
        </M.FormControl>
      </M.Box>
    </M.Paper>
  )
}
