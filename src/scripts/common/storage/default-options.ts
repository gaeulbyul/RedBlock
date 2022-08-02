import type {
  RedBlockOptions,
  RedBlockStorage,
  RedBlockUIOptions,
} from '\\/scripts/common/storage/schema'

import { REDBLOCK_STORAGE_LATEST_VERSION } from '\\/scripts/common/storage/schema'

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
  oneClickBlockCoTweeter: false,
  oneClickBlockNFT: false,
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

export const defaultStorage: RedBlockStorage = {
  $$version$$: REDBLOCK_STORAGE_LATEST_VERSION,
  bookmarks: [],
  badWords: [],
  options: defaultOptions,
  uiOptions: defaultUIOptions,
}
