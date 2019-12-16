export function notify(message: string): void {
  const notif: browser.notifications.NotificationOptions = {
    type: 'basic',
    iconUrl: '/icons/icon-128.png',
    title: 'Red Block',
    message,
  }
  browser.notifications.create(null, notif)
}
