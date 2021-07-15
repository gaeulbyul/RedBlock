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

export async function getCurrentTab(): Promise<browser.tabs.Tab> {
  const tabs = await browser.tabs.query({
    active: true,
    currentWindow: true,
  })
  const currentTab = tabs[0]!
  return currentTab
}

export async function toggleOneClickBlockMode(tab: browser.tabs.Tab, enabled: boolean) {
  const tabId = tab.id
  if (typeof tabId !== 'number') {
    throw new Error()
  }
  return browser.tabs.sendMessage<RBMessageToContent.ToggleOneClickBlockMode>(tabId, {
    messageType: 'ToggleOneClickBlockMode',
    messageTo: 'content',
    enabled,
  })
}
