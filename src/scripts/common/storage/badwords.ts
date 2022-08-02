import browser from 'webextension-polyfill'
import { z } from 'zod'

const badWordItemSchema = z.object({
  id: z.string(),
  enabled: z.boolean(),
  word: z.string(),
  regexp: z.boolean(),
})

export const badWordsSchema = z.array(badWordItemSchema)

type BadWordItem = z.infer<typeof badWordItemSchema>

export async function loadBadWords(): Promise<BadWordItem[]> {
  return badWordsSchema.parse((await browser.storage.local.get('badWords')).badWords)
}

export async function saveBadWords(badWords: BadWordItem[]): Promise<BadWordItem[]> {
  const storageObject = { badWords }
  return browser.storage.local.set(storageObject as any).then(() => badWords)
}

export async function insertBadWord(word: string, regexp: boolean) {
  const words = await loadBadWords()
  const id = Date.now().toString()
  words.push({
    id,
    enabled: true,
    regexp,
    word,
  })
  return saveBadWords(words)
}

export async function removeBadWord(wordId: string) {
  const wordsBeforeRemove = await loadBadWords()
  const words = wordsBeforeRemove.filter(bw => bw.id !== wordId)
  return saveBadWords(words)
}

export async function editBadWord(wordIdToEdit: string, newBadWord: BadWordItem) {
  const words = await loadBadWords()
  const editedBadWords = words.map(word => {
    if (word.id === wordIdToEdit) {
      return newBadWord
    }
    return word
  })
  return saveBadWords(editedBadWords)
}
