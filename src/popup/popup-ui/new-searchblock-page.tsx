import * as i18n from '../../scripts/i18n.js'
import * as TextGenerate from '../../scripts/text-generate.js'
import { startNewChainBlockSession } from '../../scripts/background/request-sender.js'
import { MyselfContext, BlockLimiterContext, UIContext } from './contexts.js'
import {
  UserSearchChainBlockPageStatesContext,
  PurposeContext,
  SessionOptionsContext,
} from './ui-states.js'
import {
  RBExpansionPanel,
  BigExecuteChainBlockButton,
  BigExecuteUnChainBlockButton,
  BlockLimiterUI,
  ChainBlockPurposeUI,
} from './components.js'

const M = MaterialUI
const T = MaterialUI.Typography

function TargetExecutionButtonUI(props: { isAvailable: boolean }) {
  const { isAvailable } = props
  const { searchQuery } = React.useContext(UserSearchChainBlockPageStatesContext)
  const { targetOptions } = React.useContext(SessionOptionsContext)
  const { purpose } = React.useContext(PurposeContext)
  const { openDialog } = React.useContext(UIContext)
  const uiContext = React.useContext(UIContext)
  const myself = React.useContext(MyselfContext)
  function executeSession(purpose: UserSearchBlockSessionRequest['purpose']) {
    if (!myself) {
      uiContext.openSnackBar(i18n.getMessage('error_occured_check_login'))
      return
    }
    if (!searchQuery) {
      throw new Error('unreachable -- searchQuery is null')
    }
    const request: UserSearchBlockSessionRequest = {
      purpose,
      options: targetOptions,
      target: {
        type: 'user_search',
        query: searchQuery,
      },
      myself,
    }
    openDialog({
      dialogType: 'confirm',
      message: TextGenerate.generateConfirmMessage(request),
      callbackOnOk() {
        startNewChainBlockSession<UserSearchBlockSessionRequest>(request)
      },
    })
  }
  let bigButton: React.ReactNode
  switch (purpose) {
    case 'chainblock':
      bigButton = (
        <BigExecuteChainBlockButton
          disabled={!isAvailable}
          onClick={() => executeSession('chainblock')}
        >
          <span>
            {'\u{1f6d1}'} {i18n.getMessage('execute_chainblock')}
          </span>
        </BigExecuteChainBlockButton>
      )
      break
    case 'unchainblock':
      bigButton = (
        <BigExecuteUnChainBlockButton
          disabled={!isAvailable}
          onClick={() => executeSession('unchainblock')}
        >
          <span>
            {'\u{1f49a}'} {i18n.getMessage('execute_unchainblock')}
          </span>
        </BigExecuteUnChainBlockButton>
      )
      break
  }
  return <M.Box>{bigButton}</M.Box>
}

function TargetOptionsUI() {
  const { purpose } = React.useContext(PurposeContext)
  const summary = `${i18n.getMessage('options')} (${i18n.getMessage(purpose)})`
  return (
    <RBExpansionPanel summary={summary} defaultExpanded>
      <ChainBlockPurposeUI />
    </RBExpansionPanel>
  )
}

export default function NewSearchChainBlockPage() {
  const myself = React.useContext(MyselfContext)
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
      <TargetExecutionButtonUI isAvailable={isAvailable()} />
    </div>
  )
}
