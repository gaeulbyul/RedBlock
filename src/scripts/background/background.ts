import * as i18n from '../i18n.js'

export function notify(message: string): void {
  const notif: browser.notifications.NotificationOptions = {
    type: 'basic',
    iconUrl: '/icons/icon-128.png',
    title: 'Red Block',
    message,
  }
  browser.notifications.create(null, notif)
}

export async function alert(message: string) {
  const currentTab = await browser.tabs
    .query({
      active: true,
      currentWindow: true,
    })
    .then(tabs => tabs.pop())
  if (!currentTab) {
    return
  }
  browser.tabs.sendMessage<RBMessages.Alert>(currentTab.id!, {
    messageType: 'Alert',
    message,
  })
}

export function updateExtensionBadge(sessions: SessionInfo[]) {
  const manifest = browser.runtime.getManifest()
  const runningSessionsCount = sessions.length
  // Chromium에선 setBadgeText의 text에 null을 허용하지 않음
  const text: string = runningSessionsCount ? runningSessionsCount.toString() : ''
  browser.browserAction.setBadgeText({
    text,
  })
  browser.browserAction.setBadgeBackgroundColor({
    color: '#3d5afe',
  })
  let title = `Red Block v${manifest.version}\n`
  title += `* ${i18n.getMessage('running_sessions')}: ${runningSessionsCount}`
  browser.browserAction.setTitle({
    title,
  })
}
