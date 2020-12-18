// import * as Storage from '../../scripts/background/storage.js'
import * as i18n from '../../scripts/i18n.js'
import { LoginStatusContext, BlockLimiterContext } from './contexts.js'
import { startTweetReactionChainBlock } from '../../scripts/background/request-sender.js'
import {
  PleaseLoginBox,
  BlockLimiterUI,
  TwitterUserProfile,
  DenseExpansionPanel,
} from './ui-common.js'

type SessionOptions = TweetReactionBlockSessionRequest['options']

const TargetTweetContext = React.createContext<{
  currentTweet: Tweet | null
  wantBlockRetweeters: boolean
  setWantBlockRetweeters: (b: boolean) => void
  wantBlockLikers: boolean
  setWantBlockLikers: (b: boolean) => void
  wantBlockMentionedUsers: boolean
  setWantBlockMentionedUsers: (b: boolean) => void
  targetOptions: SessionOptions
  setTargetOptions: (options: SessionOptions) => void
  mutateOptions: (optionsPart: Partial<SessionOptions>) => void
}>({
  currentTweet: null,
  wantBlockRetweeters: false,
  setWantBlockRetweeters: () => {},
  wantBlockLikers: false,
  setWantBlockLikers: () => {},
  wantBlockMentionedUsers: false,
  setWantBlockMentionedUsers: () => {},
  targetOptions: {
    myFollowers: 'Skip',
    myFollowings: 'Skip',
    includeUsersInBio: 'never',
  },
  setTargetOptions: () => {},
  mutateOptions: () => {},
})

const M = MaterialUI

const BigExecuteChainBlockButton = MaterialUI.withStyles(theme => ({
  root: {
    width: '100%',
    padding: '10px',
    fontSize: 'larger',
    backgroundColor: MaterialUI.colors.red[700],
    color: theme.palette.getContrastText(MaterialUI.colors.red[700]),
    '&:disabled': {
      opacity: '.5',
    },
    '&:hover': {
      backgroundColor: MaterialUI.colors.red[500],
      color: theme.palette.getContrastText(MaterialUI.colors.red[500]),
    },
  },
}))(MaterialUI.Button)

function TargetTweetUI(props: { tweet: Tweet }) {
  const {
    wantBlockRetweeters,
    setWantBlockRetweeters,
    wantBlockLikers,
    setWantBlockLikers,
    wantBlockMentionedUsers,
    setWantBlockMentionedUsers,
  } = React.useContext(TargetTweetContext)
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
  const { currentTweet } = React.useContext(TargetTweetContext)
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
  const { targetOptions, mutateOptions } = React.useContext(TargetTweetContext)
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
  return (
    <DenseExpansionPanel summary={i18n.getMessage('options')} defaultExpanded>
      <div style={{ width: '100%' }}>
        <TargetChainBlockOptionsUI />
        <div className="description">
          {i18n.getMessage('chainblock_description')}{' '}
          {i18n.getMessage('my_mutual_followers_wont_block')}
        </div>
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
    targetOptions,
  } = React.useContext(TargetTweetContext)
  function onExecuteChainBlockButtonClicked() {
    if (!currentTweet) {
      throw new Error('트윗을 선택해주세요')
    }
    const request: TweetReactionBlockSessionRequest = {
      purpose: 'chainblock',
      target: {
        type: 'tweet_reaction',
        tweet: currentTweet,
        blockRetweeters: wantBlockRetweeters,
        blockLikers: wantBlockLikers,
        blockMentionedUsers: wantBlockMentionedUsers,
      },
      options: targetOptions,
    }
    startTweetReactionChainBlock(request)
  }
  const blockButtonDisabled = !(
    isAvailable &&
    (wantBlockRetweeters || wantBlockLikers || wantBlockMentionedUsers)
  )
  return (
    <M.Box padding="10px">
      <BigExecuteChainBlockButton
        disabled={blockButtonDisabled}
        onClick={onExecuteChainBlockButtonClicked}
      >
        <span>
          {'\u{1f6d1}'} {i18n.getMessage('execute_chainblock')}
        </span>
      </BigExecuteChainBlockButton>
    </M.Box>
  )
}

export default function NewTweetReactionBlockPage(props: { currentTweet: Tweet | null }) {
  const { currentTweet } = props
  const { loggedIn } = React.useContext(LoginStatusContext)
  const limiterStatus = React.useContext(BlockLimiterContext)
  const [targetOptions, setTargetOptions] = React.useState<SessionOptions>({
    myFollowers: 'Skip',
    myFollowings: 'Skip',
    includeUsersInBio: 'never',
  })
  const [wantBlockRetweeters, setWantBlockRetweeters] = React.useState<boolean>(false)
  const [wantBlockLikers, setWantBlockLikers] = React.useState<boolean>(false)
  const [wantBlockMentionedUsers, setWantBlockMentionedUsers] = React.useState<boolean>(false)
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
  function mutateOptions(newOptionsPart: Partial<SessionOptions>) {
    const newOptions = { ...targetOptions, ...newOptionsPart }
    setTargetOptions(newOptions)
  }
  return (
    <div>
      <TargetTweetContext.Provider
        value={{
          currentTweet,
          wantBlockRetweeters,
          setWantBlockRetweeters,
          wantBlockLikers,
          setWantBlockLikers,
          wantBlockMentionedUsers,
          setWantBlockMentionedUsers,
          targetOptions,
          setTargetOptions,
          mutateOptions,
        }}
      >
        <div className="chainblock-target">
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
      </TargetTweetContext.Provider>
    </div>
  )
}
