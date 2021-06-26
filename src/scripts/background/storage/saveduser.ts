import { TwitterUserMap, stripSensitiveInfo } from '../../common'

export async function loadUsers(): Promise<TwitterUserMap> {
  const { savedUsers } = (await browser.storage.local.get(
    'savedUsers'
  )) as unknown as RedBlockStorage
  if (savedUsers) {
    return TwitterUserMap.fromUsersArray(savedUsers.map(stripSensitiveInfo))
  } else {
    return new TwitterUserMap()
  }
}
