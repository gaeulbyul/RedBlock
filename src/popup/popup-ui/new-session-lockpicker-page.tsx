import {
  UIContext,
  MyselfContext,
  BlockLimiterContext,
  RedBlockOptionsContext,
} from './contexts.js'
import {
  RBExpansionPanel,
  BlockLimiterUI,
  BigExecuteButton,
  PurposeSelectionUI,
  TwitterUserProfile,
  RequestCheckResultUI,
} from './components.js'
import * as TextGenerate from '../../scripts/text-generate.js'
import { startNewChainBlockSession } from '../../scripts/background/request-sender.js'
import { LockPickerPageStatesContext, ExtraTargetContext } from './ui-states.js'
import { TargetCheckResult, validateRequest } from '../../scripts/background/target-checker.js'

const M = MaterialUI

function useSessionRequest(): Either<TargetCheckResult, SessionRequest<LockPickerSessionTarget>> {
  const { purpose } = React.useContext(LockPickerPageStatesContext)
  const { extraTarget } = React.useContext(ExtraTargetContext)
  const myself = React.useContext(MyselfContext)
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
    extraTarget,
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
    <M.Box>
      <BigExecuteButton {...{ purpose }} disabled={!isAvailable()} onClick={executeSession} />
    </M.Box>
  )
}

export default function NewSessionLockpickerPage() {
  const myself = React.useContext(MyselfContext)!
  const maybeRequest = useSessionRequest()
  return (
    <div>
      <RBExpansionPanel summary={i18n.getMessage('lockpicker')} defaultExpanded>
        <div style={{ width: '100%' }}>
          <TwitterUserProfile user={myself.user} />
        </div>
      </RBExpansionPanel>
      <TargetOptionsUI />
      <BlockLimiterUI />
      <RequestCheckResultUI {...{ maybeRequest }} />
      <TargetExecutionButtonUI />
    </div>
  )
}
