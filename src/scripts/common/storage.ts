import browser from 'webextension-polyfill'

import { loadBadWords } from './storage/badwords'
import { loadBookmarks } from './storage/bookmarks'
import { loadOptions, loadUIOptions } from './storage/options'

import { REDBLOCK_STORAGE_LATEST_VERSION, redblockStorageSchema } from './storage/schema'
import type { RedBlockStorage, RedBlockStorageChanges } from './storage/schema'

export function onStorageChanged<K extends keyof RedBlockStorage>(
  key: K,
  handler: (newValue: RedBlockStorage[K]) => void,
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

export async function dumpStorage(): Promise<RedBlockStorage> {
  const options = await loadOptions()
  const uiOptions = await loadUIOptions()
  const bookmarks = await loadBookmarks()
  const badWords = await loadBadWords()
  const storage = redblockStorageSchema.parse({
    $$version$$: REDBLOCK_STORAGE_LATEST_VERSION,
    options,
    uiOptions,
    bookmarks,
    badWords,
  })
  return storage
}
