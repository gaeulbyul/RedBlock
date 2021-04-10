import * as TextGenerate from '../../scripts/text-generate.js'
import { startNewChainBlockSession } from '../../scripts/background/request-sender.js'
import {
  UIContext,
  MyselfContext,
  BlockLimiterContext,
  TwitterAPIClientContext,
  RedBlockOptionsContext,
} from './contexts.js'
import { UserSearchChainBlockPageStatesContext, ExtraTargetContext } from './ui-states.js'
import {
  RBExpansionPanel,
  BigExecuteButton,
  BlockLimiterUI,
  PurposeSelectionUI,
  RequestCheckResultUI,
} from './components.js'
import { TargetCheckResult, validateRequest } from '../../scripts/background/target-checker.js'

const M = MaterialUI
const T = MaterialUI.Typography

function useSessionRequest(): UserSearchBlockSessionRequest {
  const { purpose, searchQuery } = React.useContext(UserSearchChainBlockPageStatesContext)
  const { cookieOptions } = React.useContext(TwitterAPIClientContext)
  const { extraTarget } = React.useContext(ExtraTargetContext)
  const myself = React.useContext(MyselfContext)!
  const options = React.useContext(RedBlockOptionsContext)
  const retriever = { user: myself, cookieOptions }
  return {
    purpose,
    options,
    extraTarget,
    target: {
      type: 'user_search',
      query: searchQuery!,
    },
    retriever,
    executor: retriever,
  }
}

function TargetExecutionButtonUI() {
  const { purpose } = React.useContext(UserSearchChainBlockPageStatesContext)
  const limiterStatus = React.useContext(BlockLimiterContext)
  const uiContext = React.useContext(UIContext)
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
      message: TextGenerate.generateConfirmMessage(request),
      callbackOnOk() {
        startNewChainBlockSession<UserSearchBlockSessionRequest>(request)
      },
    })
  }
  return (
    <M.Box>
      <BigExecuteButton {...{ purpose }} disabled={!isAvailable()} onClick={executeSession} />
    </M.Box>
  )
}

function TargetOptionsUI() {
  const {
    purpose,
    changePurposeType,
    mutatePurposeOptions,
    availablePurposeTypes,
  } = React.useContext(UserSearchChainBlockPageStatesContext)
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

export default function NewSearchChainBlockPage() {
  const request = useSessionRequest()
  const { searchQuery } = React.useContext(UserSearchChainBlockPageStatesContext)
  return (
    <div>
      <RBExpansionPanel summary={i18n.getMessage('usersearch_chainblock')} defaultExpanded>
        <div style={{ width: '100%' }}>
          <T>
            {`${i18n.getMessage('query')}: `}
            <strong>{searchQuery}</strong>
          </T>
        </div>
      </RBExpansionPanel>
      <TargetOptionsUI />
      <BlockLimiterUI />
      <RequestCheckResultUI {...{ request }} />
      <TargetExecutionButtonUI />
    </div>
  )
}
