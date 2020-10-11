interface RedBlockStorage {
  savedUsers: TwitterUser[]
  options: {
    removeSessionAfterComplete: boolean
  }
  badWords: BadWordItem[]
  reservedRequest: ReservedRequest[]
}

type RedBlockStorageChanges = {
  [key in keyof RedBlockStorage]: {
    oldValue: RedBlockStorage[key]
    newValue: RedBlockStorage[key]
  }
}
