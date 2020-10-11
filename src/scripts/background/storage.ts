export { loadBadWords, saveBadWords, editBadWord, insertBadWord, removeBadWord } from './storage/badwords.js'
export { loadOptions, saveOptions, defaultOptions } from './storage/options.js'
export { loadUsers, saveUsers, insertUser, removeUser } from './storage/saveduser.js'

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
