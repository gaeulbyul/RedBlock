// import * as Storage from '../../scripts/background/storage.js'
import * as i18n from '../../scripts/i18n.js'
import { startTweetReactionChainBlock } from '../popup.js'

type SessionOptions = TweetReactionBlockSessionRequest['options']

const TargetTweetContext = React.createContext<{
  currentTweet: Tweet | null
  wantBlockRetweeters: boolean
  setWantBlockRetweeters: (b: boolean) => void
  wantBlockLikers: boolean
  setWantBlockLikers: (b: boolean) => void
  targetOptions: SessionOptions
  setTargetOptions: (options: SessionOptions) => void
  mutateOptions: (optionsPart: Partial<SessionOptions>) => void
}>({
  currentTweet: null,
  wantBlockRetweeters: false,
  setWantBlockRetweeters: () => {},
  wantBlockLikers: false,
  setWantBlockLikers: () => {},
  targetOptions: {
    myFollowers: 'Skip',
    myFollowings: 'Skip',
  },
  setTargetOptions: () => {},
  mutateOptions: () => {},
})

const M = MaterialUI
const T = MaterialUI.Typography

const useStylesForExpansionPanels = MaterialUI.makeStyles(() =>
  MaterialUI.createStyles({
    details: {
      padding: '8px 16px',
    },
  })
)

const DenseExpansionPanelSummary = MaterialUI.withStyles({
  root: {
    minHeight: 16,
    '&$expanded': {
      minHeight: 16,
    },
  },
  content: {
    '&$expanded': {
      margin: 0,
    },
  },
  expanded: {},
})(MaterialUI.ExpansionPanelSummary)

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
  const { wantBlockRetweeters, setWantBlockRetweeters, wantBlockLikers, setWantBlockLikers } = React.useContext(
    TargetTweetContext
  )
  const { tweet } = props
  const user = tweet.user
  const biggerProfileImageUrl = user.profile_image_url_https.replace('_normal', '_bigger')
  const nobodyRetweeted = tweet.retweet_count <= 0
  const nobodyLiked = tweet.favorite_count <= 0
  return (
    <div className="target-user-info">
      <div className="profile-image-area">
        <img alt={i18n.getMessage('profile_image')} className="profile-image" src={biggerProfileImageUrl} />
      </div>
      <div className="profile-right-area">
        <div className="profile-right-info">
          <div className="nickname" title={user.name}>
            {user.name}
          </div>
          <div className="username">
            <a
              target="_blank"
              rel="noopener noreferer"
              href={`https://twitter.com/${user.screen_name}`}
              title={i18n.getMessage('go_to_url', `https://twitter.com/${user.screen_name}`)}
            >
              @{user.screen_name}
            </a>
          </div>
        </div>
        <div className="profile-right-targettweet">
          <div>
            <small>{tweet.text}</small>
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
          </M.FormGroup>
        </div>
      </div>
    </div>
  )
}

function TargetTweetOuterUI() {
  const { currentTweet } = React.useContext(TargetTweetContext)
  if (!currentTweet) {
    throw new Error()
  }
  const classes = useStylesForExpansionPanels()
  const userName = currentTweet.user.screen_name
  const targetSummary = `(${i18n.getMessage('reacted_xxxs_tweet', userName)})`
  return (
    <M.ExpansionPanel defaultExpanded>
      <DenseExpansionPanelSummary expandIcon={<M.Icon>expand_more</M.Icon>}>
        <T>
          {i18n.getMessage('target')} {targetSummary}
        </T>
      </DenseExpansionPanelSummary>
      <M.ExpansionPanelDetails className={classes.details}>
        <div style={{ width: '100%' }}>
          <M.FormControl component="fieldset" fullWidth>
            <TargetTweetUI tweet={currentTweet} />
          </M.FormControl>
        </div>
      </M.ExpansionPanelDetails>
    </M.ExpansionPanel>
  )
}

function TargetChainBlockOptionsUI() {
  const { targetOptions, mutateOptions } = React.useContext(TargetTweetContext)
  const { myFollowers, myFollowings } = targetOptions
  const verbs: Array<[Verb, string]> = [
    ['Skip', i18n.getMessage('skip')],
    ['Mute', i18n.getMessage('do_mute')],
    ['Block', i18n.getMessage('do_block')],
  ]
  return (
    <React.Fragment>
      <M.FormControl component="fieldset">
        <M.FormLabel component="legend">{i18n.getMessage('my_followers')}</M.FormLabel>
        <M.RadioGroup row>
          {verbs.map(([verb, vKor], index) => (
            <M.FormControlLabel
              key={index}
              control={<M.Radio size="small" />}
              checked={myFollowers === verb}
              onChange={() => mutateOptions({ myFollowers: verb })}
              label={vKor}
            />
          ))}
        </M.RadioGroup>
      </M.FormControl>
      <br />
      <M.FormControl component="fieldset">
        <M.FormLabel component="legend">{i18n.getMessage('my_followings')}</M.FormLabel>
        <M.RadioGroup row>
          {verbs.map(([verb, vKor], index) => (
            <M.FormControlLabel
              key={index}
              control={<M.Radio size="small" />}
              checked={myFollowings === verb}
              onChange={() => mutateOptions({ myFollowings: verb })}
              label={vKor}
            />
          ))}
        </M.RadioGroup>
      </M.FormControl>
    </React.Fragment>
  )
}

function TargetOptionsUI() {
  const classes = useStylesForExpansionPanels()
  return (
    <M.ExpansionPanel defaultExpanded>
      <DenseExpansionPanelSummary expandIcon={<M.Icon>expand_more</M.Icon>}>
        <T>{i18n.getMessage('options')}</T>
      </DenseExpansionPanelSummary>
      <M.ExpansionPanelDetails className={classes.details}>
        <div style={{ width: '100%' }}>
          <TargetChainBlockOptionsUI />
          <div className="description">
            {i18n.getMessage('chainblock_description')} {i18n.getMessage('my_mutual_followers_wont_block')}
          </div>
        </div>
      </M.ExpansionPanelDetails>
    </M.ExpansionPanel>
  )
}

function TargetExecutionButtonUI() {
  const { currentTweet, wantBlockRetweeters, wantBlockLikers, targetOptions } = React.useContext(TargetTweetContext)
  function onExecuteChainBlockButtonClicked() {
    if (!currentTweet) {
      throw new Error('트윗을 선택해주세요')
    }
    const request: TweetReactionBlockSessionRequest = {
      purpose: 'chainblock',
      target: {
        type: 'tweetReaction',
        tweet: currentTweet,
        blockRetweeters: wantBlockRetweeters,
        blockLikers: wantBlockLikers,
      },
      options: targetOptions,
    }
    startTweetReactionChainBlock(request)
  }
  const blockButtonDisabled = !(wantBlockRetweeters || wantBlockLikers)
  return (
    <M.Box padding="10px">
      <BigExecuteChainBlockButton disabled={blockButtonDisabled} onClick={onExecuteChainBlockButtonClicked}>
        <span>
          {'\u{1f6d1}'} {i18n.getMessage('execute_chainblock')}
        </span>
      </BigExecuteChainBlockButton>
    </M.Box>
  )
}

export default function NewTweetReactionBlockPage(props: { currentTweet: Tweet | null }) {
  const { currentTweet } = props
  const [targetOptions, setTargetOptions] = React.useState<SessionOptions>({
    myFollowers: 'Skip',
    myFollowings: 'Skip',
  })
  // const [targetReaction, setTargetReaction] = React.useState<ReactionKind>('retweeted')
  const [wantBlockRetweeters, setWantBlockRetweeters] = React.useState<boolean>(false)
  const [wantBlockLikers, setWantBlockLikers] = React.useState<boolean>(false)

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
          targetOptions,
          setTargetOptions,
          mutateOptions,
        }}
      >
        <div className="chainblock-target">
          <TargetTweetOuterUI />
          <TargetOptionsUI />
          <TargetExecutionButtonUI />
        </div>
      </TargetTweetContext.Provider>
    </div>
  )
}
