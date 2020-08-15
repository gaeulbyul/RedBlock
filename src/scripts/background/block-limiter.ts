export class BlockLimiter {
  public readonly max = 500
  public get count() {
    return parseInt(localStorage.getItem('RedBlock BlockLimiterCount') || '0', 10)
  }
  public increment() {
    const count = this.count + 1
    localStorage.setItem('RedBlock BlockLimiterCount', count.toString())
    localStorage.setItem('RedBlock BlockLimiterTimestamp', Date.now().toString())
    return count
  }
  public check(): 'ok' | 'danger' {
    const { count, max } = this
    const timestamp = parseInt(localStorage.getItem('RedBlock BlockLimiterTimestamp') || '0', 10)
    if (count < max) {
      return 'ok'
    }
    const diff = Date.now() - timestamp
    const second = 1000
    const minute = second * 60
    const hour = minute * 60
    const threshold = hour * 3
    const maybeFine = diff > threshold
    if (maybeFine) {
      return 'ok'
    } else {
      return 'danger'
    }
  }
  public reset() {
    localStorage.setItem('RedBlock BlockLimiterCount', '0')
    return 0
  }
}
