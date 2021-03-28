import { RedBlockOptionsContext } from './contexts.js'

function checkFirstPartyIsolationSupport() {
  try {
    // 크로미움계열에선 쿠키관련 API 사용시 firstPartyDomain을 사용할 수 없으며, TypeError가 발생한다.
    // 이를 통해 first party isolation 지원여부를 확인한다.
    // @ts-ignore
    chrome.cookies.getAll({ firstPartyDomain: undefined })
    return true
  } catch (err) {
    return false
  }
}

const M = MaterialUI

function SwitchItem(props: {
  label: string
  onChange(checked: boolean): void
  checked: boolean
  disabled?: boolean
}) {
  const { checked, disabled, label } = props
  return (
    <M.FormControlLabel
      control={<M.Switch />}
      {...{ checked, disabled, label }}
      onChange={(_event, checked) => props.onChange(checked)}
    />
  )
}

export default function ExperimentalOptionsPages() {
  const { options, updateOptions } = React.useContext(RedBlockOptionsContext)
  const firstPartyIsolatableBrowser = checkFirstPartyIsolationSupport()
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
              disabled={!firstPartyIsolatableBrowser}
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
