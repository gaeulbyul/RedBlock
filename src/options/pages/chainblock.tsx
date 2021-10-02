import React from 'react'
import * as MaterialUI from '@material-ui/core'
import * as i18n from '../../scripts/i18n'

import { RedBlockOptionsContext } from './contexts'

const M = MaterialUI
const T = MaterialUI.Typography

function BlockDelaySlider() {
  const {
    options: { delayBlockRequest },
    updateOptions,
  } = React.useContext(RedBlockOptionsContext)
  function onChange(_event: unknown, newValue_: number | number[]) {
    const newValue = typeof newValue_ === 'number' ? newValue_ : newValue_[0]
    updateOptions({
      delayBlockRequest: newValue,
    })
  }
  function onChangeCommitted(_event: unknown, newValue_: number | number[]) {
    const newValue = typeof newValue_ === 'number' ? newValue_ : newValue_[0]
    updateOptions({
      delayBlockRequest: newValue,
    })
  }
  return (
    <M.FormControl>
      <M.FormLabel>
        <T>
          {i18n.getMessage('throttle_block')} (+{delayBlockRequest}s)
        </T>
      </M.FormLabel>
      <M.Slider
        {...{ onChange, onChangeCommitted }}
        value={delayBlockRequest}
        min={0}
        max={10}
        step={0.1}
        color="secondary"
        valueLabelDisplay="auto"
      />
    </M.FormControl>
  )
  // min-max 수정 시 validator도 같이 고칠것.
}

function ChainBlockOptionsPaper() {
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
          <M.FormLabel component="legend">체인블락 / Chain-block</M.FormLabel>
          <M.Divider />
          <M.FormGroup>
            <M.FormControlLabel
              control={<M.Checkbox size="small" />}
              onChange={(_event, checked) =>
                updateOptions({
                  removeSessionAfterComplete: checked,
                })
              }
              checked={options.removeSessionAfterComplete}
              label={i18n.getMessage('remove_session_after_complete')}
            />
          </M.FormGroup>
          <M.FormGroup>
            <M.FormControlLabel
              control={<M.Checkbox size="small" />}
              onChange={(_event, checked) =>
                updateOptions({
                  muteEvenAlreadyBlocking: checked,
                })
              }
              checked={options.muteEvenAlreadyBlocking}
              label={i18n.getMessage('mute_even_already_blocked')}
            />
          </M.FormGroup>
          <M.FormGroup>
            <M.FormControlLabel
              control={<M.Checkbox size="small" />}
              onChange={(_event, checked) =>
                updateOptions({
                  allowSelfChainBlock: checked,
                })
              }
              checked={options.allowSelfChainBlock}
              label={i18n.getMessage('allow_self_chainblock')}
            />
          </M.FormGroup>
          <M.FormGroup>
            <M.FormControlLabel
              control={<M.Checkbox size="small" />}
              onChange={(_event, checked) =>
                updateOptions({
                  alsoBlockTargetItself: checked,
                })
              }
              checked={options.alsoBlockTargetItself}
              label={i18n.getMessage('include_itself')}
            />
            <M.FormHelperText>{i18n.getMessage('include_itself_description')}</M.FormHelperText>
          </M.FormGroup>
          <br />
          <BlockDelaySlider />
          <br />
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
          <br />
          <M.FormControl>
            <M.FormLabel>
              <T>{i18n.getMessage('recurring_interval')}</T>
            </M.FormLabel>
            <M.Select
              native
              value={options.recurringSessionInterval}
              onChange={event => {
                const { value } = event.target
                if (typeof value !== 'string') {
                  return
                }
                const minutes = parseInt(value, 10)
                if (Number.isNaN(minutes)) {
                  return
                }
                updateOptions({
                  recurringSessionInterval: minutes,
                })
              }}
            >
              <option value={3}>{i18n.getMessage('n_minutes', 3)}</option>
              <option value={5}>{i18n.getMessage('n_minutes', 5)}</option>
              <option value={10}>{i18n.getMessage('n_minutes', 10)}</option>
              <option value={15}>{i18n.getMessage('n_minutes', 15)}</option>
              <option value={20}>{i18n.getMessage('n_minutes', 20)}</option>
              <option value={30}>{i18n.getMessage('n_minutes', 30)}</option>
            </M.Select>
            <M.FormHelperText>{i18n.getMessage('recurring_session_description')}</M.FormHelperText>
          </M.FormControl>
        </M.FormControl>
      </M.Box>
    </M.Paper>
  )
  // n분 선택시 수정시 validator도 같이 고칠것.
}

export default function ChainBlockOptionsPage() {
  return (
    <React.Fragment>
      <ChainBlockOptionsPaper />
    </React.Fragment>
  )
}
