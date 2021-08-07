import { iterateAvailableTwClients } from './blockbuster'
import { markUser } from './misc'
import * as i18n from '../../scripts/i18n'

export type MultitudeUserAction = 'Block' | 'UnBlock' | 'Mute' | 'UnMute'

interface MultitudeActionResult {
  executor: TwitterUser
  targetUser: TwitterUser
}

function curriedHandleAfterAction(executor: TwitterUser, userAction: UserAction) {
  return (targetUser: TwitterUser): MultitudeActionResult => {
    markUser({
      userId: targetUser.id_str,
      userAction,
    })
    return {
      executor,
      targetUser,
    }
  }
}

async function blockWithMultipleAccounts(target: TwitterUser) {
  const promises: Promise<MultitudeActionResult>[] = []
  for await (const { client, user: executor } of iterateAvailableTwClients()) {
    promises.push(client.blockUser(target).then(curriedHandleAfterAction(executor, 'Block')))
  }
  return Promise.allSettled(promises)
}

async function unblockWithMultipleAccounts(target: TwitterUser) {
  const promises: Promise<MultitudeActionResult>[] = []
  for await (const { client, user: executor } of iterateAvailableTwClients()) {
    promises.push(client.unblockUser(target).then(curriedHandleAfterAction(executor, 'UnBlock')))
  }
  return Promise.allSettled(promises)
}

async function muteWithMultipleAccounts(target: TwitterUser) {
  const promises: Promise<MultitudeActionResult>[] = []
  for await (const { client, user: executor } of iterateAvailableTwClients()) {
    promises.push(client.muteUser(target).then(curriedHandleAfterAction(executor, 'Mute')))
  }
  return Promise.allSettled(promises)
}

async function unmuteWithMultipleAccounts(target: TwitterUser) {
  const promises: Promise<MultitudeActionResult>[] = []
  for await (const { client, user: executor } of iterateAvailableTwClients()) {
    promises.push(client.unmuteUser(target).then(curriedHandleAfterAction(executor, 'UnMute')))
  }
  return Promise.allSettled(promises)
}

export async function doActionWithMultipleAccounts(
  action: MultitudeUserAction,
  targetUser: TwitterUser
) {
  switch (action) {
    case 'Block':
      return blockWithMultipleAccounts(targetUser)
    case 'UnBlock':
      return unblockWithMultipleAccounts(targetUser)
    case 'Mute':
      return muteWithMultipleAccounts(targetUser)
    case 'UnMute':
      return unmuteWithMultipleAccounts(targetUser)
  }
}

export function generateMultitudeResultMessage(
  action: MultitudeUserAction,
  results: PromiseSettledResult<MultitudeActionResult>[]
) {
  const success = results.filter(({ status }) => status === 'fulfilled')
  // const failed = results.filter(({status}) => status === 'rejected')
  let actionPast: string
  switch (action) {
    case 'Block':
      actionPast = i18n.getMessage('blocked')
      break
    case 'UnBlock':
      actionPast = i18n.getMessage('unblocked')
      break
    case 'Mute':
      actionPast = i18n.getMessage('muted')
      break
    case 'UnMute':
      actionPast = i18n.getMessage('unmuted')
      break
  }
  return i18n.getMessage('multitude_result_message', [success.length, actionPast])
}
