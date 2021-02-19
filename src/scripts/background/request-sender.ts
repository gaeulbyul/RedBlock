export async function startNewChainBlockSession<T extends SessionRequest>(request: T) {
  return browser.runtime.sendMessage<RBMessageToBackground.CreateChainBlockSession>({
    messageType: 'CreateChainBlockSession',
    messageTo: 'background',
    request,
  })
}

export async function stopChainBlock(sessionId: string) {
  return browser.runtime.sendMessage<RBMessageToBackground.StopSession>({
    messageType: 'StopSession',
    messageTo: 'background',
    sessionId,
  })
}

export async function stopAllChainBlock() {
  return browser.runtime.sendMessage<RBMessageToBackground.StopAllSessions>({
    messageType: 'StopAllSessions',
    messageTo: 'background',
  })
}

export async function rewindChainBlock(sessionId: string) {
  return browser.runtime.sendMessage<RBMessageToBackground.RewindSession>({
    messageType: 'RewindSession',
    messageTo: 'background',
    sessionId,
  })
}

export async function requestProgress() {
  return browser.runtime.sendMessage<RBMessageToBackground.RequestProgress>({
    messageType: 'RequestProgress',
    messageTo: 'background',
  })
}

export async function cleanupInactiveSessions() {
  return browser.runtime.sendMessage<RBMessageToBackground.RequestCleanup>({
    messageType: 'RequestCleanup',
    messageTo: 'background',
    cleanupWhat: 'inactive',
  })
}

export async function insertUserToStorage(user: TwitterUser) {
  return browser.runtime.sendMessage<RBMessageToBackground.InsertUserToStorage>({
    messageType: 'InsertUserToStorage',
    messageTo: 'background',
    user,
  })
}

export async function removeUserFromStorage(user: TwitterUser) {
  return browser.runtime.sendMessage<RBMessageToBackground.RemoveUserFromStorage>({
    messageType: 'RemoveUserFromStorage',
    messageTo: 'background',
    user,
  })
}

export async function refreshSavedUsers(cookieOptions: CookieOptions) {
  return browser.runtime.sendMessage<RBMessageToBackground.RefreshSavedUsers>({
    messageType: 'RefreshSavedUsers',
    messageTo: 'background',
    cookieOptions,
  })
}

export async function requestBlockLimiterStatus(userId: string) {
  return browser.runtime.sendMessage<RBMessageToBackground.RequestBlockLimiterStatus>({
    messageType: 'RequestBlockLimiterStatus',
    messageTo: 'background',
    userId,
  })
}

export async function requestResetCounter(userId: string) {
  return browser.runtime.sendMessage<RBMessageToBackground.RequestResetCounter>({
    messageType: 'RequestResetCounter',
    messageTo: 'background',
    userId,
  })
}

export async function downloadFromExportSession(sessionId: string) {
  return browser.runtime.sendMessage<RBMessageToBackground.DownloadFromExportSession>({
    messageType: 'DownloadFromExportSession',
    messageTo: 'background',
    sessionId,
  })
}
