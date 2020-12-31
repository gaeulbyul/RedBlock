import * as Storage from '../../scripts/background/storage.js'
import * as TwitterAPI from '../../scripts/background/twitter-api.js'
import { TwitterUser } from '../../scripts/background/twitter-api.js'
import { TwitterUserMap, checkUserIdBeforeLockPicker } from '../../scripts/common.js'
import * as i18n from '../../scripts/i18n.js'
import * as TextGenerate from '../../scripts/text-generate.js'
import {
  insertUserToStorage,
  removeUserFromStorage,
  startNewChainBlockSession,
  refreshSavedUsers,
} from '../../scripts/background/request-sender.js'
import { UIContext, MyselfContext, BlockLimiterContext } from './contexts.js'
import {
  TabPanel,
  PleaseLoginBox,
  BlockLimiterUI,
  TwitterUserProfile,
  DenseExpansionPanel,
  BigExecuteChainBlockButton,
  BigExecuteUnChainBlockButton,
  BigExportButton,
  BigExecuteLockPickerButton,
  WhatIsBioBlock,
} from './ui-common.js'
import { SelectUserGroup, FollowerChainBlockPageStatesContext } from './ui-states.js'

const M = MaterialUI

interface UserSelectorContextType {
  changeSelectedUser(userId: string, userName: string, group: SelectUserGroup): void
}
const UserSelectorContext = React.createContext<UserSelectorContextType>({
  changeSelectedUser() {},
})

function TargetSavedUsers(props: { savedUsers: TwitterUserMap }) {
  const { savedUsers } = props
  const uiContext = React.useContext(UIContext)
  const { changeSelectedUser } = React.useContext(UserSelectorContext)
  const { currentUser, selectedUserGroup, selectedUser } = React.useContext(
    FollowerChainBlockPageStatesContext
  )
  const myself = React.useContext(MyselfContext)
  async function insertUser() {
    if (selectedUser) {
      insertUserToStorage(selectedUser)
      uiContext.openSnackBar(i18n.getMessage('user_xxx_added', selectedUser.screen_name))
    }
  }
  async function removeUser() {
    if (selectedUser) {
      removeUserFromStorage(selectedUser)
      uiContext.openSnackBar(i18n.getMessage('user_xxx_removed', selectedUser.screen_name))
    }
  }
  async function requestRefreshSavedUsers() {
    refreshSavedUsers()
    uiContext.openSnackBar(i18n.getMessage('refreshing_saved_users'))
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
          <optgroup label={i18n.getMessage('saved_user')}>
            {sortedByName(savedUsers).map((user, index) => (
              <UserOptionItem key={index} user={user} optgroup="saved" />
            ))}
          </optgroup>
          {myself ? (
            <optgroup label={i18n.getMessage('lockpicker')}>
              <UserOptionItem user={myself} optgroup="self" />
            </optgroup>
          ) : (
            ''
          )}
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
  const { selectedUser, targetList, setTargetList } = React.useContext(
    FollowerChainBlockPageStatesContext
  )
  // selectedUser가 null일 땐 이 컴포넌트를 렌더링하지 않으므로
  const user = selectedUser!
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

function TargetChainBlockOptionsUI() {
  const { targetOptions, mutateOptions } = React.useContext(FollowerChainBlockPageStatesContext)
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
        <M.FormLabel component="legend">
          BioBlock &#x1F9EA; <WhatIsBioBlock />
        </M.FormLabel>
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
  const {
    currentUser,
    targetList,
    setSelectedUserGroup,
    selectedUser,
    setSelectedUser,
    setPurpose,
  } = React.useContext(FollowerChainBlockPageStatesContext)
  const { openDialog } = React.useContext(UIContext)
  const myself = React.useContext(MyselfContext)
  const [savedUsers, setSavedUsers] = React.useState(new TwitterUserMap())
  const [isLoading, setLoadingState] = React.useState(false)
  async function changeSelectedUser(userId: string, userName: string, group: SelectUserGroup) {
    if (!/^\d+$/.test(userId)) {
      setSelectedUser(null)
      setSelectedUserGroup('invalid')
      return
    }
    try {
      setLoadingState(true)
      const newUser = await getUserByIdWithCache(userId).catch(() => null)
      if (newUser) {
        setSelectedUser(newUser)
        setSelectedUserGroup(group)
        if (myself) {
          if (newUser.id_str === myself.id_str) {
            setPurpose('lockpicker')
          } else {
            setPurpose('chainblock')
          }
        }
      } else {
        // TODO: 유저를 가져오는 데 실패하면 해당 유저를 지운다?
        openDialog({
          dialogType: 'alert',
          message: {
            title: i18n.getMessage('failed_to_get_user_info', userName),
          },
        })
        setSelectedUser(null)
        setSelectedUserGroup('invalid')
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
        setSelectedUserGroup('current')
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
    <DenseExpansionPanel summary={targetSummary} defaultExpanded>
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
    </DenseExpansionPanel>
  )
}

function TargetUnChainBlockOptionsUI() {
  // const { options, mutateOptions } = props
  const { targetOptions, mutateOptions } = React.useContext(FollowerChainBlockPageStatesContext)
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

function TargetOptionsUIMyself() {
  return (
    <div style={{ width: '100%' }}>
      <div className="description">{i18n.getMessage('lockpicker_description')}</div>
    </div>
  )
}

function TargetOptionsUIOthers() {
  const { purpose, setPurpose } = React.useContext(FollowerChainBlockPageStatesContext)
  return (
    <div style={{ width: '100%' }}>
      <M.Tabs variant="fullWidth" value={purpose} onChange={(_ev, val) => setPurpose(val)}>
        <M.Tab value={'chainblock'} label={`\u{1f6d1} ${i18n.getMessage('chainblock')}`} />
        <M.Tab value={'unchainblock'} label={`\u{1f49a} ${i18n.getMessage('unchainblock')}`} />
        <M.Tab value={'export'} label={`\u{1f4be} ${i18n.getMessage('export')}`} />
      </M.Tabs>
      <M.Divider />
      <TabPanel value={purpose} index={'chainblock'}>
        <TargetChainBlockOptionsUI />
        <M.Divider />
        <div className="description">
          {i18n.getMessage('chainblock_description')}{' '}
          {i18n.getMessage('my_mutual_followers_wont_block')}
          <div className="wtf">{i18n.getMessage('wtf_twitter') /* massive block warning */}</div>
        </div>
      </TabPanel>
      <TabPanel value={purpose} index={'unchainblock'}>
        <TargetUnChainBlockOptionsUI />
        <div className="description">{i18n.getMessage('unchainblock_description')}</div>
      </TabPanel>
      <TabPanel value={purpose} index={'export'}>
        <div className="description">{i18n.getMessage('export_followers_description')}</div>
      </TabPanel>
    </div>
  )
}

function TargetOptionsUI() {
  const { purpose } = React.useContext(FollowerChainBlockPageStatesContext)
  const summary = `${i18n.getMessage('options')} (${i18n.getMessage(purpose)})`
  return (
    <DenseExpansionPanel summary={summary} defaultExpanded>
      {purpose === 'lockpicker' ? <TargetOptionsUIMyself /> : <TargetOptionsUIOthers />}
    </DenseExpansionPanel>
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

function TargetExecutionButtonUI(props: { isAvailable: boolean }) {
  const { isAvailable } = props
  const { purpose, selectedUser, targetList, targetOptions: options } = React.useContext(
    FollowerChainBlockPageStatesContext
  )
  const { openDialog } = React.useContext(UIContext)
  const uiContext = React.useContext(UIContext)
  const myself = React.useContext(MyselfContext)
  const target: FollowerBlockSessionRequest['target'] = {
    type: 'follower',
    user: selectedUser!,
    list: targetList,
  }
  function executeSession(purpose: Purpose) {
    if (!myself) {
      uiContext.openSnackBar(i18n.getMessage('error_occured_check_login'))
      return
    }
    const request: FollowerBlockSessionRequest = {
      purpose,
      target,
      options,
      myself,
    }
    openDialog({
      dialogType: 'confirm',
      message: TextGenerate.generateConfirmMessage(request),
      callbackOnOk() {
        startNewChainBlockSession<FollowerBlockSessionRequest>(request)
      },
    })
  }
  let bigButton: React.ReactNode
  switch (purpose) {
    case 'chainblock':
      bigButton = (
        <BigExecuteChainBlockButton
          disabled={!isAvailable}
          onClick={() => executeSession('chainblock')}
        >
          <span>
            {'\u{1f6d1}'} {i18n.getMessage('execute_chainblock')}
          </span>
        </BigExecuteChainBlockButton>
      )
      break
    case 'unchainblock':
      bigButton = (
        <BigExecuteUnChainBlockButton
          disabled={!isAvailable}
          onClick={() => executeSession('unchainblock')}
        >
          <span>
            {'\u{1f49a}'} {i18n.getMessage('execute_unchainblock')}
          </span>
        </BigExecuteUnChainBlockButton>
      )
      break
    case 'export':
      bigButton = (
        <BigExportButton disabled={!isAvailable} onClick={() => executeSession('export')}>
          <span>
            {'\u{1f4be}'} {i18n.getMessage('export')}
          </span>
        </BigExportButton>
      )
      break
    case 'lockpicker':
      bigButton = (
        <BigExecuteLockPickerButton
          disabled={!isAvailable}
          onClick={() => executeSession('lockpicker')}
        >
          <span>
            {'\u{1f513}'} {i18n.getMessage('lockpicker')}
          </span>
        </BigExecuteLockPickerButton>
      )
  }
  return <M.Box>{bigButton}</M.Box>
}

export default function NewChainBlockPage() {
  const { purpose, selectedUser } = React.useContext(FollowerChainBlockPageStatesContext)
  const myself = React.useContext(MyselfContext)
  const limiterStatus = React.useContext(BlockLimiterContext)
  function isAvailable() {
    if (!myself) {
      return false
    }
    if (limiterStatus.remained <= 0 && (purpose === 'chainblock' || purpose === 'lockpicker')) {
      return false
    }
    if (!selectedUser) {
      return false
    }
    const selfvalid = checkUserIdBeforeLockPicker({
      purpose,
      myselfId: myself.id_str,
      givenUserId: selectedUser.id_str,
    })
    if (selfvalid.startsWith('invalid')) {
      return false
    }
    // 락피커은 이하의 체크가 필요없음
    if (selfvalid === 'self') {
      return true
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
