type InactivePeriod = 'never' | '1y' | '2y' | '3y'
type NonLinkedMentionPattern = 'common' | 'aggressive'

interface RedBlockStorage {
  savedUsers: TwitterUser[]
  bookmarks: BookmarkItem[]
  options: {
    removeSessionAfterComplete: boolean
    skipInactiveUser: InactivePeriod
    revealBioBlockMode: boolean
    enableBlockBuster: boolean
    firstPartyIsolationCompatibleMode: boolean
    delayBlockRequest: number
    muteEvenAlreadyBlocking: boolean
    enableReactionsV2Support: boolean
    oneClickBlockModeForAllTabs: boolean
    allowSelfChainBlock: boolean
  }
  uiOptions: {
    menus: {
      chainBlockFollowers: boolean
      chainBlockFollowings: boolean
      chainBlockMutualFollowers: boolean
      chainBlockRetweeters: boolean
      chainBlockLikers: boolean
      chainBlockRetweetersAndLikers: boolean
      chainBlockMentioned: boolean
      chainBlockAudioSpaceSpeakers: boolean
      chainBlockAudioSpaceSpeakersAndListeners: boolean
      chainBlockHashTagInUsersProfile: boolean
    }
  }
  badWords: BadWordItem[]
}

type RedBlockOptions = RedBlockStorage['options']
type RedBlockUIOptions = RedBlockStorage['uiOptions']

type RedBlockStorageChanges = {
  [key in keyof RedBlockStorage]: {
    oldValue: RedBlockStorage[key]
    newValue: RedBlockStorage[key]
  }
}
