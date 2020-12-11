import * as Storage from '../../scripts/background/storage.js'
import * as TwitterAPI from '../../scripts/background/twitter-api.js'
import { TwitterUser } from '../../scripts/background/twitter-api.js'
import { TwitterUserMap } from '../../scripts/common.js'
import * as i18n from '../../scripts/i18n.js'
import {
  insertUserToStorage,
  removeUserFromStorage,
  startFollowerChainBlock,
  refreshSavedUsers,
} from '../../scripts/background/request-sender.js'
import {
  DialogContext,
  SnackBarContext,
  LoginStatusContext,
  BlockLimiterContext,
} from './contexts.js'
import { TabPanel, PleaseLoginBox, BlockLimiterUI } from './ui-common.js'

const M = MaterialUI
const T = MaterialUI.Typography

type SessionOptions = FollowerBlockSessionRequest['options']
type SelectUserGroup = 'invalid' | 'current' | 'saved'

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

// const SelectedUserContext = React.createContext<TwitterUser | null>(null)
const TargetUserContext = React.createContext<{
  currentUser: TwitterUser | null
  selectedUser: TwitterUser | null
  setSelectedUser: (maybeUser: TwitterUser | null) => void
  targetList: FollowKind
  setTargetList: (fk: FollowKind) => void
  targetOptions: SessionOptions
  setTargetOptions: (options: SessionOptions) => void
  mutateOptions: (optionsPart: Partial<SessionOptions>) => void
  purpose: Purpose
  setPurpose: (ck: Purpose) => void
}>({
  currentUser: null,
  selectedUser: null,
  setSelectedUser: () => {},
  targetList: 'followers',
  setTargetList: () => {},
  targetOptions: {
    myFollowers: 'Skip',
    myFollowings: 'Skip',
    mutualBlocked: 'Skip',
    includeUsersInBio: 'never',
  },
  setTargetOptions: () => {},
  mutateOptions: () => {},
  purpose: 'chainblock',
  setPurpose: () => {},
})

function TargetSavedUsers(props: {
  currentUser: TwitterUser | null
  selectedUserGroup: SelectUserGroup
  savedUsers: TwitterUserMap
  changeUser: (userId: string, userName: string, group: SelectUserGroup) => Promise<void>
}) {
  const { currentUser, selectedUserGroup, savedUsers, changeUser } = props
  const snackBarCtx = React.useContext(SnackBarContext)
  const { selectedUser } = React.useContext(TargetUserContext)
  async function insertUser() {
    if (selectedUser) {
      insertUserToStorage(selectedUser)
      snackBarCtx.snack(i18n.getMessage('user_xxx_added', selectedUser.screen_name))
    }
  }
  async function removeUser() {
    if (selectedUser) {
      removeUserFromStorage(selectedUser)
      snackBarCtx.snack(i18n.getMessage('user_xxx_removed', selectedUser.screen_name))
    }
  }
  async function requestRefreshSavedUsers() {
    refreshSavedUsers()
    snackBarCtx.snack(i18n.getMessage('refreshing_saved_users'))
  }
  const sortedByName = (usersMap: TwitterUserMap): TwitterUser[] =>
    _.sortBy(usersMap.toUserArray(), user => user.screen_name.toLowerCase())
  const selectUserFromOption = (elem: EventTarget) => {
    if (!(elem instanceof HTMLSelectElement)) {
      throw new Error('unreachable')
    }
    const selectedOption = elem.selectedOptions[0]
    const group = selectedOption.getAttribute('data-group') as SelectUserGroup
    const userId = selectedOption.getAttribute('data-userid')!
    const userName = selectedOption.getAttribute('data-username')!
    changeUser(userId, userName, group)
  }
  const currentUserOption = ({ id_str, screen_name, name }: TwitterUser) => (
    <optgroup label={i18n.getMessage('current_user')}>
      <option
        value={`current/${id_str}`}
        data-group="current"
        data-userid={id_str}
        data-username={screen_name}
      >
        @{screen_name} &lt;{name}&gt;
      </option>
    </optgroup>
  )
  return (
    <div style={{ width: '100%' }}>
      <M.FormControl fullWidth>
        <M.InputLabel shrink htmlFor="target-user-select">
          {i18n.getMessage('select_user')}:
        </M.InputLabel>
        <M.Select
          native
          id="target-user-select"
          fullWidth
          value={selectedUser ? `${selectedUserGroup}/${selectedUser.id_str}` : 'invalid/???'}
          onChange={({ target }) => selectUserFromOption(target)}
        >
          <option value="invalid/???" data-group="invalid" data-userid="???" data-username="???">
            {i18n.getMessage('user_not_selected')}
          </option>
          {currentUser && currentUserOption(currentUser)}
          <optgroup label={i18n.getMessage('saved_user')}>
            {sortedByName(savedUsers).map(({ id_str, screen_name, name }, index) => (
              <option
                key={index}
                value={'saved/' + id_str}
                data-group="saved"
                data-userid={id_str}
                data-username={screen_name}
              >
                @{screen_name} &lt;{name}&gt;
              </option>
            ))}
          </optgroup>
        </M.Select>
      </M.FormControl>
      {selectedUser && (
        <M.Box margin="10px 0" display="flex" flexDirection="row-reverse">
          <M.ButtonGroup>
            <M.Button
              disabled={selectedUserGroup !== 'current'}
              onClick={insertUser}
              startIcon={<M.Icon>add_circle</M.Icon>}
            >
              {i18n.getMessage('add')}
            </M.Button>
            <M.Button
              disabled={selectedUserGroup !== 'saved'}
              onClick={removeUser}
              startIcon={<M.Icon>delete</M.Icon>}
            >
              {i18n.getMessage('remove')}
            </M.Button>
            <M.Button onClick={requestRefreshSavedUsers} startIcon={<M.Icon>refresh</M.Icon>}>
              {i18n.getMessage('refresh')}
            </M.Button>
          </M.ButtonGroup>
        </M.Box>
      )}
    </div>
  )
}

function TargetUserProfile(props: { isAvailable: boolean }) {
  const { isAvailable } = props
  const { selectedUser, targetList, setTargetList } = React.useContext(TargetUserContext)
  // selectedUser가 null일 땐 이 컴포넌트를 렌더링하지 않으므로
  const user = selectedUser!
  const biggerProfileImageUrl = user.profile_image_url_https.replace('_normal', '_bigger')
  function radio(fk: FollowKind, label: string) {
    return (
      <M.FormControlLabel
        control={<M.Radio size="small" />}
        onChange={() => setTargetList(fk)}
        disabled={!isAvailable}
        checked={targetList === fk}
        label={label}
      />
    )
  }
  return (
    <div className="target-user-info">
      <div className="profile-image-area">
        <img
          alt={i18n.getMessage('profile_image')}
          className="profile-image"
          src={biggerProfileImageUrl}
        />
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
        {isAvailable || (
          <div className="profile-blocked">
            {user.protected && `\u{1f512} ${i18n.getMessage('cant_chainblock_to_protected')}`}
          </div>
        )}
        <div className="profile-right-targetlist">
          <M.RadioGroup row>
            {radio('followers', i18n.formatFollowsCount('followers', user.followers_count))}
            {radio('friends', i18n.formatFollowsCount('friends', user.friends_count))}
            {radio('mutual-followers', i18n.getMessage('mutual_followers'))}
          </M.RadioGroup>
        </div>
      </div>
    </div>
  )
}

const useStylesForCircularProgress = MaterialUI.makeStyles(() =>
  MaterialUI.createStyles({
    center: {
      margin: '10px auto',
    },
  })
)
function TargetUserProfileEmpty(props: { reason: 'invalid-user' | 'loading' }) {
  const classes = useStylesForCircularProgress()
  let message = ''
  if (props.reason === 'loading') {
    return <M.CircularProgress className={classes.center} color="secondary" />
  }
  return <div>{message}</div>
}

function TargetChainBlockOptionsUI() {
  const { targetOptions, mutateOptions } = React.useContext(TargetUserContext)
  const { myFollowers, myFollowings, includeUsersInBio } = targetOptions
  const userActions: Array<[UserAction, string]> = [
    ['Skip', i18n.getMessage('skip')],
    ['Mute', i18n.getMessage('do_mute')],
    ['Block', i18n.getMessage('do_block')],
  ]
  // L10N-ME
  const bioBlockModes: Array<[BioBlockMode, string]> = [
    ['never', '사용안함'],
    ['all', '사용'],
    ['smart', '스마트모드'],
  ]
  return (
    <React.Fragment>
      <M.FormControl component="fieldset">
        <M.FormLabel component="legend">{i18n.getMessage('my_followers')}</M.FormLabel>
        <M.RadioGroup row>
          {userActions.map(([action, localizedAction], index) => (
            <M.FormControlLabel
              key={index}
              control={<M.Radio size="small" />}
              checked={myFollowers === action}
              onChange={() => mutateOptions({ myFollowers: action })}
              label={localizedAction}
            />
          ))}
        </M.RadioGroup>
      </M.FormControl>
      <br />
      <M.FormControl component="fieldset">
        <M.FormLabel component="legend">{i18n.getMessage('my_followings')}</M.FormLabel>
        <M.RadioGroup row>
          {userActions.map(([action, localizedAction], index) => (
            <M.FormControlLabel
              key={index}
              control={<M.Radio size="small" />}
              checked={myFollowings === action}
              onChange={() => mutateOptions({ myFollowings: action })}
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

function TargetUserSelectUI(props: { isAvailable: boolean }) {
  const { isAvailable } = props
  const { currentUser, targetList, selectedUser, setSelectedUser } = React.useContext(
    TargetUserContext
  )
  const { openModal } = React.useContext(DialogContext)
  const [savedUsers, setSavedUsers] = React.useState(new TwitterUserMap())
  const [selectedUserGroup, selectUserGroup] = React.useState<SelectUserGroup>('current')
  const [isLoading, setLoadingState] = React.useState(false)
  async function changeUser(userId: string, userName: string, group: SelectUserGroup) {
    if (!/^\d+$/.test(userId)) {
      setSelectedUser(null)
      selectUserGroup('invalid')
      return
    }
    try {
      setLoadingState(true)
      const newUser = await getUserByIdWithCache(userId).catch(() => null)
      if (newUser) {
        setSelectedUser(newUser)
        selectUserGroup(group)
      } else {
        openModal({
          dialogType: 'alert',
          message: {
            title: i18n.getMessage('failed_to_get_user_info', userName),
          },
          callbackOnOk() {},
          callbackOnCancel() {},
        })
        setSelectedUser(null)
        selectUserGroup('invalid')
      }
    } finally {
      setLoadingState(false)
    }
  }
  React.useEffect(() => {
    Storage.loadUsers().then(setSavedUsers)
    return Storage.onStorageChanged('savedUsers', async users => {
      const usersMap = TwitterUserMap.fromUsersArray(users)
      setSavedUsers(usersMap)
      if (!(selectedUser && usersMap.hasUser(selectedUser))) {
        setSelectedUser(currentUser)
        selectUserGroup('current')
      }
    })
  }, [])
  const classes = useStylesForExpansionPanels()
  let targetSummary = ''
  if (selectedUser) {
    const userName = selectedUser.screen_name
    switch (targetList) {
      case 'followers':
        targetSummary = i18n.getMessage('followers_with_targets_name', userName)
        break
      case 'friends':
        targetSummary = i18n.getMessage('followings_with_targets_name', userName)
        break
      case 'mutual-followers':
        targetSummary = i18n.getMessage('mutual_followers_with_targets_name', userName)
        break
    }
  }
  return (
    <M.ExpansionPanel defaultExpanded>
      <DenseExpansionPanelSummary expandIcon={<M.Icon>expand_more</M.Icon>}>
        <T>
          {i18n.getMessage('target')} ({targetSummary})
        </T>
      </DenseExpansionPanelSummary>
      <M.ExpansionPanelDetails className={classes.details}>
        <div style={{ width: '100%' }}>
          <M.FormControl component="fieldset" fullWidth>
            <TargetSavedUsers
              currentUser={currentUser}
              selectedUserGroup={selectedUserGroup}
              savedUsers={savedUsers}
              changeUser={changeUser}
            />
            <M.Divider />
            {isLoading ? (
              <TargetUserProfileEmpty reason="loading" />
            ) : selectedUser ? (
              <TargetUserProfile isAvailable={isAvailable} />
            ) : (
              <TargetUserProfileEmpty reason="invalid-user" />
            )}
          </M.FormControl>
        </div>
      </M.ExpansionPanelDetails>
    </M.ExpansionPanel>
  )
}

function TargetOptionsUI() {
  const { purpose, setPurpose } = React.useContext(TargetUserContext)
  const classes = useStylesForExpansionPanels()
  const cautionOnMassiveBlock = i18n.getMessage('wtf_twitter')
  return (
    <M.ExpansionPanel defaultExpanded>
      <DenseExpansionPanelSummary expandIcon={<M.Icon>expand_more</M.Icon>}>
        <T>
          {i18n.getMessage('options')} ({i18n.getMessage(purpose)})
        </T>
      </DenseExpansionPanelSummary>
      <M.ExpansionPanelDetails className={classes.details}>
        <div style={{ width: '100%' }}>
          <M.Tabs value={purpose} onChange={(_ev, val) => setPurpose(val)}>
            <M.Tab value={'chainblock'} label={`\u{1f6d1} ${i18n.getMessage('chainblock')}`} />
            <M.Tab value={'unchainblock'} label={`\u{1f49a} ${i18n.getMessage('unchainblock')}`} />
          </M.Tabs>
          <M.Divider />
          <TabPanel value={purpose} index={'chainblock'}>
            <TargetChainBlockOptionsUI />
            <M.Divider />
            <div className="description">
              {i18n.getMessage('chainblock_description')}{' '}
              {i18n.getMessage('my_mutual_followers_wont_block')}
              <div className="wtf">{cautionOnMassiveBlock}</div>
            </div>
          </TabPanel>
          <TabPanel value={purpose} index={'unchainblock'}>
            <TargetUnChainBlockOptionsUI />
            <div className="description">{i18n.getMessage('unchainblock_description')}</div>
          </TabPanel>
        </div>
      </M.ExpansionPanelDetails>
    </M.ExpansionPanel>
  )
}

function TargetUnChainBlockOptionsUI() {
  // const { options, mutateOptions } = props
  const { targetOptions, mutateOptions } = React.useContext(TargetUserContext)
  const { mutualBlocked } = targetOptions
  const userActions: Array<[UserAction, string]> = [
    ['Skip', i18n.getMessage('skip')],
    ['UnBlock', i18n.getMessage('do_unblock')],
  ]
  return (
    <React.Fragment>
      <M.FormControl component="fieldset">
        <M.FormLabel component="legend">{i18n.getMessage('mutually_blocked')}</M.FormLabel>
        <M.RadioGroup row>
          {userActions.map(([action, localizedAction], index) => (
            <M.FormControlLabel
              key={index}
              control={<M.Radio size="small" />}
              checked={mutualBlocked === action}
              onChange={() => mutateOptions({ mutualBlocked: action })}
              label={localizedAction}
            />
          ))}
        </M.RadioGroup>
      </M.FormControl>
    </React.Fragment>
  )
}

function TargetExecutionButtonUI(props: { isAvailable: boolean }) {
  const { isAvailable } = props
  const { purpose, selectedUser, targetList, targetOptions } = React.useContext(TargetUserContext)
  function onExecuteChainBlockButtonClicked() {
    const request: FollowerBlockSessionRequest = {
      purpose: 'chainblock',
      target: {
        type: 'follower',
        user: selectedUser!,
        list: targetList,
      },
      options: targetOptions,
    }
    startFollowerChainBlock(request)
  }
  function onExecuteUnChainBlockButtonClicked() {
    const request: FollowerBlockSessionRequest = {
      purpose: 'unchainblock',
      target: {
        type: 'follower',
        user: selectedUser!,
        list: targetList,
      },
      options: targetOptions,
    }
    startFollowerChainBlock(request)
  }
  return (
    <M.Box padding="10px">
      {purpose === 'chainblock' && (
        <BigExecuteChainBlockButton
          disabled={!isAvailable}
          onClick={onExecuteChainBlockButtonClicked}
        >
          <span>
            {'\u{1f6d1}'} {i18n.getMessage('execute_chainblock')}
          </span>
        </BigExecuteChainBlockButton>
      )}
      {purpose === 'unchainblock' && (
        <BigExecuteUnChainBlockButton
          disabled={!isAvailable}
          onClick={onExecuteUnChainBlockButtonClicked}
        >
          <span>
            {'\u{1f49a}'} {i18n.getMessage('execute_unchainblock')}
          </span>
        </BigExecuteUnChainBlockButton>
      )}
    </M.Box>
  )
}

const userCache = new TwitterUserMap()
async function getUserByIdWithCache(userId: string): Promise<TwitterUser> {
  if (userCache.has(userId)) {
    return userCache.get(userId)!
  }
  const user = await TwitterAPI.getSingleUserById(userId)
  userCache.addUser(user)
  return user
}

const BigExecuteChainBlockButton = MaterialUI.withStyles(theme => ({
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
const BigExecuteUnChainBlockButton = MaterialUI.withStyles(theme => ({
  root: {
    width: '100%',
    padding: '10px',
    fontSize: 'larger',
    backgroundColor: MaterialUI.colors.green[700],
    color: theme.palette.getContrastText(MaterialUI.colors.green[700]),
    '&:hover': {
      backgroundColor: MaterialUI.colors.green[500],
      color: theme.palette.getContrastText(MaterialUI.colors.green[500]),
    },
  },
}))(MaterialUI.Button)

export default function NewChainBlockPage(props: { currentUser: TwitterUser | null }) {
  const { currentUser } = props
  const { loggedIn } = React.useContext(LoginStatusContext)
  const limiterStatus = React.useContext(BlockLimiterContext)
  const [targetOptions, setTargetOptions] = React.useState<SessionOptions>({
    myFollowers: 'Skip',
    myFollowings: 'Skip',
    mutualBlocked: 'Skip',
    includeUsersInBio: 'never',
  })
  const [selectedUser, setSelectedUser] = React.useState<TwitterUser | null>(currentUser)
  const [targetList, setTargetList] = React.useState<FollowKind>('followers')
  const firstMode = selectedUser && selectedUser.following ? 'unchainblock' : 'chainblock'
  const [purpose, setPurpose] = React.useState<Purpose>(firstMode)
  function mutateOptions(newOptionsPart: Partial<SessionOptions>) {
    const newOptions = { ...targetOptions, ...newOptionsPart }
    setTargetOptions(newOptions)
  }
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
    if (!selectedUser) {
      return false
    }
    if (selectedUser.following) {
      return true
    }
    if (selectedUser.protected) {
      return false
    }
    return true
  }, [loggedIn, selectedUser, availableBlocks])
  return (
    <div>
      <TargetUserContext.Provider
        value={{
          currentUser,
          selectedUser,
          setSelectedUser,
          targetList,
          setTargetList,
          targetOptions,
          setTargetOptions,
          mutateOptions,
          purpose,
          setPurpose,
        }}
      >
        <div className="chainblock-target">
          <TargetUserSelectUI isAvailable={isAvailable} />
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
      </TargetUserContext.Provider>
    </div>
  )
}
