import { listenExtensionMessages, injectScriptToPage } from './content-common'

const reactRoot = document.getElementById('react-root')
listenExtensionMessages(reactRoot)

if (reactRoot) {
  injectScriptToPage('bundled/twitter-inject.bun.js')
}
