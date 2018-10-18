const blocker = new ChainBlocker()

async function doChainBlock (userName: string) {
  const confirmMessage = `
ㅁㅁㅁㅁㅁㅁㅁㅁㅁㅁㅁㅁㅁㅁㅁㅁㅁㅁㅁㅁㅁㅁㅁㅁㅁㅁㅁ
정말로 @${userName}에게 체인블락을 실행하시겠습니까?
ㅁㅁㅁㅁㅁㅁㅁㅁㅁㅁㅁㅁㅁㅁㅁㅁㅁㅁㅁㅁㅁㅁㅁㅁㅁㅁㅁ
  `.trim()
  if (window.confirm(confirmMessage)) {
    blocker.start(userName)
  }
}

browser.runtime.onMessage.addListener((msg_: object) => {
  const message = msg_ as RBMessage
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
