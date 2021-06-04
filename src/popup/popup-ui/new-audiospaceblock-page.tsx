import * as TextGenerate from '../../scripts/text-generate.js'
import { startNewChainBlockSession } from '../../scripts/background/request-sender.js'
import {
  UIContext,
  MyselfContext,
  BlockLimiterContext,
  RedBlockOptionsContext,
} from './contexts.js'
import { AudioSpaceChainBlockPageStatesContext, ExtraTargetContext } from './ui-states.js'
import {
  TwitterUserProfile,
  RBExpansionPanel,
  BigExecuteButton,
  BlockLimiterUI,
  PurposeSelectionUI,
  RequestCheckResultUI,
} from './components.js'
import { TargetCheckResult, validateRequest } from '../../scripts/background/target-checker.js'

const M = MaterialUI
const T = MaterialUI.Typography

function useSessionRequest(): SessionRequest<AudioSpaceSessionTarget> {
  const { purpose, audioSpace, includedParticipants } = React.useContext(
    AudioSpaceChainBlockPageStatesContext
  )
  const { extraTarget } = React.useContext(ExtraTargetContext)
  const myself = React.useContext(MyselfContext)!
  const options = React.useContext(RedBlockOptionsContext)
  const target: AudioSpaceSessionTarget = {
    type: 'audio_space',
    audioSpace,
    includeHostsAndSpeakers: true,
    includeListeners: false,
  }
  if (includedParticipants === 'all_participants') {
    target.includeListeners = true
  }
  return {
    purpose,
    options,
    extraTarget,
    target,
    retriever: myself,
    executor: myself,
  }
}

function TargetAudioSpace({ audioSpace }: { audioSpace: AudioSpace }) {
  const { includedParticipants, setIncludedParticipants } = React.useContext(
    AudioSpaceChainBlockPageStatesContext
  )
  const host = audioSpace.participants.admins[0]
  const user = {
    name: host.display_name,
    screen_name: host.twitter_screen_name,
    profile_image_url_https: host.avatar_url,
  }
  return (
    <TwitterUserProfile user={user}>
      <div style={{ width: '100%' }}>
        <T>
          {`${i18n.getMessage('audio_space')}: `}
          <strong>{audioSpace.title}</strong>
        </T>
        <M.FormGroup row>
          <M.FormControlLabel
            control={<M.Radio size="small" />}
            onChange={() => setIncludedParticipants('hosts_and_speakers')}
            checked={includedParticipants === 'hosts_and_speakers'}
            label={i18n.getMessage('hosts_and_speakers')}
          />
          <M.FormControlLabel
            control={<M.Radio size="small" />}
            onChange={() => setIncludedParticipants('all_participants')}
            checked={includedParticipants === 'all_participants'}
            label={i18n.getMessage('all_participants')}
          />
        </M.FormGroup>
      </div>
    </TwitterUserProfile>
  )
}

function TargetExecutionButtonUI() {
  const { purpose } = React.useContext(AudioSpaceChainBlockPageStatesContext)
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
        startNewChainBlockSession<AudioSpaceSessionTarget>(request)
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
  } = React.useContext(AudioSpaceChainBlockPageStatesContext)
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

export default function NewAudioSpaceChainBlockPage() {
  const request = useSessionRequest()
  const { audioSpace } = React.useContext(AudioSpaceChainBlockPageStatesContext)
  const hostUserName = audioSpace.participants.admins[0].twitter_screen_name
  const targetSummary = `${i18n.getMessage('target')} (${i18n.getMessage(
    'from_audio_space_by_xxx',
    hostUserName
  )})`
  return (
    <div>
      <RBExpansionPanel summary={targetSummary} defaultExpanded>
        <TargetAudioSpace audioSpace={audioSpace} />
      </RBExpansionPanel>
      <TargetOptionsUI />
      <BlockLimiterUI />
      <RequestCheckResultUI {...{ request }} />
      <TargetExecutionButtonUI />
    </div>
  )
}
