import type { TwitterUserEntities } from '../background/twitter-api'

export default class TwitterUserMap extends Map<string, TwitterUser> {
  public addUser(user: TwitterUser) {
    return this.set(user.id_str, user)
  }

  public hasUser(user: TwitterUser) {
    return this.has(user.id_str)
  }

  public toUserArray(): TwitterUser[] {
    return Array.from(this.values())
  }

  public toUserObject(): TwitterUserEntities {
    const usersObj: TwitterUserEntities = Object.create(null)
    for (const [userId, user] of this) {
      usersObj[userId] = user
    }
    return usersObj
  }

  public static fromUsersArray(users: TwitterUser[]): TwitterUserMap {
    return new TwitterUserMap(users.map((user): [string, TwitterUser] => [user.id_str, user]))
  }

  public map<T>(fn: (user: TwitterUser, index: number, array: TwitterUser[]) => T): T[] {
    return this.toUserArray().map(fn)
  }

  public filter(
    fn: (user: TwitterUser, index: number, array: TwitterUser[]) => boolean,
  ): TwitterUserMap {
    return TwitterUserMap.fromUsersArray(this.toUserArray().filter(fn))
  }

  public merge(anotherMap: TwitterUserMap) {
    for (const user of anotherMap.values()) {
      this.addUser(user)
    }
  }
}
