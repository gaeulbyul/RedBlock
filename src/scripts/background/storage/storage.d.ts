interface RedBlockStorage {
  savedUsers: TwitterUser[]
  options: {
    removeSessionAfterComplete: boolean
  }
  badWords: BadWordItem[]
}

type RedBlockStorageChanges = {
  [key in keyof RedBlockStorage]: {
    oldValue: RedBlockStorage[key]
    newValue: RedBlockStorage[key]
  }
}
