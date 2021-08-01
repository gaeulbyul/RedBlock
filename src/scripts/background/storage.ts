import { loadOptions, loadUIOptions } from './storage/options'
import { loadBadWords } from './storage/badwords'
import { loadBookmarks } from './storage/bookmarks'

import { defaultOptions, defaultUIOptions } from './storage/options'
import { validateStorage } from './storage/validator'

const REDBLOCK_STORAGE_VERSION = 'v0.14.0.0'

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
    $$version$$: REDBLOCK_STORAGE_VERSION,
  })
  browser.runtime.onInstalled.removeListener(migrateStorage)
}

export async function dumpStorage(): Promise<RedBlockStorage> {
  const options = await loadOptions()
  const uiOptions = await loadUIOptions()
  const bookmarks = await loadBookmarks()
  const badWords = await loadBadWords()
  return validateStorage({
    $$version$$: REDBLOCK_STORAGE_VERSION,
    options,
    uiOptions,
    bookmarks,
    badWords,
  })
}
