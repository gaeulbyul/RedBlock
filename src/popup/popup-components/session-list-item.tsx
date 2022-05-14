import * as MaterialUI from '@mui/material'
import { createStyles, makeStyles } from '@mui/styles'

import React from 'react'
import type browser from 'webextension-polyfill'

import { downloadFromExportSession, stopChainBlock } from '../../scripts/background/request-sender'
import {
  getCountOfUsersToBlock,
  getLimitResetTime,
  getTargetUser,
  isRunningSession,
} from '../../scripts/common/utilities'
import * as i18n from '../../scripts/i18n'
import { statusToString } from '../../scripts/text-generate'
import { LinearProgressWithLabel } from '../popup-ui/components'
import { UIContext } from '../popup-ui/contexts'

import SessionProgressTable from './session-list-item-progress-table'

const M = MaterialUI
const T = MaterialUI.Typography

function calculatePercentage(session: SessionInfo): number | null {
  const { status } = session
  const { scraped } = session.progress
  if (status === 'AwaitingUntilRecur') {
    return 100
  }
  if (status === 'Completed') {
    return 100
  }
  const max = session.progress.total ?? getCountOfUsersToBlock(session.request)
  if (typeof max === 'number') {
    // Math.min : bioBlock모드로 인해 total보다 더 많은 유저를 수집할 수도 있다.
    // 100%가 안 넘도록 함
    return Math.min(100, Math.round((scraped / max) * 1000) / 10)
  } else if (status === 'Stopped') {
    return 0
  } else {
    return null
  }
}

// 타입추론이 제대로 작동하지 않아서 makeStyles의 theme 대신
// 여기서 함수를 따로 꺼내서 사용하기로 함.
const { getContrastText } = MaterialUI.createTheme().palette

const useStylesForSessionItem = makeStyles(() =>
  createStyles({
    expand: {
      marginLeft: 'auto',
    },
    redAvatar: {
      backgroundColor: MaterialUI.colors.red[700],
      color: getContrastText(MaterialUI.colors.red[700]),
    },
    greenAvatar: {
      backgroundColor: MaterialUI.colors.green[700],
      color: getContrastText(MaterialUI.colors.green[700]),
    },
    grayAvatar: {
      backgroundColor: MaterialUI.colors.blueGrey[700],
      color: getContrastText(MaterialUI.colors.blueGrey[700]),
    },
  })
)

export default function SessionListItem({
  sessionInfo,
  recurringAlarm,
}: {
  sessionInfo: SessionInfo
  recurringAlarm?: browser.Alarms.Alarm
}) {
  const { sessionId } = sessionInfo
  const { purpose, target, executor } = sessionInfo.request
  const uiContext = React.useContext(UIContext)
  const classes = useStylesForSessionItem()
  const [expanded, setExpanded] = React.useState(false)
  const downloaded = sessionInfo.exported || false
  const running = isRunningSession(sessionInfo)
  function toggleExpand() {
    setExpanded(!expanded)
  }
  // let user: TwitterUser | null
  let user = getTargetUser(target)
  let localizedTarget = ''
  switch (target.type) {
    case 'follower':
    case 'lockpicker':
      switch (target.list) {
        case 'followers':
          localizedTarget = i18n.getMessage('followers_of_xxx', user!.screen_name)
          break
        case 'friends':
          localizedTarget = i18n.getMessage('followings_of_xxx', user!.screen_name)
          break
        case 'mutual-followers':
          localizedTarget = i18n.getMessage('mutual_followers_of_xxx', user!.screen_name)
          break
      }
      break
    case 'tweet_reaction':
      localizedTarget = i18n.getMessage('reacted_xxxs_tweet', user!.screen_name)
      break
    case 'import':
      localizedTarget = i18n.getMessage('from_imported_blocklist')
      break
    case 'user_search':
      localizedTarget = i18n.getMessage('from_user_search_result')
      localizedTarget += ` (${i18n.getMessage('query')}: ${target.query})`
      break
    case 'audio_space':
      localizedTarget = i18n.getMessage(
        'from_audio_space_by_xxx',
        target.audioSpace.participants.admins[0]!.twitter_screen_name,
      )
      break
    case 'export_my_blocklist':
      user = executor.user
      localizedTarget = i18n.getMessage('exporting_my_blocklist')
      break
  }
  const localizedPurpose = i18n.getMessage(purpose.type)
  const cardTitle = `${localizedPurpose} ${statusToString(sessionInfo.status)}`
  function renderCardHeader(profileImageUrl: string | null) {
    // function requestRewindChainBlock() {
    //  rewindChainBlock(sessionId)
    // }
    // const rewindable = isRewindableStatus(status)
    // <M.Button style={{ display: 'none' }} disabled={!rewindable} onClick={requestRewindChainBlock}>
    //  {i18n.getMessage('rewind')}
    // </M.Button>
    function requestStopChainBlock() {
      if (running) {
        uiContext.dispatchUIStates({
          type: 'open-modal',
          content: {
            dialogType: 'confirm',
            message: {
              title: i18n.getMessage('confirm_session_stop_message'),
            },
            callbackOnOk() {
              stopChainBlock(sessionId)
            },
          },
        })
        return
      }
      const shouldConfirmClose = purpose.type === 'export'
        && sessionInfo.status !== 'Completed'
        && sessionInfo.status !== 'Stopped'
      if (shouldConfirmClose && !downloaded) {
        uiContext.dispatchUIStates({
          type: 'open-modal',
          content: {
            dialogType: 'confirm',
            message: {
              title: i18n.getMessage('confirm_closing_export_session_notyet_save'),
            },
            callbackOnOk() {
              stopChainBlock(sessionId)
            },
          },
        })
        return
      } else {
        stopChainBlock(sessionId)
      }
    }
    function downloadBlocklist() {
      if (sessionInfo.progress.scraped > 0) {
        downloadFromExportSession(sessionInfo.sessionId)
      } else {
        uiContext.dispatchUIStates({
          type: 'open-modal',
          content: {
            dialogType: 'alert',
            message: {
              title: i18n.getMessage('blocklist_is_empty'),
            },
          },
        })
      }
    }
    let closeButtonTitleText = i18n.getMessage('tooltip_close_session')
    let closeButtonIcon = 'close'
    if (running) {
      closeButtonTitleText = i18n.getMessage('tooltip_stop_session')
      closeButtonIcon = 'power_settings_new'
    }
    let downloadButton: React.ReactNode = null
    let expandButton: React.ReactNode = null
    if (purpose.type === 'export') {
      const disabled = sessionInfo.progress.scraped <= 0
      downloadButton = (
        <M.IconButton
          title={i18n.getMessage('save_button_description')}
          onClick={downloadBlocklist}
          disabled={disabled}
          color={downloaded ? 'default' : 'primary'}
        >
          <M.Icon>save</M.Icon>
        </M.IconButton>
      )
    } else {
      expandButton = (
        <M.IconButton className={classes.expand} onClick={toggleExpand}>
          <M.Icon>{expanded ? 'expand_less' : 'expand_more'}</M.Icon>
        </M.IconButton>
      )
    }
    let avatar: React.ReactNode
    if (profileImageUrl) {
      avatar = <M.Avatar src={profileImageUrl} />
    } else {
      let className: keyof typeof classes
      switch (purpose.type) {
        case 'chainblock':
        case 'chainmute':
        case 'chainunfollow':
        case 'lockpicker':
          className = 'redAvatar'
          break
        case 'unchainblock':
        case 'unchainmute':
          className = 'greenAvatar'
          break
        case 'export':
          className = 'grayAvatar'
          break
      }
      avatar = (
        <M.Avatar className={classes[className]}>
          <M.Icon>import_export</M.Icon>
        </M.Avatar>
      )
    }
    return (
      <M.CardHeader
        action={
          <React.Fragment>
            {downloadButton}
            {expandButton}
            <M.IconButton title={closeButtonTitleText} onClick={requestStopChainBlock}>
              <M.Icon>{closeButtonIcon}</M.Icon>
            </M.IconButton>
          </React.Fragment>
        }
        avatar={avatar}
        title={cardTitle}
        subheader={localizedTarget}
      />
    )
  }
  let name = ''
  let biggerProfileImageUrl = ''
  if (user) {
    name = user.name
    biggerProfileImageUrl = user.profile_image_url_https.replace('_normal', '_bigger')
    if (target.type === 'tweet_reaction') {
      name = `<${i18n.getMessage('tweet')}> ${name}`
    }
  } else if (target.type === 'audio_space') {
    const firstHost = target.audioSpace.participants.admins[0]!
    biggerProfileImageUrl = firstHost.avatar_url.replace('_normal', '_bigger')
  }
  const percentage = calculatePercentage(sessionInfo)
  const progressBar = typeof percentage === 'number'
    ? <LinearProgressWithLabel value={percentage} />
    : <M.LinearProgress variant="indeterminate" />
  const succProgress = sessionInfo.progress.success
  let shortProgress: string
  switch (purpose.type) {
    case 'chainblock':
      shortProgress = `${i18n.getMessage('block')}: ${succProgress.Block.toLocaleString()}`
      break
    case 'unchainblock':
      shortProgress = `${i18n.getMessage('unblock')}: ${succProgress.UnBlock.toLocaleString()}`
      break
    case 'export':
      shortProgress = `${
        i18n.getMessage(
          'export',
        )
      }: ${sessionInfo.progress.scraped.toLocaleString()}`
      break
    case 'lockpicker':
      shortProgress = `${i18n.getMessage('block')}: ${succProgress.Block.toLocaleString()}`
      break
    case 'chainunfollow':
      shortProgress = `${i18n.getMessage('unfollow')}: ${succProgress.UnFollow.toLocaleString()}`
      break
    case 'chainmute':
      shortProgress = `${i18n.getMessage('mute')}: ${succProgress.Mute.toLocaleString()}`
      break
    case 'unchainmute':
      shortProgress = `${i18n.getMessage('unmute')}: ${succProgress.UnMute.toLocaleString()}`
      break
  }
  const miniInfo = [`${i18n.getMessage('status')}: ${statusToString(sessionInfo.status)}`]
  if (purpose.type === 'export' && !downloaded) {
    miniInfo.push(`(${i18n.getMessage('not_saved_yet')})`)
  }
  if (sessionInfo.status === 'AwaitingUntilRecur' && recurringAlarm) {
    const timeStr = new Date(recurringAlarm.scheduledTime)
    miniInfo.push(`(${timeStr.toLocaleTimeString()})`)
  }
  miniInfo.push(shortProgress)
  return (
    <M.Box my={1}>
      <M.Card>
        {renderCardHeader(biggerProfileImageUrl)}
        <M.CardContent>
          {progressBar}
          <T>{miniInfo.join(' / ')}</T>
          {sessionInfo.limit && (
            <T color="textSecondary">
              {i18n.getMessage('rate_limit_reset_time')} (±5m):{' '}
              {getLimitResetTime(sessionInfo.limit)}
            </T>
          )}
        </M.CardContent>
        <M.Collapse in={expanded} unmountOnExit>
          <M.CardContent>
            <SessionProgressTable {...{ sessionInfo, recurringAlarm }} />
          </M.CardContent>
        </M.Collapse>
      </M.Card>
    </M.Box>
  )
}
