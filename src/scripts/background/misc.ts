import * as RBStorage from './storage.js'
import { lookupUsersByIds } from './user-scraping-api.js'

export async function refreshSavedUsers() {
  const usersMap = await RBStorage.loadUsers()
  if (usersMap.size <= 0) {
    return
  }
  const userIds = Array.from(usersMap.keys())
  const refreshedUsersIterator = lookupUsersByIds(userIds)
  for await (const maybeUsers of refreshedUsersIterator) {
    if (maybeUsers.ok) {
      maybeUsers.value.users.forEach(user => usersMap.addUser(user, true))
    }
  }
  return RBStorage.saveUsers(usersMap)
}
