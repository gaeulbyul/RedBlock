import { iterateAvailableTwClients } from './blockbuster'
import { markUser } from './misc'

async function blockWithMultipleAccounts(target: TwitterUser) {
  const promises: Promise<void>[] = []
  for await (const client of iterateAvailableTwClients()) {
    promises.push(
      client.blockUser(target).then(afterTarget => {
        if (!afterTarget) {
          return
        }
        return markUser({
          userId: afterTarget.id_str,
          userAction: 'Block',
        })
      })
    )
  }
  return Promise.allSettled(promises)
}

async function unblockWithMultipleAccounts(target: TwitterUser) {
  const promises: Promise<void>[] = []
  for await (const client of iterateAvailableTwClients()) {
    promises.push(
      client.unblockUser(target).then(afterTarget => {
        if (!afterTarget) {
          return
        }
        return markUser({
          userId: afterTarget.id_str,
          userAction: 'UnBlock',
        })
      })
    )
  }
  return Promise.allSettled(promises)
}

async function muteWithMultipleAccounts(target: TwitterUser) {
  const promises: Promise<void>[] = []
  for await (const client of iterateAvailableTwClients()) {
    promises.push(
      client.muteUser(target).then(afterTarget => {
        if (!afterTarget) {
          return
        }
        return markUser({
          userId: afterTarget.id_str,
          userAction: 'Mute',
        })
      })
    )
  }
  return Promise.allSettled(promises)
}

async function unmuteWithMultipleAccounts(target: TwitterUser) {
  const promises: Promise<void>[] = []
  for await (const client of iterateAvailableTwClients()) {
    promises.push(
      client.unmuteUser(target).then(afterTarget => {
        if (!afterTarget) {
          return
        }
        return markUser({
          userId: afterTarget.id_str,
          userAction: 'UnMute',
        })
      })
    )
  }
  return Promise.allSettled(promises)
}

export async function doActionWithMultipleAccounts(action: UserAction, targetUser: TwitterUser) {
  switch (action) {
    case 'Block':
      return blockWithMultipleAccounts(targetUser)
    case 'UnBlock':
      return unblockWithMultipleAccounts(targetUser)
    case 'Mute':
      return muteWithMultipleAccounts(targetUser)
    case 'UnMute':
      return unmuteWithMultipleAccounts(targetUser)
    case 'Skip':
    case 'UnFollow':
    case 'BlockAndUnBlock':
      throw new Error('unreachable')
  }
}
