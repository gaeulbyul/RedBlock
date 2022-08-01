import { z } from 'zod'

const validator = {
  bookmarks() {
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

    const arrayOfBookmarkItemsSchema = z.array(bookmarkItemSchema)

    return arrayOfBookmarkItemsSchema
  },

  options() {
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
    const optionsSchema = z.object({
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
    })

    return optionsSchema
  },

  uiOptions() {
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
    const uiOptionsSchema = z.object({
      menus: menusSchema,
    })

    return uiOptionsSchema
  },

  badWords() {
    const badWordItemSchema = z.object({
      id: z.string(),
      enabled: z.boolean(),
      word: z.string(),
      regexp: z.boolean(),
    })
    return z.array(badWordItemSchema)
  },
}

const redblockStorageSchema = z.object({
  $$version$$: z.literal('v0.14.0.0'),
  bookmarks: validator.bookmarks(),
  options: validator.options(),
  uiOptions: validator.uiOptions(),
  badWords: validator.badWords(),
})

export default redblockStorageSchema

export type RedBlockStorage = z.infer<typeof redblockStorageSchema>

export type RedBlockStorageChanges = {
  [key in keyof RedBlockStorage]: {
    oldValue: RedBlockStorage[key]
    newValue: RedBlockStorage[key]
  }
}
