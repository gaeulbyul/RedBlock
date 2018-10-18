/* XXX
 * How to get authenticity_token's value from mobile.twitter.com???
 * ????????
 * ?????
 */

function generateToken (): string {
  return uuid.v1().replace(/-/g, '')
}

// 주의: 차단 반영이 늦거나 아예 반영이 안되거나 심지어 간헐적으로 차단이 풀릴 수 있음
// 실험적 구현 이상의 용도로 쓰기엔 좋지 않음..
namespace TwitterExperimentalBlocker {
  export async function blockAllByIds (ids: string[]): Promise<BlockAllResult> {
    const tokenElem = document.getElementById('authenticity_token') as HTMLInputElement | null
    const authenticityToken = tokenElem ? tokenElem.value : generateToken()
    const requests: Promise<Response | null>[] = []
    const chunkedIds = _.chunk(ids, 800)
    for (const chunk of chunkedIds) {
      const requestBody = new URLSearchParams()
      requestBody.set('authenticity_token', authenticityToken)
      for (const id of chunk) {
        requestBody.append('user_ids[]', id)
      }
      const headers = new Headers()
      headers.set('x-requested-with', 'XMLHttpRequest')
      headers.set('x-twitter-active-user', 'yes')
      requests.push(fetch('https://twitter.com/i/user/block_all', {
        method: 'POST',
        mode: 'cors',
        credentials: 'include',
        referrer: 'https://twitter.com/settings/imported_blocked',
        headers,
        body: requestBody
      }).catch(err => {
        console.error(err)
        return null
      }))
    }
    const responses = await Promise.all(requests)
    const totalBlocked = []
    const totalFailed = []
    for (const resp of responses) {
      if (!resp) {
        continue
      }
      const blockAllResult = (await resp.json()).result as BlockAllResult
      const { blocked, failed } = blockAllResult
      totalBlocked.push(...blocked)
      totalFailed.push(...failed)
    }
    return {
      blocked: totalBlocked,
      failed: totalFailed
    }
  }
}
