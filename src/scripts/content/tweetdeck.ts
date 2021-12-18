import { initializeForBlackBird } from './blackbird'
import { initializeForGryphon } from './gryphon'

function initialize() {
  // 트윗덱 신버전 여부는 .js-app Element 존재여부로 확인한다.
  const isLegacyTweetDeck = document.querySelector('.js-app')
  if (isLegacyTweetDeck) {
    initializeForBlackBird()
    return
  }
  const reactRoot = document.getElementById('react-root')
  if (reactRoot) {
    initializeForGryphon(reactRoot)
    return
  }
  throw new Error('failed to inject script!')
}

initialize()
