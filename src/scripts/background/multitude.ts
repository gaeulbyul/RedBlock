import { iterateAvailableTwClients } from './blockbuster'
import { markUser } from './misc'
import * as i18n from '~~/scripts/i18n'

export type MultitudeUserAction = 'Block' | 'UnBlock' | 'Mute' | 'UnMute'

function curriedMarkUser(userAction: UserAction) {
  return (user: TwitterUser): TwitterUser => {
    markUser({
      userId: user.id_str,
      userAction,
    })
    return user
  }
}

async function blockWithMultipleAccounts(target: TwitterUser) {
  const promises: Promise<TwitterUser>[] = []
  for await (const client of iterateAvailableTwClients()) {
    promises.push(client.blockUser(target).then(curriedMarkUser('Block')))
  }
  return Promise.allSettled(promises)
}

async function unblockWithMultipleAccounts(target: TwitterUser) {
  const promises: Promise<TwitterUser>[] = []
  for await (const client of iterateAvailableTwClients()) {
    promises.push(client.unblockUser(target).then(curriedMarkUser('UnBlock')))
  }
  return Promise.allSettled(promises)
}

async function muteWithMultipleAccounts(target: TwitterUser) {
  const promises: Promise<TwitterUser>[] = []
  for await (const client of iterateAvailableTwClients()) {
    promises.push(client.muteUser(target).then(curriedMarkUser('Mute')))
  }
  return Promise.allSettled(promises)
}

async function unmuteWithMultipleAccounts(target: TwitterUser) {
  const promises: Promise<TwitterUser>[] = []
  for await (const client of iterateAvailableTwClients()) {
    promises.push(client.unmuteUser(target).then(curriedMarkUser('UnMute')))
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
  results: PromiseSettledResult<TwitterUser>[]
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
