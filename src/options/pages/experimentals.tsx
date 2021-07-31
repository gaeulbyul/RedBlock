import React from 'react'
import * as MaterialUI from '@material-ui/core'
import * as i18n from '~~/scripts/i18n'

import { RedBlockOptionsContext } from './contexts'
import { SwitchItem } from '../../ui/components'

const M = MaterialUI

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
              checked={options.enableBlockBuster}
              label={i18n.getMessage('enable_blockbuster')}
              onChange={checked =>
                updateOptions({
                  enableBlockBuster: checked,
                })
              }
            />
          </M.FormGroup>
          <M.FormHelperText>{i18n.getMessage('blockbuster_description')}</M.FormHelperText>
          {options.enableBlockBuster && (
            <M.FormGroup>
              <SwitchItem
                checked={options.enableBlockBusterWithTweetDeck}
                label={i18n.getMessage('blockbuster_use_tweetdeck')}
                onChange={checked =>
                  updateOptions({
                    enableBlockBusterWithTweetDeck: checked,
                  })
                }
              />
            </M.FormGroup>
          )}
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
              checked={options.enableReactionsV2Support}
              label={i18n.getMessage('enable_reactions_v2')}
              onChange={checked =>
                updateOptions({
                  enableReactionsV2Support: checked,
                })
              }
            />
          </M.FormGroup>
          <M.FormHelperText>{i18n.getMessage('enable_reactions_v2_description')}</M.FormHelperText>
        </M.FormControl>
      </M.Box>
    </M.Paper>
  )
}
