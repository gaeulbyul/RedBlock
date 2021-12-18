const BEARER_TOKEN =
  `AAAAAAAAAAAAAAAAAAAAANRILgAAAAAAnNwIzUejRCOuH5E6I8xnZz4puTs%3D1Zv7ttfk8LF81IUq16cHjhLTvJu4FA33AGWWjCpTnA`

export function* getAddedElementsFromMutations(
  mutations: MutationRecord[],
): IterableIterator<HTMLElement> {
  for (const mut of mutations) {
    for (const node of mut.addedNodes) {
      if (node instanceof HTMLElement) {
        yield node
      }
    }
  }
}

async function verifyCredentials() {
  const response = await fetch('https://api.twitter.com/1.1/account/verify_credentials.json', {
    method: 'get',
    credentials: 'include',
    mode: 'cors',
    referrer: 'https://twitter.com/',
    headers: {
      authorization: `Bearer ${BEARER_TOKEN}`,
      'x-twitter-active-user': 'yes',
      'x-twitter-auth-type': 'OAuth2Session',
    },
  }).then(r => r.json())
  return response
}

export async function checkLoggedIn(): Promise<boolean> {
  // 놀랍게도(?) 트윗덱에선 로그인을 해도 false를 리턴하더라.
  const isLoggedIn = (window as any)?.__META_DATA__?.isLoggedIn
  if (isLoggedIn) {
    return true
  }
  // 그래서 최후의 방법...
  return await verifyCredentials()
}
