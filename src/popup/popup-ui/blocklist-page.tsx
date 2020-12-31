import { UIContext, MyselfContext, BlockLimiterContext } from './contexts.js'
import { PleaseLoginBox, BlockLimiterUI, BigExecuteChainBlockButton } from './components.js'
import { PageEnum } from '../popup.js'
import * as i18n from '../../scripts/i18n.js'
import { generateConfirmMessage } from '../../scripts/text-generate.js'
import * as TwitterAPI from '../../scripts/background/twitter-api.js'
import { startNewChainBlockSession } from '../../scripts/background/request-sender.js'
import {
  emptyBlocklist,
  parseBlocklist,
  concatBlockList,
} from '../../scripts/background/blocklist-process.js'
import { ImportChainBlockPageStatesContext } from './ui-states.js'

const M = MaterialUI
const T = MaterialUI.Typography

function ImportOptionsUI() {
  const { targetOptions, mutateOptions } = React.useContext(ImportChainBlockPageStatesContext)
  const { myFollowers, myFollowings } = targetOptions
  const userActions: Array<[UserAction, string]> = [
    ['Skip', i18n.getMessage('skip')],
    ['Mute', i18n.getMessage('do_mute')],
    ['Block', i18n.getMessage('do_block')],
  ]
  return (
    <React.Fragment>
      <M.FormControl component="fieldset">
        <M.FormLabel component="legend">{i18n.getMessage('my_followers')}</M.FormLabel>
        <M.RadioGroup row>
          {userActions.map(([userAction, localizedAction], index) => (
            <M.FormControlLabel
              key={index}
              control={<M.Radio size="small" />}
              checked={myFollowers === userAction}
              onChange={() => mutateOptions({ myFollowers: userAction })}
              label={localizedAction}
            />
          ))}
        </M.RadioGroup>
      </M.FormControl>
      <br />
      <M.FormControl component="fieldset">
        <M.FormLabel component="legend">{i18n.getMessage('my_followings')}</M.FormLabel>
        <M.RadioGroup row>
          {userActions.map(([userAction, localizedAction], index) => (
            <M.FormControlLabel
              key={index}
              control={<M.Radio size="small" />}
              checked={myFollowings === userAction}
              onChange={() => mutateOptions({ myFollowings: userAction })}
              label={localizedAction}
            />
          ))}
        </M.RadioGroup>
      </M.FormControl>
    </React.Fragment>
  )
}

export default function BlocklistPage() {
  const myself = React.useContext(MyselfContext)
  const uiContext = React.useContext(UIContext)
  const limiterStatus = React.useContext(BlockLimiterContext)
  const { openDialog } = React.useContext(UIContext)
  const {
    blocklist,
    setBlocklist,
    targetOptions,
    setTargetOptions,
    nameOfSelectedFiles,
    setNameOfSelectedFiles,
  } = React.useContext(ImportChainBlockPageStatesContext)
  const [fileInput] = React.useState(React.createRef<HTMLInputElement>())
  function isAvailable() {
    if (!myself) {
      return false
    }
    if (limiterStatus.remained <= 0) {
      return false
    }
    return true
  }
  async function onChange(event: React.FormEvent<HTMLInputElement>) {
    event.preventDefault()
    const files = fileInput.current!.files
    if (!(files && files.length > 0)) {
      uiContext.openSnackBar(i18n.getMessage('pick_file_first'))
      setBlocklist(emptyBlocklist)
      return
    }
    const filesArray = Array.from(files)
    setNameOfSelectedFiles(filesArray.map(file => file.name))
    const texts = await Promise.all(filesArray.map(file => file.text()))
    const blocklist = texts
      .map(parseBlocklist)
      .reduce((list1, list2) => concatBlockList(list1, list2))
    setBlocklist(blocklist)
  }
  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (blocklist.userIds.size <= 0) {
      uiContext.openSnackBar(i18n.getMessage('cant_chainblock_empty_list'))
      return
    }
    const myself = await TwitterAPI.getMyself().catch(() => null)
    if (!myself) {
      uiContext.openSnackBar(i18n.getMessage('error_occured_check_login'))
      return
    }
    const request: ImportBlockSessionRequest = {
      purpose: 'chainblock',
      target: {
        type: 'import',
        userIds: Array.from(blocklist.userIds),
      },
      options: targetOptions,
      myself,
    }
    openDialog({
      dialogType: 'confirm',
      message: generateConfirmMessage(request),
      callbackOnOk() {
        startNewChainBlockSession<ImportBlockSessionRequest>(request)
      },
    })
  }
  function onReset(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBlocklist(emptyBlocklist)
    setNameOfSelectedFiles([])
    setTargetOptions({
      myFollowers: 'Skip',
      myFollowings: 'Skip',
      includeUsersInBio: 'never',
    })
  }
  async function openPopupUIInTab(event: React.MouseEvent<HTMLButtonElement, MouseEvent>) {
    event.preventDefault()
    browser.tabs.create({
      active: true,
      url: `/popup/popup.html?istab=1&page=${PageEnum.Blocklist}`,
    })
    window.close()
  }
  const usersToBlock = (
    <span>
      {i18n.getMessage('count_of_users')}:{' '}
      <strong>{blocklist.userIds.size.toLocaleString()}</strong>
    </span>
  )
  const duplicatedUsers = (
    <span>
      {i18n.getMessage('duplicated')}: {blocklist.duplicated.toLocaleString()}
    </span>
  )
  const invalidUsers = (
    <span>
      {i18n.getMessage('invalid')}: {blocklist.invalid.toLocaleString()}
    </span>
  )
  return (
    <div>
      <M.ExpansionPanel defaultExpanded>
        <M.ExpansionPanelSummary>
          <T>{i18n.getMessage('import_blocklist')}</T>
        </M.ExpansionPanelSummary>
        <M.ExpansionPanelDetails>
          <div style={{ width: '100%' }}>
            <form onSubmit={onSubmit} onReset={onReset}>
              <input
                required
                ref={fileInput}
                id="input-file-to-import"
                name="input-file"
                type="file"
                onChange={onChange}
                multiple
                style={{ display: 'none' }}
                accept="text/plain,.txt,text/csv,.csv,application/json,.json,application/javascript,.js"
              />
              <M.FormControl component="fieldset" fullWidth>
                <M.Box
                  display="flex"
                  flexDirection="row"
                  alignItems="center"
                  justifyContent="space-between"
                >
                  <label htmlFor="input-file-to-import">
                    <M.Button variant="contained" component="span">
                      {i18n.getMessage('select_files')}
                    </M.Button>
                  </label>
                  <M.Button variant="outlined" type="reset">
                    Reset
                  </M.Button>
                </M.Box>
              </M.FormControl>
              <div className="description">
                <p>
                  {usersToBlock} / {duplicatedUsers} / {invalidUsers}
                </p>
                {nameOfSelectedFiles.length > 0 && (
                  <React.Fragment>
                    <span>{i18n.getMessage('selected_files')}:</span>
                    <ul className="list-of-files">
                      {nameOfSelectedFiles.map((name, index) => (
                        <li key={index}>{name}</li>
                      ))}
                    </ul>
                  </React.Fragment>
                )}
              </div>
              <ImportOptionsUI />
              <div className="description">
                <p>{i18n.getMessage('blocklist_import_description')}</p>
                <div className="hide-on-tab">
                  <p style={{ fontWeight: 'bold' }}>
                    ⚠ {i18n.getMessage('open_new_tab_for_file_picker')}
                  </p>
                  <M.Button
                    type="button"
                    variant="outlined"
                    component="button"
                    onClick={openPopupUIInTab}
                  >
                    {i18n.getMessage('open_in_new_tab')}
                  </M.Button>
                </div>
              </div>
              <BigExecuteChainBlockButton type="submit" disabled={!isAvailable}>
                <span>
                  {'\u{1f6d1}'} {i18n.getMessage('execute_chainblock')}
                </span>
              </BigExecuteChainBlockButton>
            </form>
          </div>
        </M.ExpansionPanelDetails>
      </M.ExpansionPanel>
      {myself ? '' : <PleaseLoginBox />}
      <BlockLimiterUI />
    </div>
  )
}
