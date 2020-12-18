/// <reference path="./chainblock-session.d.ts" />

import * as UserScrapingAPI from '../user-scraping-api.js'
// import * as TwitterAPI from '../twitter-api.js'

const alternativeAccountIndicativePrefixes = [/[a-z가-힣]+계(?:는|정은?)?(?:$|[^가-힣])/i]

function extractMentionsInUsersBio(
  { description: bio }: TwitterUser,
  mode: 'all' | 'smart'
): string[] {
  const mentionAndIndices = twttr.txt.extractMentionsWithIndices(bio)
  if (mode === 'all') {
    return mentionAndIndices.map(({ screenName }) => screenName)
  }
  const mentionedUserNames: string[] = []
  let lastIndices: [number, number] = [0, 0]
  for (const { screenName, indices } of mentionAndIndices) {
    const prefix = bio.slice(lastIndices[1], indices[0])
    // console.log('prefix: "%s" [from indice %d:%d]', prefix, lastIndices[1], indices[0])
    for (const pattern of alternativeAccountIndicativePrefixes) {
      pattern.lastIndex = 0
      if (pattern.test(prefix)) {
        mentionedUserNames.push(screenName)
      }
    }
    lastIndices = indices
  }
  return mentionedUserNames
}

export async function* scrapeUsersOnBio(
  userIterator: ScrapedUsersIterator,
  mode: BioBlockMode
): ScrapedUsersIterator {
  if (mode === 'never') {
    yield* userIterator
    return
  }
  for await (const response of userIterator) {
    yield response
    if (response.ok) {
      const { users } = response.value
      const mentionedUserNames = new Set(
        users.map(user => extractMentionsInUsersBio(user, mode)).flat()
      )
      if (mentionedUserNames.size > 0) {
        console.debug(
          '%c found users-in-bio: %o',
          'font-size:14pt;color:orange',
          mentionedUserNames
        )
      }
      yield* UserScrapingAPI.lookupUsersByNames(Array.from(mentionedUserNames))
    }
  }
}
