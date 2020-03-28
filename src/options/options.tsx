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
              checked={options.enableRailgun}
              onChange={() =>
                mutateOptions({
                  enableRailgun: !options.enableRailgun,
                })
              }
            />
            <span>Railgun 모드</span>
          </label>
          <div className="info-option">
            <p>체인블락을 할 때 팔로워를 가져오는 API호출을 대폭 줄입니다.</p>
            <p>단, 이미 차단한 유저수가 집계되지 않습니다.</p>
          </div>
        </div>
      </fieldset>
    </div>
  )
}

document.addEventListener('DOMContentLoaded', () => {
  ReactDOM.render(<OptionsApp />, document.getElementById('app')!)
})
