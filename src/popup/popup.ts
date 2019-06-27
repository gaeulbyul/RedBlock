namespace RedBlock.Popup {
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
  const PopupApp = angular.module('RedBlockPopup', [])
  async function requestChainBlock(userName: string, options: ChainBlockSessionOptions) {
    browser.runtime.sendMessage<RBStartMessage, void>({
      action: Action.StartChainBlock,
      userName,
      options,
    })
    window.close()
  }
  // interface ChainBlockOption
  interface PopupScope extends ng.IScope {
    options: ChainBlockSessionOptions
    currentVersion: string
    executeChainBlock: ($event: MouseEvent) => void
    userName: string | null
  }
  interface PopupService {
    extractUserNameFromCurrentTab: () => ng.IPromise<string | null>
  }
  export async function initialize() {
    PopupApp.factory('PopupService', [
      '$q',
      ($q: ng.IQService) => {
        const extractUserNameFromCurrentTab_original = async () => {
          const tabs = await browser.tabs.query({
            active: true,
            currentWindow: true,
          })
          const currentTab = tabs[0]
          if (!currentTab || !currentTab.url) {
            console.info('x1')
            return null
          }
          const url = new URL(currentTab.url)
          const supportingHostname = ['twitter.com', 'mobile.twitter.com']
          if (!supportingHostname.includes(url.hostname)) {
            console.info('x2')
            return null
          }
          const notUserPagePattern01 = /^\/\w\w\/(?:tos|privacy)/
          if (notUserPagePattern01.test(url.pathname)) {
            console.info('x3')
            return null
          }
          const pattern = /^\/([0-9A-Za-z_]+)/
          const match = pattern.exec(url.pathname)
          if (!match) {
            console.info('x4')
            return null
          }
          const userName = match[1]
          if (userNameBlacklist.includes(userName.toLowerCase())) {
            console.info('x5')
            return null
          }
          return userName
        }
        return {
          extractUserNameFromCurrentTab() {
            return $q.when(extractUserNameFromCurrentTab_original())
          },
        }
      },
    ])
    PopupApp.controller('RedBlockPopupController', [
      '$scope',
      'PopupService',
      ($scope: PopupScope, popupService: PopupService) => {
        const manifest = browser.runtime.getManifest()
        $scope.userName = null
        $scope.currentVersion = manifest.version
        $scope.options = {
          targetList: 'followers',
          myFollowers: 'skip',
          myFollowings: 'skip',
        }
        popupService.extractUserNameFromCurrentTab().then(userName => {
          $scope.userName = userName
        })
        $scope.executeChainBlock = async ($event: MouseEvent) => {
          if (typeof $event.preventDefault === 'function') {
            $event.preventDefault()
            const userName = $scope.userName
            if (userName) {
              const options = Object.assign({}, $scope.options)
              Object.freeze(options)
              requestChainBlock(userName, options)
            }
          }
        }
        //
      },
    ])
  }
}

RedBlock.Popup.initialize()
