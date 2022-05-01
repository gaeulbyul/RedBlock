import * as MaterialUI from '@mui/material'
import React from 'react'

import { startNewChainBlockSession } from '../../scripts/background/request-sender'
import { TargetCheckResult, validateRequest } from '../../scripts/background/target-checker'
import {
  findNonLinkedMentionsFromTweet,
  getReactionsV2CountsFromTweet,
} from '../../scripts/common/utilities'
import * as i18n from '../../scripts/i18n'
import * as TextGenerate from '../../scripts/text-generate'
import { BigExecuteButton, PurposeSelectionUI, TwitterUserProfile } from './components'
import {
  BlockLimiterContext,
  RedBlockOptionsContext,
  RetrieverContext,
  TabInfoContext,
  UIContext,
} from './contexts'
import { ExtraSessionOptionsContext, TweetReactionChainBlockPageStatesContext } from './ui-states'

import BlockLimiterUI from '../popup-components/block-limiter-ui'

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
  const { extraSessionOptions } = React.useContext(ExtraSessionOptionsContext)
  const { myself } = React.useContext(TabInfoContext)
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
    extraSessionOptions,
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

function TargetReactionsV2UI({ tweet }: { tweet: Tweet }) {
  const { includedReactionsV2, setIncludedReactionsV2 } = React.useContext(
    TweetReactionChainBlockPageStatesContext,
  )
  const reactionCounts = getReactionsV2CountsFromTweet(tweet)
  const availableReactions: ReactionV2Kind[] = ['Like', 'Cheer', 'Hmm', 'Sad', 'Haha']
  const emojis: { [reaction in ReactionV2Kind]: string } = {
    Like: '\u2764\uFE0F',
    Cheer: '\uD83D\uDC4F',
    Hmm: '\uD83E\uDD14',
    Sad: '\uD83D\uDE22',
    Haha: '\uD83D\uDE02',
  }
  function onChange(reaction: ReactionV2Kind, checked: boolean) {
    if (checked) {
      setIncludedReactionsV2([...includedReactionsV2, reaction])
    } else {
      setIncludedReactionsV2(includedReactionsV2.filter(r => r !== reaction))
    }
  }
  const padding = '6px 9px'
  return (
    <React.Fragment>
      {availableReactions.map((reaction, index) => (
        <M.FormControlLabel
          key={index}
          control={<M.Checkbox size="small" sx={{ padding }} />}
          onChange={(_event, checked) => onChange(reaction, checked)}
          checked={includedReactionsV2.includes(reaction)}
          disabled={reactionCounts[reaction] <= 0}
          label={`${i18n.getMessage('reaction')}: ${emojis[reaction]} (${
            reactionCounts[
              reaction
            ].toLocaleString()
          })`}
          title={i18n.reaction(reaction)}
        />
      ))}
    </React.Fragment>
  )
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
  const { enableReactionsV2Support } = React.useContext(RedBlockOptionsContext)
  const mentions = tweet.entities.user_mentions || []
  const nobodyRetweeted = tweet.retweet_count <= 0
  const nobodyLiked = tweet.favorite_count <= 0
  const nobodyMentioned = mentions.length <= 0
  const nobodyQuoted = tweet.quote_count <= 0
  const nonLinkedMentions = findNonLinkedMentionsFromTweet(tweet)
  const displayText = showTextLikeTwitter(tweet)
  const padding = '6px 9px'
  return (
    <TwitterUserProfile user={tweet.user}>
      <div className="profile-right-targettweet">
        <div>
          <blockquote className="tweet-content">{displayText}</blockquote>
        </div>
        <M.FormGroup row>
          <M.FormControlLabel
            control={<M.Checkbox size="small" sx={{ padding }} />}
            onChange={() => setIncludeRetweeters(!includeRetweeters)}
            checked={includeRetweeters}
            disabled={nobodyRetweeted}
            label={`${i18n.getMessage('retweet')} (${tweet.retweet_count.toLocaleString()})`}
          />
          {enableReactionsV2Support ? <TargetReactionsV2UI {...{ tweet }} /> : (
            <M.FormControlLabel
              control={<M.Checkbox size="small" sx={{ padding }} />}
              onChange={() => setIncludeLikers(!includeLikers)}
              checked={includeLikers}
              disabled={nobodyLiked}
              label={`${i18n.getMessage('like')} (${tweet.favorite_count.toLocaleString()})`}
            />
          )}
          <M.FormControlLabel
            control={<M.Checkbox size="small" sx={{ padding }} />}
            onChange={() => setIncludeMentionedUsers(!includeMentionedUsers)}
            checked={includeMentionedUsers}
            disabled={nobodyMentioned}
            label={`${i18n.getMessage('mentioned')} (${mentions.length.toLocaleString()})`}
          />
          <M.FormControlLabel
            control={<M.Checkbox size="small" sx={{ padding }} />}
            onChange={() => setIncludeQuotedUsers(!includeQuotedUsers)}
            checked={includeQuotedUsers}
            disabled={nobodyQuoted}
            label={`${i18n.getMessage('quoted')} (${tweet.quote_count.toLocaleString()})`}
          />
          <M.FormControlLabel
            control={<M.Checkbox size="small" sx={{ padding }} />}
            onChange={() => setIncludeNonLinkedMentions(!includeNonLinkedMentions)}
            checked={includeNonLinkedMentions}
            disabled={nonLinkedMentions.length <= 0}
            label={`${
              i18n.getMessage(
                'non_linked_mentions',
              )
            } (${nonLinkedMentions.length.toLocaleString()})`}
          />
        </M.FormGroup>
      </div>
    </TwitterUserProfile>
  )
}

function TargetTweetOuterUI() {
  const { currentTweet } = React.useContext(TweetReactionChainBlockPageStatesContext)
  return (
    <M.FormControl component="fieldset" fullWidth>
      <TargetTweetUI tweet={currentTweet!} />
    </M.FormControl>
  )
}

function TargetOptionsUI() {
  const { purpose, changePurposeType, mutatePurposeOptions, availablePurposeTypes } = React
    .useContext(TweetReactionChainBlockPageStatesContext)
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

function TargetExecutionButtonUI() {
  const { purpose } = React.useContext(TweetReactionChainBlockPageStatesContext)
  const { dispatchUIStates } = React.useContext(UIContext)
  const limiterStatus = React.useContext(BlockLimiterContext)
  const maybeRequest = useSessionRequest()
  function isAvailable() {
    const remained = limiterStatus.max - limiterStatus.current
    if (purpose.type === 'chainblock' && remained <= 0) {
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
            startNewChainBlockSession<TweetReactionSessionTarget>(request)
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

export default function NewSessionTweetPage() {
  return (
    <div>
      <M.Paper>
        <M.Box p={2}>
          <TargetTweetOuterUI />
          <M.Divider />
          <TargetOptionsUI />
          <TargetExecutionButtonUI />
        </M.Box>
      </M.Paper>
      <BlockLimiterUI />
    </div>
  )
}
