import * as MaterialUI from '@mui/material'

import sortBy from 'lodash-es/sortBy'
import React from 'react'
import browser from 'webextension-polyfill'

import { startNewChainBlockSession } from '../../scripts/background/request-sender'
import { onStorageChanged } from '../../scripts/background/storage'
import * as RedBlockBookmarksStorage from '../../scripts/background/storage/bookmarks'
import { TargetCheckResult, validateRequest } from '../../scripts/background/target-checker'
import { TwClient } from '../../scripts/background/twitter-api'
import TwitterUserMap from '../../scripts/common/twitter-user-map'
import * as i18n from '../../scripts/i18n'
import * as TextGenerate from '../../scripts/text-generate'
import { getUserNameFromTab } from '../popup'
import { BigExecuteButton, PurposeSelectionUI, TwitterUserProfile } from './components'
import {
  Controls as TargetSelectorControls,
  identifierOfItem,
  ItemsGroup,
  Options as TargetSelectorOptions,
  TargetGroup,
  TargetSelector,
  TargetSelectorItem,
  UserItem,
} from './components/target-selector'
import {
  BlockLimiterContext,
  RedBlockOptionsContext,
  RetrieverContext,
  TabInfoContext,
  UIContext,
} from './contexts'
import { ExtraSessionOptionsContext, FollowerChainBlockPageStatesContext } from './ui-states'

import BlockLimiterUI from '../popup-components/block-limiter-ui'

const M = MaterialUI

const userCache = new TwitterUserMap()

interface UserSelectorContextType {
  changeSelectedUser(userId: string, group: TargetGroup): void
}
const UserSelectorContext = React.createContext<UserSelectorContextType>(null!)

function useSessionRequest(): Either<TargetCheckResult, SessionRequest<FollowerSessionTarget>> {
  const { purpose, targetList, userSelection } = React.useContext(
    FollowerChainBlockPageStatesContext,
  )
  const { myself } = React.useContext(TabInfoContext)
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
        uiContext.dispatchUIStates({
          type: 'open-snack-bar',
          message: i18n.getMessage('user_xxx_already_exists', user.screen_name),
        })
        return
      }
      await RedBlockBookmarksStorage.insertItemToBookmark(
        RedBlockBookmarksStorage.createBookmarkUserItem(user),
      )
      uiContext.dispatchUIStates({
        type: 'open-snack-bar',
        message: i18n.getMessage('user_xxx_added', user.screen_name),
      })
    },
    async removeUserFromBookmark(user: TwitterUser) {
      const userId = user.id_str
      await RedBlockBookmarksStorage.modifyBookmarksWith(bookmarks => {
        const itemToRemove = Array.from(bookmarks.values()).find(
          item => item.type === 'user' && item.userId === userId,
        )
        if (itemToRemove) {
          bookmarks.delete(itemToRemove.itemId)
        } else {
          console.warn('item already removed? user-id:"%s"', userId)
        }
        return bookmarks
      })
      uiContext.dispatchUIStates({
        type: 'open-snack-bar',
        message: i18n.getMessage('user_xxx_removed', user.screen_name),
      })
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
          {sortedByName(usersInOtherTab).map((user, index) => <UserItem key={index} user={user} />)}
        </ItemsGroup>
        <ItemsGroup
          group="bookmarked"
          label={`${i18n.getMessage('saved_user')} (${bookmarkedUsers.size})`}
        >
          {sortedByName(bookmarkedUsers).map((user, index) => <UserItem key={index} user={user} />)}
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
  const { myself } = React.useContext(TabInfoContext)
  const selectedMyself = user.id_str === myself!.user.id_str
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
      <M.Box>
        <M.Box display="flex" flexDirection="column">
          {selectedMyself && <div>&#10071; {i18n.getMessage('its_you')}</div>}
        </M.Box>
        <M.RadioGroup row>
          {radio('followers', TextGenerate.formatFollowsCount('followers', user.followers_count))}
          {radio('friends', TextGenerate.formatFollowsCount('friends', user.friends_count))}
          {radio('mutual-followers', i18n.getMessage('mutual_followers'))}
        </M.RadioGroup>
      </M.Box>
    </TwitterUserProfile>
  )
}

const CenteredCircularProgress = MaterialUI.styled(M.CircularProgress)(({ theme }) => ({
  '&.centered': {
    margin: theme.spacing(1, 'auto'),
  },
}))

function TargetUserProfileEmpty({ reason }: { reason: 'invalid-user' | 'loading' }) {
  if (reason === 'loading') {
    return <CenteredCircularProgress className="centered" color="secondary" />
  }
  return <div></div>
}

function TargetUserSelectUI() {
  const { currentUser, userSelection, setUserSelection } = React.useContext(
    FollowerChainBlockPageStatesContext,
  )
  const { myself } = React.useContext(TabInfoContext)
  const { dispatchUIStates } = React.useContext(UIContext)
  const [bookmarkedUsers, setBookmarkedUsers] = React.useState(new TwitterUserMap())
  const [usersInOtherTab, setUsersInOtherTab] = React.useState(new TwitterUserMap())
  const [isLoading, setLoadingState] = React.useState(false)
  const twClient = new TwClient(myself!.clientOptions)
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
        dispatchUIStates({
          type: 'open-modal',
          content: {
            dialogType: 'alert',
            message: {
              title: i18n.getMessage('failed_to_get_user_info'),
            },
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
        const userNames = tabs.map(getUserNameFromTab).filter(Boolean) as string[]
        const usersArray = await twClient
          .getMultipleUsers({ screen_name: userNames })
          .catch(() => [])
        const usersMap = TwitterUserMap.fromUsersArray(usersArray)
        setUsersInOtherTab(usersMap)
      })
  }, [])
  return (
    <M.FormControl component="fieldset" fullWidth>
      <UserSelectorContext.Provider value={{ changeSelectedUser }}>
        <FollowerChainBlockTargetSelector {...{ bookmarkedUsers, usersInOtherTab }} />
      </UserSelectorContext.Provider>
      <M.Divider />
      <M.Box mt={2}>
        {userSelection
          ? <TargetUserProfile user={userSelection.user} />
          : <TargetUserProfileEmpty reason={isLoading ? 'loading' : 'invalid-user'} />}
      </M.Box>
    </M.FormControl>
  )
}

function TargetOptionsUI() {
  const { purpose, changePurposeType, mutatePurposeOptions, availablePurposeTypes } = React
    .useContext(FollowerChainBlockPageStatesContext)

  const maybeRequest = useSessionRequest()
  return (
    <PurposeSelectionUI
      {...{
        purpose,
        changePurposeType,
        mutatePurposeOptions,
        availablePurposeTypes,
        maybeRequest,
      }}
    />
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
  userIds: string[],
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
  const { dispatchUIStates } = React.useContext(UIContext)
  const limiterStatus = React.useContext(BlockLimiterContext)
  const maybeRequest = useSessionRequest()
  function isAvailable() {
    if (!userSelection) {
      return false
    }
    const remained = limiterStatus.max - limiterStatus.current
    if (remained <= 0 && purpose.type === 'chainblock') {
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
      return dispatchUIStates({
        type: 'open-modal',
        content: {
          dialogType: 'confirm',
          message: TextGenerate.generateConfirmMessage(request),
          callbackOnOk() {
            startNewChainBlockSession<FollowerSessionTarget>(request)
          },
        },
      })
    } else {
      const message = TextGenerate.checkResultToString(maybeRequest.error)
      return dispatchUIStates({ type: 'open-snack-bar', message })
    }
  }
  return (
    <M.Box mt={1}>
      <BigExecuteButton {...{ purpose }} disabled={!isAvailable()} onClick={executeSession} />
    </M.Box>
  )
}

function NewSessionFollowersPageWithoutSelectedUser() {
  return (
    <div>
      <M.Paper>
        <M.Box p={2}>
          <TargetUserSelectUI />
        </M.Box>
      </M.Paper>
      <BlockLimiterUI />
    </div>
  )
}

export default function NewSessionFollowersPage() {
  const { userSelection } = React.useContext(FollowerChainBlockPageStatesContext)
  if (!userSelection) {
    return NewSessionFollowersPageWithoutSelectedUser()
  }
  return (
    <div>
      <M.Paper>
        <M.Box p={2}>
          <TargetUserSelectUI />
          <M.Divider />
          <TargetOptionsUI />
          <TargetExecutionButtonUI />
        </M.Box>
      </M.Paper>
      <BlockLimiterUI />
    </div>
  )
}
