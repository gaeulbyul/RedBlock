browser.runtime.onMessage.addListener((msg_: object) => {
  const msg = msg_ as RBMessage
  if (msg.action === Action.ShowNotify) {
    const { title, message } = msg
    browser.notifications.create(null, {
      type: 'basic',
      title,
      message
    })
  }
})
