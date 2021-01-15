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
      for await (const maybeUser of UserScrapingAPI.lookupUsersByNames(Array.from(mentionedUserNames))) {
        // ok여부 체크하지 않으면 오류로 인해 체인블락이 정지한다.
        // 프로필 유저를 가져오지 못하더라도 진행할 수 있도록 하자
        if (maybeUser.ok) {
          yield maybeUser
        } else {
          console.error(maybeUser.error)
        }
      }
    }
  }
}
