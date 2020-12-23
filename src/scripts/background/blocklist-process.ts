import { startImportChainBlock } from './request-sender.js'

export interface Blocklist {
  userIds: Set<string>
  duplicated: number
  invalid: number
}

export const emptyBlocklist: Blocklist = {
  userIds: new Set(),
  duplicated: 0,
  invalid: 0,
}

/*
function* iterateRegexp(pattern: RegExp, text: string) {
  let match: RegExpExecArray | null
  while ((match = pattern.exec(text))) {
    yield match[0]
  }
}
*/

function parseAsImportChainJson(text: string): Blocklist {
  const json = JSON.parse(text)
  if (!Array.isArray(json.users)) {
    throw new Error('invalid file?')
  }
  const importedJson = json as ImportChainJson
  const userIds = new Set<string>()
  let duplicated = 0
  let invalid = 0
  for (const { id } of importedJson.users) {
    if (!/^\d+$/.test(id)) {
      invalid++
      continue
    }
    if (userIds.has(id)) {
      duplicated++
      continue
    }
    userIds.add(id)
  }
  return { userIds, duplicated, invalid }
}

function parseAsTwitterArchiveBlockJson(text: string): Blocklist {
  const json = JSON.parse(text.replace(/^window\.YTD\.block\.part\d+ = /, ''))
  if (!Array.isArray(json)) {
    throw new Error('invalid file?')
  }
  const importedJson = json as TwitterArchiveBlockItem[]
  const userIds = new Set<string>()
  let duplicated = 0
  let invalid = 0
  for (const item of importedJson) {
    const id = item.blocking.accountId
    if (!/^\d+$/.test(id)) {
      invalid++
      continue
    }
    if (userIds.has(id)) {
      duplicated++
      continue
    }
    userIds.add(id)
  }
  return { userIds, duplicated, invalid }
}

function parseAsCsvBlocklist(text: string): Blocklist {
  const splitted = text.split('\n')
  const userIds = new Set<string>()
  let duplicated = 0
  let invalid = 0
  for (const line_ of splitted) {
    const line = line_.trim()
    if (line === '') {
      continue
    }
    if (!/^\d+$/.test(line)) {
      invalid++
      continue
    }
    if (userIds.has(line)) {
      duplicated++
      continue
    }
    userIds.add(line)
  }
  return { userIds, duplicated, invalid }
}

export function parseBlocklist(text: string): Blocklist {
  if (text.startsWith('{')) {
    return parseAsImportChainJson(text)
  } else if (/^window.YTD.block.part\d+ = /.test(text)) {
    return parseAsTwitterArchiveBlockJson(text)
  } else {
    return parseAsCsvBlocklist(text)
  }
}

export async function importBlocklist(request: ImportBlockSessionRequest) {
  startImportChainBlock(request)
}

export async function exportBlocklist({ filename, userIds }: ExportResult) {
  if (userIds.size <= 0) {
    throw new Error('userlist is empty')
  }
  const csv = Array.from(userIds).join('\n')
  const csvFile = new File([csv], filename, { type: 'text/csv' })
  let objectUrl = URL.createObjectURL(csvFile)
  await browser.downloads
    .download({
      url: objectUrl,
      filename,
    })
    .finally(() => {
      URL.revokeObjectURL(objectUrl)
    })
}

export function concatBlockList(list1: Blocklist, list2: Blocklist): Blocklist {
  const userIds = new Set([...list1.userIds, ...list2.userIds])
  // 두 목록에 중복이 없다면 총 갯수가 totalIfNoDuplicate 만큼 나와야하지만
  // 실제 갯수는 totalActually 만큼 있다.
  // Set에는 중복값이 안 들어가니 이 크기차이인 duplicatedBetweenTwoList 를 중복 갯수로 볼 수 있다.
  const totalIfNoDuplicate = list1.userIds.size + list2.userIds.size
  const totalActually = userIds.size
  const duplicatedBetweenTwoList = totalIfNoDuplicate - totalActually
  const duplicated = list1.duplicated + list2.duplicated + duplicatedBetweenTwoList
  const invalid = list1.invalid + list2.invalid
  return { userIds, duplicated, invalid }
}
