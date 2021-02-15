const myFollowers = 'Skip'
const myFollowings = 'Skip'
const mutualBlocked = 'Skip'
const protectedFollowers = 'Block'
const mutedAndAlsoBlocked = 'Skip'

const includeUsersInBio = 'never'
const skipInactiveUser = 'never'
const enableAntiBlock = false
const throttleBlockRequest = true

export const defaultSessionOptions = Object.freeze<SessionOptions>({
  includeUsersInBio,
  skipInactiveUser,
  enableAntiBlock,
  throttleBlockRequest,
})

export const defaultChainBlockPurposeOptions = Object.freeze<ChainBlockPurpose>({
  type: 'chainblock',
  myFollowers,
  myFollowings,
})

export const defaultUnChainBlockPurposeOptions = Object.freeze<UnChainBlockPurpose>({
  type: 'unchainblock',
  mutualBlocked,
})

export const defaultLockPickerPurposeOptions = Object.freeze<LockPickerPurpose>({
  type: 'lockpicker',
  protectedFollowers,
})

export const defaultChainUnfollowPurposeOptions = Object.freeze<ChainUnfollowPurpose>({
  type: 'chainunfollow',
})

export const defaultChainMutePurposeOptions = Object.freeze<ChainMutePurpose>({
  type: 'chainmute',
  myFollowers,
  myFollowings,
})

export const defaultUnChainMutePurposeOptions = Object.freeze<UnChainMutePurpose>({
  type: 'unchainmute',
  mutedAndAlsoBlocked,
})

export const defaultExportPurposeOptions = Object.freeze<ExportPurpose>({
  type: 'export',
})

export const defaultPurposeOptions = Object.freeze({
  chainblock: defaultChainBlockPurposeOptions,
  unchainblock: defaultUnChainBlockPurposeOptions,
  lockpicker: defaultLockPickerPurposeOptions,
  chainunfollow: defaultChainUnfollowPurposeOptions,
  chainmute: defaultChainMutePurposeOptions,
  unchainmute: defaultUnChainMutePurposeOptions,
  export: defaultExportPurposeOptions,
})
