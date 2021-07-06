import React from 'react'
import * as MaterialUI from '@material-ui/core'

import * as TextGenerate from '../../scripts/text-generate'
import {
  UIContext,
  MyselfContext,
  RetrieverContext,
  BlockLimiterContext,
  RedBlockOptionsContext,
} from './contexts'
import { startNewChainBlockSession } from '../../scripts/background/request-sender'
import {
  BlockLimiterUI,
  TwitterUserProfile,
  RBExpansionPanel,
  BigExecuteButton,
  PurposeSelectionUI,
  RequestCheckResultUI,
} from './components'
import { TweetReactionChainBlockPageStatesContext, ExtraTargetContext } from './ui-states'
import { TargetCheckResult, validateRequest } from '../../scripts/background/target-checker'
import { findNonLinkedMentionsFromTweet } from '../../scripts/common'
import * as i18n from '~~/scripts/i18n'

const M = MaterialUI

// 트윗을 실제 트위터에서 보이는대로 잘라줌
function showTextLikeTwitter({ full_text, display_text_range: [start, end] }: Tweet): string {
  return Array.from(full_text).slice(start, end).join('')
}

function useSessionRequest(): Either<
  TargetCheckResult,
  SessionRequest<TweetReactionSessionTarget>
> {
  const {
    purpose,
    currentTweet,
    includeRetweeters,
    includeLikers,
    includeMentionedUsers,
    includeQuotedUsers,
    includeNonLinkedMentions,
    includedReactionsV2,
  } = React.useContext(TweetReactionChainBlockPageStatesContext)
  const { extraTarget } = React.useContext(ExtraTargetContext)
  const myself = React.useContext(MyselfContext)
  const { retriever } = React.useContext(RetrieverContext)
  const options = React.useContext(RedBlockOptionsContext)
  if (!myself) {
    return {
      ok: false,
      error: TargetCheckResult.MaybeNotLoggedIn,
    }
  }
  if (!currentTweet) {
    // currentTweet이 없으면 트윗 체인블락 페이지를 안 띄우므로.
    throw new Error('unreachable')
  }
  if (currentTweet.user.blocked_by) {
    return {
      ok: false,
      error: TargetCheckResult.TheyBlocksYou,
    }
  }
  const request: SessionRequest<TweetReactionSessionTarget> = {
    purpose,
    options,
    extraTarget,
    target: {
      type: 'tweet_reaction',
      tweet: currentTweet,
      includeRetweeters,
      includeLikers,
      includeMentionedUsers,
      includeQuotedUsers,
      includeNonLinkedMentions,
      includedReactionsV2,
    },
    retriever,
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

function TargetTweetUI({ tweet }: { tweet: Tweet }) {
  const {
    includeRetweeters,
    setIncludeRetweeters,
    includeLikers,
    setIncludeLikers,
    includeMentionedUsers,
    setIncludeMentionedUsers,
    includeQuotedUsers,
    setIncludeQuotedUsers,
    includeNonLinkedMentions,
    setIncludeNonLinkedMentions,
  } = React.useContext(TweetReactionChainBlockPageStatesContext)
  const mentions = tweet.entities.user_mentions || []
  const nobodyRetweeted = tweet.retweet_count <= 0
  const nobodyLiked = tweet.favorite_count <= 0
  const nobodyMentioned = mentions.length <= 0
  const nobodyQuoted = tweet.quote_count <= 0
  const nonLinkedMentions = findNonLinkedMentionsFromTweet(tweet)
  const displayText = showTextLikeTwitter(tweet)
  return (
    <TwitterUserProfile user={tweet.user}>
      <div className="profile-right-targettweet">
        <div>
          <blockquote className="tweet-content">{displayText}</blockquote>
        </div>
        <M.FormGroup row>
          <M.FormControlLabel
            control={<M.Checkbox size="small" />}
            onChange={() => setIncludeRetweeters(!includeRetweeters)}
            checked={includeRetweeters}
            disabled={nobodyRetweeted}
            label={`${i18n.getMessage('retweet')} (${tweet.retweet_count.toLocaleString()})`}
          />
          <M.FormControlLabel
            control={<M.Checkbox size="small" />}
            onChange={() => setIncludeLikers(!includeLikers)}
            checked={includeLikers}
            disabled={nobodyLiked}
            label={`${i18n.getMessage('like')} (${tweet.favorite_count.toLocaleString()})`}
          />
          <M.FormControlLabel
            control={<M.Checkbox size="small" />}
            onChange={() => setIncludeMentionedUsers(!includeMentionedUsers)}
            checked={includeMentionedUsers}
            disabled={nobodyMentioned}
            label={`${i18n.getMessage('mentioned')} (${mentions.length.toLocaleString()})`}
          />
          <M.FormControlLabel
            control={<M.Checkbox size="small" />}
            onChange={() => setIncludeQuotedUsers(!includeQuotedUsers)}
            checked={includeQuotedUsers}
            disabled={nobodyQuoted}
            label={`${i18n.getMessage('quoted')} (${tweet.quote_count.toLocaleString()})`}
          />
          <M.FormControlLabel
            control={<M.Checkbox size="small" />}
            onChange={() => setIncludeNonLinkedMentions(!includeNonLinkedMentions)}
            checked={includeNonLinkedMentions}
            disabled={nonLinkedMentions.length <= 0}
            label={`${i18n.getMessage(
              'non_linked_mentions'
            )} (${nonLinkedMentions.length.toLocaleString()})`}
          />
        </M.FormGroup>
      </div>
    </TwitterUserProfile>
  )
}

function TargetTweetOuterUI() {
  const { currentTweet } = React.useContext(TweetReactionChainBlockPageStatesContext)
  if (!currentTweet) {
    throw new Error()
  }
  const userName = currentTweet.user.screen_name
  const targetSummary = `${i18n.getMessage('target')} (${i18n.getMessage(
    'reacted_xxxs_tweet',
    userName
  )})`
  return (
    <RBExpansionPanel summary={targetSummary} defaultExpanded>
      <div style={{ width: '100%' }}>
        <M.FormControl component="fieldset" fullWidth>
          <TargetTweetUI tweet={currentTweet} />
        </M.FormControl>
      </div>
    </RBExpansionPanel>
  )
}

function TargetOptionsUI() {
  const { purpose, changePurposeType, mutatePurposeOptions, availablePurposeTypes } =
    React.useContext(TweetReactionChainBlockPageStatesContext)
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
  const { purpose } = React.useContext(TweetReactionChainBlockPageStatesContext)
  const uiContext = React.useContext(UIContext)
  const limiterStatus = React.useContext(BlockLimiterContext)
  const maybeRequest = useSessionRequest()
  function isAvailable() {
    if (purpose.type === 'chainblock' && limiterStatus.remained <= 0) {
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
          startNewChainBlockSession<TweetReactionSessionTarget>(request)
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

export default function NewSessionTweetPage() {
  const maybeRequest = useSessionRequest()
  return (
    <div>
      <TargetTweetOuterUI />
      <TargetOptionsUI />
      <BlockLimiterUI />
      <RequestCheckResultUI {...{ maybeRequest }} />
      <TargetExecutionButtonUI />
    </div>
  )
}
