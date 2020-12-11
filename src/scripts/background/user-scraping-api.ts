import { sleep, collectAsync, unwrap, wrapEitherRight } from '../common.js'
import {
  getFollowsIds,
  getFollowsUserList,
  getReactedUserList,
  getMultipleUsersById,
  getMultipleUsersByName,
} from './twitter-api.js'
import type { UserIdsResponse, UserListResponse } from './twitter-api.js'

const DELAY = 100

export interface AdditionalScraperParameter {
  actAsUserId?: string
}

export async function* getAllFollowsIds(
  followKind: FollowKind,
  user: TwitterUser,
  { actAsUserId }: AdditionalScraperParameter = {}
): AsyncIterableIterator<Either<Error, UserIdsResponse>> {
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
): AsyncIterableIterator<Either<Error, UserListResponse>> {
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

export async function getAllMutualFollowersIds(user: TwitterUser, actAsUserId = ''): Promise<string[]> {
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
): AsyncIterableIterator<Either<Error, UserListResponse>> {
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

export async function* lookupUsersByIds(
  userIds: string[]
): AsyncIterableIterator<Either<Error, { users: TwitterUser[] }>> {
  const chunks = _.chunk(userIds, 100)
  for (const chunk of chunks) {
    const mutualUsers = await getMultipleUsersById(chunk)
    yield wrapEitherRight({ users: mutualUsers })
  }
}

export async function* lookupUsersByNames(
  userNames: string[]
): AsyncIterableIterator<Either<Error, { users: TwitterUser[] }>> {
  const chunks = _.chunk(userNames, 100)
  for (const chunk of chunks) {
    const mutualUsers = await getMultipleUsersByName(chunk)
    yield wrapEitherRight({ users: mutualUsers })
  }
}
