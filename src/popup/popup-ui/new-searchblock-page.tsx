import * as i18n from '../../scripts/i18n.js'
import * as TextGenerate from '../../scripts/text-generate.js'
import { startNewChainBlockSession } from '../../scripts/background/request-sender.js'
import {
  MyselfContext,
  BlockLimiterContext,
  UIContext,
  TwitterAPIClientContext,
} from './contexts.js'
import { UserSearchChainBlockPageStatesContext, SessionOptionsContext } from './ui-states.js'
import {
  RBExpansionPanel,
  BigExecuteButton,
  BlockLimiterUI,
  PurposeSelectionUI,
} from './components.js'

const M = MaterialUI
const T = MaterialUI.Typography

function TargetExecutionButtonUI(props: { isAvailable: boolean }) {
  const { isAvailable } = props
  const { searchQuery, purpose } = React.useContext(UserSearchChainBlockPageStatesContext)
  const { sessionOptions } = React.useContext(SessionOptionsContext)
  const { openDialog } = React.useContext(UIContext)
  const uiContext = React.useContext(UIContext)
  const myself = React.useContext(MyselfContext)
  const { cookieOptions } = React.useContext(TwitterAPIClientContext)
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
      options: sessionOptions,
      target: {
        type: 'user_search',
        query: searchQuery,
      },
      myself,
      cookieOptions,
    }
    openDialog({
      dialogType: 'confirm',
      message: TextGenerate.generateConfirmMessage(request),
      callbackOnOk() {
        startNewChainBlockSession<UserSearchBlockSessionRequest>(request)
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
