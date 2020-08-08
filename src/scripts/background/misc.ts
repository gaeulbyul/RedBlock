import * as RBStorage from './storage.js'
import { lookupUsersByIds } from './user-scraping-api.js'
import { TwitterUserMap } from '../common.js'

export async function refreshSavedUsers() {
  const usersMap = await RBStorage.loadUsers()
  if (usersMap.size <= 0) {
    return
  }
  const refreshedUserMap = new TwitterUserMap()
  const userIds = Array.from(usersMap.keys())
  const refreshedUsersIterator = lookupUsersByIds(userIds)
  for await (const maybeUsers of refreshedUsersIterator) {
    if (maybeUsers.ok) {
      maybeUsers.value.users.forEach(user => refreshedUserMap.addUser(user))
    }
  }
  return RBStorage.saveUsers(refreshedUserMap)
}
