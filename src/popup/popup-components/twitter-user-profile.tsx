import * as MaterialUI from '@mui/material'
import { useTheme } from '@mui/styles'
import React from 'react'

import * as i18n from '\\/scripts/i18n'

const M = MaterialUI
const T = MaterialUI.Typography

// AudioSpace에는 요것만 있음. 이걸로도 TwitterUserProfile을 사용하는 데 지장이 없으니까.
interface UserWithOnlyNameAndProfileImages {
  name: string
  screen_name: string
  profile_image_url_https: string
}

export default function TwitterUserProfile({
  user,
  children,
}: {
  user: TwitterUser | UserWithOnlyNameAndProfileImages
  children?: React.ReactNode
}) {
  const theme = useTheme()
  // @ts-ignore 잘 되는데 왜 타입오류가 발생하지??
  const textSecondary = theme.palette.text.secondary
  const biggerProfileImageUrl = user.profile_image_url_https.replace('_normal', '_bigger')
  return (
    <M.Box display="flex" flexDirection="row">
      <M.Box mr={1}>
        <M.Avatar
          alt={i18n.getMessage('profile_image')}
          src={biggerProfileImageUrl}
          sx={{ width: 64, height: 64 }}
        />
      </M.Box>
      <M.Box width="100%" lineHeight="150%">
        <M.Box>
          <T sx={{ fontWeight: 'bold', fontSize: 'larger' }}>
            {user.name}
          </T>
          <M.Link
            target="_blank"
            rel="noopener noreferrer"
            href={`https://twitter.com/${user.screen_name}`}
            title={i18n.getMessage('go_to_url', `https://twitter.com/${user.screen_name}`)}
            sx={{ color: 'text.secondary', textDecorationColor: textSecondary }}
          >
            @{user.screen_name}
          </M.Link>
        </M.Box>
        <div style={{ margin: '5px 0' }}>{children}</div>
      </M.Box>
    </M.Box>
  )
}
