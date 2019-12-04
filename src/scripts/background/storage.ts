namespace RedBlock.Background.Storage {
  type StorageObject = browser.storage.StorageObject
  export async function loadUsers(): Promise<TwitterUserMap> {
    const { savedUsers } = await browser.storage.local.get<StorageObject & RedBlockStorage>('savedUsers')
    if (savedUsers) {
      return TwitterUserMap.fromUsersArray(savedUsers)
    } else {
      return new TwitterUserMap()
    }
  }
  export async function saveUsers(usersMap: TwitterUserMap): Promise<void> {
    const storeObject: RedBlockStorage = {
      savedUsers: usersMap.toUserArray(),
    }
    // @ts-ignore
    return browser.storage.local.set(storeObject)
  }
}
