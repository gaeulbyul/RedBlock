import * as RBStorage from './storage.js'
import { TwClient } from './twitter-api.js'
import { UserScrapingAPIClient } from './user-scraping-api.js'
import { TwitterUserMap } from '../common.js'

export async function refreshSavedUsers() {
  const scrapingClient = new UserScrapingAPIClient(new TwClient())
  const usersMap = await RBStorage.loadUsers()
  if (usersMap.size <= 0) {
    return
  }
  const refreshedUserMap = new TwitterUserMap()
  const userIds = Array.from(usersMap.keys())
  const refreshedUsersIterator = scrapingClient.lookupUsersByIds(userIds)
  for await (const maybeUsers of refreshedUsersIterator) {
    if (maybeUsers.ok) {
      maybeUsers.value.users.forEach(user => refreshedUserMap.addUser(user))
    }
  }
  return RBStorage.saveUsers(refreshedUserMap)
}
