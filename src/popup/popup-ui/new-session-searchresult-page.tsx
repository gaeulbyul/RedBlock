import React from 'react'
import * as MaterialUI from '@material-ui/core'

import * as TextGenerate from '../../scripts/text-generate'
import { startNewChainBlockSession } from '../../scripts/background/request-sender'
import { UIContext, MyselfContext, BlockLimiterContext, RedBlockOptionsContext } from './contexts'
import { UserSearchChainBlockPageStatesContext, ExtraSessionOptionsContext } from './ui-states'
import {
  RBAccordion,
  BigExecuteButton,
  BlockLimiterUI,
  PurposeSelectionUI,
  RequestCheckResultUI,
} from './components'
import { TargetCheckResult, validateRequest } from '../../scripts/background/target-checker'
import * as i18n from '../../scripts/i18n'

const M = MaterialUI
const T = MaterialUI.Typography

function useSessionRequest(): Either<TargetCheckResult, SessionRequest<UserSearchSessionTarget>> {
  const { purpose, searchQuery } = React.useContext(UserSearchChainBlockPageStatesContext)
  const { extraSessionOptions } = React.useContext(ExtraSessionOptionsContext)
  const myself = React.useContext(MyselfContext)
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
  const uiContext = React.useContext(UIContext)
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
          startNewChainBlockSession<UserSearchSessionTarget>(request)
        },
      })
    } else {
      const message = TextGenerate.checkResultToString(maybeRequest.error)
      return uiContext.openSnackBar(message)
    }
  }
  return (
    <M.Box>
      <BigExecuteButton {...{ purpose }} disabled={!isAvailable()} onClick={executeSession} />
    </M.Box>
  )
}

function TargetOptionsUI() {
  const { purpose, changePurposeType, mutatePurposeOptions, availablePurposeTypes } =
    React.useContext(UserSearchChainBlockPageStatesContext)
  const summary = `${i18n.getMessage('options')} (${i18n.getMessage(purpose.type)})`
  return (
    <RBAccordion summary={summary} defaultExpanded>
      <PurposeSelectionUI
        {...{
          purpose,
          changePurposeType,
          mutatePurposeOptions,
          availablePurposeTypes,
        }}
      />
    </RBAccordion>
  )
}

export default function NewSessionSearchResultPage() {
  const maybeRequest = useSessionRequest()
  const { searchQuery } = React.useContext(UserSearchChainBlockPageStatesContext)
  return (
    <div>
      <RBAccordion summary={i18n.getMessage('usersearch_chainblock')} defaultExpanded>
        <div style={{ width: '100%' }}>
          <T>
            {`${i18n.getMessage('query')}: `}
            <strong>{searchQuery}</strong>
          </T>
        </div>
      </RBAccordion>
      <TargetOptionsUI />
      <BlockLimiterUI />
      <RequestCheckResultUI {...{ maybeRequest }} />
      <TargetExecutionButtonUI />
    </div>
  )
}
