import browser from 'webextension-polyfill'

import { sendBrowserTabMessage } from '\\/scripts/common/utilities'
import * as i18n from '../i18n'

export function notify(message: string): void {
  browser.notifications.create({
    type: 'basic',
    iconUrl: '/icons/icon-128.png',
    title: 'Red Block',
    message,
  })
}

export async function alertToTab(tab: browser.Tabs.Tab, message: string) {
  return sendBrowserTabMessage<RBMessageToContent.Alert>(tab.id!, {
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

export async function downloadCleaner() {
  // Red Block에서 URL.createObjectURL 가지고 만들어낸 파일을
  // 여기에서 삭제한다.
  const prefix = 'blob:' + browser.runtime.getURL('')
  const extensionName = browser.runtime.getManifest().name
  browser.downloads.onChanged.addListener(async delta => {
    const state = delta.state?.current || ''
    if (state !== 'complete') {
      return
    }
    const downloadItems = await browser.downloads.search({ id: delta.id })
    downloadItems.forEach(item => {
      const { byExtensionName, url } = item
      if (byExtensionName !== extensionName) {
        return
      }
      if (!url.startsWith(prefix)) {
        return
      }
      URL.revokeObjectURL(url)
    })
  })
}
