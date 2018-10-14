async function doChainBlock (userName: string) {
  const confirm3 = [1, 2, 3].map(i => window.confirm(`are you SURE to BLOCK @${userName}'s followers? ${i}`))
  if (confirm3.filter(a => !a).length > 0) {
    return
  }
  const blocker = new ChainBlocker()
  blocker.start(userName)
}

browser.runtime.onMessage.addListener((msg_: object) => {
  console.log('message: %o', msg_)
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
