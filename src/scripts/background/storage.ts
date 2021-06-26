export {
  loadBadWords,
  saveBadWords,
  editBadWord,
  insertBadWord,
  removeBadWord,
} from './storage/badwords'
export {
  loadOptions,
  saveOptions,
  defaultOptions,
  loadUIOptions,
  saveUIOptions,
  defaultUIOptions,
} from './storage/options'
export {
  loadBookmarks,
  createBookmarkUserItem,
  createBookmarkTweetItem,
  insertItemToBookmark,
  removeBookmarkById,
  modifyBookmarksWith,
} from './storage/bookmarks'

import * as SavedUsers from './storage/saveduser'
import * as Bookmarks from './storage/bookmarks'

async function migrateToBookmarks() {
  const savedUsers = await SavedUsers.loadUsers()
  if (savedUsers.size <= 0) {
    return
  }
  console.debug('migrating bookmarks...')
  await Bookmarks.modifyBookmarksWith(bookmarks => {
    for (const user of savedUsers.values()) {
      const item = Bookmarks.createBookmarkUserItem(user)
      bookmarks.set(item.itemId, item)
    }
    return bookmarks
  })
  await browser.storage.local.remove('savedUsers')
}

export function onStorageChanged<K extends keyof RedBlockStorage>(
  key: K,
  handler: (newValue: RedBlockStorage[K]) => void
) {
  function listener(changes: Partial<RedBlockStorageChanges>) {
    if (changes[key]) {
      // @ts-ignore
      handler(changes[key].newValue)
    }
  }
  browser.storage.onChanged.addListener(listener)
  return () => void browser.storage.onChanged.removeListener(listener)
}

async function migrateStorage() {
  await migrateToBookmarks()
  browser.runtime.onInstalled.removeListener(migrateStorage)
}

browser.runtime.onInstalled.addListener(() => {
  migrateStorage()
})
