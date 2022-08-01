import type {
  RedBlockOptions,
  RedBlockStorage,
  RedBlockUIOptions,
} from '\\/scripts/common/storage/schema'
import browser from 'webextension-polyfill'

function migrateOptions(options: any) {
  // 최초 설치 후 실행시 null/undefined가 온다.
  if (!options) {
    return
  }
  delete options.experimentallyEnableAudioSpace
  const redblockOptions = options as RedBlockOptions
  if ('enableAntiBlock' in options) {
    redblockOptions.enableBlockBuster = options.enableAntiBlock
    delete options.enableAntiBlock
  }
}

export async function loadOptions(): Promise<RedBlockOptions> {
  const { options } = (await browser.storage.local.get('options')) as unknown as RedBlockStorage
  migrateOptions(options)
  return Object.assign({}, defaultOptions, options)
}

export async function saveOptions(newOptions: RedBlockOptions): Promise<void> {
  const options: RedBlockOptions = Object.assign({}, defaultOptions, newOptions)
  migrateOptions(options)
  const storageObject = { options }
  return browser.storage.local.set(storageObject as any)
}

export async function loadUIOptions(): Promise<RedBlockUIOptions> {
  const { uiOptions } = (await browser.storage.local.get('uiOptions')) as unknown as RedBlockStorage
  return Object.assign({}, defaultUIOptions, uiOptions)
}

export async function saveUIOptions(newOptions: RedBlockUIOptions): Promise<void> {
  const uiOptions: RedBlockUIOptions = Object.assign({}, defaultUIOptions, newOptions)
  const storageObject = { uiOptions }
  return browser.storage.local.set(storageObject as any)
}

export const defaultOptions = Object.freeze<RedBlockOptions>({
  removeSessionAfterComplete: false,
  skipInactiveUser: 'never',
  revealBioBlockMode: false,
  enableBlockBuster: false,
  enableBlockBusterWithTweetDeck: false,
  firstPartyIsolationCompatibleMode: false,
  delayBlockRequest: 0,
  muteEvenAlreadyBlocking: false,
  enableReactionsV2Support: false,
  oneClickBlockModeForAllTabs: false,
  allowSelfChainBlock: false,
  recurringSessionInterval: 10,
  enableTeamwork: false,
  alsoBlockTargetItself: false,
})

export const defaultUIOptions = Object.freeze<RedBlockUIOptions>({
  menus: Object.freeze({
    chainBlockFollowers: true,
    chainBlockFollowings: true,
    chainBlockMutualFollowers: true,
    chainBlockRetweeters: true,
    chainBlockLikers: true,
    chainBlockRetweetersAndLikers: true,
    chainBlockMentioned: true,
    chainBlockAudioSpaceSpeakers: true,
    chainBlockAudioSpaceSpeakersAndListeners: true,
    chainBlockHashTagInUsersProfile: true,
    teamworkBlock: true,
    teamworkUnblock: true,
    teamworkMute: true,
    teamworkUnmute: true,
  }),
})
