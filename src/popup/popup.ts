namespace RedBlock.Popup {
  type Tab = browser.tabs.Tab
  export async function startChainBlock(userName: string, options: ChainBlockSessionOptions) {
    return browser.runtime.sendMessage<RBStartAction, void>({
      action: Action.StartChainBlock,
      userName,
      options,
    })
  }

  export async function stopChainBlock(sessionId: string) {
    return browser.runtime.sendMessage<RBStopAction>({
      action: Action.StopChainBlock,
      sessionId,
    })
  }

  export async function stopAllChainBlock() {
    return browser.runtime.sendMessage<RBStopAllAction>({
      action: Action.StopAllChainBlock,
    })
  }

  export async function requestProgress() {
    return browser.runtime.sendMessage<RBRequestProgress>({
      action: Action.RequestProgress,
    })
  }

  export async function insertUserToStorage(user: TwitterUser) {
    return browser.runtime.sendMessage<RBInsertUserToStorage>({
      action: Action.InsertUserToStorage,
      user,
    })
  }

  export async function removeUserFromStorage(user: TwitterUser) {
    return browser.runtime.sendMessage<RBRemoveUserFromStorage>({
      action: Action.RemoveUserFromStorage,
      user,
    })
  }

  export async function getCurrentTab(): Promise<Tab | null> {
    const tabs = await browser.tabs.query({
      active: true,
      currentWindow: true,
    })
    const currentTab = tabs[0]
    if (!currentTab || !currentTab.url) {
      return null
    }
    return currentTab
  }

  export function getUserNameFromTab(tab: Tab): string | null {
    if (!tab || !tab.url) {
      return null
    }
    const url = new URL(tab.url)
    return getUserNameFromURL(url)
  }
}
