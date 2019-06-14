namespace RedBlock.Background {
  export function notify(message: string): void {
    const notif: BNotificationOptions = {
      type: 'basic',
      iconUrl: 'icons/icon-128.png',
      title: 'Red Block',
      message,
    }
    browser.notifications.create(null, notif)
  }
}
