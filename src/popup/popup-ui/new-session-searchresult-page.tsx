import * as MaterialUI from '@mui/material'
import React from 'react'

import { startNewChainBlockSession } from '\\/scripts/background/request-sender'
import { TargetCheckResult, validateRequest } from '\\/scripts/background/target-checker'
import * as i18n from '\\/scripts/i18n'
import * as TextGenerate from '\\/scripts/text-generate'
import { BigExecuteButton, PurposeSelectionUI } from './components'
import { BlockLimiterContext, RedBlockOptionsContext, TabInfoContext, UIContext } from './contexts'
import { ExtraSessionOptionsContext, UserSearchChainBlockPageStatesContext } from './ui-states'

import BlockLimiterUI from '../popup-components/block-limiter-ui'

const M = MaterialUI
const T = MaterialUI.Typography

function useSessionRequest(): Either<TargetCheckResult, SessionRequest<UserSearchSessionTarget>> {
  const { purpose, searchQuery } = React.useContext(UserSearchChainBlockPageStatesContext)
  const { extraSessionOptions } = React.useContext(ExtraSessionOptionsContext)
  const { myself } = React.useContext(TabInfoContext)
  const options = React.useContext(RedBlockOptionsContext)
  if (!myself) {
    return {
      ok: false,
      error: TargetCheckResult.MaybeNotLoggedIn,
    }
  }
  const request: SessionRequest<UserSearchSessionTarget> = {
    purpose,
    options,
    extraSessionOptions,
    target: {
      type: 'user_search',
      query: searchQuery!,
    },
    retriever: myself,
    executor: myself,
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

function TargetExecutionButtonUI() {
  const { purpose } = React.useContext(UserSearchChainBlockPageStatesContext)
  const limiterStatus = React.useContext(BlockLimiterContext)
  const { dispatchUIStates } = React.useContext(UIContext)
  const maybeRequest = useSessionRequest()
  function isAvailable() {
    const remained = limiterStatus.max - limiterStatus.current
    if (remained <= 0) {
      return false
    }
    return maybeRequest.ok
  }
  function executeSession() {
    if (maybeRequest.ok) {
      const { value: request } = maybeRequest
      return dispatchUIStates({
        type: 'open-modal',
        content: {
          dialogType: 'confirm',
          message: TextGenerate.generateConfirmMessage(request),
          callbackOnOk() {
            startNewChainBlockSession<UserSearchSessionTarget>(request)
          },
        },
      })
    } else {
      const message = TextGenerate.checkResultToString(maybeRequest.error)
      return dispatchUIStates({ type: 'open-snack-bar', message })
    }
  }
  return (
    <M.Box mt={1}>
      <BigExecuteButton {...{ purpose }} disabled={!isAvailable()} onClick={executeSession} />
    </M.Box>
  )
}

function TargetOptionsUI() {
  const { purpose, changePurposeType, mutatePurposeOptions, availablePurposeTypes } = React
    .useContext(UserSearchChainBlockPageStatesContext)

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

export default function NewSessionSearchResultPage() {
  const { searchQuery } = React.useContext(UserSearchChainBlockPageStatesContext)
  return (
    <div>
      <M.Paper>
        <M.Box p={2}>
          <T>
            {`${i18n.getMessage('query')}: `}
            <strong>{searchQuery}</strong>
          </T>
          <TargetOptionsUI />
          <TargetExecutionButtonUI />
        </M.Box>
      </M.Paper>
      <BlockLimiterUI />
    </div>
  )
}
