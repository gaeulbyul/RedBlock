interface ChainBlockProgress {
  total: number,
  alreadyBlocked: number,
  skipped: number,
  blockSuccess: number,
  blockFail: number
}

interface ChainBlockOptions {
  'unsafe useIdsAPI': boolean,
  useBlockAllAPI: boolean
}

const enum ChainBlockUIState {
  Initial,
  Running,
  RateLimited,
  Completed,
  Stopped,
  Closed,
  Error
}

const blocker = new ChainBlocker()

async function doChainBlock (targetUserName: string) {
  const targetUser = await TwitterAPI.getSingleUserByName(targetUserName)
  const confirmMessage = `
ㅁㅁㅁㅁㅁㅁㅁㅁㅁㅁㅁㅁㅁㅁㅁㅁㅁㅁㅁㅁㅁㅁㅁㅁㅁㅁㅁㅁㅁㅁ
정말로 @${targetUserName}에게 체인블락을 실행하시겠습니까?
ㅁㅁㅁㅁㅁㅁㅁㅁㅁㅁㅁㅁㅁㅁㅁㅁㅁㅁㅁㅁㅁㅁㅁㅁㅁㅁㅁㅁㅁㅁ
  `.trim()
  if (window.confirm(confirmMessage)) {
    const unsafeConfirmMessage = window.confirm(`
♥♥♥♥♥♥♥♥♥♥♥♥♥♥♥♥♥♥♥♥♥♥♥♥♥♥♥♥♥♥♥♥♥♥♥♥♥♥♥♥♥♥♥♥♥♥♥♥♥♥♥♥♥♥
CAUTION CAUTION CAUTION CAUTION CAUTION CAUTION
♥♥♥♥♥♥♥♥♥♥♥♥♥♥♥♥♥♥♥♥♥♥♥♥♥♥♥♥♥♥♥♥♥♥♥♥♥♥♥♥♥♥♥♥♥♥♥♥♥♥♥♥♥♥
>>>>> unsafe mode? <<<<<
♥♥♥♥♥♥♥♥♥♥♥♥♥♥♥♥♥♥♥♥♥♥♥♥♥♥♥♥♥♥♥♥♥♥♥♥♥♥♥♥♥♥♥♥♥♥♥♥♥♥♥♥♥♥
CAUTION CAUTION CAUTION CAUTION CAUTION CAUTION
♥♥♥♥♥♥♥♥♥♥♥♥♥♥♥♥♥♥♥♥♥♥♥♥♥♥♥♥♥♥♥♥♥♥♥♥♥♥♥♥♥♥♥♥♥♥♥♥♥♥♥♥♥♥
    `)
    const cbOptions: ChainBlockOptions = {
      useBlockAllAPI: false,
      'unsafe useIdsAPI': false
    }
    if (unsafeConfirmMessage) {
      // cbOptions.useBlockAllAPI = true
      cbOptions['unsafe useIdsAPI'] = true
    }
    blocker.add(targetUser, cbOptions)
    blocker.start()
  }
}

browser.runtime.onMessage.addListener((msgobj: object) => {
  const message = msgobj as RBMessage
  switch (message.action) {
    case Action.Start: {
      if (document.querySelector('.mobcb-bg') != null) {
        window.alert('Mirror Of Block 작동중엔 사용할 수 없습니다.')
        return
      } else if (document.querySelector('.redblock-bg') != null) {
        window.alert('이미 Red Block이 실행중입니다.')
        return
      }
      doChainBlock(message.userName).then(() => {
        // console.dir(result)
      })
    } break
  }
})
