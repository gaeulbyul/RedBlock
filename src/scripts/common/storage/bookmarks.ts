import browser from 'webextension-polyfill'
import { z } from 'zod'

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
/*
// ---- bookmark ----



type BookmarkItem = BookmarkTweetItem | BookmarkUserItem
*/

const bookmarkItemSchema = z.discriminatedUnion('type', [
  bookmarkTweetItemSchema,
  bookmarkUserItemSchema,
])

export const bookmarksSchema = z.array(bookmarkItemSchema)

export type BookmarkTweetItem = z.infer<typeof bookmarkTweetItemSchema>
export type BookmarkUserItem = z.infer<typeof bookmarkUserItemSchema>
export type BookmarkItem = z.infer<typeof bookmarkItemSchema>

type BookmarksMap = Map<string, BookmarkItem>

export async function loadBookmarksAsMap(
  desiredType?: BookmarkItem['type'],
): Promise<BookmarksMap> {
  const bookmarks = bookmarksSchema.parse((await browser.storage.local.get('bookmarks')).bookmarks)
  if (desiredType) {
    return arrayToMap(bookmarks.filter(({ type }) => type === desiredType))
  } else {
    return arrayToMap(bookmarks)
  }
}

export async function loadBookmarks(): Promise<BookmarkItem[]> {
  return bookmarksSchema.parse((await browser.storage.local.get('bookmarks')).bookmarks)
}

async function saveBookmarks(bookmarksMap: BookmarksMap): Promise<void> {
  const bookmarks = mapToArray(bookmarksMap)
  const storageObject = { bookmarks }
  return browser.storage.local.set(storageObject as any)
}

export async function insertItemToBookmark(item: BookmarkItem): Promise<void> {
  const bookmarks = await loadBookmarksAsMap()
  bookmarks.set(item.itemId, item)
  return saveBookmarks(bookmarks)
}

export async function removeBookmarkById(itemId: string): Promise<void> {
  const bookmarks = await loadBookmarksAsMap()
  bookmarks.delete(itemId)
  return saveBookmarks(bookmarks)
}

export async function modifyBookmarksWith(
  callback: (bookmark: BookmarksMap) => BookmarksMap,
): Promise<void> {
  const bookmarks = await loadBookmarksAsMap()
  const newBookmarks = callback(bookmarks)
  return saveBookmarks(newBookmarks)
}

function generateItemId(type: BookmarkItem['type'], id: string) {
  return `${type}-${id}`
}

export function createBookmarkUserItem(user: TwitterUser): BookmarkUserItem {
  return {
    type: 'user',
    itemId: generateItemId('user', user.id_str),
    userId: user.id_str,
  }
}

export function createBookmarkTweetItem(tweet: Tweet): BookmarkTweetItem {
  return {
    type: 'tweet',
    itemId: generateItemId('tweet', tweet.id_str),
    tweetId: tweet.id_str,
  }
}

function arrayToMap(array: BookmarkItem[]): BookmarksMap {
  const map: BookmarksMap = new Map<string, BookmarkItem>()
  for (const item of array) {
    map.set(item.itemId, item)
  }
  return map
}

function mapToArray(map: BookmarksMap): BookmarkItem[] {
  return Array.from(map.values())
}
