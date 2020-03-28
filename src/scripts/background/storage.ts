import { TwitterUserMap } from '../common.js'
import { TwitterUser } from './twitter-api.js'

function deleteUnusedOptions(options: RedBlockStorage['options']) {
  const optionsAsAny = options as any
  delete optionsAsAny.tweetReactionBasedChainBlock
  delete optionsAsAny.experimental_tweetReactionBasedChainBlock
}

export async function loadUsers(): Promise<TwitterUserMap> {
  const { savedUsers } = ((await browser.storage.local.get('savedUsers')) as unknown) as RedBlockStorage
  if (savedUsers) {
    return TwitterUserMap.fromUsersArray(savedUsers)
  } else {
    return new TwitterUserMap()
  }
}

export async function saveUsers(usersMap: TwitterUserMap): Promise<void> {
  const savedUsers: RedBlockStorage['savedUsers'] = usersMap.toUserArray()
  const storageObject = { savedUsers }
  return browser.storage.local.set(storageObject as any)
}

export async function insertSingleUserAndSave(user: TwitterUser): Promise<void> {
  const users = await loadUsers()
  users.addUser(user)
  return saveUsers(users)
}

export async function removeSingleUserAndSave(user: TwitterUser): Promise<void> {
  const users = await loadUsers()
  users.delete(user.id_str)
  return saveUsers(users)
}

export async function loadOptions(): Promise<RedBlockStorage['options']> {
  const { options } = ((await browser.storage.local.get('options')) as unknown) as RedBlockStorage
  deleteUnusedOptions(options)
  return Object.assign({}, defaultOptions, options)
}

export async function saveOptions(newOptions: RedBlockStorage['options']): Promise<void> {
  const options: RedBlockStorage['options'] = Object.assign({}, defaultOptions, newOptions)
  deleteUnusedOptions(options)
  const storageObject = { options }
  return browser.storage.local.set(storageObject as any)
}

export const defaultOptions: Readonly<RedBlockStorage['options']> = Object.freeze({
  enableRailgun: false,
})

export function onOptionsChanged(handler: (options: RedBlockStorage['options']) => void) {
  function listener(changes: Partial<RedBlockStorageChanges>) {
    if (changes.options) {
      handler(changes.options.newValue)
    }
  }
  browser.storage.onChanged.addListener(listener)
  return () => {
    browser.storage.onChanged.removeListener(listener as any)
  }
}

export function onSavedUsersChanged(handler: (savedUsers: TwitterUserMap) => void) {
  function listener(changes: Partial<RedBlockStorageChanges>) {
    if (changes.savedUsers) {
      handler(TwitterUserMap.fromUsersArray(changes.savedUsers.newValue))
    }
  }
  browser.storage.onChanged.addListener(listener)
  return () => {
    browser.storage.onChanged.removeListener(listener as any)
  }
}

export interface RedBlockStorage {
  savedUsers: TwitterUser[]
  options: {
    enableRailgun: boolean
  }
}

export type RedBlockStorageChanges = {
  [key in keyof RedBlockStorage]: {
    oldValue: RedBlockStorage[key]
    newValue: RedBlockStorage[key]
  }
}
