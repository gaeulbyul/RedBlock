import { EventEmitter } from '../common'

const RECURRING_INTERVAL = 5 // in minutes

interface WakeSessionParameters {
  sessionId: string
  alarm: browser.alarms.Alarm
}

interface RecurringManagerEventEmitter {
  'wake-session': WakeSessionParameters
}

function generateAlarmName(sessionId: string) {
  return `RedBlock:RecurringSession(id=${sessionId})`
}

export default class RecurringManager {
  private readonly nameToSessionId = new Map<string, string>()
  private emitter = new EventEmitter<RecurringManagerEventEmitter>()
  public startListen() {
    browser.alarms.onAlarm.addListener(alarm => {
      const sessionId = this.nameToSessionId.get(alarm.name)
      if (!sessionId) {
        console.debug('missing "%s" from name=>id map. remove it.', alarm.name)
        browser.alarms.clear(alarm.name)
        return
      }
      this.emitter.emit('wake-session', {
        sessionId,
        alarm,
      })
    })
  }
  public addSchedule(sessionId: string) {
    const name = generateAlarmName(sessionId)
    this.nameToSessionId.set(name, sessionId)
    browser.alarms.create(name, {
      delayInMinutes: RECURRING_INTERVAL,
    })
  }
  public async removeSchedule(sessionId: string) {
    // 존재하지 않은 sessionId가 주어져도 조용히 넘어갈 것.
    const name = generateAlarmName(sessionId)
    await browser.alarms.clear(name)
    this.nameToSessionId.delete(name)
  }
  public onWake(handler: (params: WakeSessionParameters) => void) {
    this.emitter.on('wake-session', handler)
  }
  public async clearAll() {
    await browser.alarms.clearAll()
    this.nameToSessionId.clear()
  }
}
