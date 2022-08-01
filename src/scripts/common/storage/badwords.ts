import type { RedBlockStorage } from '\\/scripts/common/storage/schema'
import browser from 'webextension-polyfill'

type BadWordItem = RedBlockStorage['badWords'][number]

export async function loadBadWords(): Promise<RedBlockStorage['badWords']> {
  const { badWords } = (await browser.storage.local.get('badWords')) as unknown as RedBlockStorage
  return badWords || []
}

export async function saveBadWords(badWords: RedBlockStorage['badWords']): Promise<BadWordItem[]> {
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
