import * as MaterialUI from '@mui/material'
import React from 'react'

import * as i18n from '\\/scripts/i18n'

const M = MaterialUI
const T = MaterialUI.Typography

export default function PleaseLoginBox() {
  function closePopup(_event: React.MouseEvent) {
    window.setTimeout(() => {
      window.close()
    }, 200)
  }
  return (
    <M.Paper>
      <M.Box px={2} py={1.5}>
        <T component="div">{i18n.getMessage('please_check_login')}</T>
        <M.Box mt={1}>
          <a
            rel="noopener noreferrer"
            target="_blank"
            href="https://twitter.com/login"
            onClick={closePopup}
            style={{ textDecoration: 'none' }}
          >
            <M.Button variant="outlined" startIcon={<M.Icon>exit_to_app</M.Icon>}>
              Login
            </M.Button>
          </a>
        </M.Box>
      </M.Box>
    </M.Paper>
  )
}
