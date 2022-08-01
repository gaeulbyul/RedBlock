import * as MaterialUI from '@mui/material'
import React from 'react'

import * as i18n from '\\/scripts/i18n'
import { MyTooltip } from '../popup-ui/components'

const M = MaterialUI

export default function PopupMyselfIcon({ myself }: { myself: TwitterUser }) {
  const description = i18n.getMessage('current_account', [myself.screen_name, myself.name])
  return (
    <MyTooltip arrow placement="left" title={description}>
      <M.Button>
        <M.Avatar
          style={{
            width: 24,
            height: 24,
            borderRadius: '50%',
          }}
          src={myself.profile_image_url_https}
        />
      </M.Button>
    </MyTooltip>
  )
}
