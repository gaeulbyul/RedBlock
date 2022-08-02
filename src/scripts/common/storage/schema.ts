import { z } from 'zod'

export const REDBLOCK_STORAGE_LATEST_VERSION = 'v0.14.1.0'

const inactivePeriod = z.union([
  z.literal('never'),
  z.literal('1y'),
  z.literal('2y'),
  z.literal('3y'),
])

const recurringSessionInterval = z.union([
  z.literal(3),
  z.literal(5),
  z.literal(10),
  z.literal(15),
  z.literal(20),
  z.literal(30),
])

const bookmarkTweetItemSchema = z.object({
  type: z.literal('tweet'),
  itemId: z.string(),
  tweetId: z.string(),
})

const bookmarkUserItemSchema = z.object({
  type: z.literal('user'),
  itemId: z.string(),
  userId: z.string(),
})

const bookmarkItemSchema = z.union([bookmarkTweetItemSchema, bookmarkUserItemSchema])

const bookmarks = z.array(bookmarkItemSchema)

const options = z.object({
  removeSessionAfterComplete: z.boolean(),
  skipInactiveUser: inactivePeriod,
  revealBioBlockMode: z.boolean(),
  enableBlockBuster: z.boolean(),
  enableBlockBusterWithTweetDeck: z.boolean(),
  firstPartyIsolationCompatibleMode: z.boolean(),
  delayBlockRequest: z.number().min(0).max(10),
  muteEvenAlreadyBlocking: z.boolean(),
  enableReactionsV2Support: z.boolean(),
  oneClickBlockModeForAllTabs: z.boolean(),
  allowSelfChainBlock: z.boolean(),
  recurringSessionInterval,
  enableTeamwork: z.boolean(),
  alsoBlockTargetItself: z.boolean(),
  oneClickBlockCoTweeter: z.boolean(),
  oneClickBlockNFT: z.boolean(),
})

const options_v0_14_0_0 = options.omit({
  oneClickBlockCoTweeter: true,
  oneClickBlockNFT: true,
})

const menusSchema = z.object({
  chainBlockFollowers: z.boolean(),
  chainBlockFollowings: z.boolean(),
  chainBlockMutualFollowers: z.boolean(),
  chainBlockRetweeters: z.boolean(),
  chainBlockLikers: z.boolean(),
  chainBlockRetweetersAndLikers: z.boolean(),
  chainBlockMentioned: z.boolean(),
  chainBlockAudioSpaceSpeakers: z.boolean(),
  chainBlockAudioSpaceSpeakersAndListeners: z.boolean(),
  chainBlockHashTagInUsersProfile: z.boolean(),
  teamworkBlock: z.boolean(),
  teamworkUnblock: z.boolean(),
  teamworkMute: z.boolean(),
  teamworkUnmute: z.boolean(),
})

const uiOptions = z.object({
  menus: menusSchema,
})

const badWordItemSchema = z.object({
  id: z.string(),
  enabled: z.boolean(),
  word: z.string(),
  regexp: z.boolean(),
})

const badWords = z.array(badWordItemSchema)

export const redblockStorageSchema = z.object({
  $$version$$: z.literal(REDBLOCK_STORAGE_LATEST_VERSION),
  bookmarks,
  options,
  uiOptions,
  badWords,
})

export const redblockStorageSchema_v0_14_0_0 = z.object({
  $$version$$: z.literal('v0.14.0.0'),
  bookmarks,
  options: options_v0_14_0_0,
  uiOptions,
  badWords,
})

export const redblockStorageSchemaAnyVersion = z.discriminatedUnion('$$version$$', [
  redblockStorageSchema,
  redblockStorageSchema_v0_14_0_0,
])

export type RedBlockStorage = z.infer<typeof redblockStorageSchema>
export type RedBlockOptions = RedBlockStorage['options']
export type RedBlockUIOptions = RedBlockStorage['uiOptions']

export type RedBlockStorageChanges = {
  [key in keyof RedBlockStorage]: {
    oldValue: RedBlockStorage[key]
    newValue: RedBlockStorage[key]
  }
}
