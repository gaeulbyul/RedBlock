import { RedBlockOptionsContext } from './contexts.js'
import * as i18n from '../../scripts/i18n.js'

const M = MaterialUI
const T = MaterialUI.Typography

export default function ChainBlockOptionsPage() {
  const { options, updateOptions } = React.useContext(RedBlockOptionsContext)
  const inactivePeriods: Array<[InactivePeriod, string]> = [
    ['never', i18n.getMessage('dont_skip')],
    ['1y', i18n.getMessage('one_year')],
    ['2y', i18n.getMessage('n_years', 2)],
    ['3y', i18n.getMessage('n_years', 3)],
  ]
  return (
    <M.Paper>
      <M.Box padding="10px" margin="10px">
        <M.FormControl component="fieldset" fullWidth>
          <M.FormLabel component="legend">체인블락 / Chainblock</M.FormLabel>
          <M.Divider />
          <M.FormGroup>
            <M.FormControlLabel
              control={<M.Checkbox size="small" />}
              onChange={() =>
                updateOptions({
                  removeSessionAfterComplete: !options.removeSessionAfterComplete,
                })
              }
              checked={options.removeSessionAfterComplete}
              label={i18n.getMessage('remove_session_after_complete')}
            />
          </M.FormGroup>
          <M.FormControl>
            <M.FormLabel>
              <T>{i18n.getMessage('skip_inactive_users')}</T>
            </M.FormLabel>
            <M.RadioGroup row>
              {inactivePeriods.map(([period, label], index) => (
                <M.FormControlLabel
                  key={index}
                  control={<M.Radio />}
                  checked={options.skipInactiveUser === period}
                  onChange={() =>
                    updateOptions({
                      skipInactiveUser: period,
                    })
                  }
                  label={label}
                />
              ))}
            </M.RadioGroup>
            <M.FormHelperText>
              {i18n.getMessage('skip_inactive_users_description')}
            </M.FormHelperText>
          </M.FormControl>
        </M.FormControl>
      </M.Box>
    </M.Paper>
  )
}
