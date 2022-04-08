import * as MaterialUI from '@mui/material'
import React from 'react'

import { startNewChainBlockSession } from '../../scripts/background/request-sender'
import { TargetCheckResult, validateRequest } from '../../scripts/background/target-checker'
import * as TextGenerate from '../../scripts/text-generate'
import {
  BigExecuteButton,
  BlockLimiterUI,
  PurposeSelectionUI,
  TwitterUserProfile,
} from './components'
import { BlockLimiterContext, RedBlockOptionsContext, TabInfoContext, UIContext } from './contexts'
import { ExtraSessionOptionsContext, LockPickerPageStatesContext } from './ui-states'

const M = MaterialUI

function useSessionRequest(): Either<TargetCheckResult, SessionRequest<LockPickerSessionTarget>> {
  const { purpose } = React.useContext(LockPickerPageStatesContext)
  const { extraSessionOptions } = React.useContext(ExtraSessionOptionsContext)
  const { myself } = React.useContext(TabInfoContext)
  const options = React.useContext(RedBlockOptionsContext)
  if (!myself) {
    return {
      ok: false,
      error: TargetCheckResult.MaybeNotLoggedIn,
    }
  }
  const request: SessionRequest<LockPickerSessionTarget> = {
    purpose,
    options,
    target: {
      type: 'lockpicker',
      user: myself.user,
      list: 'followers',
    },
    retriever: myself,
    executor: myself,
    extraSessionOptions,
  }
  const requestCheckResult = validateRequest(request)
  if (requestCheckResult === TargetCheckResult.Ok) {
    return {
      ok: true,
      value: request,
    }
  } else {
    return {
      ok: false,
      error: requestCheckResult,
    }
  }
}

function TargetOptionsUI() {
  const { purpose, changePurposeType, mutatePurposeOptions, availablePurposeTypes } = React
    .useContext(LockPickerPageStatesContext)
  const maybeRequest = useSessionRequest()
  return (
    <PurposeSelectionUI
      {...{
        purpose,
        changePurposeType,
        mutatePurposeOptions,
        availablePurposeTypes,
        maybeRequest,
      }}
    />
  )
}

function TargetExecutionButtonUI() {
  const { purpose } = React.useContext(LockPickerPageStatesContext)
  const uiContext = React.useContext(UIContext)
  const limiterStatus = React.useContext(BlockLimiterContext)
  const maybeRequest = useSessionRequest()
  function isAvailable() {
    if (limiterStatus.remained <= 0) {
      return false
    }
    return maybeRequest.ok
  }
  function executeSession() {
    if (maybeRequest.ok) {
      const { value: request } = maybeRequest
      return uiContext.openDialog({
        dialogType: 'confirm',
        message: TextGenerate.generateConfirmMessage(request),
        callbackOnOk() {
          startNewChainBlockSession<LockPickerSessionTarget>(request)
        },
      })
    } else {
      const message = TextGenerate.checkResultToString(maybeRequest.error)
      return uiContext.openSnackBar(message)
    }
  }
  return (
    <M.Box mt={1}>
      <BigExecuteButton {...{ purpose }} disabled={!isAvailable()} onClick={executeSession} />
    </M.Box>
  )
}

export default function NewSessionLockpickerPage() {
  const { myself } = React.useContext(TabInfoContext)

  return (
    <div>
      <M.Paper>
        <M.Box p={2}>
          <TwitterUserProfile user={myself!.user} />
          <TargetOptionsUI />
          <TargetExecutionButtonUI />
        </M.Box>
      </M.Paper>
      <BlockLimiterUI />
    </div>
  )
}
