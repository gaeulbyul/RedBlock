import * as RBStorage from './storage.js'
import { TwClient } from './twitter-api.js'
import { UserScrapingAPIClient } from './user-scraping-api.js'
import { TwitterUserMap } from '../common.js'

export async function refreshSavedUsers(cookieOptions: CookieOptions) {
  const scrapingClient = new UserScrapingAPIClient(new TwClient(cookieOptions))
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

export async function markUser(params: MarkUserParams) {
  const tabs = await browser.tabs.query({
    discarded: false,
    url: ['https://twitter.com/*', 'https://mobile.twitter.com/*'],
  })
  tabs.forEach(tab => {
    const id = tab.id
    if (typeof id !== 'number') {
      return
    }
    browser.tabs
      .sendMessage<RBMessageToContent.MarkUser>(id, {
        messageType: 'MarkUser',
        messageTo: 'content',
        ...params,
      })
      .catch(() => {})
  })
}
