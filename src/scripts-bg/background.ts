browser.runtime.onMessage.addListener((msgobj: object) => {
  const msg = msgobj as RBMessage
  if (msg.action === Action.ShowNotify) {
    const { title, message } = msg
    browser.notifications.create(null, {
      type: 'basic',
      title,
      message
    })
  }
})
