import { listenExtensionMessages, injectScriptToPage } from './content-common'

const reactRoot = document.getElementById('react-root')
listenExtensionMessages(reactRoot)

if (reactRoot) {
  injectScriptToPage('bundled/twitter_inject.bun.js')
}
