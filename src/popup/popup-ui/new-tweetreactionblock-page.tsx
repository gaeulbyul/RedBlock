// import * as Storage from '../../scripts/background/storage.js'
import * as TwitterAPI from '../../scripts/background/twitter-api.js'
import * as i18n from '../../scripts/i18n.js'
import * as TextGenerate from '../../scripts/text-generate.js'
import { getReactionsCount } from '../../scripts/common.js'
import { startTweetReactionChainBlock } from '../popup.js'
import { DialogContext } from './contexts.js'

type Tweet = TwitterAPI.Tweet
type SessionOptions = TweetReactionBlockSessionRequest['options']

const TargetTweetContext = React.createContext<{
  currentTweet: Tweet | null
  targetReaction: ReactionKind
  setTargetReaction: (rk: ReactionKind) => void
  targetOptions: SessionOptions
  setTargetOptions: (options: SessionOptions) => void
  mutateOptions: (optionsPart: Partial<SessionOptions>) => void
}>({
  currentTweet: null,
  targetReaction: 'retweeted',
  setTargetReaction: () => {},
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

const BigExecuteChainBlockButton = MaterialUI.withStyles((theme) => ({
  root: {
    width: '100%',
    padding: '10px',
    fontSize: 'larger',
    backgroundColor: MaterialUI.colors.red[700],
    color: theme.palette.getContrastText(MaterialUI.colors.red[700]),
    '&:hover': {
      backgroundColor: MaterialUI.colors.red[500],
      color: theme.palette.getContrastText(MaterialUI.colors.red[500]),
    },
  },
}))(MaterialUI.Button)

function TargetTweetUI(props: { tweet: Tweet }) {
  const { targetReaction, setTargetReaction } = React.useContext(TargetTweetContext)
  const { tweet } = props
  const user = tweet.user
  const biggerProfileImageUrl = user.profile_image_url_https.replace('_normal', '_bigger')
  function radio(rk: ReactionKind, label: string) {
    return (
      <M.FormControlLabel
        control={<M.Radio size="small" />}
        onChange={() => setTargetReaction(rk)}
        checked={targetReaction === rk}
        label={label}
      />
    )
  }
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
          <M.RadioGroup row>
            {radio('retweeted', i18n.getMessage('retweet'))}
            {radio('liked', i18n.getMessage('like'))}
          </M.RadioGroup>
          <div className="description">{i18n.getMessage('not_all_reaction')}</div>
        </div>
      </div>
    </div>
  )
}

function TargetTweetEmptyUI() {
  let message = i18n.getMessage('goto_tweet_url')
  return <div>{message}</div>
}

function TargetTweetOuterUI() {
  const { currentTweet, targetReaction } = React.useContext(TargetTweetContext)
  const classes = useStylesForExpansionPanels()
  let targetSummary = ''
  if (currentTweet) {
    const userName = currentTweet.user.screen_name
    switch (targetReaction) {
      case 'retweeted':
        targetSummary = i18n.getMessage('retweeted_xxxs_tweet', userName)
        break
      case 'liked':
        targetSummary = i18n.getMessage('liked_xxxs_tweet', userName)
        break
    }
    targetSummary = `(${targetSummary})`
  }
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
            {currentTweet ? <TargetTweetUI tweet={currentTweet} /> : <TargetTweetEmptyUI />}
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
  const { currentTweet, targetReaction, targetOptions } = React.useContext(TargetTweetContext)
  const { openModal } = React.useContext(DialogContext)
  function onExecuteChainBlockButtonClicked() {
    if (!currentTweet) {
      throw new Error('트윗을 선택해주세요')
    }
    const request: TweetReactionBlockSessionRequest = {
      purpose: 'chainblock',
      target: {
        type: 'tweetReaction',
        tweet: currentTweet,
        reaction: targetReaction,
        count: getReactionsCount(currentTweet, targetReaction),
      },
      options: targetOptions,
    }
    openModal({
      dialogType: 'confirm',
      message: TextGenerate.generateTweetReactionBlockMessage(request),
      callback() {
        startTweetReactionChainBlock(request)
      },
    })
  }
  return (
    <M.Box padding="10px">
      <BigExecuteChainBlockButton disabled={!currentTweet} onClick={onExecuteChainBlockButtonClicked}>
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
  const [targetReaction, setTargetReaction] = React.useState<ReactionKind>('retweeted')
  function mutateOptions(newOptionsPart: Partial<SessionOptions>) {
    const newOptions = { ...targetOptions, ...newOptionsPart }
    setTargetOptions(newOptions)
  }
  return (
    <div>
      <TargetTweetContext.Provider
        value={{
          currentTweet,
          targetReaction,
          setTargetReaction,
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
