import { TwitterUserMap, deleteSensitiveInfo } from '../../common.js'

export async function loadUsers(): Promise<TwitterUserMap> {
  const { savedUsers } = ((await browser.storage.local.get(
    'savedUsers'
  )) as unknown) as RedBlockStorage
  if (savedUsers) {
    return TwitterUserMap.fromUsersArray(savedUsers.map(deleteSensitiveInfo))
  } else {
    return new TwitterUserMap()
  }
}
