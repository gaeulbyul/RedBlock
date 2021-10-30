import browser from 'webextension-polyfill'

import { validateUserName } from '../common'
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
  return { userIds, userNames: new Set(), duplicated, invalid }
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
  return { userIds, userNames: new Set(), duplicated, invalid }
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
  return { userIds, userNames: new Set(), duplicated, invalid }
}

function parseAsCsvUserNameBlocklist(text: string): Blocklist {
  const splitted = text.split('\n')
  const userNames = new Set<string>()
  let duplicated = 0
  let invalid = 0
  for (const line_ of splitted) {
    const line = line_.trim().toLowerCase()
    if (line === '') {
      continue
    }
    if (!validateUserName(line)) {
      invalid++
      continue
    }
    if (userNames.has(line)) {
      duplicated++
      continue
    }
    userNames.add(line)
  }
  return { userIds: new Set(), userNames, duplicated, invalid }
}

export function parseBlocklist(text: string): Blocklist {
  if (text.startsWith('{')) {
    return parseAsImportChainJson(text)
  } else if (/^window.YTD.block.part\d+ = /.test(text)) {
    return parseAsTwitterArchiveBlockJson(text)
  } else {
    // 주어진 CSV파일이 엄밀하게 유저ID인지 유저네임인지 구분하긴 어렵다.
    // 가령, 500은 유저ID일 수도 있고, 유저네임일 수도 있음
    // naive한 방법이지만 텍스트파일 앞부분이 전체 숫자인 경우 유저ID목록으로,
    // 그렇지 않으면 유저이름 목록으로 간주해보자.
    const heads = text.split('\n', 10)
    const looksLikeUserIds = heads.every(line => /^\d+$/.test(line.trim()))
    if (looksLikeUserIds) {
      return parseAsCsvBlocklist(text)
    } else {
      return parseAsCsvUserNameBlocklist(text)
    }
  }
}

export async function exportBlocklist({ filename, userIds }: ExportResult) {
  if (userIds.size <= 0) {
    throw new Error('userlist is empty')
  }
  const csv = Array.from(userIds).join('\n')
  const csvFile = new File([csv], filename, { type: 'text/csv' })
  const objectUrl = URL.createObjectURL(csvFile)
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
  const userNames = new Set([...list1.userNames, ...list2.userNames])
  // 두 목록에 중복이 없다면 총 갯수가 totalIfNoDuplicate 만큼 나와야하지만
  // 실제 갯수는 totalActually 만큼 있다.
  // Set에는 중복값이 안 들어가니 이 크기차이인 duplicatedBetweenTwoList 를 중복 갯수로 볼 수 있다.
  const totalIfNoDuplicate =
    list1.userIds.size + list2.userIds.size + list1.userNames.size + list2.userNames.size
  const totalActually = userIds.size + userNames.size
  const duplicatedBetweenTwoList = totalIfNoDuplicate - totalActually
  const duplicated = list1.duplicated + list2.duplicated + duplicatedBetweenTwoList
  const invalid = list1.invalid + list2.invalid
  return { userIds, userNames, duplicated, invalid }
}

export interface Blocklist {
  userIds: Set<string>
  userNames: Set<string>
  duplicated: number
  invalid: number
}

export const emptyBlocklist: Blocklist = {
  userIds: new Set(),
  userNames: new Set(),
  duplicated: 0,
  invalid: 0,
}
