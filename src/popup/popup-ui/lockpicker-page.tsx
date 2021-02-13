import {
  UIContext,
  MyselfContext,
  BlockLimiterContext,
  TwitterAPIClientContext,
} from './contexts.js'
import {
  RBExpansionPanel,
  BlockLimiterUI,
  BigExecuteButton,
  PurposeSelectionUI,
  TwitterUserProfile,
  RequestCheckResultUI,
} from './components.js'

import * as i18n from '../../scripts/i18n.js'
import { generateConfirmMessage } from '../../scripts/text-generate.js'
import { startNewChainBlockSession } from '../../scripts/background/request-sender.js'
import { LockPickerPageStatesContext, SessionOptionsContext } from './ui-states.js'
import { TargetCheckResult, validateRequest } from '../../scripts/background/target-checker.js'

const M = MaterialUI

function useSessionRequest(): LockPickerSessionRequest {
  const { purpose } = React.useContext(LockPickerPageStatesContext)
  const { cookieOptions } = React.useContext(TwitterAPIClientContext)
  const { sessionOptions } = React.useContext(SessionOptionsContext)
  const myself = React.useContext(MyselfContext)!
  return {
    purpose,
    options: sessionOptions,
    target: {
      type: 'lockpicker',
      user: myself,
      list: 'followers',
    },
    myself,
    cookieOptions,
  }
}

function TargetOptionsUI() {
  const {
    purpose,
    changePurposeType,
    mutatePurposeOptions,
    availablePurposeTypes,
  } = React.useContext(LockPickerPageStatesContext)
  const summary = `${i18n.getMessage('options')} (${i18n.getMessage(purpose.type)})`
  return (
    <RBExpansionPanel summary={summary} defaultExpanded>
      <PurposeSelectionUI
        {...{
          purpose,
          changePurposeType,
          mutatePurposeOptions,
          availablePurposeTypes,
        }}
      />
    </RBExpansionPanel>
  )
}

function TargetExecutionButtonUI() {
  const { purpose } = React.useContext(LockPickerPageStatesContext)
  const uiContext = React.useContext(UIContext)
  const limiterStatus = React.useContext(BlockLimiterContext)
  const request = useSessionRequest()
  function isAvailable() {
    if (limiterStatus.remained <= 0) {
      return false
    }
    return validateRequest(request) === TargetCheckResult.Ok
  }
  function executeSession() {
    uiContext.openDialog({
      dialogType: 'confirm',
      message: generateConfirmMessage(request),
      callbackOnOk() {
        startNewChainBlockSession<LockPickerSessionRequest>(request)
      },
    })
  }
  return (
    <M.Box>
      <BigExecuteButton {...{ purpose }} disabled={!isAvailable()} onClick={executeSession} />
    </M.Box>
  )
}

export default function LockPickerPage() {
  const myself = React.useContext(MyselfContext)!
  const request = useSessionRequest()
  return (
    <div>
      <RBExpansionPanel summary={i18n.getMessage('lockpicker')} defaultExpanded>
        <div style={{ width: '100%' }}>
          <TwitterUserProfile user={myself} />
        </div>
      </RBExpansionPanel>
      <TargetOptionsUI />
      <BlockLimiterUI />
      <RequestCheckResultUI {...{ request }} />
      <TargetExecutionButtonUI />
    </div>
  )
}
