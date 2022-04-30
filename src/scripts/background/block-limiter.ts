const second = 1000
const minute = 60 * second
const hour = 60 * minute
// 정확한 값은 불명
const threshold = 8 * hour

const PREFIX_KEY_TIMESTAMP = `BlockLimiterTimestamp`
const PREFIX_KEY_COUNT = `BlockLimiterCount`

export default class BlockLimiter {
  public readonly max = 500
  private readonly KEY_TIMESTAMP: string
  private readonly KEY_COUNT: string
  public static getAll(): Record<string, BlockLimiterStatus> {
    const results: Record<string, BlockLimiterStatus> = Object.create(null)
    Object.keys(localStorage)
      .filter(key => key.startsWith(PREFIX_KEY_TIMESTAMP) || key.startsWith(PREFIX_KEY_COUNT))
      .forEach(key => {
        const userId = /user=(\d+)/.exec(key)?.[1]
        if (!userId) {
          return
        }
        if (userId in results) {
          return
        }
        const limiter = new BlockLimiter(userId)
        results[userId] = {
          max: limiter.max,
          current: limiter.count,
        }
      })
    return results
  }

  public constructor(userId: string) {
    const identifier = `user=${userId}`
    this.KEY_TIMESTAMP = `${PREFIX_KEY_TIMESTAMP} ${identifier}`
    this.KEY_COUNT = `${PREFIX_KEY_COUNT} ${identifier}`
  }

  private expired() {
    const timestamp = parseInt(localStorage.getItem(this.KEY_TIMESTAMP) || '0', 10)
    const diff = Date.now() - timestamp
    return diff > threshold
  }

  public get count() {
    if (this.expired()) {
      return 0
    } else {
      return parseInt(localStorage.getItem(this.KEY_COUNT) || '0', 10)
    }
  }

  public increment() {
    const count = this.count + 1
    localStorage.setItem(this.KEY_COUNT, count.toString())
    localStorage.setItem(this.KEY_TIMESTAMP, Date.now().toString())
    return count
  }

  public check(): 'ok' | 'danger' {
    const { count, max } = this
    if (count < max) {
      return 'ok'
    } else {
      return 'danger'
    }
  }

  public reset() {
    localStorage.setItem(this.KEY_COUNT, '0')
    localStorage.setItem(this.KEY_TIMESTAMP, '0')
  }

  public static resetCounterByUserId(userId: string) {
    return new BlockLimiter(userId).reset()
  }
}
