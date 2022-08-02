const myFollowers = 'Skip'
const myFollowings = 'Skip'
const mutualBlocked = 'Skip'
const protectedFollowers = 'Block'
const mutedAndAlsoBlocked = 'Skip'

const bioBlock = 'never'
const recurring = false

export const defaultChainBlockPurposeOptions = Object.freeze<ChainBlockPurpose>({
  type: 'chainblock',
  myFollowers,
  myFollowings,
  verifiedUsers: 'Block',
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
  verifiedUsers: 'Mute',
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

export const defaultExtraSessionOptions = Object.freeze<
  SessionRequest<AnySessionTarget>['extraSessionOptions']
>({
  bioBlock,
  recurring,
})
