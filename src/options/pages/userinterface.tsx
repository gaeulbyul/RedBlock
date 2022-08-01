import * as MaterialUI from '@mui/material'
import React from 'react'

import * as i18n from '\\/scripts/i18n'
import { CheckboxItem } from '\\/ui/components'
import { RedBlockOptionsContext } from './contexts'

const M = MaterialUI

function RightClickMenusPaper() {
  const {
    options: { enableTeamwork },
    uiOptions,
    updateUIOptions,
  } = React.useContext(RedBlockOptionsContext)
  const currentMenus = uiOptions.menus
  function updateMenusOption(newOptionsPart: Partial<RedBlockUIOptions['menus']>) {
    updateUIOptions({
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
                })}
            />
          </M.FormGroup>
          <M.FormGroup>
            <CheckboxItem
              checked={currentMenus.chainBlockFollowings}
              label={i18n.getMessage('run_followings_chainblock_to_this_user')}
              onChange={checked =>
                updateMenusOption({
                  chainBlockFollowings: checked,
                })}
            />
          </M.FormGroup>
          <M.FormGroup>
            <CheckboxItem
              checked={currentMenus.chainBlockMutualFollowers}
              label={i18n.getMessage('run_mutual_followers_chainblock_to_this_user')}
              onChange={checked =>
                updateMenusOption({
                  chainBlockMutualFollowers: checked,
                })}
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
                })}
            />
          </M.FormGroup>
          <M.FormGroup>
            <CheckboxItem
              checked={currentMenus.chainBlockLikers}
              label={i18n.getMessage('run_likers_chainblock_to_this_tweet')}
              onChange={checked =>
                updateMenusOption({
                  chainBlockLikers: checked,
                })}
            />
          </M.FormGroup>
          <M.FormGroup>
            <CheckboxItem
              checked={currentMenus.chainBlockRetweetersAndLikers}
              label={i18n.getMessage('run_retweeters_and_likers_chainblock_to_this_tweet')}
              onChange={checked =>
                updateMenusOption({
                  chainBlockRetweetersAndLikers: checked,
                })}
            />
          </M.FormGroup>
          <M.FormGroup>
            <CheckboxItem
              checked={currentMenus.chainBlockMentioned}
              label={i18n.getMessage('run_mentioned_users_chainblock_to_this_tweet')}
              onChange={checked =>
                updateMenusOption({
                  chainBlockMentioned: checked,
                })}
            />
          </M.FormGroup>
          <M.FormGroup>
            <CheckboxItem
              checked={currentMenus.chainBlockAudioSpaceSpeakers}
              label={i18n.getMessage('run_chainblock_from_audio_space_hosts_and_speakers')}
              onChange={checked =>
                updateMenusOption({
                  chainBlockAudioSpaceSpeakers: checked,
                })}
            />
          </M.FormGroup>
          <M.FormGroup>
            <CheckboxItem
              checked={currentMenus.chainBlockAudioSpaceSpeakersAndListeners}
              label={i18n.getMessage('run_chainblock_from_audio_space_all')}
              onChange={checked =>
                updateMenusOption({
                  chainBlockAudioSpaceSpeakersAndListeners: checked,
                })}
            />
          </M.FormGroup>
          <M.FormGroup>
            <CheckboxItem
              checked={currentMenus.chainBlockHashTagInUsersProfile}
              label={i18n.getMessage('run_hashtag_user_chainblock')}
              onChange={checked =>
                updateMenusOption({
                  chainBlockHashTagInUsersProfile: checked,
                })}
            />
          </M.FormGroup>
          {enableTeamwork && (
            <React.Fragment>
              <M.Divider variant="middle" />
              <M.FormGroup>
                <CheckboxItem
                  checked={currentMenus.teamworkBlock}
                  label={i18n.getMessage('teamwork_block_user')}
                  onChange={checked =>
                    updateMenusOption({
                      teamworkBlock: checked,
                    })}
                />
              </M.FormGroup>
              <M.FormGroup>
                <CheckboxItem
                  checked={currentMenus.teamworkUnblock}
                  label={i18n.getMessage('teamwork_unblock_user')}
                  onChange={checked =>
                    updateMenusOption({
                      teamworkUnblock: checked,
                    })}
                />
              </M.FormGroup>
              <M.FormGroup>
                <CheckboxItem
                  checked={currentMenus.teamworkMute}
                  label={i18n.getMessage('teamwork_mute_user')}
                  onChange={checked =>
                    updateMenusOption({
                      teamworkMute: checked,
                    })}
                />
              </M.FormGroup>
              <M.FormGroup>
                <CheckboxItem
                  checked={currentMenus.teamworkUnmute}
                  label={i18n.getMessage('teamwork_unmute_user')}
                  onChange={checked =>
                    updateMenusOption({
                      teamworkUnmute: checked,
                    })}
                />
              </M.FormGroup>
            </React.Fragment>
          )}
        </M.FormControl>
      </M.Box>
    </M.Paper>
  )
}

export default function UserInterfaceOptionsPage() {
  return (
    <React.Fragment>
      <RightClickMenusPaper />
    </React.Fragment>
  )
}
