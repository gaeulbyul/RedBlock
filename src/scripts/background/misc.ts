export async function markUser(params: MarkUserParams) {
  const tabs = await browser.tabs.query({
    discarded: false,
    url: ['https://twitter.com/*', 'https://mobile.twitter.com/*'],
  })
  tabs.forEach(tab => {
    const id = tab.id
    if (typeof id !== 'number') {
      return
    }
    browser.tabs
      .sendMessage<RBMessageToContent.MarkUser>(id, {
        messageType: 'MarkUser',
        messageTo: 'content',
        ...params,
      })
      .catch(() => {})
  })
}
