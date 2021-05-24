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
import { generateConfirmMessage } from '../../scripts/text-generate.js'
import { startNewChainBlockSession } from '../../scripts/background/request-sender.js'
import { LockPickerPageStatesContext, ExtraTargetContext } from './ui-states.js'
import { TargetCheckResult, validateRequest } from '../../scripts/background/target-checker.js'

const M = MaterialUI

function useSessionRequest(): SessionRequest<LockPickerSessionTarget> {
  const { purpose } = React.useContext(LockPickerPageStatesContext)
  const { extraTarget } = React.useContext(ExtraTargetContext)
  const myself = React.useContext(MyselfContext)!
  const options = React.useContext(RedBlockOptionsContext)
  return {
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
        startNewChainBlockSession<LockPickerSessionTarget>(request)
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
          <TwitterUserProfile user={myself.user} />
        </div>
      </RBExpansionPanel>
      <TargetOptionsUI />
      <BlockLimiterUI />
      <RequestCheckResultUI {...{ request }} />
      <TargetExecutionButtonUI />
    </div>
  )
}
