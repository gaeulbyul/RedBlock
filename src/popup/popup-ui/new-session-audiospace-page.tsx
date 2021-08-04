import React from 'react'
import * as MaterialUI from '@material-ui/core'

import * as TextGenerate from '../../scripts/text-generate'
import { startNewChainBlockSession } from '../../scripts/background/request-sender'
import { UIContext, MyselfContext, BlockLimiterContext, RedBlockOptionsContext } from './contexts'
import { AudioSpaceChainBlockPageStatesContext, ExtraSessionOptionsContext } from './ui-states'
import {
  TwitterUserProfile,
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

function useSessionRequest(): Either<TargetCheckResult, SessionRequest<AudioSpaceSessionTarget>> {
  const { purpose, audioSpace, includedParticipants } = React.useContext(
    AudioSpaceChainBlockPageStatesContext
  )
  const { extraSessionOptions } = React.useContext(ExtraSessionOptionsContext)
  const myself = React.useContext(MyselfContext)
  const options = React.useContext(RedBlockOptionsContext)
  if (!myself) {
    return {
      ok: false,
      error: TargetCheckResult.MaybeNotLoggedIn,
    }
  }
  const target: AudioSpaceSessionTarget = {
    type: 'audio_space',
    audioSpace,
    includeHostsAndSpeakers: true,
    includeListeners: false,
  }
  if (includedParticipants === 'all_participants') {
    target.includeListeners = true
  }
  const request: SessionRequest<AudioSpaceSessionTarget> = {
    purpose,
    options,
    extraSessionOptions,
    target,
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
          <strong>{audioSpace.metadata.title}</strong>
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
          startNewChainBlockSession<AudioSpaceSessionTarget>(request)
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
    React.useContext(AudioSpaceChainBlockPageStatesContext)
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

export default function NewSessionAudioSpacePage() {
  const maybeRequest = useSessionRequest()
  const { audioSpace } = React.useContext(AudioSpaceChainBlockPageStatesContext)
  const hostUserName = audioSpace.participants.admins[0].twitter_screen_name
  const targetSummary = `${i18n.getMessage('target')} (${i18n.getMessage(
    'from_audio_space_by_xxx',
    hostUserName
  )})`
  return (
    <div>
      <RBAccordion summary={targetSummary} defaultExpanded>
        <TargetAudioSpace audioSpace={audioSpace} />
      </RBAccordion>
      <TargetOptionsUI />
      <BlockLimiterUI />
      <RequestCheckResultUI {...{ maybeRequest }} />
      <TargetExecutionButtonUI />
    </div>
  )
}
