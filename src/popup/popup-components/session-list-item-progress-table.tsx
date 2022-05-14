import * as MaterialUI from '@mui/material'

import React from 'react'
import type browser from 'webextension-polyfill'

import * as i18n from '../../scripts/i18n'

const M = MaterialUI
function progressTableRow(left: string, right: string | number) {
  const rightCell = typeof right === 'string' ? right : right.toLocaleString()
  return (
    <M.TableRow>
      <M.TableCell>{left}</M.TableCell>
      <M.TableCell align="right">{rightCell}</M.TableCell>
    </M.TableRow>
  )
}

export default function SessionProgressTable({
  sessionInfo,
  recurringAlarm,
}: {
  sessionInfo: SessionInfo
  recurringAlarm?: browser.Alarms.Alarm
}) {
  const { progress: p } = sessionInfo
  const { TableContainer, Table, TableBody } = MaterialUI
  const { success: s } = p
  return (
    <TableContainer>
      <Table size="small">
        <TableBody>
          {recurringAlarm && (
            <M.TableRow>
              <M.TableCell>{i18n.getMessage('next_recur_time')}</M.TableCell>
              <M.TableCell align="right">
                {new Date(recurringAlarm.scheduledTime).toLocaleTimeString()}
              </M.TableCell>
            </M.TableRow>
          )}
          {progressTableRow(i18n.getMessage('block'), s.Block)}
          {progressTableRow(i18n.getMessage('unblock'), s.UnBlock)}
          {progressTableRow(i18n.getMessage('mute'), s.Mute)}
          {progressTableRow(i18n.getMessage('unmute'), s.UnMute)}
          {progressTableRow(i18n.getMessage('unfollow'), s.UnFollow)}
          {progressTableRow(i18n.getMessage('block_and_unblock'), s.BlockAndUnBlock)}
          {progressTableRow(i18n.getMessage('already_done'), p.already)}
          {progressTableRow(i18n.getMessage('skipped'), p.skipped)}
          {progressTableRow(i18n.getMessage('failed'), p.failure)}
        </TableBody>
      </Table>
    </TableContainer>
  )
}
