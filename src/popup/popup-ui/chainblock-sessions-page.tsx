import * as MaterialUI from '@mui/material'

import * as i18n from '\\/scripts/i18n'
import React from 'react'
import { TabInfoContext, UIContext } from './contexts'

import BlockLimiterUI from '../popup-components/block-limiter-ui'
import PleaseLoginBox from '../popup-components/please-login'
import SessionListControlbar from '../popup-components/session-list-controlbar'
import SessionItem from '../popup-components/session-list-item'
import NewSessionButtons from '../popup-components/session-list-new-buttons'

const M = MaterialUI

function SessionsList({
  sessions,
  recurringInfos,
}: {
  sessions: SessionInfo[]
  recurringInfos: RecurringAlarmInfosObject
}) {
  return (
    <div>
      {sessions.map(sessionInfo => {
        const { sessionId } = sessionInfo
        const recurringAlarm = recurringInfos[sessionId]
        return <SessionItem {...{ sessionInfo, recurringAlarm }} key={sessionId} />
      })}
    </div>
  )
}

function Welcome() {
  return (
    <M.Box display="flex" flexDirection="column" justifyContent="center" px={2} py={1.5}>
      <M.Box display="flex" justifyContent="center" p={1}>
        <M.Icon color="disabled" style={{ fontSize: '100pt' }}>
          pause_circle_filled_icon
        </M.Icon>
      </M.Box>
      <M.Box
        display="flex"
        flexDirection="column"
        justifyContent="center"
        textAlign="center"
        my={1}
      >
        {i18n.getMessage('session_is_empty')} {i18n.getMessage('press_plus_to_start_new_session')}
      </M.Box>
    </M.Box>
  )
}

export default function ChainBlockSessionsPage({
  sessions,
  recurringInfos,
}: {
  sessions: SessionInfo[]
  recurringInfos: RecurringAlarmInfosObject
}) {
  const { uiStates: { initialLoading } } = React.useContext(UIContext)
  const { myself } = React.useContext(TabInfoContext)

  // 세션이 있어도 팝업 로딩 직후에 빈 세션이 잠깐 나타날 수 있으므로
  // initialLoding이 아닐때에만 보여지도록
  const shouldShowWelcomeNewSession = sessions.length <= 0 && !initialLoading
  const isSessionExist = sessions.length > 0
  if (initialLoading) {
    return <span>Loading...</span>
  }
  return (
    <React.Fragment>
      <BlockLimiterUI />
      {isSessionExist && (
        <React.Fragment>
          <M.Box my={1}>
            <SessionListControlbar />
          </M.Box>
          <SessionsList {...{ sessions, recurringInfos }} />
        </React.Fragment>
      )}
      {shouldShowWelcomeNewSession && <Welcome />}
      <M.Divider />
      {myself
        ? (
          <React.Fragment>
            <M.Box textAlign="center" my={1}>
              {i18n.getMessage('new_session')}:
            </M.Box>
            <NewSessionButtons />
          </React.Fragment>
        )
        : <PleaseLoginBox />}
    </React.Fragment>
  )
}
