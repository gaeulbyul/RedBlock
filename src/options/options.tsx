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
        <div className="option-item">
          <label className="field checkbox-field">
            <input
              type="checkbox"
              checked={options.experimental_tweetReactionBasedChainBlock}
              onChange={() =>
                mutateOptions({
                  experimental_tweetReactionBasedChainBlock: !options.experimental_tweetReactionBasedChainBlock,
                })
              }
            />
            <span>트윗반응 체인블락</span>
          </label>
          <div className="info-option">
            <p>지정한 트윗을 리트윗하거나 마음에 들어한 사용자의 일부를 차단합니다.</p>
            <p>
              사용법: 위 옵션이 켜져있을 때, 체인블락을 실행하고 싶은 트윗의 링크에 우클릭을 하면 Red Block 메뉴에
              항목이 나타납니다.
            </p>
            {'\u26a0'} 주의:
            <ol>
              <li>이 기능으로 실제로 차단할 수 있는 사용자는 적거나 없을 수 있습니다.</li>
              <li>이 기능은 이미 차단한 사용자를 집계하지 못 합니다.</li>
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
