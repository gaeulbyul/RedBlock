import * as MaterialUI from '@material-ui/core'
import React from 'react'

import * as i18n from '../../scripts/i18n'

const availablePageIds = [
  'chainblock-sessions-page',
  'new-session-followers-page',
  'new-session-tweet-page',
  'new-session-searchresult-page',
  'new-session-audiospace-page',
  'new-session-blocklist-page',
  'new-session-lockpicker-page',
  'misc-page',
] as const

export type PageId = typeof availablePageIds[number]

export function isValidPageId(pid: string): pid is PageId {
  // @ts-ignore
  return availablePageIds.includes(pid)
}

export interface AvailablePages {
  'new-session-followers-page': boolean
  'new-session-tweet-page': boolean
  'new-session-searchresult-page': boolean
  'new-session-blocklist-page': boolean
  'new-session-audiospace-page': boolean
  'new-session-lockpicker-page': boolean
}

export function pageIcon(page: PageId): React.ReactElement {
  const M = MaterialUI
  switch (page) {
    case 'chainblock-sessions-page':
      return <M.Icon>play_circle_filled_white_icon</M.Icon>
    case 'new-session-followers-page':
      return <M.Icon>group</M.Icon>
    case 'new-session-tweet-page':
      return <M.Icon>repeat</M.Icon>
    case 'new-session-searchresult-page':
      return <M.Icon>search</M.Icon>
    case 'new-session-audiospace-page':
      return <M.Icon>surround_sound</M.Icon>
    case 'new-session-blocklist-page':
      return <M.Icon>list_alt</M.Icon>
    case 'new-session-lockpicker-page':
      return <M.Icon>no_encryption</M.Icon>
    case 'misc-page':
      return <M.Icon>build</M.Icon>
  }
}

export function newSessionsLabel(page: PageId): string {
  switch (page) {
    case 'new-session-followers-page':
      return i18n.getMessage('followers')
    case 'new-session-tweet-page':
      return i18n.getMessage('tweet_reactions')
    case 'new-session-searchresult-page':
      return i18n.getMessage('search_result')
    case 'new-session-audiospace-page':
      return i18n.getMessage('audio_space')
    case 'new-session-blocklist-page':
      return i18n.getMessage('blocklist_page')
    case 'new-session-lockpicker-page':
      return i18n.getMessage('lockpicker')
    case 'chainblock-sessions-page':
    case 'misc-page':
      throw new Error()
  }
}

export function pageLabel(page: PageId, sessionsCount = 0): string {
  switch (page) {
    case 'chainblock-sessions-page':
      return `${i18n.getMessage('running_sessions')} (${sessionsCount})`
    case 'new-session-followers-page':
      return `${i18n.getMessage('new_session')} (${i18n.getMessage('followers')})`
    case 'new-session-tweet-page':
      return `${i18n.getMessage('new_session')} (${i18n.getMessage('tweet_reactions')})`
    case 'new-session-searchresult-page':
      return `${i18n.getMessage('new_session')} (${i18n.getMessage('search_result')})`
    case 'new-session-audiospace-page':
      return `${i18n.getMessage('new_session')} (${i18n.getMessage('audio_space')})`
    case 'new-session-blocklist-page':
      return i18n.getMessage('blocklist_page')
    case 'new-session-lockpicker-page':
      return i18n.getMessage('lockpicker')
    case 'misc-page':
      return i18n.getMessage('miscellaneous')
  }
}
