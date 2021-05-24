import { getUserNameFromURL } from '../common.js'
import { defaultChainBlockPurposeOptions } from './chainblock-session/default-options.js'
import * as TwitterAPI from './twitter-api.js'
import { TargetCheckResult } from './target-checker.js'
import { generateConfirmMessage, checkResultToString, objToString } from '../text-generate.js'
import { alertToTab } from './background.js'
import { getCookieStoreIdFromTab } from './cookie-handler.js'
import { loadOptions } from './storage.js'
import { examineRetrieverByTargetUser } from './antiblock.js'
import type ChainBlocker from './chainblock.js'

type BrowserTab = browser.tabs.Tab

const urlPatterns = ['https://twitter.com/*', 'https://mobile.twitter.com/*']
const documentUrlPatterns = [
  'https://twitter.com/*',
  'https://mobile.twitter.com/*',
  'https://tweetdeck.twitter.com/*',
]
const tweetUrlPatterns = ['https://twitter.com/*/status/*', 'https://mobile.twitter.com/*/status/*']

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
  const cookieOptions = { cookieStoreId }
  const twClient = new TwitterAPI.TwClient(cookieOptions)
  const myself = await twClient.getMyself().catch(() => null)
  if (myself) {
    return { user: myself, cookieOptions }
  } else {
    return null
  }
}

async function confirmChainBlockRequest(
  tab: BrowserTab,
  chainblocker: ChainBlocker,
  executor: Actor,
  target: FollowerSessionTarget | TweetReactionSessionTarget
) {
  const options = await loadOptions()
  let retriever: Actor
  if (target.type === 'follower' && options.enableAntiBlock) {
    retriever = (await examineRetrieverByTargetUser(executor, target.user)) || executor
  } else {
    retriever = executor
  }
  const request: SessionRequest<FollowerSessionTarget | TweetReactionSessionTarget> = {
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
  const twClient = new TwitterAPI.TwClient(executor.cookieOptions)
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
    blockRetweeters: boolean
    blockLikers: boolean
    blockMentionedUsers: boolean
    blockQuotedUsers: boolean
    blockNonLinkedMentions: boolean
  }
) {
  const executor = await initExecutorActor(tab)
  if (!executor) {
    alertToTab(tab, i18n.getMessage('error_occured_check_login'))
    return
  }
  const twClient = new TwitterAPI.TwClient(executor.cookieOptions)
  const tweet = await twClient.getTweetById(tweetId).catch(() => null)
  if (!tweet) {
    alertToTab(tab, i18n.getMessage('error_occured_on_retrieving_tweet'))
    return
  }
  return confirmChainBlockRequest(tab, chainblocker, executor, {
    type: 'tweet_reaction',
    tweet,
    ...whoToBlock,
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

function optionallyCreateMenu(
  visible: boolean,
  menuCreateParameter: Parameters<typeof browser.menus.create>[0]
) {
  if (visible) {
    menus.create(menuCreateParameter)
  }
}

let connectedChainblocker: ChainBlocker | null = null

export async function initializeContextMenu(
  chainblocker: ChainBlocker,
  enabledMenus: RedBlockUIOptions['menus']
) {
  connectedChainblocker = chainblocker
  await menus.removeAll()
  // 우클릭 - 유저
  optionallyCreateMenu(enabledMenus.chainBlockFollowers, {
    contexts: ['link'],
    documentUrlPatterns,
    targetUrlPatterns: urlPatterns,
    title: i18n.getMessage('run_followers_chainblock_to_this_user'),
    onclick(clickEvent, tab) {
      const url = new URL(clickEvent.linkUrl!)
      const userName = getUserNameFromURL(url)!
      confirmFollowerChainBlockRequest(tab, chainblocker, userName, 'followers')
    },
  })
  optionallyCreateMenu(enabledMenus.chainBlockFollowings, {
    contexts: ['link'],
    documentUrlPatterns,
    targetUrlPatterns: urlPatterns,
    title: i18n.getMessage('run_followings_chainblock_to_this_user'),
    onclick(clickEvent, tab) {
      const url = new URL(clickEvent.linkUrl!)
      const userName = getUserNameFromURL(url)!
      confirmFollowerChainBlockRequest(tab, chainblocker, userName, 'friends')
    },
  })
  optionallyCreateMenu(enabledMenus.chainBlockMutualFollowers, {
    contexts: ['link'],
    documentUrlPatterns,
    targetUrlPatterns: urlPatterns,
    title: i18n.getMessage('run_mutual_followers_chainblock_to_this_user'),
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
  optionallyCreateMenu(enabledMenus.chainBlockRetweeters, {
    contexts: ['link'],
    documentUrlPatterns,
    targetUrlPatterns: tweetUrlPatterns,
    title: i18n.getMessage('run_retweeters_chainblock_to_this_tweet'),
    onclick(clickEvent, tab) {
      const url = new URL(clickEvent.linkUrl!)
      const tweetId = getTweetIdFromUrl(url)!
      confirmTweetReactionChainBlockRequest(tab, chainblocker, tweetId, {
        blockRetweeters: true,
        blockLikers: false,
        blockMentionedUsers: false,
        blockQuotedUsers: false,
        blockNonLinkedMentions: false,
      })
    },
  })
  optionallyCreateMenu(enabledMenus.chainBlockLikers, {
    contexts: ['link'],
    documentUrlPatterns,
    targetUrlPatterns: tweetUrlPatterns,
    title: i18n.getMessage('run_likers_chainblock_to_this_tweet'),
    onclick(clickEvent, tab) {
      const url = new URL(clickEvent.linkUrl!)
      const tweetId = getTweetIdFromUrl(url)!
      confirmTweetReactionChainBlockRequest(tab, chainblocker, tweetId, {
        blockRetweeters: false,
        blockLikers: true,
        blockMentionedUsers: false,
        blockQuotedUsers: false,
        blockNonLinkedMentions: false,
      })
    },
  })
  optionallyCreateMenu(enabledMenus.chainBlockRetweetersAndLikers, {
    contexts: ['link'],
    documentUrlPatterns,
    targetUrlPatterns: tweetUrlPatterns,
    title: i18n.getMessage('run_retweeters_and_likers_chainblock_to_this_tweet'),
    onclick(clickEvent, tab) {
      const url = new URL(clickEvent.linkUrl!)
      const tweetId = getTweetIdFromUrl(url)!
      confirmTweetReactionChainBlockRequest(tab, chainblocker, tweetId, {
        blockRetweeters: true,
        blockLikers: true,
        blockMentionedUsers: false,
        blockQuotedUsers: false,
        blockNonLinkedMentions: false,
      })
    },
  })
  optionallyCreateMenu(enabledMenus.chainBlockMentioned, {
    contexts: ['link'],
    documentUrlPatterns,
    targetUrlPatterns: tweetUrlPatterns,
    title: i18n.getMessage('run_mentioned_users_chainblock_to_this_tweet'),
    onclick(clickEvent, tab) {
      const url = new URL(clickEvent.linkUrl!)
      const tweetId = getTweetIdFromUrl(url)!
      confirmTweetReactionChainBlockRequest(tab, chainblocker, tweetId, {
        blockRetweeters: false,
        blockLikers: false,
        blockMentionedUsers: true,
        blockQuotedUsers: false,
        blockNonLinkedMentions: false,
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
}

browser.storage.onChanged.addListener((changes: Partial<RedBlockStorageChanges>) => {
  if (!changes.uiOptions) {
    return
  }
  if (!connectedChainblocker) {
    console.warn('warning: failed to refresh context menus (chainblocker missing?)')
    return
  }
  initializeContextMenu(connectedChainblocker, changes.uiOptions.newValue.menus)
})
