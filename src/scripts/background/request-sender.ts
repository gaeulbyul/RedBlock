export async function startNewChainBlockSession<T extends AnySessionTarget>(
  request: SessionRequest<T>
) {
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
  return browser.runtime.sendMessage<RBMessageToBackground.RequestChainBlockInfo>({
    messageType: 'RequestChainBlockInfo',
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

export async function requestBlockLimiterStatus(userId: string) {
  return browser.runtime.sendMessage<RBMessageToBackground.RequestBlockLimiterStatus>({
    messageType: 'RequestBlockLimiterStatus',
    messageTo: 'background',
    userId,
  })
}

export async function requestResetCounter(userId: string) {
  return browser.runtime.sendMessage<RBMessageToBackground.RequestResetBlockCounter>({
    messageType: 'RequestResetBlockCounter',
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
