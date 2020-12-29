import { sleep, collectAsync, unwrap, wrapEitherRight } from '../common.js'
import {
  getFollowsIds,
  getFollowsUserList,
  getReactedUserList,
  getMultipleUsersById,
  getMultipleUsersByName,
  searchUsers,
  getNextCursorFromAPIv2Response,
} from './twitter-api.js'

const DELAY = 100

export interface AdditionalScraperParameter {
  actAsUserId?: string
}

export async function* getAllFollowsIds(
  followKind: FollowKind,
  user: TwitterUser,
  { actAsUserId }: AdditionalScraperParameter = {}
): ScrapedUserIdsIterator {
  let cursor = '-1'
  while (cursor !== '0') {
    try {
      const json = await getFollowsIds(followKind, user, cursor, actAsUserId)
      cursor = json.next_cursor_str
      yield wrapEitherRight(json)
      await sleep(DELAY)
    } catch (error) {
      yield {
        ok: false,
        error,
      }
    }
  }
}

export async function* getAllFollowsUserList(
  followKind: FollowKind,
  user: TwitterUser,
  { actAsUserId }: AdditionalScraperParameter = {}
): ScrapedUsersIterator {
  let cursor = '-1'
  while (cursor !== '0') {
    try {
      const json = await getFollowsUserList(followKind, user, cursor, actAsUserId)
      cursor = json.next_cursor_str
      yield wrapEitherRight(json)
      await sleep(DELAY)
    } catch (error) {
      yield {
        ok: false,
        error,
      }
    }
  }
}

export async function getAllMutualFollowersIds(
  user: TwitterUser,
  actAsUserId = ''
): Promise<string[]> {
  const followingsIds = (await collectAsync(getAllFollowsIds('friends', user, { actAsUserId })))
    .map(unwrap)
    .map(resp => resp.ids)
    .flat()
  const followersIds = (await collectAsync(getAllFollowsIds('followers', user, { actAsUserId })))
    .map(unwrap)
    .map(resp => resp.ids)
    .flat()
  const mutualIds = _.intersection(followingsIds, followersIds)
  return mutualIds
}

export async function* getAllReactedUserList(
  reaction: ReactionKind,
  tweet: Tweet
): ScrapedUsersIterator {
  let cursor = '-1'
  while (cursor !== '0') {
    try {
      const json = await getReactedUserList(reaction, tweet, cursor)
      cursor = json.next_cursor_str
      yield wrapEitherRight(json)
      await sleep(DELAY)
    } catch (error) {
      yield {
        ok: false,
        error,
      }
    }
  }
}

export async function* getUserSearchResults(query: string): ScrapedUsersIterator {
  let cursor: string | undefined
  while (true) {
    const response = await searchUsers(query, cursor)
    cursor = getNextCursorFromAPIv2Response(response) || undefined
    const { users } = response.globalObjects
    const usersArray = Object.values(users)
    if (usersArray.length > 0) {
      yield wrapEitherRight({ users: usersArray })
      await sleep(DELAY)
    } else {
      break
    }
  }
}

export async function* lookupUsersByIds(userIds: string[]): ScrapedUsersIterator {
  const chunks = _.chunk(userIds, 100)
  for (const chunk of chunks) {
    const mutualUsers = await getMultipleUsersById(chunk)
    yield wrapEitherRight({ users: mutualUsers })
  }
}

export async function* lookupUsersByNames(userNames: string[]): ScrapedUsersIterator {
  const chunks = _.chunk(userNames, 100)
  for (const chunk of chunks) {
    const mutualUsers = await getMultipleUsersByName(chunk)
    yield wrapEitherRight({ users: mutualUsers })
  }
}
