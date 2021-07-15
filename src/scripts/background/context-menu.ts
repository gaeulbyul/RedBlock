import { getUserNameFromURL, getAudioSpaceIdFromUrl } from '../common'
import { defaultChainBlockPurposeOptions } from './chainblock-session/default-options'
import * as TwitterAPI from './twitter-api'
import { TargetCheckResult } from './target-checker'
import { generateConfirmMessage, checkResultToString, objToString } from '../text-generate'
import { alertToTab } from './background'
import { getCookieStoreIdFromTab } from './cookie-handler'
import { loadOptions, loadUIOptions } from './storage'
import { examineRetrieverByTargetUser } from './antiblock'
import { toggleOneClickBlockMode } from './misc'
import type ChainBlocker from './chainblock'
import * as i18n from '~~/scripts/i18n'

type BrowserTab = browser.tabs.Tab

const urlPatterns = ['https://twitter.com/*', 'https://mobile.twitter.com/*']
const documentUrlPatterns = [
  'https://twitter.com/*',
  'https://mobile.twitter.com/*',
  'https://tweetdeck.twitter.com/*',
]
const tweetUrlPatterns = ['https://twitter.com/*/status/*', 'https://mobile.twitter.com/*/status/*']
const audioSpaceUrlPatterns = [
  'https://twitter.com/i/spaces/*',
  'https://mobile.twitter.com/i/spaces/*',
]
const validHostNames = ['twitter.com', 'mobile.twitter.com', 'tweetdeck.twitter.com']

const extraTarget: SessionRequest<AnySessionTarget>['extraTarget'] = {
  bioBlock: 'never',
}

function getTweetIdFromUrl(url: URL) {
  const match = /\/status\/(\d+)/.exec(url.pathname)
  return match && match[1]
}

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

async function confirmChainBlockRequest(
  tab: BrowserTab,
  chainblocker: ChainBlocker,
  executor: Actor,
  target: AnySessionTarget
) {
  const options = await loadOptions()
  let retriever: Actor
  if (target.type === 'follower' && options.enableAntiBlock) {
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
    extraTarget,
  }
  const checkResult = chainblocker.checkRequest(request)
  if (checkResult === TargetCheckResult.Ok) {
    return sendConfirmToTab(tab, request)
  } else {
    const alertMessage = checkResultToString(checkResult)
    return alertToTab(tab, alertMessage)
  }
}

async function confirmFollowerChainBlockRequest(
  tab: BrowserTab,
  chainblocker: ChainBlocker,
  userName: string,
  followKind: FollowKind
) {
  const executor = await initExecutorActor(tab)
  if (!executor) {
    alertToTab(tab, i18n.getMessage('error_occured_check_login'))
    return
  }
  const twClient = new TwitterAPI.TwClient(executor.clientOptions)
  const user = await twClient.getSingleUser({ screen_name: userName }).catch(() => null)
  if (!user) {
    alertToTab(tab, i18n.getMessage('error_occured_on_retrieving_user', userName))
    return
  }
  return confirmChainBlockRequest(tab, chainblocker, executor, {
    type: 'follower',
    list: followKind,
    user,
  })
}

async function confirmTweetReactionChainBlockRequest(
  tab: BrowserTab,
  chainblocker: ChainBlocker,
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
  return confirmChainBlockRequest(tab, chainblocker, executor, {
    type: 'tweet_reaction',
    tweet,
    ...whoToBlock,
    includedReactionsV2: [], // TODO 반응별로 나누기
  })
}

async function confirmAudioSpaceChainBlockRequest(
  tab: BrowserTab,
  chainblocker: ChainBlocker,
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
  return confirmChainBlockRequest(tab, chainblocker, executor, {
    type: 'audio_space',
    audioSpace,
    ...includesWho,
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

let connectedChainblocker: ChainBlocker | null = null

export async function initializeContextMenu(
  chainblocker: ChainBlocker,
  enabledMenus: RedBlockUIOptions['menus']
) {
  connectedChainblocker = chainblocker
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
      const url = new URL(clickEvent.linkUrl!)
      const userName = getUserNameFromURL(url)!
      confirmFollowerChainBlockRequest(tab, chainblocker, userName, 'followers')
    },
  })
  menus.create({
    contexts: ['link'],
    documentUrlPatterns,
    targetUrlPatterns: urlPatterns,
    title: i18n.getMessage('run_followings_chainblock_to_this_user'),
    visible: enabledMenus.chainBlockFollowings,
    onclick(clickEvent, tab) {
      const url = new URL(clickEvent.linkUrl!)
      const userName = getUserNameFromURL(url)!
      confirmFollowerChainBlockRequest(tab, chainblocker, userName, 'friends')
    },
  })
  menus.create({
    contexts: ['link'],
    documentUrlPatterns,
    targetUrlPatterns: urlPatterns,
    title: i18n.getMessage('run_mutual_followers_chainblock_to_this_user'),
    visible: enabledMenus.chainBlockMutualFollowers,
    onclick(clickEvent, tab) {
      const url = new URL(clickEvent.linkUrl!)
      const userName = getUserNameFromURL(url)!
      confirmFollowerChainBlockRequest(tab, chainblocker, userName, 'mutual-followers')
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
      const url = new URL(clickEvent.linkUrl!)
      const tweetId = getTweetIdFromUrl(url)!
      confirmTweetReactionChainBlockRequest(tab, chainblocker, tweetId, {
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
      const url = new URL(clickEvent.linkUrl!)
      const tweetId = getTweetIdFromUrl(url)!
      confirmTweetReactionChainBlockRequest(tab, chainblocker, tweetId, {
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
      const url = new URL(clickEvent.linkUrl!)
      const tweetId = getTweetIdFromUrl(url)!
      confirmTweetReactionChainBlockRequest(tab, chainblocker, tweetId, {
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
      const url = new URL(clickEvent.linkUrl!)
      const tweetId = getTweetIdFromUrl(url)!
      confirmTweetReactionChainBlockRequest(tab, chainblocker, tweetId, {
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
    visible:
      enabledMenus.chainBlockAudioSpaceSpeakers && redblockOptions.experimentallyEnableAudioSpace,
    onclick(clickEvent, tab) {
      const url = new URL(clickEvent.linkUrl!)
      const audioSpaceId = getAudioSpaceIdFromUrl(url)!
      confirmAudioSpaceChainBlockRequest(tab, chainblocker, audioSpaceId, {
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
    visible:
      enabledMenus.chainBlockAudioSpaceSpeakers && redblockOptions.experimentallyEnableAudioSpace,
    onclick(clickEvent, tab) {
      const url = new URL(clickEvent.linkUrl!)
      const audioSpaceId = getAudioSpaceIdFromUrl(url)!
      confirmAudioSpaceChainBlockRequest(tab, chainblocker, audioSpaceId, {
        includeHostsAndSpeakers: true,
        includeListeners: true,
      })
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
      const url = new URL(tab.url!)
      if (validHostNames.includes(url.hostname)) {
        toggleOneClickBlockMode(tab, true)
      }
    },
  })
  menus.create({
    contexts: ['browser_action'],
    title: `${i18n.getMessage('oneclick_block_mode')}: OFF`,
    onclick(_clickEvent, tab) {
      const url = new URL(tab.url!)
      if (validHostNames.includes(url.hostname)) {
        toggleOneClickBlockMode(tab, false)
      }
    },
  })
}

browser.storage.onChanged.addListener((changes: Partial<RedBlockStorageChanges>) => {
  if (!connectedChainblocker) {
    console.warn('warning: failed to refresh context menus (chainblocker missing?)')
    return
  }
  if (changes.uiOptions) {
    initializeContextMenu(connectedChainblocker, changes.uiOptions.newValue.menus)
  } else if (changes.options) {
    loadUIOptions().then(uiOptions =>
      initializeContextMenu(connectedChainblocker!, uiOptions.menus)
    )
  }
})
