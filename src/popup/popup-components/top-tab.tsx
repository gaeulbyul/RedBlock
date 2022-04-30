import * as MaterialUI from '@mui/material'
import { withStyles } from '@mui/styles'
import React from 'react'

import { MyTooltip } from '../popup-ui/components'
import { pageIcon, PageId, pageLabel } from '../popup-ui/pages'

const M = MaterialUI

const StyledTab = withStyles({
  root: {
    minWidth: '48px',
    '&:disabled': {
      opacity: 0.5,
      filter: 'blur(1px)',
    },
  },
})(MaterialUI.Tab)

export default function PopupUITopTab({
  value,
  disabled,
  count,
  ...props
}: {
  value: PageId
  count?: number
  disabled?: boolean
}) {
  const icon = (
    <M.Badge
      color="secondary"
      badgeContent={count}
      anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
    >
      {pageIcon(value)}
    </M.Badge>
  )
  const cursor = disabled ? 'not-allowed' : 'pointer'
  return (
    <MyTooltip arrow title={pageLabel(value, count)} style={{ cursor }}>
      <div>
        <StyledTab {...props} {...{ value, icon, disabled }} style={{ cursor }} />
      </div>
    </MyTooltip>
  )
}
