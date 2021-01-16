import { TwitterUserMap } from '../../common.js'

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

export async function saveUsers(usersMap: TwitterUserMap): Promise<void> {
  const savedUsers: RedBlockStorage['savedUsers'] = usersMap.toUserArray().map(deleteSensitiveInfo)
  const storageObject = { savedUsers }
  return browser.storage.local.set(storageObject as any)
}

export async function insertUser(user: TwitterUser): Promise<void> {
  const users = await loadUsers()
  users.addUser(user)
  return saveUsers(users)
}

export async function removeUser(user: TwitterUser): Promise<void> {
  const users = await loadUsers()
  users.delete(user.id_str)
  return saveUsers(users)
}

function deleteSensitiveInfo(user: TwitterUser): TwitterUser {
  const userAsAny = user as any
  if (Object.isFrozen(userAsAny)) {
    const clonedUser = Object.assign({}, userAsAny)
    return deleteSensitiveInfo(clonedUser)
  }
  delete userAsAny.email
  delete userAsAny.phone
  return user
}
