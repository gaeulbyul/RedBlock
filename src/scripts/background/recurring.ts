import { EventEmitter } from '../common'

interface RecurringAlarm {
  sessionId: string
  alarm: browser.alarms.Alarm
}

interface RecurringManagerEventEmitter {
  'wake-session': RecurringAlarm
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

  public async addSchedule(
    sessionId: string,
    delayInMinutes: number
  ): Promise<browser.alarms.Alarm> {
    const name = generateAlarmName(sessionId)
    this.nameToSessionId.set(name, sessionId)
    browser.alarms.create(name, {
      delayInMinutes,
    })
    const createdAlarm = await browser.alarms.get(name)
    return createdAlarm!
  }

  public async removeSchedule(sessionId: string) {
    // 존재하지 않은 sessionId가 주어져도 조용히 넘어갈 것.
    const name = generateAlarmName(sessionId)
    await browser.alarms.clear(name)
    this.nameToSessionId.delete(name)
  }

  public onWake(handler: (params: RecurringAlarm) => void) {
    this.emitter.on('wake-session', handler)
  }

  public async clearAll() {
    await browser.alarms.clearAll()
    this.nameToSessionId.clear()
  }

  public async getAll(): Promise<RecurringAlarmInfosObject> {
    const rAlarms: RecurringAlarmInfosObject = {}
    const alarms = await browser.alarms.getAll()
    alarms.forEach(alarm => {
      const sessionId = this.nameToSessionId.get(alarm.name)
      if (!sessionId) {
        return
      }
      rAlarms[sessionId] = alarm
    })
    return rAlarms
  }
}
