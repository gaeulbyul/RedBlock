import * as i18n from '~~/scripts/i18n'

export function notify(message: string): void {
  const notif: browser.notifications.NotificationOptions = {
    type: 'basic',
    iconUrl: '/icons/icon-128.png',
    title: 'Red Block',
    message,
  }
  browser.notifications.create(null, notif)
}

export async function alertToTab(tab: browser.tabs.Tab, message: string) {
  return browser.tabs.sendMessage<RBMessageToContent.Alert>(tab.id!, {
    messageType: 'Alert',
    messageTo: 'content',
    message,
  })
}

export async function alertToCurrentTab(message: string) {
  const currentTab = await browser.tabs
    .query({
      active: true,
      currentWindow: true,
    })
    .then(tabs => tabs.pop())
  if (!currentTab) {
    return
  }
  return alertToTab(currentTab, message)
}

export function updateExtensionBadge(sessionsCount: number) {
  const manifest = browser.runtime.getManifest()
  if (typeof browser.browserAction.setBadgeText !== 'function') {
    // 안드로이드용 Firefox에선 뱃지 관련 API를 사용할 수 없다.
    return
  }
  // Chromium에선 setBadgeText의 text에 null을 허용하지 않음
  const text: string = sessionsCount ? sessionsCount.toString() : ''
  browser.browserAction.setBadgeText({
    text,
  })
  browser.browserAction.setBadgeBackgroundColor({
    color: '#3d5afe',
  })
  let title = `Red Block v${manifest.version}\n`
  title += `* ${i18n.getMessage('running_sessions')}: ${sessionsCount}`
  browser.browserAction.setTitle({
    title,
  })
}
