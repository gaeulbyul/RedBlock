interface BrowserNotificationButton {
  title: string,
  iconUrl?: string
}

interface BrowserNotificationItem {
  title: string,
  message: string
}

interface BrowserNotification {
  type: 'basic' | 'image' | 'list' | 'progress',
  iconUrl: string,
  title: string,
  message: string,
  contextMessage?: string,
  priority: 0 | 1 | 2, // -2, -1 does not support on some platform
  eventTime?: number,
  buttons?: BrowserNotificationButton[],
  items: BrowserNotificationItem[],
  imageUrl?: string,
  progress?: number
}

browser.runtime.onMessage.addListener((msgobj: object) => {
  const msg = msgobj as RBMessage
  if (msg.action === Action.ShowNotify) {
    const notif: browser.notifications.NotificationOptions = {
      type: 'basic',
      iconUrl: 'icon/icon-128.png',
      title: 'Red Block',
      message: ''
    }
    Object.assign<browser.notifications.NotificationOptions, Partial<BrowserNotification>>(notif, msg.notification)
    browser.notifications.create(null, notif)
  }
})
