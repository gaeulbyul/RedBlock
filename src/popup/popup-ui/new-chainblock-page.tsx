import * as Storage from '../../scripts/background/storage.js'
import * as TwitterAPI from '../../scripts/background/twitter-api.js'
import { TwitterUser } from '../../scripts/background/twitter-api.js'
import { formatNumber, TwitterUserMap } from '../../scripts/common.js'
import * as TextGenerate from '../../scripts/text-generate.js'
import { insertUserToStorage, removeUserFromStorage, startFollowerChainBlock } from '../popup.js'
import { DialogContext, SnackBarContext } from './contexts.js'
import { TabPanel } from './ui-common.js'

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
  selectedMode: ChainKind
  setSelectedMode: (ck: ChainKind) => void
}>({
  currentUser: null,
  selectedUser: null,
  setSelectedUser: () => {},
  targetList: 'followers',
  setTargetList: () => {},
  targetOptions: {
    quickMode: false,
    myFollowers: 'Skip',
    myFollowings: 'Skip',
    mutualBlocked: 'Skip',
  },
  setTargetOptions: () => {},
  mutateOptions: () => {},
  selectedMode: 'chainblock',
  setSelectedMode: () => {},
})

function TargetSavedUsers(props: {
  currentUser: TwitterUser | null
  selectedUserGroup: SelectUserGroup
  savedUsers: TwitterUserMap
  changeUser: (userName: string, group: SelectUserGroup) => Promise<void>
}) {
  const { currentUser, selectedUserGroup, savedUsers, changeUser } = props
  const snackBarCtx = React.useContext(SnackBarContext)
  const { selectedUser } = React.useContext(TargetUserContext)
  async function insertUser() {
    if (selectedUser) {
      insertUserToStorage(selectedUser)
      snackBarCtx.snack(`@${selectedUser.screen_name}을(를) 저장했습니다.`)
    }
  }
  async function removeUser() {
    if (selectedUser) {
      removeUserFromStorage(selectedUser)
      snackBarCtx.snack(`@${selectedUser.screen_name}을(를) 제거했습니다.`)
    }
  }
  const sortedByName = (usersMap: TwitterUserMap): TwitterUser[] =>
    _.sortBy(usersMap.toUserArray(), user => user.screen_name.toLowerCase())
  const selectUserFromOption = (elem: EventTarget) => {
    if (!(elem instanceof HTMLSelectElement)) {
      throw new Error('unreachable')
    }
    const selectedOption = elem.selectedOptions[0]
    const group = selectedOption.getAttribute('data-group') as SelectUserGroup
    const userName = selectedOption.getAttribute('data-username')!
    changeUser(userName, group)
  }
  const currentUserOption = ({ screen_name, name }: TwitterUser) => (
    <optgroup label="현재 유저">
      <option value={`current/${screen_name}`} data-group="current" data-username={screen_name}>
        @{screen_name} &lt;{name}&gt;
      </option>
    </optgroup>
  )
  return (
    <div style={{ width: '100%' }}>
      <M.FormControl fullWidth>
        <M.InputLabel shrink htmlFor="target-user-select">
          사용자 선택:
        </M.InputLabel>
        <M.Select
          native
          id="target-user-select"
          fullWidth
          value={selectedUser ? `${selectedUserGroup}/${selectedUser.screen_name}` : 'invalid/???'}
          onChange={({ target }) => selectUserFromOption(target)}
        >
          <option value="invalid/???" data-group="invalid" data-username="???">
            체인블락을 실행할 사용자를 선택해주세요.
          </option>
          {currentUser && currentUserOption(currentUser)}
          <optgroup label="저장한 유저">
            {sortedByName(savedUsers).map(({ screen_name, name }, index) => (
              <option key={index} value={'saved/' + screen_name} data-group="saved" data-username={screen_name}>
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
              저장
            </M.Button>
            <M.Button disabled={selectedUserGroup !== 'saved'} onClick={removeUser} startIcon={<M.Icon>delete</M.Icon>}>
              제거
            </M.Button>
          </M.ButtonGroup>
        </M.Box>
      )}
    </div>
  )
}

function TargetUserProfile(props: { isAvailable: boolean }) {
  const { isAvailable } = props
  const { selectedUser, targetList, setTargetList, targetOptions, mutateOptions } = React.useContext(TargetUserContext)
  // selectedUser가 null일 땐 이 컴포넌트를 렌더링하지 않으므로
  const user = selectedUser!
  const { quickMode } = targetOptions
  const quickModeIsAvailable = isAvailable && targetList !== 'mutual-followers'
  const biggerProfileImageUrl = user.profile_image_url_https.replace('_normal', '_bigger')
  return (
    <div className="target-user-info">
      <div className="profile-image-area">
        <img alt="프로필 이미지" className="profile-image" src={biggerProfileImageUrl} />
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
              title={`https://twitter.com/${user.screen_name} 로 이동`}
            >
              @{user.screen_name}
            </a>
          </div>
        </div>
        {isAvailable || (
          <div className="profile-blocked">
            {user.protected && '\u{1f512} 프로텍트가 걸려있어 체인블락을 할 수 없습니다.'}
            {user.blocked_by && '\u26d4 이 사용자에게 차단당하여 체인블락을 할 수 없습니다.'}
          </div>
        )}
        <div className="profile-right-targetlist">
          <M.RadioGroup row>
            <M.FormControlLabel
              control={<M.Radio size="small" />}
              onChange={() => setTargetList('followers')}
              disabled={!isAvailable}
              checked={targetList === 'followers'}
              label={`팔로워 ${formatNumber(user.followers_count, quickMode)}명`}
              title={`@${user.screen_name}의 팔로워를 차단합니다.`}
            />
            <M.FormControlLabel
              control={<M.Radio size="small" />}
              onChange={() => setTargetList('friends')}
              disabled={!isAvailable}
              checked={targetList === 'friends'}
              label={`팔로잉 ${formatNumber(user.friends_count, quickMode)}명`}
              title={`@${user.screen_name}이(가) 팔로우하는 사용자를 차단합니다.`}
            />
            <M.FormControlLabel
              control={<M.Radio size="small" />}
              onChange={() => setTargetList('mutual-followers')}
              disabled={!isAvailable}
              checked={targetList === 'mutual-followers'}
              label="맞팔로워만"
              title={`@${user.screen_name}이(가) 맞팔로우한 사용자만 골라서 차단합니다.`}
            />
          </M.RadioGroup>
          <hr />
          <M.FormControlLabel
            control={<M.Checkbox />}
            disabled={!quickModeIsAvailable}
            checked={quickMode}
            onChange={() => mutateOptions({ quickMode: !quickMode })}
            label="퀵 모드 (200명 이하만 차단)"
            title="퀵 모드: 최근에 해당 사용자에게 체인블락을 실행하였으나 이후에 새로 생긴 팔로워만 더 빠르게 차단하기 위해 고안한 기능입니다. (단, 팔로잉이나 팔로워가 이미 200명 이하인 경우 아무련 효과가 없습니다.)"
          />
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
  const { myFollowers, myFollowings } = targetOptions
  const verbs: Array<[Verb, string]> = [
    ['Skip', '냅두기'],
    ['Mute', '뮤트하기'],
    ['Block', '차단하기'],
  ]
  return (
    <React.Fragment>
      <M.FormControl component="fieldset">
        <M.FormLabel component="legend">내 팔로워</M.FormLabel>
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
        <M.FormLabel component="legend">내 팔로잉</M.FormLabel>
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

function TargetUserSelectUI(props: { isAvailable: boolean }) {
  const { isAvailable } = props
  const { currentUser, targetList, selectedUser, setSelectedUser, selectedMode } = React.useContext(TargetUserContext)
  const { openModal } = React.useContext(DialogContext)
  const [savedUsers, setSavedUsers] = React.useState(new TwitterUserMap())
  const [selectedUserGroup, selectUserGroup] = React.useState<SelectUserGroup>('current')
  const [isLoading, setLoadingState] = React.useState(false)
  const modeKor = selectedMode === 'chainblock' ? '체인블락' : '언체인블락'
  async function changeUser(userName: string, group: SelectUserGroup) {
    const validUserNamePattern = /^[0-9a-z_]{1,15}$/i
    if (!validUserNamePattern.test(userName)) {
      setSelectedUser(null)
      selectUserGroup('invalid')
      return
    }
    try {
      setLoadingState(true)
      const newUser = await getUserByNameWithCache(userName).catch(() => null)
      if (newUser) {
        setSelectedUser(newUser)
        selectUserGroup(group)
      } else {
        openModal({
          dialogType: 'alert',
          message: {
            title: `사용자 @${userName}을(를) 찾을 수 없습니다.`,
          },
        })
        setSelectedUser(null)
        selectUserGroup('invalid')
      }
    } finally {
      setLoadingState(false)
    }
  }
  React.useEffect(() => {
    async function loadUsers() {
      const users = await Storage.loadUsers()
      setSavedUsers(users)
      return users
    }
    loadUsers()
    return Storage.onSavedUsersChanged(async users => {
      await loadUsers()
      if (!(selectedUser && users.has(selectedUser.id_str))) {
        setSelectedUser(currentUser)
        selectUserGroup('current')
      }
    })
  }, [])
  const classes = useStylesForExpansionPanels()
  let targetSummary = ''
  if (selectedUser) {
    targetSummary += '('
    targetSummary += `@${selectedUser.screen_name} `
    switch (targetList) {
      case 'followers':
        targetSummary += '팔로워'
        break
      case 'friends':
        targetSummary += '팔로잉'
        break
      case 'mutual-followers':
        targetSummary += '맞팔로워'
        break
    }
    targetSummary += ')'
  }
  return (
    <M.ExpansionPanel defaultExpanded>
      <DenseExpansionPanelSummary expandIcon={<M.Icon>expand_more</M.Icon>}>
        <T>
          {modeKor} 대상 {targetSummary}
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
  const { selectedMode, setSelectedMode } = React.useContext(TargetUserContext)
  const classes = useStylesForExpansionPanels()
  const modeKor = selectedMode === 'chainblock' ? '체인블락' : '언체인블락'
  return (
    <M.ExpansionPanel defaultExpanded>
      <DenseExpansionPanelSummary expandIcon={<M.Icon>expand_more</M.Icon>}>
        <T>{modeKor} 옵션</T>
      </DenseExpansionPanelSummary>
      <M.ExpansionPanelDetails className={classes.details}>
        <div>
          <M.Tabs value={selectedMode} onChange={(_ev, val) => setSelectedMode(val)}>
            <M.Tab value={'chainblock'} label={`\u{1f6d1} 체인블락`} />
            <M.Tab value={'unchainblock'} label={`\u{1f49a} 언체인블락`} />
          </M.Tabs>
          <M.Divider />
          <TabPanel value={selectedMode} index={'chainblock'}>
            <TargetChainBlockOptionsUI />
            <div className="description">
              위 조건에 해당하지 않는 나머지 사용자를 모두 <mark>차단</mark>합니다. (단, <b>나와 맞팔로우</b>인 사용자는
              위 옵션과 무관하게 <b>뮤트나 차단하지 않습니다</b>.)
            </div>
          </TabPanel>
          <TabPanel value={selectedMode} index={'unchainblock'}>
            <TargetUnChainBlockOptionsUI />
            <div className="description">
              위 조건에 해당하지 않는 나머지 사용자를 모두 <mark>차단 해제</mark>합니다.
            </div>
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
  const verbs: Array<[Verb, string]> = [
    ['Skip', '(맞차단인 상태로) 냅두기'],
    ['UnBlock', '차단 해제하기'],
  ]
  return (
    <React.Fragment>
      <M.FormControl component="fieldset">
        <M.FormLabel component="legend">서로 맞차단</M.FormLabel>
        <M.RadioGroup row>
          {verbs.map(([verb, vKor], index) => (
            <M.FormControlLabel
              key={index}
              control={<M.Radio size="small" />}
              checked={mutualBlocked === verb}
              onChange={() => mutateOptions({ mutualBlocked: verb })}
              label={vKor}
            />
          ))}
        </M.RadioGroup>
      </M.FormControl>
    </React.Fragment>
  )
}

function TargetExecutionButtonUI(props: { isAvailable: boolean }) {
  const { isAvailable } = props
  const { selectedMode, selectedUser, targetList, targetOptions } = React.useContext(TargetUserContext)
  const { openModal } = React.useContext(DialogContext)
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
    openModal({
      dialogType: 'confirm',
      message: TextGenerate.generateFollowerBlockConfirmMessage(request),
      callback() {
        startFollowerChainBlock(request)
      },
    })
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
    openModal({
      dialogType: 'confirm',
      message: TextGenerate.generateFollowerBlockConfirmMessage(request),
      callback() {
        startFollowerChainBlock(request)
      },
    })
  }
  return (
    <M.Box padding="10px">
      {selectedMode === 'chainblock' && (
        <BigExecuteChainBlockButton disabled={!isAvailable} onClick={onExecuteChainBlockButtonClicked}>
          <span>{'\u{1f6d1}'} 체인블락 실행</span>
        </BigExecuteChainBlockButton>
      )}
      {selectedMode === 'unchainblock' && (
        <BigExecuteUnChainBlockButton disabled={!isAvailable} onClick={onExecuteUnChainBlockButtonClicked}>
          <span>{'\u{1f49a}'} 언체인블락 실행</span>
        </BigExecuteUnChainBlockButton>
      )}
    </M.Box>
  )
}

const userCache = new Map<string, TwitterUser>()
async function getUserByNameWithCache(userName: string): Promise<TwitterUser> {
  const key = userName.replace(/^@/, '').toLowerCase()
  if (userCache.has(key)) {
    return userCache.get(key)!
  }
  const user = await TwitterAPI.getSingleUserByName(key)
  userCache.set(user.screen_name, user)
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
  const [targetOptions, setTargetOptions] = React.useState<SessionOptions>({
    quickMode: false,
    myFollowers: 'Skip',
    myFollowings: 'Skip',
    mutualBlocked: 'Skip',
  })
  const [selectedUser, setSelectedUser] = React.useState<TwitterUser | null>(currentUser)
  const [targetList, setTargetList] = React.useState<FollowKind>('followers')
  const firstMode = selectedUser && selectedUser.following ? 'unchainblock' : 'chainblock'
  const [selectedMode, setSelectedMode] = React.useState<ChainKind>(firstMode)
  function mutateOptions(newOptionsPart: Partial<SessionOptions>) {
    const newOptions = { ...targetOptions, ...newOptionsPart }
    setTargetOptions(newOptions)
  }
  const isAvailable = React.useMemo((): boolean => {
    if (!selectedUser) {
      return false
    }
    if (selectedUser.following) {
      return true
    }
    if (selectedUser.protected || selectedUser.blocked_by) {
      return false
    }
    return true
  }, [selectedUser])
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
          selectedMode,
          setSelectedMode,
        }}
      >
        <div className="chainblock-target">
          <TargetUserSelectUI isAvailable={isAvailable} />
          <TargetOptionsUI />
          <TargetExecutionButtonUI isAvailable={isAvailable} />
        </div>
      </TargetUserContext.Provider>
    </div>
  )
}
