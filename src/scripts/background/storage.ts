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
// TODO: export-from 문 제거?

import { defaultOptions, defaultUIOptions } from './storage/options'

export function onStorageChanged<K extends keyof RedBlockStorage>(
  key: K,
  handler: (newValue: RedBlockStorage[K]) => void
) {
  function listener(changes: Partial<RedBlockStorageChanges>) {
    if (!changes[key]) {
      return
    }
    switch (key) {
      case 'options':
        // @ts-ignore
        handler(Object.assign({}, defaultOptions, changes.options!.newValue))
        break
      case 'uiOptions':
        // @ts-ignore
        handler(Object.assign({}, defaultUIOptions, changes.uiOptions!.newValue))
        break
      default:
        // @ts-ignore
        handler(changes[key].newValue)
        break
    }
  }
  browser.storage.onChanged.addListener(listener)
  return () => void browser.storage.onChanged.removeListener(listener)
}

export async function migrateStorage() {
  await browser.storage.local.set({
    $$version$$: 'v0.14.0.0',
  })
  browser.runtime.onInstalled.removeListener(migrateStorage)
}
