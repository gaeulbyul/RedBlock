import cloneDeep from 'lodash-es/cloneDeep'
import browser from 'webextension-polyfill'
import { z } from 'zod'

import { defaultStorage } from './default-options'
import type { RedBlockStorage } from './schema'
import {
  REDBLOCK_STORAGE_LATEST_VERSION,
  redblockStorageSchema,
  redblockStorageSchema_v0_14_0_0,
  redblockStorageSchemaAnyVersion,
} from './schema'

export type RedBlockStorage_v0_14_0_0 = z.infer<typeof redblockStorageSchema_v0_14_0_0>
export type RedBlockStorageAnyVersion = z.infer<typeof redblockStorageSchemaAnyVersion>

function from_v0_14_0_0_To_v0_14_1_0(storage: RedBlockStorage_v0_14_0_0): RedBlockStorage {
  const cloned = cloneDeep(storage)
  const newStorage: RedBlockStorage = {
    ...cloned,
    $$version$$: 'v0.14.1.0',
    options: {
      ...cloned.options,
      oneClickBlockCoTweeter: false,
      oneClickBlockNFT: false,
    },
  }
  return redblockStorageSchema.parse(newStorage)
}

export function migrateStorage(unknownStorage: unknown): RedBlockStorage {
  try {
    const storage = redblockStorageSchemaAnyVersion.parse(unknownStorage)
    switch (storage.$$version$$) {
      case REDBLOCK_STORAGE_LATEST_VERSION:
        return storage
      case 'v0.14.0.0':
        return from_v0_14_0_0_To_v0_14_1_0(storage)
      default:
        throw new Error('unreachable')
    }
  } catch (err) {
    console.error(err)
    return defaultStorage
  }
}

async function migrateSelf() {
  const storage = await browser.storage.local.get()
  const migrated = migrateStorage(storage)
  await browser.storage.local.set(migrated)
}

export function handleMigrationOnExtensionUpdate() {
  browser.runtime.onInstalled.addListener(migrateSelf)
}

export async function safelyImportStorage(unknownStorage: unknown) {
  const storage = migrateStorage(unknownStorage)
  browser.storage.local.set(storage)
}
