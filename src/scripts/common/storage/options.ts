import browser from 'webextension-polyfill'
import { z } from 'zod'

const inactivePeriodSchema = z.union([
  z.literal('never'),
  z.literal('1y'),
  z.literal('2y'),
  z.literal('3y'),
])

const recurringSessionIntervalSchema = z.union([
  z.literal(3),
  z.literal(5),
  z.literal(10),
  z.literal(15),
  z.literal(20),
  z.literal(30),
])

export const optionsSchema = z.object({
  removeSessionAfterComplete: z.boolean(),
  skipInactiveUser: inactivePeriodSchema,
  revealBioBlockMode: z.boolean(),
  enableBlockBuster: z.boolean(),
  enableBlockBusterWithTweetDeck: z.boolean(),
  firstPartyIsolationCompatibleMode: z.boolean(),
  delayBlockRequest: z.number().min(0).max(10),
  muteEvenAlreadyBlocking: z.boolean(),
  enableReactionsV2Support: z.boolean(),
  oneClickBlockModeForAllTabs: z.boolean(),
  allowSelfChainBlock: z.boolean(),
  recurringSessionInterval: recurringSessionIntervalSchema,
  enableTeamwork: z.boolean(),
  alsoBlockTargetItself: z.boolean(),
  oneClickBlockCoTweeter: z.boolean(),
  oneClickBlockNFT: z.boolean(),
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

export const uiOptionsSchema = z.object({
  menus: menusSchema,
})

export const optionsSchema_v0_14_0_0 = optionsSchema.omit({
  oneClickBlockCoTweeter: true,
  oneClickBlockNFT: true,
})

export type RedBlockOptions = z.infer<typeof optionsSchema>
export type RedBlockUIOptions = z.infer<typeof uiOptionsSchema>

export async function loadOptions(): Promise<RedBlockOptions> {
  return optionsSchema.parse((await browser.storage.local.get('options')).options)
}

export async function saveOptions(options: RedBlockOptions): Promise<void> {
  const storageObject = { options }
  return browser.storage.local.set(storageObject as any)
}

export async function loadUIOptions(): Promise<RedBlockUIOptions> {
  return uiOptionsSchema.parse((await browser.storage.local.get('uiOptions')).uiOptions)
}

export async function saveUIOptions(uiOptions: RedBlockUIOptions): Promise<void> {
  const storageObject = { uiOptions }
  return browser.storage.local.set(storageObject as any)
}
