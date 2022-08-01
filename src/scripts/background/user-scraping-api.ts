import chunk from 'lodash-es/chunk'
import intersection from 'lodash-es/intersection'

import { collectAsync, sleep, unwrap, wrapEitherRight } from '\\/scripts/common/utilities'
import { getNextCursorFromAPIv2Response, TwClient } from './twitter-api'

const DELAY = 100

export class UserScrapingAPIClient {
  public constructor(private twClient: TwClient) {}
  public static fromClientOptions(clientOptions: TwClientOptions) {
    return new UserScrapingAPIClient(new TwClient(clientOptions))
  }

  public async *getAllFollowsIds(
    followKind: FollowKind,
    user: TwitterUser,
  ): ScrapedUserIdsIterator {
    let cursor = '-1'
    while (cursor !== '0') {
      try {
        const json = await this.twClient.getFollowsIds(followKind, user, cursor)
        cursor = json.next_cursor_str
        yield wrapEitherRight(json)
        await sleep(DELAY)
      } catch (error: any) {
        yield {
          ok: false,
          error,
        }
      }
    }
  }

  public async *getAllFollowsUserList(
    followKind: FollowKind,
    user: TwitterUser,
  ): ScrapedUsersIterator {
    let cursor = '-1'
    while (cursor !== '0') {
      try {
        const json = await this.twClient.getFollowsUserList(followKind, user, cursor)
        cursor = json.next_cursor_str
        yield wrapEitherRight(json)
        await sleep(DELAY)
      } catch (error: any) {
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
    const mutualIds = intersection(followingsIds, followersIds)
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
      } catch (error: any) {
        yield {
          ok: false,
          error,
        }
      }
    }
  }

  public async *getAllReactedV2UserList(
    tweet: Tweet,
    reactions: ReactionV2Kind[],
  ): ScrapedUsersIterator {
    if (reactions.length <= 0) {
      console.warn('empty reactions(v2)!')
      return
    }
    const timeline = await this.twClient.getTweetReactionV2Timeline(tweet)
    const users: TwitterUser[] = []
    for (const entry of timeline.tweet_reaction_timeline_entries) {
      if (!reactions.includes(entry.reaction_type)) {
        continue
      }
      const maybeUser = entry.user_results.result
      if (!(maybeUser && 'rest_id' in maybeUser)) {
        continue
      }
      const user: TwitterUser = { ...maybeUser.legacy, id_str: maybeUser.rest_id }
      users.push(user)
    }
    yield wrapEitherRight({ users })
  }

  public async *getAllBlockedUsersIds(): ScrapedUserIdsIterator {
    let cursor = '-1'
    while (cursor !== '0') {
      try {
        const json = await this.twClient.getBlockedUsersIds(cursor)
        cursor = json.next_cursor_str
        yield wrapEitherRight(json)
        await sleep(DELAY)
      } catch (error: any) {
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
      const users = Object.values(response.globalObjects.users)
      if (users.length > 0) {
        yield wrapEitherRight({ users })
        await sleep(DELAY)
      } else {
        break
      }
    }
  }

  public async *getQuotedUsers(tweet: Tweet): ScrapedUsersIterator {
    // 한 유저가 같은 트윗에 2개 이상의 인용트윗을 작성하면
    // 여러건이 scrape될것이다.
    const seenUserIds = new Set<string>()
    let cursor: string | undefined
    while (true) {
      const response = await this.twClient.searchQuotedUsers(tweet.id_str, cursor)
      cursor = getNextCursorFromAPIv2Response(response) || undefined
      const users: TwitterUser[] = []
      for (const user of Object.values(response.globalObjects.users)) {
        if (seenUserIds.has(user.id_str)) {
          continue
        }
        seenUserIds.add(user.id_str)
        users.push(user)
      }
      if (users.length > 0) {
        yield wrapEitherRight({ users })
        await sleep(DELAY)
      } else {
        break
      }
    }
  }

  public async *getParticipantsInAudioSpace({
    audioSpace,
    hostsAndSpeakers,
    listeners,
  }: {
    audioSpace: AudioSpace
    hostsAndSpeakers: boolean
    listeners: boolean
  }): ScrapedUsersIterator {
    if (hostsAndSpeakers === false && listeners === false) {
      console.warn('neither speakers nor listeners should fetch?')
      return
    }
    const userNames = new Set<string>()
    if (hostsAndSpeakers) {
      const participants = audioSpace.participants.admins.concat(audioSpace.participants.speakers)
      for (const participant of participants) {
        userNames.add(participant.twitter_screen_name)
      }
    }
    if (listeners) {
      for (const participant of audioSpace.participants.listeners) {
        userNames.add(participant.twitter_screen_name)
      }
    }
    yield* this.lookupUsersByNames(Array.from(userNames))
  }

  public async *lookupUsersByIds(userIds: string[]): ScrapedUsersIterator {
    const chunks = chunk(userIds, 100)
    for (const chunk of chunks) {
      const users = await this.twClient.getMultipleUsers({ user_id: chunk })
      yield wrapEitherRight({ users })
    }
  }

  public async *lookupUsersByNames(userNames: string[]): ScrapedUsersIterator {
    const chunks = chunk(userNames, 100)
    for (const chunk of chunks) {
      try {
        const users = await this.twClient.getMultipleUsers({ screen_name: chunk })
        yield wrapEitherRight({ users })
      } catch (error: any) {
        yield {
          ok: false,
          error,
        }
      }
    }
  }
}
