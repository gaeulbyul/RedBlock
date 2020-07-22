export async function startFollowerChainBlock(request: FollowerBlockSessionRequest) {
  return browser.runtime.sendMessage<RBActions.CreateFollowerChainBlockSession>({
    actionType: 'CreateFollowerChainBlockSession',
    request,
  })
}

export async function startTweetReactionChainBlock(request: TweetReactionBlockSessionRequest) {
  return browser.runtime.sendMessage<RBActions.CreateTweetReactionChainBlockSession>({
    actionType: 'CreateTweetReactionChainBlockSession',
    request,
  })
}

export async function startImportChainBlock(request: ImportBlockSessionRequest) {
  return browser.runtime.sendMessage<RBActions.CreateImportChainBlockSession>({
    actionType: 'CreateImportChainBlockSession',
    request,
  })
}

export async function cancelChainBlock(sessionId: string) {
  return browser.runtime.sendMessage<RBActions.Cancel>({
    actionType: 'Cancel',
    sessionId,
  })
}

export async function stopChainBlock(sessionId: string) {
  return browser.runtime.sendMessage<RBActions.Stop>({
    actionType: 'StopChainBlock',
    sessionId,
  })
}

export async function stopAllChainBlock() {
  return browser.runtime.sendMessage<RBActions.StopAll>({
    actionType: 'StopAllChainBlock',
  })
}

export async function rewindChainBlock(sessionId: string) {
  return browser.runtime.sendMessage<RBActions.Rewind>({
    actionType: 'RewindChainBlock',
    sessionId,
  })
}

export async function requestProgress() {
  return browser.runtime.sendMessage<RBActions.RequestProgress>({
    actionType: 'RequestProgress',
  })
}

export async function cleanupInactiveSessions() {
  return browser.runtime.sendMessage<RBActions.RequestCleanup>({
    actionType: 'RequestCleanup',
    cleanupWhat: 'inactive',
  })
}

export async function cleanupNotConfirmedSessions() {
  return browser.runtime.sendMessage<RBActions.RequestCleanup>({
    actionType: 'RequestCleanup',
    cleanupWhat: 'not-confirmed',
  })
}

export async function insertUserToStorage(user: TwitterUser) {
  return browser.runtime.sendMessage<RBActions.InsertUserToStorage>({
    actionType: 'InsertUserToStorage',
    user,
  })
}

export async function removeUserFromStorage(user: TwitterUser) {
  return browser.runtime.sendMessage<RBActions.RemoveUserFromStorage>({
    actionType: 'RemoveUserFromStorage',
    user,
  })
}

export async function refreshSavedUsers() {
  return browser.runtime.sendMessage<RBActions.RefreshSavedUsers>({
    actionType: 'RefreshSavedUsers',
  })
}
