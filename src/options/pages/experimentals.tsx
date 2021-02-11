import { RedBlockOptionsContext } from './contexts.js'
import * as i18n from '../../scripts/i18n.js'

const M = MaterialUI

function SwitchItem(props: { label: string; onChange(checked: boolean): void; checked: boolean }) {
  const { label, checked } = props
  return (
    <M.FormControlLabel
      control={<M.Switch />}
      {...{ checked, label }}
      onChange={(_event, checked) => props.onChange(checked)}
    />
  )
}

export default function ExperimentalOptionsPages() {
  const { options, updateOptions } = React.useContext(RedBlockOptionsContext)
  return (
    <M.Paper>
      <M.Box padding="10px" margin="10px">
        <M.FormControl component="fieldset" fullWidth>
          <M.FormLabel component="legend">실험적 기능 / Experimental features</M.FormLabel>
          <M.Divider />
          <M.FormGroup>
            <SwitchItem
              checked={options.enableAntiBlock}
              label={i18n.getMessage('enable_antiblock')}
              onChange={checked =>
                updateOptions({
                  enableAntiBlock: checked,
                })
              }
            />
          </M.FormGroup>
          <M.FormHelperText>{i18n.getMessage('antiblock_description')}</M.FormHelperText>
          <M.Divider variant="middle" />
          <M.FormGroup>
            <SwitchItem
              checked={options.revealBioBlockMode}
              label={i18n.getMessage('enable_bioblock')}
              onChange={checked =>
                updateOptions({
                  revealBioBlockMode: checked,
                })
              }
            />
          </M.FormGroup>
          <M.FormHelperText>{i18n.getMessage('bioblock_description')}</M.FormHelperText>
          <M.Divider variant="middle" />
          <M.FormGroup>
            <SwitchItem
              checked={options.firstPartyIsolationCompatibleMode}
              label={i18n.getMessage('1st_party_isolation_compatible_mode')}
              onChange={checked =>
                updateOptions({
                  firstPartyIsolationCompatibleMode: checked,
                })
              }
            />
          </M.FormGroup>
          <M.FormHelperText>
            {i18n.getMessage('1st_party_isolation_compatible_mode_description')}
          </M.FormHelperText>
        </M.FormControl>
      </M.Box>
    </M.Paper>
  )
}
