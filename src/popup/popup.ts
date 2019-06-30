namespace RedBlock.Popup {
  type Tab = browser.tabs.Tab
  const userNameBlacklist = [
    '1',
    'about',
    'account',
    'blog',
    'followers',
    'followings',
    'hashtag',
    'i',
    'lists',
    'login',
    'logout',
    'oauth',
    'privacy',
    'search',
    'tos',
    'notifications',
    'messages',
    'explore',
    'home',
  ]
  export async function requestChainBlock(userName: string, options: ChainBlockSessionOptions) {
    browser.runtime.sendMessage<RBStartMessage, void>({
      action: Action.StartChainBlock,
      userName,
      options,
    })
    window.close()
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
    const supportingHostname = ['twitter.com', 'mobile.twitter.com']
    if (!supportingHostname.includes(url.hostname)) {
      return null
    }
    const notUserPagePattern01 = /^\/\w\w\/(?:tos|privacy)/
    if (notUserPagePattern01.test(url.pathname)) {
      return null
    }
    const pattern = /^\/([0-9A-Za-z_]+)/
    const match = pattern.exec(url.pathname)
    if (!match) {
      return null
    }
    const userName = match[1]
    if (userNameBlacklist.includes(userName.toLowerCase())) {
      return null
    }
    return userName
  }
}
namespace RedBlock.Popup.UI {
  type Tab = browser.tabs.Tab
  interface PopupScope extends ng.IScope {
    options: ChainBlockSessionOptions
    currentVersion: string
    executeChainBlock: ($event: MouseEvent) => void
    currentTab: Tab | null
    currentUser: TwitterUser | null
    isOnTwitter: boolean
  }
  const { requestChainBlock, getUserNameFromTab, getCurrentTab } = RedBlock.Popup
  const { TwitterAPI } = RedBlock.Background
  const PopupApp = angular.module('RedBlockPopup', [])
  PopupApp.filter('formatNumber', () => (input: unknown): string => {
    if (typeof input === 'number') {
      const formn = input.toLocaleString()
      return `${formn}명`
    } else {
      return '??명'
    }
  })
  async function getTabAndUser(): Promise<{ tab: Tab | null; user: TwitterUser | null }> {
    const tab = await getCurrentTab()
    const userName = tab ? getUserNameFromTab(tab) : null
    const user = userName ? await TwitterAPI.getSingleUserByName(userName) : null
    return { tab, user }
  }
  export function initializeUI() {
    PopupApp.controller('RedBlockPopupController', [
      '$scope',
      '$q',
      ($scope: PopupScope, $q: ng.IQService) => {
        const manifest = browser.runtime.getManifest()
        $q.when(getTabAndUser()).then(({ tab, user }) => {
          $scope.currentTab = tab
          $scope.currentUser = user
          $scope.isOnTwitter = !!user
        })
        $scope.currentVersion = manifest.version
        $scope.isOnTwitter = true
        $scope.options = {
          targetList: 'followers',
          myFollowers: 'skip',
          myFollowings: 'skip',
        }
        $scope.executeChainBlock = ($event: MouseEvent) => {
          if (typeof $event.preventDefault === 'function') {
            $event.preventDefault()
            const user = $scope.currentUser
            if (user) {
              const options = Object.assign({}, $scope.options)
              Object.freeze(options)
              requestChainBlock(user.screen_name, options)
            }
          }
        }
      },
    ])
    PopupApp.controller('FooterController', [
      '$scope',
      ($scope: ng.IScope) => {
        const manifest = browser.runtime.getManifest()
        Object.assign($scope, {
          manifest,
        })
      },
    ])
  }
}

RedBlock.Popup.UI.initializeUI()
