import * as TwitterAPI from '../twitter-api.js'
import { blockMultipleUsers, BlockAllResult } from '../block-all.js'

export class BlockAllAPIBlocker {
  private readonly buffer: TwitterUser[] = []
  public onSuccess = (_result: BlockAllResult) => {}
  public add(user: TwitterUser) {
    this.buffer.push(user)
  }
  public async flush() {
    let result: BlockAllResult
    if (this.buffer.length > 20) {
      result = await blockMultipleUsers(this.buffer.map(u => u.id_str))
    } else {
      result = await this.flushWithStandardBlockApi()
    }
    this.buffer.length = 0
    this.onSuccess(result)
    return result
  }
  public async flushIfNeeded() {
    if (this.buffer.length >= 800) {
      return this.flush()
    }
    return
  }
  private async flushWithStandardBlockApi(): Promise<BlockAllResult> {
    const blocked: string[] = []
    const failed: string[] = []
    for (const user of this.buffer) {
      const blockResult = await TwitterAPI.blockUser(user).catch(() => false)
      if (blockResult) {
        blocked.push(user.id_str)
      } else {
        failed.push(user.id_str)
      }
    }
    return { blocked, failed }
  }
}

export class Blocker {
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
