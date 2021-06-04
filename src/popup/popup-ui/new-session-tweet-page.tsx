import * as TextGenerate from '../../scripts/text-generate.js'
import {
  UIContext,
  MyselfContext,
  RetrieverContext,
  BlockLimiterContext,
  RedBlockOptionsContext,
} from './contexts.js'
import { startNewChainBlockSession } from '../../scripts/background/request-sender.js'
import {
  BlockLimiterUI,
  TwitterUserProfile,
  RBExpansionPanel,
  BigExecuteButton,
  PurposeSelectionUI,
  RequestCheckResultUI,
} from './components.js'
import { TweetReactionChainBlockPageStatesContext, ExtraTargetContext } from './ui-states.js'
import { TargetCheckResult, validateRequest } from '../../scripts/background/target-checker.js'
import { findNonLinkedMentionsFromTweet } from '../../scripts/common.js'

const M = MaterialUI

// 트윗을 실제 트위터에서 보이는대로 잘라줌
function showTextLikeTwitter({ full_text, display_text_range: [start, end] }: Tweet): string {
  return Array.from(full_text).slice(start, end).join('')
}

function useSessionRequest(): SessionRequest<TweetReactionSessionTarget> {
  const {
    purpose,
    currentTweet,
    includeRetweeters,
    includeLikers,
    includeMentionedUsers,
    includeQuotedUsers,
    includeNonLinkedMentions,
  } = React.useContext(TweetReactionChainBlockPageStatesContext)
  const { extraTarget } = React.useContext(ExtraTargetContext)
  const myself = React.useContext(MyselfContext)!
  const { retriever } = React.useContext(RetrieverContext)!
  const options = React.useContext(RedBlockOptionsContext)
  return {
    purpose,
    options,
    extraTarget,
    target: {
      type: 'tweet_reaction',
      tweet: currentTweet!,
      includeRetweeters,
      includeLikers,
      includeMentionedUsers,
      includeQuotedUsers,
      includeNonLinkedMentions,
    },
    retriever,
    executor: myself,
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
  const {
    purpose,
    changePurposeType,
    mutatePurposeOptions,
    availablePurposeTypes,
  } = React.useContext(TweetReactionChainBlockPageStatesContext)
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
  const { openDialog } = React.useContext(UIContext)
  const limiterStatus = React.useContext(BlockLimiterContext)
  const request = useSessionRequest()
  function isAvailable() {
    if (purpose.type === 'chainblock' && limiterStatus.remained <= 0) {
      return false
    }
    return validateRequest(request) === TargetCheckResult.Ok
  }
  function executeSession() {
    openDialog({
      dialogType: 'confirm',
      message: TextGenerate.generateConfirmMessage(request),
      callbackOnOk() {
        startNewChainBlockSession<TweetReactionSessionTarget>(request)
      },
    })
  }
  return (
    <M.Box>
      <BigExecuteButton {...{ purpose }} disabled={!isAvailable()} onClick={executeSession} />
    </M.Box>
  )
}

export default function NewSessionTweetPage() {
  const request = useSessionRequest()
  return (
    <div>
      <TargetTweetOuterUI />
      <TargetOptionsUI />
      <BlockLimiterUI />
      <RequestCheckResultUI {...{ request }} />
      <TargetExecutionButtonUI />
    </div>
  )
}
