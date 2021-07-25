import React from 'react'
import * as MaterialUI from '@material-ui/core'

import { UIContext, MyselfContext, BlockLimiterContext, RedBlockOptionsContext } from './contexts'
import {
  RBAccordion,
  BlockLimiterUI,
  BigExecuteButton,
  PurposeSelectionUI,
  RequestCheckResultUI,
  TabPanel,
} from './components'
import type { PageId } from './pages'
import * as TextGenerate from '../../scripts/text-generate'
import { startNewChainBlockSession } from '../../scripts/background/request-sender'
import {
  emptyBlocklist,
  parseBlocklist,
  concatBlockList,
} from '../../scripts/background/blocklist-process'
import { ImportChainBlockPageStatesContext, ExtraTargetContext } from './ui-states'
import { TargetCheckResult, validateRequest } from '../../scripts/background/target-checker'
import * as i18n from '~~/scripts/i18n'

const M = MaterialUI

function useImportSessionRequest(): Either<TargetCheckResult, SessionRequest<ImportSessionTarget>> {
  const { purpose, blocklist } = React.useContext(ImportChainBlockPageStatesContext)
  const { extraTarget } = React.useContext(ExtraTargetContext)
  const myself = React.useContext(MyselfContext)
  const options = React.useContext(RedBlockOptionsContext)
  if (!myself) {
    return {
      ok: false,
      error: TargetCheckResult.MaybeNotLoggedIn,
    }
  }
  const request: SessionRequest<ImportSessionTarget> = {
    purpose,
    target: {
      type: 'import',
      source: 'file',
      userIds: Array.from(blocklist.userIds),
      userNames: Array.from(blocklist.userNames),
    },
    extraTarget,
    retriever: myself,
    executor: myself,
    options,
  }
  const requestCheckResult = validateRequest(request)
  if (requestCheckResult === TargetCheckResult.Ok) {
    return {
      ok: true,
      value: request,
    }
  } else {
    return {
      ok: false,
      error: requestCheckResult,
    }
  }
}

function useExportSessionRequest(): Either<
  TargetCheckResult,
  SessionRequest<ExportMyBlocklistTarget>
> {
  const myself = React.useContext(MyselfContext)
  const options = React.useContext(RedBlockOptionsContext)
  if (!myself) {
    return {
      ok: false,
      error: TargetCheckResult.MaybeNotLoggedIn,
    }
  }
  const request: SessionRequest<ExportMyBlocklistTarget> = {
    purpose: {
      type: 'export',
    },
    target: {
      type: 'export_my_blocklist',
    },
    extraTarget: {
      bioBlock: 'never',
    },
    retriever: myself,
    executor: myself,
    options,
  }
  const requestCheckResult = validateRequest(request)
  if (requestCheckResult === TargetCheckResult.Ok) {
    return {
      ok: true,
      value: request,
    }
  } else {
    return {
      ok: false,
      error: requestCheckResult,
    }
  }
}

function TargetOptionsUI() {
  const { purpose, changePurposeType, mutatePurposeOptions, availablePurposeTypes } =
    React.useContext(ImportChainBlockPageStatesContext)
  const summary = `${i18n.getMessage('options')} (${i18n.getMessage(purpose.type)})`
  return (
    <RBAccordion summary={summary} defaultExpanded>
      <PurposeSelectionUI
        {...{
          purpose,
          changePurposeType,
          mutatePurposeOptions,
          availablePurposeTypes,
        }}
      />
    </RBAccordion>
  )
}

function ImportBlocklistUI() {
  const uiContext = React.useContext(UIContext)
  const limiterStatus = React.useContext(BlockLimiterContext)
  const { blocklist, setBlocklist, nameOfSelectedFiles, setNameOfSelectedFiles, purpose } =
    React.useContext(ImportChainBlockPageStatesContext)
  const [fileInput] = React.useState(React.createRef<HTMLInputElement>())
  const maybeRequest = useImportSessionRequest()
  const blocklistSize = blocklist.userIds.size + blocklist.userNames.size
  function isAvailable() {
    if (limiterStatus.remained <= 0) {
      return false
    }
    return maybeRequest.ok
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
    const newBlocklist = texts
      .map(parseBlocklist)
      .reduce((list1, list2) => concatBlockList(list1, list2))
    setBlocklist(newBlocklist)
  }
  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (maybeRequest.ok) {
      const { value: request } = maybeRequest
      return uiContext.openDialog({
        dialogType: 'confirm',
        message: TextGenerate.generateConfirmMessage(request),
        callbackOnOk() {
          startNewChainBlockSession<ImportSessionTarget>(request)
        },
      })
    } else {
      const message = TextGenerate.checkResultToString(maybeRequest.error)
      return uiContext.openSnackBar(message)
    }
  }
  function onReset(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBlocklist(emptyBlocklist)
    setNameOfSelectedFiles([])
  }
  async function openPopupUIInTab(event: React.MouseEvent<HTMLButtonElement, MouseEvent>) {
    event.preventDefault()
    const blocklistPage: PageId = 'new-session-blocklist-page'
    browser.tabs.create({
      active: true,
      url: `/popup/popup.html?istab=1&page=${blocklistPage}`,
    })
    window.close()
  }
  const usersToBlock = (
    <span>
      {i18n.getMessage('count_of_users')}: <strong>{blocklistSize.toLocaleString()}</strong>
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
    <form onSubmit={onSubmit} onReset={onReset}>
      <RBAccordion summary={i18n.getMessage('import_blocklist')} defaultExpanded>
        <div style={{ width: '100%' }}>
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
        </div>
      </RBAccordion>
      <TargetOptionsUI />
      <BlockLimiterUI />
      <RequestCheckResultUI {...{ maybeRequest }} />
      <BigExecuteButton {...{ purpose }} type="submit" disabled={!isAvailable()} />
    </form>
  )
}

function ExportBlocklistUI() {
  const maybeRequest = useExportSessionRequest()
  const uiContext = React.useContext(UIContext)
  const purpose: SessionRequest<ExportMyBlocklistTarget>['purpose'] = {
    type: 'export',
  }
  function executeSession() {
    if (maybeRequest.ok) {
      const { value: request } = maybeRequest
      return uiContext.openDialog({
        dialogType: 'confirm',
        message: TextGenerate.generateConfirmMessage(request),
        callbackOnOk() {
          startNewChainBlockSession<ExportMyBlocklistTarget>(request)
        },
      })
    } else {
      const message = TextGenerate.checkResultToString(maybeRequest.error)
      return uiContext.openSnackBar(message)
    }
  }
  return (
    <div style={{ width: '100%' }}>
      <RBAccordion summary={i18n.getMessage('exporting_my_blocklist')} defaultExpanded>
        <p>{i18n.getMessage('exporting_my_blocklist_description')}</p>
      </RBAccordion>
      <BigExecuteButton disabled={false} {...{ purpose }} onClick={executeSession} />
    </div>
  )
}

type BlocklistPageTab = 'importing' | 'exporting'

export default function NewSessionBlocklistPage() {
  const [tab, setTab] = React.useState<BlocklistPageTab>('importing')
  return (
    <div style={{ width: '100%' }}>
      <M.Tabs variant="fullWidth" value={tab} onChange={(_ev, val) => setTab(val)}>
        <M.Tab label="Import" value="importing" />
        <M.Tab label="Export" value="exporting" />
      </M.Tabs>
      <TabPanel value={tab} index="importing" noPadding>
        <ImportBlocklistUI />
      </TabPanel>
      <TabPanel value={tab} index="exporting" noPadding>
        <ExportBlocklistUI />
      </TabPanel>
    </div>
  )
}
