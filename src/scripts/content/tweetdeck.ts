import { listenExtensionMessages, injectScriptToPage } from './content-common'

listenExtensionMessages(null)

injectScriptToPage('bundled/tweetdeck_inject.bun.js')
