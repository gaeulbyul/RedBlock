import React from 'react'
import * as MaterialUI from '@material-ui/core'
import sortBy from 'lodash-es/sortBy'

import * as RedBlockBookmarksStorage from '../../scripts/background/storage/bookmarks'
import { onStorageChanged } from '../../scripts/background/storage'
import { TwClient } from '../../scripts/background/twitter-api'
import { TwitterUserMap } from '../../scripts/common'
import * as TextGenerate from '../../scripts/text-generate'
import { startNewChainBlockSession } from '../../scripts/background/request-sender'
import {
  UIContext,
  MyselfContext,
  RetrieverContext,
  BlockLimiterContext,
  RedBlockOptionsContext,
} from './contexts'
import {
  BlockLimiterUI,
  TwitterUserProfile,
  RBAccordion,
  BigExecuteButton,
  PurposeSelectionUI,
  RequestCheckResultUI,
} from './components'
import {
  TargetSelector,
  TargetGroup,
  ItemsGroup,
  UserItem,
  Options as TargetSelectorOptions,
  Controls as TargetSelectorControls,
  identifierOfItem,
  TargetSelectorItem,
} from './components/target-selector'
import { FollowerChainBlockPageStatesContext, ExtraSessionOptionsContext } from './ui-states'
import { TargetCheckResult, validateRequest } from '../../scripts/background/target-checker'
import { getUserNameFromTab } from '../popup'
import * as i18n from '~~/scripts/i18n'

const M = MaterialUI

const userCache = new TwitterUserMap()

interface UserSelectorContextType {
  changeSelectedUser(userId: string, group: TargetGroup): void
}
const UserSelectorContext = React.createContext<UserSelectorContextType>(null!)

function useSessionRequest(): Either<TargetCheckResult, SessionRequest<FollowerSessionTarget>> {
  const { purpose, targetList, userSelection } = React.useContext(
    FollowerChainBlockPageStatesContext
  )
  const myself = React.useContext(MyselfContext)
  const { retriever } = React.useContext(RetrieverContext)
  const { extraSessionOptions } = React.useContext(ExtraSessionOptionsContext)
  const options = React.useContext(RedBlockOptionsContext)
  const targetUser = userSelection?.user
  if (!myself) {
    return {
      ok: false,
      error: TargetCheckResult.MaybeNotLoggedIn,
    }
  }
  if (!targetUser) {
    return {
      ok: false,
      error: TargetCheckResult.InvalidSelectedUserOrTweet,
    }
  }
  if (targetUser.blocked_by && myself.user.id_str === retriever.user.id_str) {
    return {
      ok: false,
      error: TargetCheckResult.TheyBlocksYou,
    }
  }
  const request: SessionRequest<FollowerSessionTarget> = {
    purpose,
    target: {
      type: 'follower',
      user: targetUser,
      list: targetList,
    },
    options,
    extraSessionOptions,
    retriever,
    executor: myself,
  }
  const requestCheckResult = validateRequest(request)
  if (requestCheckResult === TargetCheckResult.Ok) {
    return {
      ok: true,
      value: request,
    }
  } else {
    return {
      ok: false,
      error: requestCheckResult,
    }
  }
}

// TODO: tweet에서도 재활용할 수 있도록 수정
function useBookmarkModifier(bookmarkedUsers: TwitterUserMap) {
  const uiContext = React.useContext(UIContext)
  return {
    async addUserToBookmark(user: TwitterUser) {
      if (bookmarkedUsers.hasUser(user)) {
        uiContext.openSnackBar(i18n.getMessage('user_xxx_already_exists', user.screen_name))
        return
      }
      await RedBlockBookmarksStorage.insertItemToBookmark(
        RedBlockBookmarksStorage.createBookmarkUserItem(user)
      )
      uiContext.openSnackBar(i18n.getMessage('user_xxx_added', user.screen_name))
    },
    async removeUserFromBookmark(user: TwitterUser) {
      const userId = user.id_str
      await RedBlockBookmarksStorage.modifyBookmarksWith(bookmarks => {
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
      uiContext.openSnackBar(i18n.getMessage('user_xxx_removed', user.screen_name))
    },
  }
}

function sortedByName(usersMap: TwitterUserMap): TwitterUser[] {
  return sortBy(usersMap.toUserArray(), user => user.screen_name.toLowerCase())
}

function FollowerChainBlockTargetSelector({
  bookmarkedUsers,
  usersInOtherTab,
}: {
  bookmarkedUsers: TwitterUserMap
  usersInOtherTab: TwitterUserMap
}) {
  const { currentUser, userSelection } = React.useContext(FollowerChainBlockPageStatesContext)
  const { changeSelectedUser } = React.useContext(UserSelectorContext)
  const { addUserToBookmark, removeUserFromBookmark } = useBookmarkModifier(bookmarkedUsers)
  let selectedItemIdentifier = ''
  if (userSelection) {
    selectedItemIdentifier = identifierOfItem({
      type: 'user',
      group: userSelection.group,
      idStr: userSelection.user.id_str,
    })
  }
  function onSelectTarget(item: TargetSelectorItem) {
    changeSelectedUser(item.idStr, item.group)
  }
  return (
    <TargetSelector
      type="user"
      selectedItemIdentifier={selectedItemIdentifier}
      onSelectTarget={onSelectTarget}
    >
      <TargetSelectorOptions label={i18n.getMessage('select_user') + ':'}>
        {currentUser && (
          <ItemsGroup group="current" label={i18n.getMessage('current_user')}>
            <UserItem user={currentUser} />
          </ItemsGroup>
        )}
        <ItemsGroup
          group="other tab"
          label={`${i18n.getMessage('users_in_other_tab')} (${usersInOtherTab.size})`}
        >
          {sortedByName(usersInOtherTab).map((user, index) => (
            <UserItem key={index} user={user} />
          ))}
        </ItemsGroup>
        <ItemsGroup
          group="bookmarked"
          label={`${i18n.getMessage('saved_user')} (${bookmarkedUsers.size})`}
        >
          {sortedByName(bookmarkedUsers).map((user, index) => (
            <UserItem key={index} user={user} />
          ))}
        </ItemsGroup>
      </TargetSelectorOptions>
      <TargetSelectorControls>
        <M.Button
          disabled={!userSelection || userSelection.group === 'bookmarked'}
          onClick={() => addUserToBookmark(userSelection!.user!)}
          startIcon={<M.Icon>add_circle</M.Icon>}
        >
          {i18n.getMessage('add')}
        </M.Button>
        <M.Button
          disabled={!userSelection || userSelection.group !== 'bookmarked'}
          onClick={() => removeUserFromBookmark(userSelection!.user!)}
          startIcon={<M.Icon>delete</M.Icon>}
        >
          {i18n.getMessage('remove')}
        </M.Button>
      </TargetSelectorControls>
    </TargetSelector>
  )
}

function TargetUserProfile({ user }: { user: TwitterUser }) {
  const { targetList, setTargetList } = React.useContext(FollowerChainBlockPageStatesContext)
  const myself = React.useContext(MyselfContext)!
  const selectedMyself = user.id_str === myself.user.id_str
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
function TargetUserProfileEmpty({ reason }: { reason: 'invalid-user' | 'loading' }) {
  const classes = useStylesForCircularProgress()
  let message = ''
  if (reason === 'loading') {
    return <M.CircularProgress className={classes.center} color="secondary" />
  }
  return <div>{message}</div>
}

function TargetUserSelectUI() {
  const { currentUser, targetList, userSelection, setUserSelection } = React.useContext(
    FollowerChainBlockPageStatesContext
  )
  const myself = React.useContext(MyselfContext)!
  const { openDialog } = React.useContext(UIContext)
  const [bookmarkedUsers, setBookmarkedUsers] = React.useState(new TwitterUserMap())
  const [usersInOtherTab, setUsersInOtherTab] = React.useState(new TwitterUserMap())
  const [isLoading, setLoadingState] = React.useState(false)
  const twClient = new TwClient(myself.clientOptions)
  async function changeSelectedUser(userId: string, group: TargetGroup) {
    if (!/^\d+$/.test(userId)) {
      setUserSelection(null)
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
            title: i18n.getMessage('failed_to_get_user_info'),
          },
        })
        setUserSelection(null)
      }
    } finally {
      setLoadingState(false)
    }
  }
  React.useEffect(() => {
    RedBlockBookmarksStorage.loadBookmarksAsMap('user').then(async bookmarks => {
      const userIds = Array.from(bookmarks.values())
        .filter(item => item.type === 'user')
        .map(item => (item as BookmarkUserItem).userId)
      const users = await getMultipleUsersByIdWithCache(twClient, userIds)
      setBookmarkedUsers(users)
    })
    return onStorageChanged('bookmarks', async bookmarks => {
      const userIds = bookmarks
        .filter(item => item.type === 'user')
        .map(item => (item as BookmarkUserItem).userId)
      const users = await getMultipleUsersByIdWithCache(twClient, userIds)
      setBookmarkedUsers(users)
      // 스토리지에서 불러올 때 직전에 선택했었던 유저가 없는 경우
      if (!(userSelection && users.hasUser(userSelection.user))) {
        if (currentUser) {
          setUserSelection({
            user: currentUser,
            group: 'current',
          })
        } else {
          setUserSelection(null)
        }
      }
    })
  }, [currentUser, userSelection])
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
  if (userSelection) {
    const userName = userSelection.user.screen_name
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
    <RBAccordion summary={targetSummary} defaultExpanded>
      <div style={{ width: '100%' }}>
        <M.FormControl component="fieldset" fullWidth>
          <UserSelectorContext.Provider value={{ changeSelectedUser }}>
            <FollowerChainBlockTargetSelector {...{ bookmarkedUsers, usersInOtherTab }} />
          </UserSelectorContext.Provider>
          <M.Divider />
          {userSelection ? (
            <TargetUserProfile user={userSelection.user} />
          ) : (
            <TargetUserProfileEmpty reason={isLoading ? 'loading' : 'invalid-user'} />
          )}
        </M.FormControl>
      </div>
    </RBAccordion>
  )
}

function TargetOptionsUI() {
  const { purpose, changePurposeType, mutatePurposeOptions, availablePurposeTypes } =
    React.useContext(FollowerChainBlockPageStatesContext)
  const summary = `${i18n.getMessage('options')} (${i18n.getMessage(purpose.type)})`
  return (
    <RBAccordion summary={summary} defaultExpanded>
      <PurposeSelectionUI
        {...{
          purpose,
          changePurposeType,
          mutatePurposeOptions,
          availablePurposeTypes,
        }}
      />
    </RBAccordion>
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
  const { purpose, userSelection } = React.useContext(FollowerChainBlockPageStatesContext)
  const uiContext = React.useContext(UIContext)
  const limiterStatus = React.useContext(BlockLimiterContext)
  const maybeRequest = useSessionRequest()
  function isAvailable() {
    if (!userSelection) {
      return false
    }
    if (limiterStatus.remained <= 0 && purpose.type === 'chainblock') {
      return false
    }

    return maybeRequest.ok
  }
  function executeSession() {
    if (!userSelection) {
      // userSelection이 없으면 button이 disabled됨
      throw new Error('unreachable')
    }
    if (maybeRequest.ok) {
      const { value: request } = maybeRequest
      return uiContext.openDialog({
        dialogType: 'confirm',
        message: TextGenerate.generateConfirmMessage(request),
        callbackOnOk() {
          startNewChainBlockSession<FollowerSessionTarget>(request)
        },
      })
    } else {
      const message = TextGenerate.checkResultToString(maybeRequest.error)
      return uiContext.openSnackBar(message)
    }
  }
  return (
    <M.Box>
      <BigExecuteButton {...{ purpose }} disabled={!isAvailable()} onClick={executeSession} />
    </M.Box>
  )
}

function NewSessionFollowersPageWithoutSelectedUser() {
  return (
    <div>
      <TargetUserSelectUI />
      <BlockLimiterUI />
    </div>
  )
}

export default function NewSessionFollowersPage() {
  const { userSelection } = React.useContext(FollowerChainBlockPageStatesContext)
  const maybeRequest = useSessionRequest()
  if (!userSelection) {
    return NewSessionFollowersPageWithoutSelectedUser()
  }
  return (
    <div>
      <TargetUserSelectUI />
      <TargetOptionsUI />
      <BlockLimiterUI />
      <RequestCheckResultUI {...{ maybeRequest }} />
      <TargetExecutionButtonUI />
    </div>
  )
}
