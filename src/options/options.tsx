import * as Storage from '../scripts/background/storage.js'

type RedBlockOptions = Storage.RedBlockStorage['options']

function OptionsApp() {
  const [options, setOptions] = React.useState<RedBlockOptions>(Storage.defaultOptions)
  React.useEffect(() => {
    Storage.loadOptions().then(setOptions)
    return Storage.onOptionsChanged(setOptions)
  }, [])
  async function mutateOptions(newOptionsPart: Partial<RedBlockOptions>) {
    const newOptions = { ...options, ...newOptionsPart }
    await Storage.saveOptions(newOptions)
    setOptions(newOptions)
  }
  return (
    <div>
      <fieldset>
        <legend>실험적인 기능</legend>
        <div className="field">
          <label>
            <input
              type="checkbox"
              checked={options.experimental_tweetReactionBasedChainBlock}
              onChange={() =>
                mutateOptions({
                  experimental_tweetReactionBasedChainBlock: !options.experimental_tweetReactionBasedChainBlock,
                })
              }
            />
            <span className="checkable">트윗반응 기반 체인블락</span>
          </label>
          <div className="description">
            사용법: 위 옵션이 켜져있을 때, 체인블락을 실행하고 싶은 트윗의 링크에 우클릭을 하면 Red Block 메뉴에 항목이
            나타납니다.
            {'\u26a0'} 주의:
            <ol>
              <li>
                이미 차단하거나 프로텍트, 일시정지등의 이유로 실제로 차단할 수 있는 사용자는 적거나 아예 없을 수
                있습니다.
              </li>
              <li>
                비팔알림(내가 팔로우하지 않는 사용자의 알림)을 끌 경우 이 기능이 제대로 작동하지 않을 수 있습니다.
              </li>
            </ol>
          </div>
        </div>
      </fieldset>
    </div>
  )
}

document.addEventListener('DOMContentLoaded', () => {
  ReactDOM.render(<OptionsApp />, document.getElementById('app')!)
})
