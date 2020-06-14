import * as Storage from '../scripts/background/storage.js'
import * as i18n from '../scripts/i18n.js'

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
        <legend>옵션 / Options</legend>
        <div className="option-item">
          <label className="field checkbox-field">
            <input
              type="checkbox"
              checked={options.useStandardBlockAPI}
              onChange={() =>
                mutateOptions({
                  useStandardBlockAPI: !options.useStandardBlockAPI,
                })
              }
            />
            <span>{i18n.getMessage('use_official_block_api')}</span>
          </label>
          <div className="info-option">
            <p>{i18n.getMessage('use_official_block_api_description')}</p>
            <div className="caution">
              <p>{i18n.getMessage('use_official_block_api_warning')}</p>
            </div>
          </div>
        </div>
        <div className="option-item">
          <label className="field checkbox-field">
            <input
              type="checkbox"
              checked={options.removeSessionAfterComplete}
              onChange={() =>
                mutateOptions({
                  removeSessionAfterComplete: !options.removeSessionAfterComplete,
                })
              }
            />
            <span>{i18n.getMessage('remove_session_after_complete')}</span>
          </label>
          <div className="info-option"></div>
        </div>
      </fieldset>
      {/*
      <fieldset>
        <legend>실험적인 기능 / Experimental Features</legend>
        <span>현재는 없습니다. / Not available at the moment.</span>
        <div className="option-item"></div>
      </fieldset>
      */}
    </div>
  )
}

document.addEventListener('DOMContentLoaded', () => {
  ReactDOM.render(<OptionsApp />, document.getElementById('app')!)
})
