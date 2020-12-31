// import * as Storage from '../../scripts/background/storage.js'
import * as i18n from '../../scripts/i18n.js'
import * as TextGenerate from '../../scripts/text-generate.js'
import { MyselfContext, BlockLimiterContext, UIContext } from './contexts.js'
import { startNewChainBlockSession } from '../../scripts/background/request-sender.js'
import {
  PleaseLoginBox,
  BlockLimiterUI,
  TwitterUserProfile,
  DenseExpansionPanel,
  BigExecuteChainBlockButton,
  BigExportButton,
  ChainBlockPurposeUI,
} from './components.js'
import {
  TweetReactionChainBlockPageStatesContext,
  PurposeContext,
  SessionOptionsContext,
} from './ui-states.js'

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
    <DenseExpansionPanel summary={targetSummary} defaultExpanded>
      <div style={{ width: '100%' }}>
        <M.FormControl component="fieldset" fullWidth>
          <TargetTweetUI tweet={currentTweet} />
        </M.FormControl>
      </div>
    </DenseExpansionPanel>
  )
}

function TargetOptionsUI() {
  const { purpose } = React.useContext(PurposeContext)
  const summary = `${i18n.getMessage('options')} (${i18n.getMessage(purpose)})`
  return (
    <DenseExpansionPanel summary={summary} defaultExpanded>
      <ChainBlockPurposeUI />
    </DenseExpansionPanel>
  )
}

function TargetExecutionButtonUI(props: { isAvailable: boolean }) {
  const { isAvailable } = props
  const {
    currentTweet,
    wantBlockRetweeters,
    wantBlockLikers,
    wantBlockMentionedUsers,
  } = React.useContext(TweetReactionChainBlockPageStatesContext)
  const { targetOptions } = React.useContext(SessionOptionsContext)
  const { purpose } = React.useContext(PurposeContext)
  const { openDialog } = React.useContext(UIContext)
  const uiContext = React.useContext(UIContext)
  const myself = React.useContext(MyselfContext)
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
      options: targetOptions,
      target: {
        type: 'tweet_reaction',
        tweet: currentTweet,
        blockRetweeters: wantBlockRetweeters,
        blockLikers: wantBlockLikers,
        blockMentionedUsers: wantBlockMentionedUsers,
      },
      myself,
    }
    openDialog({
      dialogType: 'confirm',
      message: TextGenerate.generateConfirmMessage(request),
      callbackOnOk() {
        startNewChainBlockSession<TweetReactionBlockSessionRequest>(request)
      },
    })
  }
  const blockButtonDisabled = !(
    isAvailable &&
    (wantBlockRetweeters || wantBlockLikers || wantBlockMentionedUsers)
  )
  const exportButtonDisabled = !(wantBlockRetweeters || wantBlockLikers || wantBlockMentionedUsers)
  let bigButton: React.ReactNode
  switch (purpose) {
    case 'chainblock':
      bigButton = (
        <BigExecuteChainBlockButton
          disabled={blockButtonDisabled}
          onClick={() => executeSession('chainblock')}
        >
          <span>
            {'\u{1f6d1}'} {i18n.getMessage('execute_chainblock')}
          </span>
        </BigExecuteChainBlockButton>
      )
      break
    case 'export':
      bigButton = (
        <BigExportButton disabled={exportButtonDisabled} onClick={() => executeSession('export')}>
          <span>
            {'\u{1f4be}'} {i18n.getMessage('export')}
          </span>
        </BigExportButton>
      )
      break
  }
  return <M.Box>{bigButton}</M.Box>
}

export default function NewTweetReactionBlockPage() {
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
  return (
    <div>
      <TargetTweetOuterUI />
      {myself ? (
        <div>
          <TargetOptionsUI />
          <BlockLimiterUI />
          <TargetExecutionButtonUI isAvailable={isAvailable()} />
        </div>
      ) : (
        <PleaseLoginBox />
      )}
    </div>
  )
}
