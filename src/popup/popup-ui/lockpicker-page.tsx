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
} from './components.js'

import * as i18n from '../../scripts/i18n.js'
import { generateConfirmMessage } from '../../scripts/text-generate.js'
import { startNewChainBlockSession } from '../../scripts/background/request-sender.js'
import { LockPickerPageStatesContext, SessionOptionsContext } from './ui-states.js'

const M = MaterialUI

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

function TargetExecutionButtonUI(props: { isAvailable: boolean }) {
  const { isAvailable } = props
  const { purpose } = React.useContext(LockPickerPageStatesContext)
  const { sessionOptions } = React.useContext(SessionOptionsContext)
  const uiContext = React.useContext(UIContext)
  const myself = React.useContext(MyselfContext)
  const { cookieOptions } = React.useContext(TwitterAPIClientContext)
  function executeSession(purpose: LockPickerSessionRequest['purpose']) {
    if (!myself) {
      uiContext.openSnackBar(i18n.getMessage('error_occured_check_login'))
      return
    }
    const request: LockPickerSessionRequest = {
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
      <BigExecuteButton
        {...{ purpose }}
        disabled={!isAvailable}
        onClick={() => executeSession(purpose)}
      />
    </M.Box>
  )
}

export default function LockPickerPage() {
  const myself = React.useContext(MyselfContext)!
  const limiterStatus = React.useContext(BlockLimiterContext)
  function isAvailable() {
    if (!myself) {
      return false
    }
    if (limiterStatus.remained <= 0) {
      return false
    }
    return true
  }
  return (
    <div>
      <RBExpansionPanel summary={i18n.getMessage('lockpicker')} defaultExpanded>
        <div style={{ width: '100%' }}>
          <TwitterUserProfile user={myself} />
        </div>
      </RBExpansionPanel>
      <TargetOptionsUI />
      <BlockLimiterUI />
      <TargetExecutionButtonUI isAvailable={isAvailable()} />
    </div>
  )
}
