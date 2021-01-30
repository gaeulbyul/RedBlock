import * as Storage from '../../scripts/background/storage.js'
import type { TwClient } from '../../scripts/background/twitter-api.js'
import { TwitterUserMap } from '../../scripts/common.js'
import * as i18n from '../../scripts/i18n.js'
import * as TextGenerate from '../../scripts/text-generate.js'
import {
  insertUserToStorage,
  removeUserFromStorage,
  startNewChainBlockSession,
} from '../../scripts/background/request-sender.js'
import {
  UIContext,
  MyselfContext,
  BlockLimiterContext,
  TwitterAPIClientContext,
} from './contexts.js'
import {
  BlockLimiterUI,
  TwitterUserProfile,
  RBExpansionPanel,
  BigExecuteButton,
  PurposeSelectionUI,
} from './components.js'
import {
  SelectUserGroup,
  FollowerChainBlockPageStatesContext,
  SessionOptionsContext,
} from './ui-states.js'

const M = MaterialUI

interface UserSelectorContextType {
  changeSelectedUser(userId: string, userName: string, group: SelectUserGroup): void
}
const UserSelectorContext = React.createContext<UserSelectorContextType>(null!)

function TargetSavedUsers(props: { savedUsers: TwitterUserMap }) {
  const { savedUsers } = props
  const uiContext = React.useContext(UIContext)
  const { changeSelectedUser } = React.useContext(UserSelectorContext)
  const { currentUser, userSelection } = React.useContext(FollowerChainBlockPageStatesContext)
  const { user: selectedUser, group: selectedUserGroup } = userSelection
  async function insertUser() {
    if (!selectedUser) {
      return
    }
    if (savedUsers.hasUser(selectedUser)) {
      uiContext.openSnackBar(i18n.getMessage('user_xxx_already_exists', selectedUser.screen_name))
      return
    }
    insertUserToStorage(selectedUser)
    uiContext.openSnackBar(i18n.getMessage('user_xxx_added', selectedUser.screen_name))
  }
  async function removeUser() {
    if (!selectedUser) {
      console.warn("attempted remove user that doesn't exist?")
      return
    }
    removeUserFromStorage(selectedUser)
    uiContext.openSnackBar(i18n.getMessage('user_xxx_removed', selectedUser.screen_name))
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
    changeSelectedUser(userId, userName, group)
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
  function UserOptionItem(props: { user: TwitterUser; optgroup: SelectUserGroup; label?: string }) {
    const { user, optgroup } = props
    const label = props.label || `@${user.screen_name} <${user.name}>`
    return (
      <option
        value={`${optgroup}/${user.id_str}`}
        data-group={optgroup}
        data-userid={user.id_str}
        data-username={user.screen_name}
      >
        {label}
      </option>
    )
  }
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
          <optgroup label={`${i18n.getMessage('saved_user')} (${savedUsers.size})`}>
            {sortedByName(savedUsers).map((user, index) => (
              <UserOptionItem key={index} user={user} optgroup="saved" />
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
          </M.ButtonGroup>
        </M.Box>
      )}
    </div>
  )
}

function TargetUserProfile(props: { isAvailable: boolean }) {
  const { isAvailable } = props
  const { targetList, setTargetList, userSelection } = React.useContext(
    FollowerChainBlockPageStatesContext
  )
  // selectedUser가 null일 땐 이 컴포넌트를 렌더링하지 않으므로
  const user = userSelection.user!
  const myself = React.useContext(MyselfContext)
  const selectedMyself = myself && user.id_str === myself.id_str
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
    <TwitterUserProfile user={user}>
      {selectedMyself ? (
        ''
      ) : (
        <div className="target-user-info">
          {isAvailable || (
            <div>
              {user.protected && `\u{1f512} ${i18n.getMessage('cant_chainblock_to_protected')}`}
            </div>
          )}
          <M.RadioGroup row>
            {radio('followers', i18n.formatFollowsCount('followers', user.followers_count))}
            {radio('friends', i18n.formatFollowsCount('friends', user.friends_count))}
            {radio('mutual-followers', i18n.getMessage('mutual_followers'))}
          </M.RadioGroup>
        </div>
      )}
    </TwitterUserProfile>
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

function TargetUserSelectUI(props: { isAvailable: boolean }) {
  const { isAvailable } = props
  const { currentUser, targetList, userSelection, setUserSelection } = React.useContext(
    FollowerChainBlockPageStatesContext
  )
  const twClient = React.useContext(TwitterAPIClientContext)
  const { openDialog } = React.useContext(UIContext)
  const myself = React.useContext(MyselfContext)!
  const [savedUsers, setSavedUsers] = React.useState(new TwitterUserMap())
  const [isLoading, setLoadingState] = React.useState(false)
  const { user: selectedUser } = userSelection
  async function changeSelectedUser(userId: string, userName: string, group: SelectUserGroup) {
    if (!/^\d+$/.test(userId)) {
      setUserSelection({
        user: null,
        group: 'invalid',
      })
      return
    }
    if (userId === myself.id_str) {
      // TODO
      //setUserSelection({
      //  user: myself,
      //  group,
      //})
      //return
    }
    try {
      setLoadingState(true)
      const newUser = await getUserByIdWithCache(twClient, userId).catch(() => null)
      if (newUser) {
        setUserSelection({
          user: newUser,
          group,
        })
      } else {
        // TODO: 유저를 가져오는 데 실패하면 해당 유저를 지운다?
        openDialog({
          dialogType: 'alert',
          message: {
            title: i18n.getMessage('failed_to_get_user_info', userName),
          },
        })
        setUserSelection({
          user: null,
          group: 'invalid',
        })
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
      // 스토리지에서 불러올 때 직전에 선택했었던 유저가 없는 경우
      if (!(selectedUser && usersMap.hasUser(selectedUser))) {
        setUserSelection({
          user: currentUser,
          group: 'current',
        })
      }
    })
  }, [])
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
  targetSummary = `${i18n.getMessage('target')} (${targetSummary})`
  return (
    <RBExpansionPanel summary={targetSummary} defaultExpanded>
      <div style={{ width: '100%' }}>
        <M.FormControl component="fieldset" fullWidth>
          <UserSelectorContext.Provider value={{ changeSelectedUser }}>
            <TargetSavedUsers savedUsers={savedUsers} />
          </UserSelectorContext.Provider>
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
    </RBExpansionPanel>
  )
}

function TargetOptionsUI() {
  const {
    purpose,
    changePurposeType,
    mutatePurposeOptions,
    availablePurposeTypes,
  } = React.useContext(FollowerChainBlockPageStatesContext)
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

const userCache = new TwitterUserMap()
async function getUserByIdWithCache(twClient: TwClient, userId: string): Promise<TwitterUser> {
  if (userCache.has(userId)) {
    return userCache.get(userId)!
  }
  const user = await twClient.getSingleUser({ user_id: userId })
  userCache.addUser(user)
  return user
}

function TargetExecutionButtonUI(props: { isAvailable: boolean }) {
  const { isAvailable } = props
  const { userSelection, targetList, purpose } = React.useContext(
    FollowerChainBlockPageStatesContext
  )
  const { sessionOptions } = React.useContext(SessionOptionsContext)
  const { openDialog } = React.useContext(UIContext)
  const { cookieOptions } = React.useContext(TwitterAPIClientContext)
  const uiContext = React.useContext(UIContext)
  const myself = React.useContext(MyselfContext)
  const selectedUser = userSelection.user!
  const target: FollowerBlockSessionRequest['target'] = {
    type: 'follower',
    user: selectedUser,
    list: targetList,
  }
  function executeSession(purpose: FollowerBlockSessionRequest['purpose']) {
    if (!myself) {
      uiContext.openSnackBar(i18n.getMessage('error_occured_check_login'))
      return
    }
    const request: FollowerBlockSessionRequest = {
      purpose,
      target,
      options: sessionOptions,
      myself,
      cookieOptions,
    }
    openDialog({
      dialogType: 'confirm',
      message: TextGenerate.generateConfirmMessage(request),
      callbackOnOk() {
        startNewChainBlockSession<FollowerBlockSessionRequest>(request)
      },
    })
  }
  return (
    <M.Box>
      <BigExecuteButton
        {...{ purpose }}
        disabled={!isAvailable}
        onClick={() => executeSession(purpose)}
      />
    </M.Box>
  )
}

export default function NewChainBlockPage() {
  const { userSelection, purpose } = React.useContext(FollowerChainBlockPageStatesContext)
  const myself = React.useContext(MyselfContext)
  const limiterStatus = React.useContext(BlockLimiterContext)
  const { user: selectedUser } = userSelection
  function isAvailable() {
    if (!myself) {
      return false
    }
    if (limiterStatus.remained <= 0 && purpose.type === 'chainblock') {
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
  }
  return (
    <div>
      <TargetUserSelectUI isAvailable={isAvailable()} />
      <TargetOptionsUI />
      <BlockLimiterUI />
      <TargetExecutionButtonUI isAvailable={isAvailable()} />
    </div>
  )
}
