import { TwitterURL } from '../common'
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
import { toggleOneClickBlockMode } from './misc'
import { doActionWithMultipleAccounts } from './multitude'
import type SessionManager from './session-manager'
import * as i18n from '~~/scripts/i18n'

type BrowserTab = browser.tabs.Tab

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
  browser.tabs.sendMessage<RBMessageToContent.ConfirmChainBlock>(tab.id!, {
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
  errorMessage += errors[0].message
  alertToTab(tab, errorMessage)
}

async function executeMultitude(tab: BrowserTab, action: UserAction, userName: string) {
  const cookieStoreId = await getCookieStoreIdFromTab(tab)
  const twClient = new TwitterAPI.TwClient({ cookieStoreId })
  const maybeUser = await getUserByName(twClient, userName)
  if (maybeUser.ok) {
    const user = maybeUser.value
    await doActionWithMultipleAccounts(action, user)
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
    retriever = (await examineRetrieverByTargetUser(executor, target.user)) || executor
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
  followKind: FollowKind
) {
  const executor = await initExecutorActor(tab)
  if (!executor) {
    alertToTab(tab, i18n.getMessage('error_occured_check_login'))
    return
  }
  const twClient = new TwitterAPI.TwClient(executor.clientOptions)
  const maybeUser = await getUserByName(twClient, userName)
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
  whoToBlock: {
    includeRetweeters: boolean
    includeLikers: boolean
    includeMentionedUsers: boolean
    includeQuotedUsers: boolean
    includeNonLinkedMentions: boolean
  }
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
  includesWho: {
    includeHostsAndSpeakers: boolean
    includeListeners: boolean
  }
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

// 크롬에선 browser.menus 대신 비표준 이름(browser.contextMenus)을 쓴다.
// 이를 파이어폭스와 맞추기 위해 이걸 함
const menus = new Proxy<typeof browser.menus>({} as any, {
  get(_target, name, receiver) {
    const menu = Reflect.get(browser.menus || {}, name, receiver)
    const ctxMenu = Reflect.get((browser as any).contextMenus || {}, name, receiver)
    return menu || ctxMenu
  },
})

let connectedSessionManager: SessionManager | null = null

export async function initializeContextMenu(
  sessionManager: SessionManager,
  enabledMenus: RedBlockUIOptions['menus']
) {
  connectedSessionManager = sessionManager
  await menus.removeAll()
  const redblockOptions = await loadOptions()
  // 우클릭 - 유저
  menus.create({
    contexts: ['link'],
    documentUrlPatterns,
    targetUrlPatterns: urlPatterns,
    title: i18n.getMessage('run_followers_chainblock_to_this_user'),
    visible: enabledMenus.chainBlockFollowers,
    onclick(clickEvent, tab) {
      const twURL = new TwitterURL(clickEvent.linkUrl!)
      const userName = twURL.getUserName()
      if (!userName) {
        alertToTab(tab, i18n.getMessage('cant_find_username_in_given_url', twURL.toString()))
        return
      }
      confirmFollowerChainBlockRequest(tab, sessionManager, userName, 'followers')
    },
  })
  menus.create({
    contexts: ['link'],
    documentUrlPatterns,
    targetUrlPatterns: urlPatterns,
    title: i18n.getMessage('run_followings_chainblock_to_this_user'),
    visible: enabledMenus.chainBlockFollowings,
    onclick(clickEvent, tab) {
      const twURL = new TwitterURL(clickEvent.linkUrl!)
      const userName = twURL.getUserName()
      if (!userName) {
        alertToTab(tab, i18n.getMessage('cant_find_username_in_given_url', twURL.toString()))
        return
      }
      confirmFollowerChainBlockRequest(tab, sessionManager, userName, 'friends')
    },
  })
  menus.create({
    contexts: ['link'],
    documentUrlPatterns,
    targetUrlPatterns: urlPatterns,
    title: i18n.getMessage('run_mutual_followers_chainblock_to_this_user'),
    visible: enabledMenus.chainBlockMutualFollowers,
    onclick(clickEvent, tab) {
      const twURL = new TwitterURL(clickEvent.linkUrl!)
      const userName = twURL.getUserName()
      if (!userName) {
        alertToTab(tab, i18n.getMessage('cant_find_username_in_given_url', twURL.toString()))
        return
      }
      confirmFollowerChainBlockRequest(tab, sessionManager, userName, 'mutual-followers')
    },
  })

  menus.create({
    contexts: ['link'],
    type: 'separator',
  })
  // 우클릭 - 트윗
  menus.create({
    contexts: ['link'],
    documentUrlPatterns,
    targetUrlPatterns: tweetUrlPatterns,
    title: i18n.getMessage('run_retweeters_chainblock_to_this_tweet'),
    visible: enabledMenus.chainBlockRetweeters,
    onclick(clickEvent, tab) {
      const twURL = new TwitterURL(clickEvent.linkUrl!)
      const tweetId = twURL.getTweetId()!
      confirmTweetReactionChainBlockRequest(tab, sessionManager, tweetId, {
        includeRetweeters: true,
        includeLikers: false,
        includeMentionedUsers: false,
        includeQuotedUsers: false,
        includeNonLinkedMentions: false,
      })
    },
  })
  menus.create({
    contexts: ['link'],
    documentUrlPatterns,
    targetUrlPatterns: tweetUrlPatterns,
    title: i18n.getMessage('run_likers_chainblock_to_this_tweet'),
    visible: enabledMenus.chainBlockLikers,
    onclick(clickEvent, tab) {
      const twURL = new TwitterURL(clickEvent.linkUrl!)
      const tweetId = twURL.getTweetId()!
      confirmTweetReactionChainBlockRequest(tab, sessionManager, tweetId, {
        includeRetweeters: false,
        includeLikers: true,
        includeMentionedUsers: false,
        includeQuotedUsers: false,
        includeNonLinkedMentions: false,
      })
    },
  })
  menus.create({
    contexts: ['link'],
    documentUrlPatterns,
    targetUrlPatterns: tweetUrlPatterns,
    title: i18n.getMessage('run_retweeters_and_likers_chainblock_to_this_tweet'),
    visible: enabledMenus.chainBlockRetweetersAndLikers,
    onclick(clickEvent, tab) {
      const twURL = new TwitterURL(clickEvent.linkUrl!)
      const tweetId = twURL.getTweetId()!
      confirmTweetReactionChainBlockRequest(tab, sessionManager, tweetId, {
        includeRetweeters: true,
        includeLikers: true,
        includeMentionedUsers: false,
        includeQuotedUsers: false,
        includeNonLinkedMentions: false,
      })
    },
  })
  menus.create({
    contexts: ['link'],
    documentUrlPatterns,
    targetUrlPatterns: tweetUrlPatterns,
    title: i18n.getMessage('run_mentioned_users_chainblock_to_this_tweet'),
    visible: enabledMenus.chainBlockMentioned,
    onclick(clickEvent, tab) {
      const twURL = new TwitterURL(clickEvent.linkUrl!)
      const tweetId = twURL.getTweetId()!
      confirmTweetReactionChainBlockRequest(tab, sessionManager, tweetId, {
        includeRetweeters: false,
        includeLikers: false,
        includeMentionedUsers: true,
        includeQuotedUsers: false,
        includeNonLinkedMentions: false,
      })
    },
  })
  menus.create({
    contexts: ['link'],
    documentUrlPatterns,
    targetUrlPatterns: audioSpaceUrlPatterns,
    title: i18n.getMessage('run_chainblock_from_audio_space_hosts_and_speakers'),
    visible: enabledMenus.chainBlockAudioSpaceSpeakers,
    onclick(clickEvent, tab) {
      const twURL = new TwitterURL(clickEvent.linkUrl!)
      const audioSpaceId = twURL.getAudioSpaceId()!
      confirmAudioSpaceChainBlockRequest(tab, sessionManager, audioSpaceId, {
        includeHostsAndSpeakers: true,
        includeListeners: false,
      })
    },
  })
  menus.create({
    contexts: ['link'],
    documentUrlPatterns,
    targetUrlPatterns: audioSpaceUrlPatterns,
    title: i18n.getMessage('run_chainblock_from_audio_space_all'),
    visible: enabledMenus.chainBlockAudioSpaceSpeakers,
    onclick(clickEvent, tab) {
      const twURL = new TwitterURL(clickEvent.linkUrl!)
      const audioSpaceId = twURL.getAudioSpaceId()!
      confirmAudioSpaceChainBlockRequest(tab, sessionManager, audioSpaceId, {
        includeHostsAndSpeakers: true,
        includeListeners: true,
      })
    },
  })
  menus.create({
    contexts: ['link'],
    documentUrlPatterns,
    targetUrlPatterns: hashtagUrlPatterns,
    title: i18n.getMessage('run_hashtag_user_chainblock'),
    visible: enabledMenus.chainBlockHashTagInUsersProfile,
    onclick(clickEvent, tab) {
      const twURL = new TwitterURL(clickEvent.linkUrl!)
      const hashtag = twURL.getHashTag()!
      confirmUserHashTagChainBlockRequest(tab, sessionManager, hashtag)
    },
  })
  menus.create({
    contexts: ['link'],
    type: 'separator',
    visible: redblockOptions.enableMultitude,
  })
  menus.create({
    contexts: ['link'],
    documentUrlPatterns,
    targetUrlPatterns: urlPatterns,
    title: i18n.getMessage('multitude_block_user'),
    visible: redblockOptions.enableMultitude && enabledMenus.multitudeBlock,
    async onclick(clickEvent, tab) {
      const twURL = new TwitterURL(clickEvent.linkUrl!)
      const userName = twURL.getUserName()
      if (!userName) {
        alertToTab(tab, i18n.getMessage('cant_find_username_in_given_url', twURL.toString()))
        return
      }
      executeMultitude(tab, 'Block', userName)
    },
  })
  menus.create({
    contexts: ['link'],
    documentUrlPatterns,
    targetUrlPatterns: urlPatterns,
    title: i18n.getMessage('multitude_unblock_user'),
    visible: redblockOptions.enableMultitude && enabledMenus.multitudeUnblock,
    async onclick(clickEvent, tab) {
      const twURL = new TwitterURL(clickEvent.linkUrl!)
      const userName = twURL.getUserName()
      if (!userName) {
        alertToTab(tab, i18n.getMessage('cant_find_username_in_given_url', twURL.toString()))
        return
      }
      executeMultitude(tab, 'UnBlock', userName)
    },
  })
  menus.create({
    contexts: ['link'],
    documentUrlPatterns,
    targetUrlPatterns: urlPatterns,
    title: i18n.getMessage('multitude_mute_user'),
    visible: redblockOptions.enableMultitude && enabledMenus.multitudeMute,
    async onclick(clickEvent, tab) {
      const twURL = new TwitterURL(clickEvent.linkUrl!)
      const userName = twURL.getUserName()
      if (!userName) {
        alertToTab(tab, i18n.getMessage('cant_find_username_in_given_url', twURL.toString()))
        return
      }
      executeMultitude(tab, 'Mute', userName)
    },
  })
  menus.create({
    contexts: ['link'],
    documentUrlPatterns,
    targetUrlPatterns: urlPatterns,
    title: i18n.getMessage('multitude_unmute_user'),
    visible: redblockOptions.enableMultitude && enabledMenus.multitudeUnmute,
    async onclick(clickEvent, tab) {
      const twURL = new TwitterURL(clickEvent.linkUrl!)
      const userName = twURL.getUserName()
      if (!userName) {
        alertToTab(tab, i18n.getMessage('cant_find_username_in_given_url', twURL.toString()))
        return
      }
      executeMultitude(tab, 'UnMute', userName)
    },
  })
  // 확장기능버튼
  menus.create({
    contexts: ['browser_action'],
    title: i18n.getMessage('open_in_new_tab'),
    onclick(_clickEvent, _tab) {
      const url = browser.runtime.getURL('/popup/popup.html') + '?istab=1'
      browser.tabs.create({
        active: true,
        url,
      })
    },
  })
  menus.create({
    contexts: ['browser_action'],
    title: i18n.getMessage('options'),
    onclick(_clickEvent, _tab) {
      browser.runtime.openOptionsPage()
    },
  })
  menus.create({
    contexts: ['browser_action'],
    type: 'separator',
  })
  menus.create({
    contexts: ['browser_action'],
    title: `${i18n.getMessage('oneclick_block_mode')}: ON`,
    onclick(_clickEvent, tab) {
      if (TwitterURL.nullable(tab.url!)) {
        toggleOneClickBlockMode(tab, true)
      }
    },
  })
  menus.create({
    contexts: ['browser_action'],
    title: `${i18n.getMessage('oneclick_block_mode')}: OFF`,
    onclick(_clickEvent, tab) {
      if (TwitterURL.nullable(tab.url!)) {
        toggleOneClickBlockMode(tab, false)
      }
    },
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
