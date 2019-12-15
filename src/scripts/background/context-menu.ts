namespace RedBlock.Background.Menu {
  const { doChainBlockWithDefaultOptions } = RedBlock.Background.Entrypoint
  const urlPatterns = ['https://twitter.com/*', 'https://mobile.twitter.com/*']
  browser.contextMenus.create({
    contexts: ['link'],
    documentUrlPatterns: urlPatterns,
    targetUrlPatterns: urlPatterns,
    title: '이 사용자의 팔로워에게 체인블락 실행',
    onclick(clickEvent, _tab) {
      const url = new URL(clickEvent.linkUrl!)
      const userName = getUserNameFromURL(url)
      if (!userName) {
        return
      }
      doChainBlockWithDefaultOptions(userName, 'followers')
    },
  })
  browser.contextMenus.create({
    contexts: ['link'],
    documentUrlPatterns: urlPatterns,
    targetUrlPatterns: urlPatterns,
    title: '이 사용자의 팔로잉에게 체인블락 실행',
    onclick(clickEvent, _tab) {
      const url = new URL(clickEvent.linkUrl!)
      const userName = getUserNameFromURL(url)
      if (!userName) {
        return
      }
      doChainBlockWithDefaultOptions(userName, 'friends')
    },
  })
}
