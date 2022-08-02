import type { RedBlockOptions, RedBlockUIOptions } from '\\/scripts/common/storage/schema'

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
