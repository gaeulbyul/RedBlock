import { RedBlockOptionsContext } from './contexts.js'
import { CheckboxItem } from '../components.js'

const M = MaterialUI
const T = MaterialUI.Typography

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
                  throttleBlockRequest: checked,
                })
              }
              checked={options.throttleBlockRequest}
              label={i18n.getMessage('throttle_block')}
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

function RightClickMenusPaper() {
  const { options, updateOptions } = React.useContext(RedBlockOptionsContext)
  const currentMenus = options.menus
  function updateMenusOption(newOptionsPart: Partial<RedBlockOptions['menus']>) {
    updateOptions({
      menus: {
        ...currentMenus,
        ...newOptionsPart,
      },
    })
  }
  return (
    <M.Paper>
      <M.Box padding="10px" margin="10px">
        <M.FormControl component="fieldset" fullWidth>
          <M.FormLabel component="legend">우클릭 메뉴 / Right click menus</M.FormLabel>
          <M.Divider />
          <M.FormGroup>
            <CheckboxItem
              checked={currentMenus.chainBlockFollowers}
              label={i18n.getMessage('run_followers_chainblock_to_this_user')}
              onChange={checked =>
                updateMenusOption({
                  chainBlockFollowers: checked,
                })
              }
            />
          </M.FormGroup>
          <M.FormGroup>
            <CheckboxItem
              checked={currentMenus.chainBlockFollowings}
              label={i18n.getMessage('run_followings_chainblock_to_this_user')}
              onChange={checked =>
                updateMenusOption({
                  chainBlockFollowings: checked,
                })
              }
            />
          </M.FormGroup>
          <M.FormGroup>
            <CheckboxItem
              checked={currentMenus.chainBlockMutualFollowers}
              label={i18n.getMessage('run_mutual_followers_chainblock_to_this_user')}
              onChange={checked =>
                updateMenusOption({
                  chainBlockMutualFollowers: checked,
                })
              }
            />
          </M.FormGroup>
          <M.Divider variant="middle" />
          <M.FormGroup>
            <CheckboxItem
              checked={currentMenus.chainBlockRetweeters}
              label={i18n.getMessage('run_retweeters_chainblock_to_this_tweet')}
              onChange={checked =>
                updateMenusOption({
                  chainBlockRetweeters: checked,
                })
              }
            />
          </M.FormGroup>
          <M.FormGroup>
            <CheckboxItem
              checked={currentMenus.chainBlockLikers}
              label={i18n.getMessage('run_likers_chainblock_to_this_tweet')}
              onChange={checked =>
                updateMenusOption({
                  chainBlockLikers: checked,
                })
              }
            />
          </M.FormGroup>
          <M.FormGroup>
            <CheckboxItem
              checked={currentMenus.chainBlockRetweetersAndLikers}
              label={i18n.getMessage('run_retweeters_and_likers_chainblock_to_this_tweet')}
              onChange={checked =>
                updateMenusOption({
                  chainBlockRetweetersAndLikers: checked,
                })
              }
            />
          </M.FormGroup>
          <M.FormGroup>
            <CheckboxItem
              checked={currentMenus.chainBlockMentioned}
              label={i18n.getMessage('run_mentioned_users_chainblock_to_this_tweet')}
              onChange={checked =>
                updateMenusOption({
                  chainBlockMentioned: checked,
                })
              }
            />
          </M.FormGroup>
        </M.FormControl>
      </M.Box>
    </M.Paper>
  )
}

export default function ChainBlockOptionsPage() {
  return (
    <React.Fragment>
      <ChainBlockOptionsPaper />
      <RightClickMenusPaper />
    </React.Fragment>
  )
}
