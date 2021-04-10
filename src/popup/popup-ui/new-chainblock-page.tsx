import * as Storage from '../../scripts/background/storage.js'
import type { TwClient } from '../../scripts/background/twitter-api.js'
import { TwitterUserMap } from '../../scripts/common.js'
import * as TextGenerate from '../../scripts/text-generate.js'
import { startNewChainBlockSession } from '../../scripts/background/request-sender.js'
import {
  UIContext,
  MyselfContext,
  BlockLimiterContext,
  TwitterAPIClientContext,
  RedBlockOptionsContext,
} from './contexts.js'
import {
  BlockLimiterUI,
  TwitterUserProfile,
  RBExpansionPanel,
  BigExecuteButton,
  PurposeSelectionUI,
  RequestCheckResultUI,
} from './components.js'
import {
  SelectUserGroup,
  FollowerChainBlockPageStatesContext,
  ExtraTargetContext,
} from './ui-states.js'
import { TargetCheckResult, validateRequest } from '../../scripts/background/target-checker.js'
import { getUserNameFromTab } from '../popup.js'

const M = MaterialUI

const userCache = new TwitterUserMap()

interface UserSelectorContextType {
  changeSelectedUser(userId: string, userName: string, group: SelectUserGroup): void
}
const UserSelectorContext = React.createContext<UserSelectorContextType>(null!)

function useSessionRequest(): FollowerBlockSessionRequest {
  const { purpose, targetList, userSelection } = React.useContext(
    FollowerChainBlockPageStatesContext
  )
  const { cookieOptions } = React.useContext(TwitterAPIClientContext)
  const { extraTarget } = React.useContext(ExtraTargetContext)
  const options = React.useContext(RedBlockOptionsContext)
  const myself = React.useContext(MyselfContext)!
  const selectedUser = userSelection.user!
  const retriever = { user: myself, cookieOptions }
  return {
    purpose,
    target: {
      type: 'follower',
      user: selectedUser,
      list: targetList,
    },
    options,
    extraTarget,
    retriever,
    executor: retriever,
  }
}

function TargetSavedUsers(props: { savedUsers: TwitterUserMap; usersInOtherTab: TwitterUserMap }) {
  const { savedUsers, usersInOtherTab } = props
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
    Storage.insertItemToBookmark(Storage.createBookmarkUserItem(selectedUser))
    uiContext.openSnackBar(i18n.getMessage('user_xxx_added', selectedUser.screen_name))
  }
  async function removeUser() {
    if (!selectedUser) {
      console.warn("attempted remove user that doesn't exist?")
      return
    }
    const userId = selectedUser.id_str
    Storage.modifyBookmarksWith(bookmarks => {
      const itemToRemove = Array.from(bookmarks.values()).find(
        item => item.type === 'user' && item.userId === userId
      )
      if (itemToRemove) {
        bookmarks.delete(itemToRemove.itemId)
      } else {
        console.warn('item already removed? user-id:"%s"', userId)
      }
      return bookmarks
    })
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
  const addButtonDisabledGroup: SelectUserGroup[] = ['invalid', 'saved']
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
          <optgroup label={`${i18n.getMessage('users_in_other_tab')} (${usersInOtherTab.size})`}>
            {sortedByName(usersInOtherTab).map((user, index) => (
              <UserOptionItem key={index} user={user} optgroup="other tab" />
            ))}
          </optgroup>
          <optgroup label={`${i18n.getMessage('saved_user')} (${savedUsers.size})`}>
            {sortedByName(savedUsers).map((user, index) => (
              <UserOptionItem key={index} user={user} optgroup="saved" />
            ))}
          </optgroup>
        </M.Select>
      </M.FormControl>
      {selectedUser && (
        <M.Box my={1} display="flex" flexDirection="row-reverse">
          <M.ButtonGroup>
            <M.Button
              disabled={addButtonDisabledGroup.includes(selectedUserGroup)}
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

function TargetUserProfile() {
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
        checked={targetList === fk}
        label={label}
      />
    )
  }
  return (
    <TwitterUserProfile user={user}>
      <div>
        <M.Box display="flex" flexDirection="column">
          {selectedMyself && <div>&#10071; {i18n.getMessage('its_you')}</div>}
        </M.Box>
        <M.RadioGroup row>
          {radio('followers', TextGenerate.formatFollowsCount('followers', user.followers_count))}
          {radio('friends', TextGenerate.formatFollowsCount('friends', user.friends_count))}
          {radio('mutual-followers', i18n.getMessage('mutual_followers'))}
        </M.RadioGroup>
      </div>
    </TwitterUserProfile>
  )
}

const useStylesForCircularProgress = MaterialUI.makeStyles(theme =>
  MaterialUI.createStyles({
    center: {
      margin: theme.spacing(1, 'auto'),
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

function TargetUserSelectUI() {
  const { currentUser, targetList, userSelection, setUserSelection } = React.useContext(
    FollowerChainBlockPageStatesContext
  )
  const twClient = React.useContext(TwitterAPIClientContext)
  const { openDialog } = React.useContext(UIContext)
  const [savedUsers, setSavedUsers] = React.useState(new TwitterUserMap())
  const [usersInOtherTab, setUsersInOtherTab] = React.useState(new TwitterUserMap())
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
    try {
      setLoadingState(true)
      const newUser = await getUserByIdWithCache(twClient, userId).catch(() => null)
      if (newUser) {
        setUserSelection({
          user: newUser,
          group,
        })
      } else {
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
    Storage.loadBookmarks('user').then(async bookmarks => {
      const userIds = Array.from(bookmarks.values())
        .filter(item => item.type === 'user')
        .map(item => (item as BookmarkUserItem).userId)
      const users = await getMultipleUsersByIdWithCache(twClient, userIds)
      setSavedUsers(users)
    })
    return Storage.onStorageChanged('bookmarks', async bookmarks => {
      const userIds = bookmarks
        .filter(item => item.type === 'user')
        .map(item => (item as BookmarkUserItem).userId)
      const users = await getMultipleUsersByIdWithCache(twClient, userIds)
      setSavedUsers(users)
      // 스토리지에서 불러올 때 직전에 선택했었던 유저가 없는 경우
      if (!(selectedUser && users.hasUser(selectedUser))) {
        setUserSelection({
          user: currentUser,
          group: 'current',
        })
      }
    })
  }, [])
  React.useEffect(() => {
    browser.tabs
      .query({
        url: ['https://twitter.com/*', 'https://mobile.twitter.com/*'],
      })
      .then(async tabs => {
        const tabsExceptCurrentOne = tabs.filter(tab => !tab.active)
        const userNames = tabsExceptCurrentOne.map(getUserNameFromTab).filter(Boolean) as string[]
        const usersArray = await twClient
          .getMultipleUsers({ screen_name: userNames })
          .catch(() => [])
        const usersMap = TwitterUserMap.fromUsersArray(usersArray)
        setUsersInOtherTab(usersMap)
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
            <TargetSavedUsers {...{ savedUsers, usersInOtherTab }} />
          </UserSelectorContext.Provider>
          <M.Divider />
          {selectedUser ? (
            <TargetUserProfile />
          ) : (
            <TargetUserProfileEmpty reason={isLoading ? 'loading' : 'invalid-user'} />
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

async function getUserByIdWithCache(twClient: TwClient, userId: string): Promise<TwitterUser> {
  if (userCache.has(userId)) {
    return userCache.get(userId)!
  }
  const user = await twClient.getSingleUser({ user_id: userId })
  userCache.addUser(user)
  return user
}

async function getMultipleUsersByIdWithCache(
  twClient: TwClient,
  userIds: string[]
): Promise<TwitterUserMap> {
  const result = new TwitterUserMap()
  const nonCachedUserIds = new Set<string>()
  for (const id of userIds) {
    const cachedUser = userCache.get(id)
    if (cachedUser) {
      result.addUser(cachedUser)
      continue
    } else {
      nonCachedUserIds.add(id)
    }
  }
  const newlyFetchedUsers = await twClient
    .getMultipleUsers({ user_id: Array.from(nonCachedUserIds) })
    .catch(() => [])
  newlyFetchedUsers.forEach(user => {
    userCache.addUser(user)
    result.addUser(user)
  })
  return result
}

function TargetExecutionButtonUI() {
  const { purpose } = React.useContext(FollowerChainBlockPageStatesContext)
  const uiContext = React.useContext(UIContext)
  const limiterStatus = React.useContext(BlockLimiterContext)
  const request = useSessionRequest()
  function isAvailable() {
    if (limiterStatus.remained <= 0 && purpose.type === 'chainblock') {
      return false
    }
    return validateRequest(request) === TargetCheckResult.Ok
  }
  function executeSession() {
    if (!request) {
      uiContext.openSnackBar(i18n.getMessage('error_occured_check_login'))
      return
    }
    uiContext.openDialog({
      dialogType: 'confirm',
      message: TextGenerate.generateConfirmMessage(request),
      callbackOnOk() {
        startNewChainBlockSession<FollowerBlockSessionRequest>(request)
      },
    })
  }
  return (
    <M.Box>
      <BigExecuteButton {...{ purpose }} disabled={!isAvailable()} onClick={executeSession} />
    </M.Box>
  )
}

export default function NewChainBlockPage() {
  const { userSelection } = React.useContext(FollowerChainBlockPageStatesContext)
  const request = useSessionRequest()
  return (
    <div>
      <TargetUserSelectUI />
      {userSelection.user && <TargetOptionsUI />}
      <BlockLimiterUI />
      {userSelection.user && (
        <div>
          <RequestCheckResultUI {...{ request }} />
          <TargetExecutionButtonUI />
        </div>
      )}
    </div>
  )
}
