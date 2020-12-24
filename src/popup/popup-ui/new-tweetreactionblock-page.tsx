// import * as Storage from '../../scripts/background/storage.js'
import * as i18n from '../../scripts/i18n.js'
import * as TextGenerate from '../../scripts/text-generate.js'
import { LoginStatusContext, BlockLimiterContext, DialogContext } from './contexts.js'
import { startTweetReactionChainBlock } from '../../scripts/background/request-sender.js'
import {
  TabPanel,
  PleaseLoginBox,
  BlockLimiterUI,
  TwitterUserProfile,
  DenseExpansionPanel,
} from './ui-common.js'
import { TweetReactionChainBlockPageStatesContext } from './ui-states.js'

const M = MaterialUI

const BigBaseButton = MaterialUI.withStyles(() => ({
  root: {
    width: '100%',
    padding: '10px',
    fontSize: 'larger',
  },
}))(MaterialUI.Button)

const BigExecuteChainBlockButton = MaterialUI.withStyles(theme => ({
  root: {
    backgroundColor: MaterialUI.colors.red[700],
    color: theme.palette.getContrastText(MaterialUI.colors.red[700]),
    '&:hover': {
      backgroundColor: MaterialUI.colors.red[500],
      color: theme.palette.getContrastText(MaterialUI.colors.red[500]),
    },
  },
}))(BigBaseButton)

const BigExportButton = MaterialUI.withStyles(theme => ({
  root: {
    backgroundColor: MaterialUI.colors.blueGrey[700],
    color: theme.palette.getContrastText(MaterialUI.colors.blueGrey[700]),
    '&:hover': {
      backgroundColor: MaterialUI.colors.blueGrey[500],
      color: theme.palette.getContrastText(MaterialUI.colors.blueGrey[500]),
    },
  },
}))(BigBaseButton)

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

function TargetChainBlockOptionsUI() {
  const { targetOptions, mutateOptions } = React.useContext(
    TweetReactionChainBlockPageStatesContext
  )
  const { myFollowers, myFollowings, includeUsersInBio } = targetOptions
  const userActions: Array<[UserAction, string]> = [
    ['Skip', i18n.getMessage('skip')],
    ['Mute', i18n.getMessage('do_mute')],
    ['Block', i18n.getMessage('do_block')],
  ]
  const bioBlockModes: Array<[BioBlockMode, string]> = [
    ['never', i18n.getMessage('bioblock_never')],
    ['all', i18n.getMessage('bioblock_all')],
    ['smart', i18n.getMessage('bioblock_smart')],
  ]
  return (
    <React.Fragment>
      <M.FormControl component="fieldset">
        <M.FormLabel component="legend">{i18n.getMessage('my_followers')}</M.FormLabel>
        <M.RadioGroup row>
          {userActions.map(([userAction, localizedAction], index) => (
            <M.FormControlLabel
              key={index}
              control={<M.Radio size="small" />}
              checked={myFollowers === userAction}
              onChange={() => mutateOptions({ myFollowers: userAction })}
              label={localizedAction}
            />
          ))}
        </M.RadioGroup>
      </M.FormControl>
      <br />
      <M.FormControl component="fieldset">
        <M.FormLabel component="legend">{i18n.getMessage('my_followings')}</M.FormLabel>
        <M.RadioGroup row>
          {userActions.map(([userAction, localizedAction], index) => (
            <M.FormControlLabel
              key={index}
              control={<M.Radio size="small" />}
              checked={myFollowings === userAction}
              onChange={() => mutateOptions({ myFollowings: userAction })}
              label={localizedAction}
            />
          ))}
        </M.RadioGroup>
      </M.FormControl>
      <br />
      <M.FormControl>
        <M.FormLabel component="legend">BioBlock &#x1F9EA;</M.FormLabel>
        <M.RadioGroup row>
          {bioBlockModes.map(([mode, localizedMode], index) => (
            <M.FormControlLabel
              key={index}
              control={<M.Radio size="small" />}
              checked={includeUsersInBio === mode}
              onChange={() => mutateOptions({ includeUsersInBio: mode })}
              label={localizedMode}
            />
          ))}
        </M.RadioGroup>
      </M.FormControl>
    </React.Fragment>
  )
}

function TargetOptionsUI() {
  const { purpose, setPurpose } = React.useContext(TweetReactionChainBlockPageStatesContext)
  const summary = `${i18n.getMessage('options')} (${i18n.getMessage(purpose)})`
  return (
    <DenseExpansionPanel summary={summary} defaultExpanded>
      <div style={{ width: '100%' }}>
        <M.Tabs value={purpose} onChange={(_ev, val) => setPurpose(val)}>
          <M.Tab value={'chainblock'} label={`\u{1f6d1} ${i18n.getMessage('chainblock')}`} />
          <M.Tab value={'export'} label={`\u{1f4be} ${i18n.getMessage('export')}`} />
        </M.Tabs>
        <M.Divider />
        <TabPanel value={purpose} index={'chainblock'}>
          <TargetChainBlockOptionsUI />
          <div className="description">
            {i18n.getMessage('chainblock_description')}{' '}
            {i18n.getMessage('my_mutual_followers_wont_block')}
          </div>
        </TabPanel>
        <TabPanel value={purpose} index={'export'}>
          <div className="description">{i18n.getMessage('export_tweetreaction_description')}</div>
        </TabPanel>
      </div>
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
    purpose,
    targetOptions,
  } = React.useContext(TweetReactionChainBlockPageStatesContext)
  const { openModal } = React.useContext(DialogContext)
  function executeSession(purpose: TweetReactionBlockSessionRequest['purpose']) {
    if (!currentTweet) {
      // unreachable?
      throw new Error('트윗을 선택해주세요')
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
    }
    openModal({
      dialogType: 'confirm',
      message: TextGenerate.generateTweetReactionBlockConfirmMessage(request),
      callbackOnOk() {
        startTweetReactionChainBlock(request)
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
  const { loggedIn } = React.useContext(LoginStatusContext)
  const limiterStatus = React.useContext(BlockLimiterContext)
  const availableBlocks = React.useMemo((): number => {
    return limiterStatus.max - limiterStatus.current
  }, [limiterStatus])
  const isAvailable = React.useMemo((): boolean => {
    if (!loggedIn) {
      return false
    }
    if (availableBlocks <= 0) {
      return false
    }
    return true
  }, [loggedIn, availableBlocks])
  return (
    <div>
      <TargetTweetOuterUI />
      {loggedIn ? (
        <div>
          <TargetOptionsUI />
          {availableBlocks <= 0 ? <BlockLimiterUI status={limiterStatus} /> : ''}
          <TargetExecutionButtonUI isAvailable={isAvailable} />
        </div>
      ) : (
        <PleaseLoginBox />
      )}
    </div>
  )
}
