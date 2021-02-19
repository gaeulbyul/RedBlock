import { sleep, collectAsync, unwrap, wrapEitherRight } from '../common.js'
import { TwClient, getNextCursorFromAPIv2Response } from './twitter-api.js'

const DELAY = 100

export class UserScrapingAPIClient {
  public constructor(private twClient: TwClient) {}
  public async *getAllFollowsIds(
    followKind: FollowKind,
    user: TwitterUser
  ): ScrapedUserIdsIterator {
    let cursor = '-1'
    while (cursor !== '0') {
      try {
        const json = await this.twClient.getFollowsIds(followKind, user, cursor)
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
  public async *getAllFollowsUserList(
    followKind: FollowKind,
    user: TwitterUser
  ): ScrapedUsersIterator {
    let cursor = '-1'
    while (cursor !== '0') {
      try {
        const json = await this.twClient.getFollowsUserList(followKind, user, cursor)
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
  public async getAllMutualFollowersIds(user: TwitterUser): Promise<string[]> {
    const followingsIds = (await collectAsync(this.getAllFollowsIds('friends', user)))
      .map(unwrap)
      .map(resp => resp.ids)
      .flat()
    const followersIds = (await collectAsync(this.getAllFollowsIds('followers', user)))
      .map(unwrap)
      .map(resp => resp.ids)
      .flat()
    const mutualIds = _.intersection(followingsIds, followersIds)
    return mutualIds
  }
  public async *getAllReactedUserList(reaction: ReactionKind, tweet: Tweet): ScrapedUsersIterator {
    let cursor = '-1'
    while (cursor !== '0') {
      try {
        const json = await this.twClient.getReactedUserList(reaction, tweet, cursor)
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
  public async *getUserSearchResults(query: string): ScrapedUsersIterator {
    let cursor: string | undefined
    while (true) {
      const response = await this.twClient.searchUsers(query, cursor)
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
  public async *lookupUsersByIds(userIds: string[]): ScrapedUsersIterator {
    const chunks = _.chunk(userIds, 100)
    for (const chunk of chunks) {
      const users = await this.twClient.getMultipleUsers({ user_id: chunk })
      yield wrapEitherRight({ users })
    }
  }
  public async *lookupUsersByNames(userNames: string[]): ScrapedUsersIterator {
    const chunks = _.chunk(userNames, 100)
    for (const chunk of chunks) {
      try {
        const users = await this.twClient.getMultipleUsers({ screen_name: chunk })
        yield wrapEitherRight({ users })
      } catch (error) {
        yield {
          ok: false,
          error,
        }
      }
    }
  }
}
