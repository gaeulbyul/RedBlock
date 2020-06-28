import { startImportChainBlock } from './request-sender.js'
import { MAX_USER_LIMIT } from '../common.js'

function* iterateRegexp(pattern: RegExp, text: string) {
  let match: RegExpExecArray | null
  while ((match = pattern.exec(text))) {
    yield match[0]
  }
}

function parseAsImportChainJson(text: string): Set<string> {
  const json = JSON.parse(text)
  if (!Array.isArray(json.users)) {
    throw new Error('invalid file?')
  }
  const userIds = new Set<string>()
  const importedJson = json as ImportChainJson
  importedJson.users.forEach(({ id }, index) => {
    if (typeof id !== 'string') {
      throw new Error('invalid file?')
    }
    if (index < MAX_USER_LIMIT) {
      userIds.add(id)
    }
  })
  return userIds
}

function parseAsCsvBlocklist(text: string): Set<string> {
  const userIds = new Set<string>()
  const iterator = iterateRegexp(/^\d+$/gm, text)
  Array.from(iterator).forEach((userId, index) => {
    if (index < MAX_USER_LIMIT) {
      userIds.add(userId)
    }
  })
  return userIds
}

export async function importBlocklist(text: string) {
  let userIds: Set<string>
  if (text.startsWith('{')) {
    userIds = parseAsImportChainJson(text)
  } else {
    userIds = parseAsCsvBlocklist(text)
  }
  const isValid = userIds && userIds.size > 0
  if (!isValid) {
    throw new Error('error to parse blocklist')
  }
  debugger
  startImportChainBlock({
    purpose: 'chainblock',
    target: {
      type: 'import',
      userIds: Array.from(userIds),
    },
    options: {
      myFollowers: 'Skip',
      myFollowings: 'Skip',
    },
  })
}
