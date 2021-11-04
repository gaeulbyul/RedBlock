import { sendBrowserRuntimeMessage } from '../common/utilities'

export async function startNewChainBlockSession<T extends AnySessionTarget>(
  request: SessionRequest<T>
) {
  return sendBrowserRuntimeMessage<RBMessageToBackground.CreateChainBlockSession>({
    messageType: 'CreateChainBlockSession',
    messageTo: 'background',
    request,
  })
}

export async function stopChainBlock(sessionId: string) {
  return sendBrowserRuntimeMessage<RBMessageToBackground.StopSession>({
    messageType: 'StopSession',
    messageTo: 'background',
    sessionId,
  })
}

export async function stopAllChainBlock() {
  return sendBrowserRuntimeMessage<RBMessageToBackground.StopAllSessions>({
    messageType: 'StopAllSessions',
    messageTo: 'background',
  })
}

export async function rewindChainBlock(sessionId: string) {
  return sendBrowserRuntimeMessage<RBMessageToBackground.RewindSession>({
    messageType: 'RewindSession',
    messageTo: 'background',
    sessionId,
  })
}

export async function requestProgress() {
  return sendBrowserRuntimeMessage<RBMessageToBackground.RequestChainBlockInfo>({
    messageType: 'RequestChainBlockInfo',
    messageTo: 'background',
  })
}

export async function cleanupInactiveSessions() {
  return sendBrowserRuntimeMessage<RBMessageToBackground.RequestCleanup>({
    messageType: 'RequestCleanup',
    messageTo: 'background',
    cleanupWhat: 'inactive',
  })
}

export async function requestBlockLimiterStatus(userId: string) {
  return sendBrowserRuntimeMessage<RBMessageToBackground.RequestBlockLimiterStatus>({
    messageType: 'RequestBlockLimiterStatus',
    messageTo: 'background',
    userId,
  })
}

export async function requestResetCounter(userId: string) {
  return sendBrowserRuntimeMessage<RBMessageToBackground.RequestResetBlockCounter>({
    messageType: 'RequestResetBlockCounter',
    messageTo: 'background',
    userId,
  })
}

export async function downloadFromExportSession(sessionId: string) {
  return sendBrowserRuntimeMessage<RBMessageToBackground.DownloadFromExportSession>({
    messageType: 'DownloadFromExportSession',
    messageTo: 'background',
    sessionId,
  })
}
