import * as MaterialUI from '@mui/material'
import React from 'react'

import { startNewChainBlockSession } from '../../scripts/background/request-sender'
import { TargetCheckResult, validateRequest } from '../../scripts/background/target-checker'
import * as i18n from '../../scripts/i18n'
import * as TextGenerate from '../../scripts/text-generate'
import { BigExecuteButton, PurposeSelectionUI, TwitterUserProfile } from './components'
import { BlockLimiterContext, RedBlockOptionsContext, TabInfoContext, UIContext } from './contexts'
import { AudioSpaceChainBlockPageStatesContext, ExtraSessionOptionsContext } from './ui-states'

import BlockLimiterUI from '../popup-components/block-limiter-ui'

const M = MaterialUI
const T = MaterialUI.Typography

function useSessionRequest(): Either<TargetCheckResult, SessionRequest<AudioSpaceSessionTarget>> {
  const { purpose, audioSpace, includedParticipants } = React.useContext(
    AudioSpaceChainBlockPageStatesContext,
  )
  const { extraSessionOptions } = React.useContext(ExtraSessionOptionsContext)
  const { myself } = React.useContext(TabInfoContext)
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
    AudioSpaceChainBlockPageStatesContext,
  )
  const host = audioSpace.participants.admins[0]!
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
  const { dispatchUIStates } = React.useContext(UIContext)
  const maybeRequest = useSessionRequest()
  function isAvailable() {
    const remained = limiterStatus.max - limiterStatus.current
    if (remained <= 0) {
      return false
    }
    return maybeRequest.ok
  }
  function executeSession() {
    if (maybeRequest.ok) {
      const { value: request } = maybeRequest
      return dispatchUIStates({
        type: 'open-modal',
        content: {
          dialogType: 'confirm',
          message: TextGenerate.generateConfirmMessage(request),
          callbackOnOk() {
            startNewChainBlockSession<AudioSpaceSessionTarget>(request)
          },
        },
      })
    } else {
      const message = TextGenerate.checkResultToString(maybeRequest.error)
      return dispatchUIStates({ type: 'open-snack-bar', message })
    }
  }
  return (
    <M.Box mt={1}>
      <BigExecuteButton {...{ purpose }} disabled={!isAvailable()} onClick={executeSession} />
    </M.Box>
  )
}

function TargetOptionsUI() {
  const { purpose, changePurposeType, mutatePurposeOptions, availablePurposeTypes } = React
    .useContext(AudioSpaceChainBlockPageStatesContext)
  const maybeRequest = useSessionRequest()
  return (
    <PurposeSelectionUI
      {...{
        purpose,
        changePurposeType,
        mutatePurposeOptions,
        availablePurposeTypes,
        maybeRequest,
      }}
    />
  )
}

export default function NewSessionAudioSpacePage() {
  const { audioSpace } = React.useContext(AudioSpaceChainBlockPageStatesContext)
  return (
    <div>
      <M.Paper>
        <M.Box p={2}>
          <TargetAudioSpace audioSpace={audioSpace} />
          <TargetOptionsUI />
          <TargetExecutionButtonUI />
        </M.Box>
      </M.Paper>
      <BlockLimiterUI />
    </div>
  )
}
