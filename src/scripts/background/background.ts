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
