import * as uuid from 'uuid'

export interface ReduxStore {
  getState(): any
  dispatch(payload: { type: string, [key: string]: any }): any
  subscribe(callback: () => void): void
}

let myselfUserId = ''
let reduxStore: ReduxStore

function isReactPropsKey(name: string) {
  return name.startsWith('__reactProps') || name.startsWith('__reactEventHandlers')
}

export function getReactEventHandlers(target: Element): any {
  const key = Object.keys(target).find(isReactPropsKey)
  return key ? (target as any)[key] : null
}

export function findReduxStore(): ReduxStore {
  if (reduxStore) {
    return reduxStore
  }
  const reactRoot = document.getElementById('react-root')!.children[0]!
  const rEventHandler = getReactEventHandlers(reactRoot)
  reduxStore = rEventHandler.children.props.children.props.store
  return reduxStore
}

export function getMyselfUserId(): string {
  if (myselfUserId) {
    return myselfUserId
  }
  const reduxStore = findReduxStore()
  const state = reduxStore.getState()
  myselfUserId = state.session.user_id
  return myselfUserId
}

export function getTweetEntityById(tweetId: string) {
  const entities = findReduxStore().getState().entities.tweets.entities
  for (const entity_ of Object.values(entities)) {
    const entity = entity_ as any
    if (entity.id_str.toLowerCase() === tweetId) {
      return entity as TweetEntity
    }
  }
  return null
}

export function getUserEntityById(userId: string): TwitterUser | null {
  const entities = findReduxStore().getState().entities.users.entities
  return entities[userId] || null
}

export function toastMessage({ text, undoBlock }: ToastMessageParam) {
  let action: any
  if (undoBlock) {
    action = {
      label: 'Unblock',
      onAction() {
        document.dispatchEvent(
          new CustomEvent<UndoOneClickBlockByIdParam>('RedBlock<-RequestUnblockUserById', {
            bubbles: true,
            detail: undoBlock,
          }),
        )
        markUser({
          userAction: 'UnBlock',
          userId: undoBlock.userId,
        })
      },
    }
  }
  findReduxStore().dispatch({
    type: 'rweb/toasts/ADD_TOAST',
    payload: {
      text,
      action,
    },
  })
}

export function markUser({ userId, userAction }: MarkUserParams) {
  const id = uuid.v1()
  if (userAction === 'BlockAndUnBlock') {
    markUser({ userId, userAction: 'Block' })
    markUser({ userId, userAction: 'UnBlock' })
    return
  }
  const userActionUpperCase = userAction.toUpperCase()
  findReduxStore().dispatch({
    type: `rweb/entities/users/${userActionUpperCase}_REQUEST`,
    optimist: {
      type: 'BEGIN',
      id,
    },
    meta: {
      entityId: userId,
    },
  })
}
