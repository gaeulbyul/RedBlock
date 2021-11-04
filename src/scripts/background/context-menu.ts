import { sendBrowserTabMessage, toggleOneClickBlockMode } from '../common/utilities'
import TwitterURL from '../common/twitter-url'
import {
  defaultChainBlockPurposeOptions,
  defaultExtraSessionOptions,
} from './chainblock-session/default-options'
import * as TwitterAPI from './twitter-api'
import { TargetCheckResult } from './target-checker'
import { generateConfirmMessage, checkResultToString, objToString } from '../text-generate'
import { alertToTab } from './background'
import { getCookieStoreIdFromTab } from './cookie-handler'
import { loadOptions, loadUIOptions, defaultUIOptions } from './storage/options'

import { examineRetrieverByTargetUser } from './blockbuster'
import {
  TeamworkUserAction,
  doActionWithMultipleAccounts,
  generateTeamworkResultMessage,
} from './teamwork'
import type SessionManager from './session-manager'
import * as i18n from '../../scripts/i18n'
import browser from 'webextension-polyfill'

type BrowserTab = browser.Tabs.Tab

const urlPatterns = [
  'https://twitter.com/*',
  'https://mobile.twitter.com/*',
  'https://tweetdeck.twitter.com/*',
]
const documentUrlPatterns = [
  'https://twitter.com/*',
  'https://mobile.twitter.com/*',
  'https://tweetdeck.twitter.com/*',
]
const tweetUrlPatterns = [
  'https://twitter.com/*/status/*',
  'https://mobile.twitter.com/*/status/*',
  'https://tweetdeck.twitter.com/*/status/*',
]
const audioSpaceUrlPatterns = [
  'https://twitter.com/i/spaces/*',
  'https://mobile.twitter.com/i/spaces/*',
  'https://tweetdeck.twitter.com/i/spaces/*',
]
const hashtagUrlPatterns = [
  'https://twitter.com/hashtag/*',
  'https://mobile.twitter.com/hashtag/*',
  'https://tweetdeck.twitter.com/hashtag/*',
]

const extraSessionOptions = defaultExtraSessionOptions

async function sendConfirmToTab(tab: BrowserTab, request: SessionRequest<AnySessionTarget>) {
  const confirmMessage = objToString(generateConfirmMessage(request))
  sendBrowserTabMessage<RBMessageToContent.ConfirmChainBlock>(tab.id!, {
    messageType: 'ConfirmChainBlock',
    messageTo: 'content',
    confirmMessage,
    request,
  })
}

async function initExecutorActor(tab: BrowserTab): Promise<Actor | null> {
  const cookieStoreId = await getCookieStoreIdFromTab(tab)
  const clientOptions = { cookieStoreId }
  const twClient = new TwitterAPI.TwClient(clientOptions)
  const myself = await twClient.getMyself().catch(() => null)
  if (myself) {
    return { user: myself, clientOptions }
  } else {
    return null
  }
}

async function getUserByName(
  twClient: TwClient,
  userName: string
): Promise<Either<TwitterAPI.ErrorResponse, TwitterUser>> {
  return twClient
    .getSingleUser({ screen_name: userName })
    .then(user => ({ ok: true as const, value: user }))
    .catch(error => ({ ok: false, error }))
}

function showErrorAlert({
  tab,
  userName,
  error: { errors },
}: {
  tab: BrowserTab
  userName: string
  error: TwitterAPI.ErrorResponse
}) {
  let errorMessage = i18n.getMessage('error_occured_on_retrieving_user', userName)
  errorMessage += '\n==========\n'
  errorMessage += errors[0]?.message
  alertToTab(tab, errorMessage)
}

async function executeTeamwork(tab: BrowserTab, action: TeamworkUserAction, userName: string) {
  const cookieStoreId = await getCookieStoreIdFromTab(tab)
  const twClient = new TwitterAPI.TwClient({ cookieStoreId })
  const maybeUser = await getUserByName(twClient, userName)
  if (maybeUser.ok) {
    const user = maybeUser.value
    const results = await doActionWithMultipleAccounts(action, user)
    const resultMessage = generateTeamworkResultMessage(action, results)
    alertToTab(tab, resultMessage)
  } else {
    const { error } = maybeUser
    showErrorAlert({ tab, userName, error })
    return
  }
}

async function confirmChainBlockRequest(
  tab: BrowserTab,
  sessionManager: SessionManager,
  executor: Actor,
  target: AnySessionTarget
) {
  const options = await loadOptions()
  let retriever: Actor
  if (target.type === 'follower' && options.enableBlockBuster) {
    retriever =
      (await examineRetrieverByTargetUser(executor, target.user, {
        includeTweetDeck: options.enableBlockBusterWithTweetDeck,
        includeAnotherCookieStores: true,
      })) || executor
  } else {
    retriever = executor
  }
  const request: SessionRequest<AnySessionTarget> = {
    purpose: defaultChainBlockPurposeOptions,
    options,
    target,
    retriever,
    executor,
    extraSessionOptions,
  }
  const checkResult = sessionManager.checkRequest(request)
  if (checkResult === TargetCheckResult.Ok) {
    return sendConfirmToTab(tab, request)
  } else {
    const alertMessage = checkResultToString(checkResult)
    return alertToTab(tab, alertMessage)
  }
}

async function confirmFollowerChainBlockRequest(
  tab: BrowserTab,
  sessionManager: SessionManager,
  userName: string,
  menuId:
    | 'run_followers_chainblock_to_this_user'
    | 'run_followings_chainblock_to_this_user'
    | 'run_mutual_followers_chainblock_to_this_user'
) {
  const executor = await initExecutorActor(tab)
  if (!executor) {
    alertToTab(tab, i18n.getMessage('error_occured_check_login'))
    return
  }
  const twClient = new TwitterAPI.TwClient(executor.clientOptions)
  const maybeUser = await getUserByName(twClient, userName)
  let followKind: FollowKind
  switch (menuId) {
    case 'run_followers_chainblock_to_this_user':
      followKind = 'followers'
      break
    case 'run_followings_chainblock_to_this_user':
      followKind = 'friends'
      break
    case 'run_mutual_followers_chainblock_to_this_user':
      followKind = 'mutual-followers'
      break
  }
  if (maybeUser.ok) {
    const user = maybeUser.value
    return confirmChainBlockRequest(tab, sessionManager, executor, {
      type: 'follower',
      list: followKind,
      user,
    })
  } else {
    const { error } = maybeUser
    showErrorAlert({ tab, userName, error })
    return
  }
}

async function confirmTweetReactionChainBlockRequest(
  tab: BrowserTab,
  sessionManager: SessionManager,
  tweetId: string,
  menuId:
    | 'run_retweeters_chainblock_to_this_tweet'
    | 'run_likers_chainblock_to_this_tweet'
    | 'run_retweeters_and_likers_chainblock_to_this_tweet'
    | 'run_mentioned_users_chainblock_to_this_tweet'
) {
  const executor = await initExecutorActor(tab)
  if (!executor) {
    alertToTab(tab, i18n.getMessage('error_occured_check_login'))
    return
  }
  const twClient = new TwitterAPI.TwClient(executor.clientOptions)
  const tweet = await twClient.getTweetById(tweetId).catch(() => null)
  if (!tweet) {
    alertToTab(tab, i18n.getMessage('error_occured_on_retrieving_tweet'))
    return
  }
  const whoToBlock = {
    includeRetweeters: false,
    includeLikers: false,
    includeMentionedUsers: false,
    includeQuotedUsers: false,
    includeNonLinkedMentions: false,
  }
  switch (menuId) {
    case 'run_retweeters_chainblock_to_this_tweet':
      whoToBlock.includeRetweeters = true
      break
    case 'run_likers_chainblock_to_this_tweet':
      whoToBlock.includeLikers = true
      break
    case 'run_retweeters_and_likers_chainblock_to_this_tweet':
      whoToBlock.includeRetweeters = true
      whoToBlock.includeLikers = true
      break
    case 'run_mentioned_users_chainblock_to_this_tweet':
      whoToBlock.includeMentionedUsers = true
      break
  }
  return confirmChainBlockRequest(tab, sessionManager, executor, {
    type: 'tweet_reaction',
    tweet,
    ...whoToBlock,
    includedReactionsV2: [], // TODO 반응별로 나누기
  })
}

async function confirmAudioSpaceChainBlockRequest(
  tab: BrowserTab,
  sessionManager: SessionManager,
  audioSpaceId: string,
  menuId:
    | 'run_chainblock_from_audio_space_hosts_and_speakers'
    | 'run_chainblock_from_audio_space_all'
) {
  const executor = await initExecutorActor(tab)
  if (!executor) {
    alertToTab(tab, i18n.getMessage('error_occured_check_login'))
    return
  }
  const twClient = new TwitterAPI.TwClient(executor.clientOptions)
  const audioSpace = await twClient.getAudioSpaceById(audioSpaceId).catch(() => null)
  if (!audioSpace) {
    alertToTab(tab, i18n.getMessage('error_occured_on_retrieving_audio_space'))
    return
  }
  const includesWho = {
    includeHostsAndSpeakers: true,
    includeListeners: false,
  }
  if (menuId === 'run_chainblock_from_audio_space_all') {
    includesWho.includeListeners = true
  }
  return confirmChainBlockRequest(tab, sessionManager, executor, {
    type: 'audio_space',
    audioSpace,
    ...includesWho,
  })
}

async function confirmUserHashTagChainBlockRequest(
  tab: BrowserTab,
  sessionManager: SessionManager,
  hashtag: string
) {
  const executor = await initExecutorActor(tab)
  if (!executor) {
    alertToTab(tab, i18n.getMessage('error_occured_check_login'))
    return
  }
  return confirmChainBlockRequest(tab, sessionManager, executor, {
    type: 'user_search',
    query: `#${hashtag}`,
  })
}

let connectedSessionManager: SessionManager | null = null

function isValidMenuId(menuItemId: string | number): menuItemId is typeof menuIds[number] {
  const menuIds = [
    'run_followers_chainblock_to_this_user',
    'run_followings_chainblock_to_this_user',
    'run_mutual_followers_chainblock_to_this_user',

    'run_retweeters_chainblock_to_this_tweet',
    'run_likers_chainblock_to_this_tweet',
    'run_retweeters_and_likers_chainblock_to_this_tweet',
    'run_mentioned_users_chainblock_to_this_tweet',

    'run_chainblock_from_audio_space_hosts_and_speakers',
    'run_chainblock_from_audio_space_all',

    'run_hashtag_user_chainblock',

    'teamwork_block_user',
    'teamwork_unblock_user',
    'teamwork_mute_user',
    'teamwork_unmute_user',

    'open_in_new_tab',
    'options',

    'oneclick_block_mode--on',
    'oneclick_block_mode--off',
  ] as const
  if (typeof menuItemId !== 'string') {
    return false
  }
  return menuIds.includes(menuItemId as any)
}

browser.contextMenus.onClicked.addListener((clickInfo, tab) => {
  const { menuItemId, linkUrl } = clickInfo
  if (!connectedSessionManager) {
    console.warn('warning: failed to refresh context menus (sessionManager missing?)')
    return
  }
  if (!isValidMenuId(menuItemId)) {
    console.warn('menuId "%s" is unknown.', clickInfo.menuItemId)
    return
  }
  if (!tab) {
    console.warn('tab is missing?')
    return
  }
  const twURL = TwitterURL.nullable(linkUrl!)
  switch (menuItemId) {
    case 'run_followers_chainblock_to_this_user':
    case 'run_followings_chainblock_to_this_user':
    case 'run_mutual_followers_chainblock_to_this_user':
      {
        const userName = twURL!.getUserName()
        if (!userName) {
          alertToTab(tab, i18n.getMessage('cant_find_username_in_given_url', twURL!.toString()))
          return
        }
        confirmFollowerChainBlockRequest(tab, connectedSessionManager, userName, menuItemId)
      }
      break
    case 'run_retweeters_chainblock_to_this_tweet':
    case 'run_likers_chainblock_to_this_tweet':
    case 'run_retweeters_and_likers_chainblock_to_this_tweet':
    case 'run_mentioned_users_chainblock_to_this_tweet':
      {
        const tweetId = twURL!.getTweetId()!
        confirmTweetReactionChainBlockRequest(tab, connectedSessionManager, tweetId, menuItemId)
      }
      break
    case 'run_chainblock_from_audio_space_hosts_and_speakers':
    case 'run_chainblock_from_audio_space_all':
      {
        const audioSpaceId = twURL!.getAudioSpaceId()!
        confirmAudioSpaceChainBlockRequest(tab, connectedSessionManager, audioSpaceId, menuItemId)
      }
      break
    case 'run_hashtag_user_chainblock':
      {
        const hashtag = twURL!.getHashTag()!
        confirmUserHashTagChainBlockRequest(tab, connectedSessionManager, hashtag)
      }
      break

    case 'teamwork_block_user':
    case 'teamwork_unblock_user':
    case 'teamwork_mute_user':
    case 'teamwork_unmute_user':
      {
        const userName = twURL!.getUserName()
        if (!userName) {
          alertToTab(tab, i18n.getMessage('cant_find_username_in_given_url', twURL!.toString()))
          return
        }
        let action: TeamworkUserAction
        switch (menuItemId) {
          case 'teamwork_block_user':
            action = 'Block'
            break
          case 'teamwork_unblock_user':
            action = 'UnBlock'
            break
          case 'teamwork_mute_user':
            action = 'Mute'
            break
          case 'teamwork_unmute_user':
            action = 'UnMute'
            break
        }
        executeTeamwork(tab, action, userName)
      }
      break

    case 'open_in_new_tab':
      browser.tabs.create({
        active: true,
        url: browser.runtime.getURL('/popup/popup.html') + '?istab=1',
      })
      break
    case 'options':
      browser.runtime.openOptionsPage()
      break

    case 'oneclick_block_mode--on':
    case 'oneclick_block_mode--off':
      {
        if (twURL) {
          toggleOneClickBlockMode(tab, menuItemId.endsWith('--on'))
        }
      }
      break
  }
})

export async function initializeContextMenu(
  sessionManager: SessionManager,
  enabledMenus: RedBlockUIOptions['menus']
) {
  connectedSessionManager = sessionManager
  await browser.contextMenus.removeAll()
  const redblockOptions = await loadOptions()
  // 우클릭 - 유저
  browser.contextMenus.create({
    id: 'run_followers_chainblock_to_this_user',
    contexts: ['link'],
    documentUrlPatterns,
    targetUrlPatterns: urlPatterns,
    title: i18n.getMessage('run_followers_chainblock_to_this_user'),
    visible: enabledMenus.chainBlockFollowers,
  })
  browser.contextMenus.create({
    id: 'run_followings_chainblock_to_this_user',
    contexts: ['link'],
    documentUrlPatterns,
    targetUrlPatterns: urlPatterns,
    title: i18n.getMessage('run_followings_chainblock_to_this_user'),
    visible: enabledMenus.chainBlockFollowings,
  })
  browser.contextMenus.create({
    id: 'run_mutual_followers_chainblock_to_this_user',
    contexts: ['link'],
    documentUrlPatterns,
    targetUrlPatterns: urlPatterns,
    title: i18n.getMessage('run_mutual_followers_chainblock_to_this_user'),
    visible: enabledMenus.chainBlockMutualFollowers,
  })

  browser.contextMenus.create({
    contexts: ['link'],
    type: 'separator',
  })
  // 우클릭 - 트윗
  browser.contextMenus.create({
    id: 'run_retweeters_chainblock_to_this_tweet',
    contexts: ['link'],
    documentUrlPatterns,
    targetUrlPatterns: tweetUrlPatterns,
    title: i18n.getMessage('run_retweeters_chainblock_to_this_tweet'),
    visible: enabledMenus.chainBlockRetweeters,
  })
  browser.contextMenus.create({
    id: 'run_likers_chainblock_to_this_tweet',
    contexts: ['link'],
    documentUrlPatterns,
    targetUrlPatterns: tweetUrlPatterns,
    title: i18n.getMessage('run_likers_chainblock_to_this_tweet'),
    visible: enabledMenus.chainBlockLikers,
  })
  browser.contextMenus.create({
    id: 'run_retweeters_and_likers_chainblock_to_this_tweet',
    contexts: ['link'],
    documentUrlPatterns,
    targetUrlPatterns: tweetUrlPatterns,
    title: i18n.getMessage('run_retweeters_and_likers_chainblock_to_this_tweet'),
    visible: enabledMenus.chainBlockRetweetersAndLikers,
  })
  browser.contextMenus.create({
    id: 'run_mentioned_users_chainblock_to_this_tweet',
    contexts: ['link'],
    documentUrlPatterns,
    targetUrlPatterns: tweetUrlPatterns,
    title: i18n.getMessage('run_mentioned_users_chainblock_to_this_tweet'),
    visible: enabledMenus.chainBlockMentioned,
  })
  browser.contextMenus.create({
    id: 'run_chainblock_from_audio_space_hosts_and_speakers',
    contexts: ['link'],
    documentUrlPatterns,
    targetUrlPatterns: audioSpaceUrlPatterns,
    title: i18n.getMessage('run_chainblock_from_audio_space_hosts_and_speakers'),
    visible: enabledMenus.chainBlockAudioSpaceSpeakers,
  })
  browser.contextMenus.create({
    id: 'run_chainblock_from_audio_space_all',
    contexts: ['link'],
    documentUrlPatterns,
    targetUrlPatterns: audioSpaceUrlPatterns,
    title: i18n.getMessage('run_chainblock_from_audio_space_all'),
    visible: enabledMenus.chainBlockAudioSpaceSpeakers,
  })
  browser.contextMenus.create({
    id: 'run_hashtag_user_chainblock',
    contexts: ['link'],
    documentUrlPatterns,
    targetUrlPatterns: hashtagUrlPatterns,
    title: i18n.getMessage('run_hashtag_user_chainblock'),
    visible: enabledMenus.chainBlockHashTagInUsersProfile,
  })
  browser.contextMenus.create({
    contexts: ['link'],
    type: 'separator',
    visible: redblockOptions.enableTeamwork,
  })
  browser.contextMenus.create({
    id: 'teamwork_block_user',
    contexts: ['link'],
    documentUrlPatterns,
    targetUrlPatterns: urlPatterns,
    title: i18n.getMessage('teamwork_block_user'),
    visible: redblockOptions.enableTeamwork && enabledMenus.teamworkBlock,
  })
  browser.contextMenus.create({
    id: 'teamwork_unblock_user',
    contexts: ['link'],
    documentUrlPatterns,
    targetUrlPatterns: urlPatterns,
    title: i18n.getMessage('teamwork_unblock_user'),
    visible: redblockOptions.enableTeamwork && enabledMenus.teamworkUnblock,
  })
  browser.contextMenus.create({
    id: 'teamwork_mute_user',
    contexts: ['link'],
    documentUrlPatterns,
    targetUrlPatterns: urlPatterns,
    title: i18n.getMessage('teamwork_mute_user'),
    visible: redblockOptions.enableTeamwork && enabledMenus.teamworkMute,
  })
  browser.contextMenus.create({
    id: 'teamwork_unmute_user',
    contexts: ['link'],
    documentUrlPatterns,
    targetUrlPatterns: urlPatterns,
    title: i18n.getMessage('teamwork_unmute_user'),
    visible: redblockOptions.enableTeamwork && enabledMenus.teamworkUnmute,
  })
  // 확장기능버튼
  browser.contextMenus.create({
    id: 'open_in_new_tab',
    contexts: ['browser_action'],
    title: i18n.getMessage('open_in_new_tab'),
  })
  browser.contextMenus.create({
    id: 'options',
    contexts: ['browser_action'],
    title: i18n.getMessage('options'),
  })
  browser.contextMenus.create({
    contexts: ['browser_action'],
    type: 'separator',
  })
  browser.contextMenus.create({
    id: 'oneclick_block_mode--on',
    contexts: ['browser_action'],
    title: `${i18n.getMessage('oneclick_block_mode')}: ON`,
  })
  browser.contextMenus.create({
    id: 'oneclick_block_mode--off',
    contexts: ['browser_action'],
    title: `${i18n.getMessage('oneclick_block_mode')}: OFF`,
  })
}

browser.storage.onChanged.addListener((changes: Partial<RedBlockStorageChanges>) => {
  if (!connectedSessionManager) {
    console.warn('warning: failed to refresh context menus (sessionManager missing?)')
    return
  }
  if (changes.uiOptions) {
    const newUiOptions = Object.assign({}, defaultUIOptions, changes.uiOptions.newValue || {})
    initializeContextMenu(connectedSessionManager, newUiOptions.menus)
  } else if (changes.options) {
    loadUIOptions().then(uiOptions =>
      initializeContextMenu(connectedSessionManager!, uiOptions.menus)
    )
  }
})
