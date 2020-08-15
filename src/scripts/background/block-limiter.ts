const second = 1000
const minute = 60 * second
const hour = 60 * minute
// 정확한 값은 불명, 일단 3시간갖고는 안 되나벼...
const threshold = 6 * hour

export default class BlockLimiter {
  public readonly max = 500
  private expired() {
    const timestamp = parseInt(localStorage.getItem('RedBlock BlockLimiterTimestamp') || '0', 10)
    const diff = Date.now() - timestamp
    return diff > threshold
  }
  public get count() {
    if (this.expired()) {
      return 0
    } else {
      return parseInt(localStorage.getItem('RedBlock BlockLimiterCount') || '0', 10)
    }
  }
  public increment() {
    const count = this.count + 1
    localStorage.setItem('RedBlock BlockLimiterCount', count.toString())
    localStorage.setItem('RedBlock BlockLimiterTimestamp', Date.now().toString())
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
    localStorage.setItem('RedBlock BlockLimiterCount', '0')
    localStorage.setItem('RedBlock BlockLimiterTimestamp', '0')
  }
}
