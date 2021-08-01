import { z } from 'zod'

const validator = {
  bookmarks() {
    const bookmarkTweetItemSchema = z.strictObject({
      type: z.literal('tweet'),
      itemId: z.string(),
      tweetId: z.string(),
    })

    const bookmarkUserItemSchema = z.strictObject({
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
    const optionsSchema = z.strictObject({
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
    })

    return optionsSchema
  },

  uiOptions() {
    const menusSchema = z.strictObject({
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
    })
    const uiOptionsSchema = z.strictObject({
      menus: menusSchema,
    })

    return uiOptionsSchema
  },

  badWords() {
    const badWordItemSchema = z.strictObject({
      id: z.string(),
      enabled: z.boolean(),
      word: z.string(),
      regexp: z.boolean(),
    })
    return z.array(badWordItemSchema)
  },
}

const redblockStorageSchema = z.strictObject({
  $$version$$: z.literal('v0.14.0.0'),
  bookmarks: validator.bookmarks(),
  options: validator.options(),
  uiOptions: validator.uiOptions(),
  badWords: validator.badWords(),
})

interface ParseSuccess {
  success: true
  data: RedBlockStorage
}

interface ParseFail {
  success: false
  error: z.ZodError
}

export function safeValidateStorage(x: unknown): ParseFail | ParseSuccess {
  return redblockStorageSchema.safeParse(x)
}

export function validateStorage(x: unknown): RedBlockStorage {
  return redblockStorageSchema.parse(x)
}
