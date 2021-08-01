import { iterateAvailableTwClients } from './blockbuster'
import { markUser } from './misc'

export async function blockWithMultipleAccounts(target: TwitterUser) {
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

export async function unblockWithMultipleAccounts(target: TwitterUser) {
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

export async function muteWithMultipleAccounts(target: TwitterUser) {
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

export async function unmuteWithMultipleAccounts(target: TwitterUser) {
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
