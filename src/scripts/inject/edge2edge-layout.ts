import { findReduxStore } from './reactredux'

export function detectEdge2EdgeLayoutSwitch() {
  const reduxStore = findReduxStore()
  try {
    return reduxStore.getState().featureSwitch.user.config.media_edge_to_edge_content_enabled.value
  } catch {
    return false
  }
}

export function isEdge2EdgeLayout() {
  return document.body.classList.contains('edge2edge')
}
