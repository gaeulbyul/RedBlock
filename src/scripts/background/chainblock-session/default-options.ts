const myFollowers = 'Skip'
const myFollowings = 'Skip'
const mutualBlocked = 'Skip'
const protectedFollowers = 'Block'

const includeUsersInBio = 'never'
const skipInactiveUser = 'never'
const enableAntiBlock = false

export const defaultSessionOptions = Object.freeze<SessionOptions>({
  includeUsersInBio,
  skipInactiveUser,
  enableAntiBlock,
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

export const defaultExportPurposeOptions = Object.freeze<ExportPurpose>({
  type: 'export',
})

export const defaultPurposeOptions = Object.freeze({
  chainblock: defaultChainBlockPurposeOptions,
  unchainblock: defaultUnChainBlockPurposeOptions,
  lockpicker: defaultLockPickerPurposeOptions,
  chainunfollow: defaultChainUnfollowPurposeOptions,
  export: defaultExportPurposeOptions,
})
