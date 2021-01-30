// import * as Storage from '../../scripts/background/storage.js'
import * as i18n from '../../scripts/i18n.js'
import * as TextGenerate from '../../scripts/text-generate.js'
import {
  MyselfContext,
  BlockLimiterContext,
  UIContext,
  TwitterAPIClientContext,
} from './contexts.js'
import { startNewChainBlockSession } from '../../scripts/background/request-sender.js'
import {
  BlockLimiterUI,
  TwitterUserProfile,
  RBExpansionPanel,
  BigExecuteButton,
  PurposeSelectionUI,
} from './components.js'
import { TweetReactionChainBlockPageStatesContext, SessionOptionsContext } from './ui-states.js'

const M = MaterialUI

function TargetTweetUI(props: { tweet: Tweet }) {
  const {
    wantBlockRetweeters,
    setWantBlockRetweeters,
    wantBlockLikers,
    setWantBlockLikers,
    wantBlockMentionedUsers,
    setWantBlockMentionedUsers,
  } = React.useContext(TweetReactionChainBlockPageStatesContext)
  const { tweet } = props
  const mentions = tweet.entities.user_mentions || []
  const nobodyRetweeted = tweet.retweet_count <= 0
  const nobodyLiked = tweet.favorite_count <= 0
  const nobodyMentioned = mentions.length <= 0
  return (
    <TwitterUserProfile user={tweet.user}>
      <div className="profile-right-targettweet">
        <div>
          <span>트윗 내용:</span>
          <blockquote className="tweet-content">{tweet.full_text}</blockquote>
        </div>
        <M.FormGroup row>
          <M.FormControlLabel
            control={<M.Checkbox size="small" />}
            onChange={() => setWantBlockRetweeters(!wantBlockRetweeters)}
            checked={wantBlockRetweeters}
            disabled={nobodyRetweeted}
            label={`${i18n.getMessage('retweet')} (${tweet.retweet_count.toLocaleString()})`}
          />
          <M.FormControlLabel
            control={<M.Checkbox size="small" />}
            onChange={() => setWantBlockLikers(!wantBlockLikers)}
            checked={wantBlockLikers}
            disabled={nobodyLiked}
            label={`${i18n.getMessage('like')} (${tweet.favorite_count.toLocaleString()})`}
          />
          <M.FormControlLabel
            control={<M.Checkbox size="small" />}
            onChange={() => setWantBlockMentionedUsers(!wantBlockMentionedUsers)}
            checked={wantBlockMentionedUsers}
            disabled={nobodyMentioned}
            label={`${i18n.getMessage('mentioned')} (${mentions.length.toLocaleString()})`}
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
  const {
    currentTweet,
    wantBlockRetweeters,
    wantBlockLikers,
    wantBlockMentionedUsers,
    purpose,
  } = React.useContext(TweetReactionChainBlockPageStatesContext)
  const { sessionOptions } = React.useContext(SessionOptionsContext)
  const { openDialog } = React.useContext(UIContext)
  const uiContext = React.useContext(UIContext)
  const myself = React.useContext(MyselfContext)
  const limiterStatus = React.useContext(BlockLimiterContext)
  const { cookieOptions } = React.useContext(TwitterAPIClientContext)
  function isAvailable() {
    if (purpose.type === 'chainblock' && limiterStatus.remained <= 0) {
      return false
    }
    if (!(wantBlockRetweeters || wantBlockLikers || wantBlockMentionedUsers)) {
      return false
    }
    return true
  }
  function executeSession(purpose: TweetReactionBlockSessionRequest['purpose']) {
    if (!currentTweet) {
      // unreachable?
      throw new Error('트윗을 선택해주세요')
    }
    if (!myself) {
      uiContext.openSnackBar(i18n.getMessage('error_occured_check_login'))
      return
    }
    const request: TweetReactionBlockSessionRequest = {
      purpose,
      options: sessionOptions,
      target: {
        type: 'tweet_reaction',
        tweet: currentTweet,
        blockRetweeters: wantBlockRetweeters,
        blockLikers: wantBlockLikers,
        blockMentionedUsers: wantBlockMentionedUsers,
      },
      myself,
      cookieOptions,
    }
    openDialog({
      dialogType: 'confirm',
      message: TextGenerate.generateConfirmMessage(request),
      callbackOnOk() {
        startNewChainBlockSession<TweetReactionBlockSessionRequest>(request)
      },
    })
  }
  return (
    <M.Box>
      <BigExecuteButton
        {...{ purpose }}
        disabled={!isAvailable()}
        onClick={() => executeSession(purpose)}
      />
    </M.Box>
  )
}

export default function NewTweetReactionBlockPage() {
  return (
    <div>
      <TargetTweetOuterUI />
      <TargetOptionsUI />
      <BlockLimiterUI />
      <TargetExecutionButtonUI />
    </div>
  )
}
