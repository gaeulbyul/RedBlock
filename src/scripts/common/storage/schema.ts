import { z } from 'zod'

import { badWordsSchema as badWords } from './badwords'
import { bookmarksSchema as bookmarks } from './bookmarks'
import {
  optionsSchema as options,
  optionsSchema_v0_14_0_0,
  uiOptionsSchema as uiOptions,
} from './options'

export const REDBLOCK_STORAGE_LATEST_VERSION = 'v0.14.1.0'

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
  options: optionsSchema_v0_14_0_0,
  uiOptions,
  badWords,
})

export const redblockStorageSchemaAnyVersion = z.discriminatedUnion('$$version$$', [
  redblockStorageSchema,
  redblockStorageSchema_v0_14_0_0,
])

export type RedBlockStorage = z.infer<typeof redblockStorageSchema>
export type { RedBlockOptions, RedBlockUIOptions } from './options'

export type RedBlockStorageChanges = {
  [key in keyof RedBlockStorage]: {
    oldValue: RedBlockStorage[key]
    newValue: RedBlockStorage[key]
  }
}
