import * as TwitterAPI from '../twitter-api.js'

export default class Blocker {
  private readonly BUFFER_SIZE = 150
  private readonly buffer: Promise<any>[] = []
  public onSuccess = (_user: TwitterUser, _whatIDid: VerbSomething) => {}
  public onError = (_user: TwitterUser, _error: any) => {}
  public get currentSize() {
    return this.buffer.length
  }
  public add(verb: VerbSomething, user: TwitterUser) {
    const promise = this.callAPIFromVerb(verb, user).then(
      () => {
        this.onSuccess(user, verb)
      },
      error => {
        this.onError(user, error)
      }
    )
    this.buffer.push(promise)
    return promise
  }
  public async flush() {
    await Promise.all(this.buffer).catch(() => {})
    this.buffer.length = 0
  }
  public async flushIfNeeded() {
    if (this.currentSize >= this.BUFFER_SIZE) {
      return this.flush()
    }
  }
  private async callAPIFromVerb(verb: VerbSomething, user: TwitterUser): Promise<boolean> {
    switch (verb) {
      case 'Block':
        return TwitterAPI.blockUser(user)
      case 'UnBlock':
        return TwitterAPI.unblockUser(user)
      case 'Mute':
        return TwitterAPI.muteUser(user)
      case 'UnMute':
        return TwitterAPI.unmuteUser(user)
    }
  }
}
