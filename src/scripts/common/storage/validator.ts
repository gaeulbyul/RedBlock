import { z } from 'zod'
import redblockStorageSchema from './schema'
import type { RedBlockStorage } from './schema'

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
