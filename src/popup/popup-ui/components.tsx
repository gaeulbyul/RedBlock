import * as MaterialUI from '@mui/material'
import { useTheme, withStyles } from '@mui/styles'

import React from 'react'

import { requestResetCounter } from '../../scripts/background/request-sender'
import type { TargetCheckResult } from '../../scripts/background/target-checker'
import * as i18n from '../../scripts/i18n'
import { checkResultToString, DialogMessageObj } from '../../scripts/text-generate'
import { CheckboxItem, RadioOptionItem } from '../../ui/components'
import { BlockLimiterContext, RedBlockOptionsContext, TabInfoContext, UIContext } from './contexts'
import { ExtraSessionOptionsContext } from './ui-states'

const M = MaterialUI
const T = MaterialUI.Typography

export interface DialogContent {
  message: DialogMessageObj
  dialogType: 'confirm' | 'alert'
  callbackOnOk?(): void
  callbackOnCancel?(): void
}

export function RedBlockPopupUITheme(darkMode: boolean) {
  return MaterialUI.createTheme({
    typography: {
      fontSize: 12,
    },
    palette: {
      mode: darkMode ? 'dark' : 'light',
      primary: MaterialUI.colors.pink,
      secondary: darkMode ? MaterialUI.colors.lightBlue : MaterialUI.colors.indigo,
    },
  })
}

export const MyTooltip = withStyles(() => ({
  tooltip: {
    fontSize: 12,
  },
}))(MaterialUI.Tooltip)

export const SmallAvatar = withStyles(theme => ({
  root: {
    width: 16,
    height: 16,
    border: `1px solid ${theme.palette.background.paper}`,
  },
}))(M.Avatar)

function Icon({ name }: { name: string }) {
  // overflow: purpose 탭 아이콘 짤림 문제방지
  // (특히 탭 라벨이 두 줄이상으로 넘어갈때)
  return <M.Icon>{name}</M.Icon>
}
function purposeTypeToIcon(purposeType: Purpose['type']): JSX.Element {
  switch (purposeType) {
    case 'chainblock':
      return <Icon name="block" />
    case 'unchainblock':
      return <Icon name="favorite_border" />
    case 'export':
      return <Icon name="save" />
    case 'lockpicker':
      return <Icon name="no_encryption" />
    case 'chainunfollow':
      return <Icon name="remove_circle_outline" />
    case 'chainmute':
      return <Icon name="volume_off" />
    case 'unchainmute':
      return <Icon name="volume_up" />
  }
}

export function RBDialog({
  isOpen,
  content,
  closeModal,
}: {
  isOpen: boolean
  content: DialogContent | null
  closeModal(): void
}) {
  if (!content) {
    return <div></div>
  }
  const { message, callbackOnOk, callbackOnCancel, dialogType } = content
  const { title, contentLines, warningLines } = message
  function confirmOk() {
    if (typeof callbackOnOk === 'function') {
      callbackOnOk()
    }
    closeModal()
  }
  function refused() {
    if (typeof callbackOnCancel === 'function') {
      callbackOnCancel()
    }
    closeModal()
  }
  function renderControls() {
    switch (dialogType) {
      case 'confirm':
        return (
          <React.Fragment>
            <M.Button onClick={confirmOk} color="primary">
              {i18n.getMessage('yes')}
            </M.Button>
            <M.Button onClick={refused}>{i18n.getMessage('no')}</M.Button>
          </React.Fragment>
        )
      case 'alert':
        return (
          <React.Fragment>
            <M.Button onClick={closeModal} color="primary">
              {i18n.getMessage('close')}
            </M.Button>
          </React.Fragment>
        )
    }
  }
  const { Dialog, DialogTitle, DialogContent, DialogContentText, DialogActions } = MaterialUI
  return (
    <Dialog open={isOpen}>
      <DialogTitle>{title}</DialogTitle>
      <DialogContent>
        {contentLines
          && contentLines.map((line, index) => (
            <DialogContentText key={index}>{line}</DialogContentText>
          ))}
        {warningLines
          && warningLines.map((line, index) => (
            <DialogContentText key={index} color="error">
              {line}
            </DialogContentText>
          ))}
      </DialogContent>
      <DialogActions>{renderControls()}</DialogActions>
    </Dialog>
  )
}

// from https://material-ui.com/components/tabs/#SimpleTabs.tsx
export function TabPanel({
  children,
  value,
  index,
  noPadding,
}: {
  children?: React.ReactNode
  index: any
  value: any
  noPadding?: boolean
}) {
  const padding = noPadding ? 0 : 1
  return (
    <T component="div" role="tabpanel" hidden={value !== index}>
      {value === index && (
        <M.Box py={1} px={padding}>
          {children}
        </M.Box>
      )}
    </T>
  )
}

export function PleaseLoginBox() {
  function closePopup(_event: React.MouseEvent) {
    window.setTimeout(() => {
      window.close()
    }, 200)
  }
  return (
    <M.Paper>
      <M.Box px={2} py={1.5}>
        <T component="div">{i18n.getMessage('please_check_login')}</T>
        <M.Box mt={1}>
          <a
            rel="noopener noreferrer"
            target="_blank"
            href="https://twitter.com/login"
            onClick={closePopup}
            style={{ textDecoration: 'none' }}
          >
            <M.Button variant="outlined" startIcon={<M.Icon>exit_to_app</M.Icon>}>
              Login
            </M.Button>
          </a>
        </M.Box>
      </M.Box>
    </M.Paper>
  )
}

export function RBAccordion({
  summary,
  children,
  defaultExpanded,
  warning,
}: {
  summary: string
  children: React.ReactNode
  defaultExpanded?: boolean
  warning?: boolean
}) {
  return (
    <M.Accordion defaultExpanded={defaultExpanded}>
      <M.AccordionSummary expandIcon={<M.Icon>expand_more</M.Icon>}>
        <T sx={{ color: warning ? 'warning.main' : 'text.primary' }}>{summary}</T>
      </M.AccordionSummary>
      <M.AccordionDetails>{children}</M.AccordionDetails>
    </M.Accordion>
  )
}

export function BlockLimiterUI() {
  const { current, max } = React.useContext(BlockLimiterContext)
  const { myself } = React.useContext(TabInfoContext)
  function handleResetButtonClick(event: React.MouseEvent<HTMLButtonElement>) {
    event.preventDefault()
    requestResetCounter(myself!.user.id_str)
  }
  const exceed = current >= max
  const warningIcon = exceed ? '\u26a0\ufe0f' : ''
  return (
    <RBAccordion
      summary={`${warningIcon} ${i18n.getMessage('block_counter')}: [${current} / ${max}]`}
      warning={exceed}
    >
      <M.Box display="flex" flexDirection="row">
        <M.Box flexGrow="1">
          <T component="div" variant="body2">
            {i18n.getMessage('wtf_twitter')}
          </T>
        </M.Box>
        <M.Button
          type="button"
          variant="outlined"
          onClick={handleResetButtonClick}
          disabled={current <= 0}
        >
          Reset
        </M.Button>
      </M.Box>
    </RBAccordion>
  )
}

// AudioSpace에는 요것만 있음. 이걸로도 TwitterUserProfile을 사용하는 데 지장이 없으니까.
interface UserWithOnlyNameAndProfileImages {
  name: string
  screen_name: string
  profile_image_url_https: string
}

export function TwitterUserProfile({
  user,
  children,
}: {
  user: TwitterUser | UserWithOnlyNameAndProfileImages
  children?: React.ReactNode
}) {
  const theme = useTheme()
  // @ts-ignore 잘 되는데 왜 타입오류가 발생하지??
  const textSecondary = theme.palette.text.secondary
  const biggerProfileImageUrl = user.profile_image_url_https.replace('_normal', '_bigger')
  return (
    <M.Box display="flex" flexDirection="row">
      <M.Box mr={1}>
        <M.Avatar
          alt={i18n.getMessage('profile_image')}
          src={biggerProfileImageUrl}
          sx={{ width: 64, height: 64 }}
        />
      </M.Box>
      <M.Box width="100%" lineHeight="150%">
        <M.Box>
          <T sx={{ fontWeight: 'bold', fontSize: 'larger' }}>
            {user.name}
          </T>
          <M.Link
            target="_blank"
            rel="noopener noreferrer"
            href={`https://twitter.com/${user.screen_name}`}
            title={i18n.getMessage('go_to_url', `https://twitter.com/${user.screen_name}`)}
            sx={{ color: 'text.secondary', textDecorationColor: textSecondary }}
          >
            @{user.screen_name}
          </M.Link>
        </M.Box>
        <div style={{ margin: '5px 0' }}>{children}</div>
      </M.Box>
    </M.Box>
  )
}

const BigBaseButton = withStyles(theme => ({
  root: {
    width: '100%',
    padding: theme.spacing(1),
    fontSize: 'larger',
  },
}))(MaterialUI.Button)

export function BigExecuteButton({
  purpose,
  disabled,
  type = 'button',
  onClick,
}: {
  purpose: Purpose
  disabled: boolean
  type?: 'button' | 'submit'
  onClick?(event: React.MouseEvent): void
}): JSX.Element {
  const label = i18n.getMessage('run_xxx', i18n.getMessage(purpose.type))
  let BigButton: typeof BigBaseButton
  switch (purpose.type) {
    case 'chainblock':
    case 'chainmute':
    case 'lockpicker':
    case 'chainunfollow':
      BigButton = BigRedButton
      break
    case 'unchainblock':
    case 'unchainmute':
      BigButton = BigGreenButton
      break
    case 'export':
      BigButton = BigGrayButton
      break
  }
  const startIcon = purposeTypeToIcon(purpose.type)
  return <BigButton {...{ type, startIcon, disabled, onClick }}>{label}</BigButton>
}

const BigRedButton = withStyles(theme => ({
  root: {
    backgroundColor: MaterialUI.colors.red[700],
    color: theme.palette.getContrastText(MaterialUI.colors.red[700]),
    '&:hover': {
      backgroundColor: MaterialUI.colors.red[500],
      color: theme.palette.getContrastText(MaterialUI.colors.red[500]),
    },
  },
}))(BigBaseButton)

const BigGreenButton = withStyles(theme => ({
  root: {
    backgroundColor: MaterialUI.colors.green[700],
    color: theme.palette.getContrastText(MaterialUI.colors.green[700]),
    '&:hover': {
      backgroundColor: MaterialUI.colors.green[500],
      color: theme.palette.getContrastText(MaterialUI.colors.green[500]),
    },
  },
}))(BigBaseButton)

const BigGrayButton = withStyles(theme => ({
  root: {
    backgroundColor: MaterialUI.colors.blueGrey[700],
    color: theme.palette.getContrastText(MaterialUI.colors.blueGrey[700]),
    '&:hover': {
      backgroundColor: MaterialUI.colors.blueGrey[500],
      color: theme.palette.getContrastText(MaterialUI.colors.blueGrey[500]),
    },
  },
}))(BigBaseButton)

const PurposeTab = withStyles(theme => ({
  root: {
    height: 60,
    padding: theme.spacing(0, 1),
  },
}))(MaterialUI.Tab)

export function LinearProgressWithLabel({ value }: { value: number }) {
  return (
    <M.Box display="flex" alignItems="center">
      <M.Box width="100%" mr={1}>
        <M.LinearProgress variant="determinate" value={value} />
      </M.Box>
      <M.Box minWidth={35}>
        <T variant="body2" color="textSecondary">{`${Math.round(value)}%`}</T>
      </M.Box>
    </M.Box>
  )
}

function SessionDescription({
  purpose: { type },
  maybeRequest,
}: {
  purpose: Purpose
  maybeRequest: Either<TargetCheckResult, SessionRequest<AnySessionTarget>>
}) {
  if (!maybeRequest.ok) {
    return (
      <T py={1} color="warning.main">
        {checkResultToString(maybeRequest.error)}
      </T>
    )
  }

  let message = ''
  switch (type) {
    case 'chainblock':
      message = i18n.getMessage('chainblock_description') + ' '
        + i18n.getMessage('my_mutual_followers_wont_block_or_mute')
      break
    case 'unchainblock':
      message = i18n.getMessage('unchainblock_description')
      break
    case 'lockpicker':
      message = i18n.getMessage('lockpicker_description')
      break
    case 'chainunfollow':
      message = i18n.getMessage('chainunfollow_description')
      break
    case 'chainmute':
      message = i18n.getMessage('chainmute_description') + ' '
        + i18n.getMessage('my_mutual_followers_wont_block_or_mute')
      break
    case 'unchainmute':
      message = i18n.getMessage('unchainmute_description')
      break
    case 'export':
      message = i18n.getMessage('export_description')
  }
  return <T py={1}>{message}</T>
}

export function PurposeSelectionUI({
  purpose,
  changePurposeType,
  mutatePurposeOptions,
  availablePurposeTypes,
  maybeRequest,
}: {
  purpose: SessionRequest<AnySessionTarget>['purpose']
  changePurposeType(purposeType: SessionRequest<AnySessionTarget>['purpose']['type']): void
  mutatePurposeOptions(
    partialOptions: Partial<Omit<SessionRequest<AnySessionTarget>['purpose'], 'type'>>,
  ): void
  availablePurposeTypes: SessionRequest<AnySessionTarget>['purpose']['type'][]
  maybeRequest: Either<TargetCheckResult, SessionRequest<AnySessionTarget>>
}) {
  const chainblockable = availablePurposeTypes.includes('chainblock')
  const unchainblockable = availablePurposeTypes.includes('unchainblock')
  const exportable = availablePurposeTypes.includes('export')
  const lockpickable = availablePurposeTypes.includes('lockpicker')
  const chainunfollowable = availablePurposeTypes.includes('chainunfollow')
  const chainmutable = availablePurposeTypes.includes('chainmute')
  const unchainmutable = availablePurposeTypes.includes('unchainmute')
  // const narrow = MaterialUI.useMediaQuery('(max-width:500px)')
  return (
    <M.Box>
      <M.Tabs
        style={{ display: availablePurposeTypes.length >= 2 ? 'flex' : 'none' }}
        variant="fullWidth"
        scrollButtons="auto"
        value={purpose.type}
        onChange={(_ev, val) => changePurposeType(val)}
      >
        {chainblockable && (
          <PurposeTab
            value="chainblock"
            icon={purposeTypeToIcon('chainblock')}
            label={i18n.getMessage('chainblock')}
          />
        )}
        {unchainblockable && (
          <PurposeTab
            value="unchainblock"
            icon={purposeTypeToIcon('unchainblock')}
            label={i18n.getMessage('unchainblock')}
          />
        )}
        {lockpickable && (
          <PurposeTab
            value="lockpicker"
            icon={purposeTypeToIcon('lockpicker')}
            label={i18n.getMessage('lockpicker')}
          />
        )}
        {chainunfollowable && (
          <PurposeTab
            value="chainunfollow"
            icon={purposeTypeToIcon('chainunfollow')}
            label={i18n.getMessage('chainunfollow')}
          />
        )}
        {chainmutable && (
          <PurposeTab
            value="chainmute"
            icon={purposeTypeToIcon('chainmute')}
            label={i18n.getMessage('chainmute')}
          />
        )}
        {unchainmutable && (
          <PurposeTab
            value="unchainmute"
            icon={purposeTypeToIcon('unchainmute')}
            label={i18n.getMessage('unchainmute')}
          />
        )}
        {exportable && (
          <PurposeTab
            value="export"
            icon={purposeTypeToIcon('export')}
            label={i18n.getMessage('export')}
          />
        )}
      </M.Tabs>
      {availablePurposeTypes.length >= 2 && <M.Divider />}
      {chainblockable && (
        <TabPanel value={purpose.type} index="chainblock">
          {purpose.type === 'chainblock' && (
            <ChainBlockPurposeUI {...{ purpose, mutatePurposeOptions }} />
          )}
          <ExtraSessionOptionsUI showBioBlock={true} />
          <M.Divider />
          <SessionDescription {...{ purpose, maybeRequest }} />
        </TabPanel>
      )}
      {unchainblockable && (
        <TabPanel value={purpose.type} index="unchainblock">
          {purpose.type === 'unchainblock' && (
            <UnChainBlockOptionsUI {...{ purpose, mutatePurposeOptions }} />
          )}
          <ExtraSessionOptionsUI />
          <M.Divider />
          <SessionDescription {...{ purpose, maybeRequest }} />
        </TabPanel>
      )}
      {lockpickable && (
        <TabPanel value={purpose.type} index="lockpicker">
          {purpose.type === 'lockpicker' && (
            <LockPickerOptionsUI {...{ purpose, mutatePurposeOptions }} />
          )}
          <ExtraSessionOptionsUI />
          <SessionDescription {...{ purpose, maybeRequest }} />
        </TabPanel>
      )}
      {chainunfollowable && (
        <TabPanel value={purpose.type} index="chainunfollow">
          <ExtraSessionOptionsUI />
          <SessionDescription {...{ purpose, maybeRequest }} />
        </TabPanel>
      )}
      {chainmutable && (
        <TabPanel value={purpose.type} index="chainmute">
          {purpose.type === 'chainmute' && (
            <ChainMutePurposeUI {...{ purpose, mutatePurposeOptions }} />
          )}
          <ExtraSessionOptionsUI showBioBlock={true} />
          <M.Divider />
          <SessionDescription {...{ purpose, maybeRequest }} />
        </TabPanel>
      )}
      {unchainmutable && (
        <TabPanel value={purpose.type} index="unchainmute">
          {purpose.type === 'unchainmute' && (
            <UnChainMuteOptionsUI {...{ purpose, mutatePurposeOptions }} />
          )}
          <ExtraSessionOptionsUI />
          <SessionDescription {...{ purpose, maybeRequest }} />
        </TabPanel>
      )}
      {exportable && (
        <TabPanel value={purpose.type} index="export">
          <SessionDescription {...{ purpose, maybeRequest }} />
        </TabPanel>
      )}
    </M.Box>
  )
}

function ExtraSessionOptionsUI({ showBioBlock }: { showBioBlock?: boolean }) {
  const { extraSessionOptions, mutate } = React.useContext(ExtraSessionOptionsContext)
  const options = React.useContext(RedBlockOptionsContext)
  const { openDialog } = React.useContext(UIContext)
  const bioBlockModes: { [label: string]: BioBlockMode } = {
    [i18n.getMessage('bioblock_never')]: 'never',
    [i18n.getMessage('bioblock_all')]: 'all',
    // [i18n.getMessage('bioblock_smart')]: 'smart',
  }
  function showRecurringHelp() {
    openDialog({
      message: {
        title: i18n.getMessage('recurring_session'),
        contentLines: [i18n.getMessage('recurring_session_description')],
      },
      dialogType: 'alert',
      callbackOnOk() {},
    })
  }
  const revealBioBlockMode = options.revealBioBlockMode && showBioBlock
  return (
    <React.Fragment>
      {revealBioBlockMode && (
        <RadioOptionItem
          legend="BioBlock &#7517;"
          options={bioBlockModes}
          selectedValue={extraSessionOptions.bioBlock}
          onChange={(bioBlock: BioBlockMode) => mutate({ bioBlock })}
        />
      )}
      <div style={{ width: '100%' }}>
        <CheckboxItem
          label={i18n.getMessage('recurring_session')}
          onChange={recurring => mutate({ recurring })}
          checked={extraSessionOptions.recurring}
          style={{ marginRight: '8px' }}
        />
        <M.IconButton size="small" onClick={showRecurringHelp}>
          <M.Icon>help_outline</M.Icon>
        </M.IconButton>
      </div>
    </React.Fragment>
  )
}

function ChainBlockPurposeUI({
  purpose,
  mutatePurposeOptions,
}: {
  purpose: ChainBlockPurpose
  mutatePurposeOptions(partialOptions: Partial<Omit<ChainBlockPurpose, 'type'>>): void
}) {
  const userActions = {
    [i18n.getMessage('skip')]: 'Skip',
    [i18n.getMessage('do_mute')]: 'Mute',
    [i18n.getMessage('do_block')]: 'Block',
  } as const
  const userActionsToMyFollowers: { [label: string]: ChainBlockPurpose['myFollowers'] } = {
    ...userActions,
    [i18n.getMessage('block_and_unblock')]: 'BlockAndUnBlock',
  }
  const userActionsToMyFollowings: { [label: string]: ChainBlockPurpose['myFollowings'] } = {
    ...userActions,
    [i18n.getMessage('unfollow')]: 'UnFollow',
  }
  return (
    <React.Fragment>
      <RadioOptionItem
        legend={i18n.getMessage('my_followers')}
        options={userActionsToMyFollowers}
        selectedValue={purpose.myFollowers}
        onChange={(myFollowers: ChainBlockPurpose['myFollowers']) =>
          mutatePurposeOptions({ myFollowers })}
      />
      <RadioOptionItem
        legend={i18n.getMessage('my_followings')}
        options={userActionsToMyFollowings}
        selectedValue={purpose.myFollowings}
        onChange={(myFollowings: ChainBlockPurpose['myFollowings']) =>
          mutatePurposeOptions({ myFollowings })}
      />
    </React.Fragment>
  )
}

function UnChainBlockOptionsUI({
  purpose,
  mutatePurposeOptions,
}: {
  purpose: UnChainBlockPurpose
  mutatePurposeOptions(partialOptions: Partial<Omit<UnChainBlockPurpose, 'type'>>): void
}) {
  const userActions: { [label: string]: UnChainBlockPurpose['mutualBlocked'] } = {
    [i18n.getMessage('skip')]: 'Skip',
    [i18n.getMessage('do_unblock')]: 'UnBlock',
  }
  return (
    <React.Fragment>
      <RadioOptionItem
        legend={i18n.getMessage('mutually_blocked')}
        options={userActions}
        selectedValue={purpose.mutualBlocked}
        onChange={(mutualBlocked: UnChainBlockPurpose['mutualBlocked']) =>
          mutatePurposeOptions({ mutualBlocked })}
      />
    </React.Fragment>
  )
}

function LockPickerOptionsUI({
  purpose,
  mutatePurposeOptions,
}: {
  purpose: LockPickerPurpose
  mutatePurposeOptions(partialOptions: Partial<Omit<LockPickerPurpose, 'type'>>): void
}) {
  const userActions: { [label: string]: LockPickerPurpose['protectedFollowers'] } = {
    [i18n.getMessage('do_block')]: 'Block',
    [i18n.getMessage('block_and_unblock')]: 'BlockAndUnBlock',
  }
  return (
    <React.Fragment>
      <RadioOptionItem
        legend={i18n.getMessage('protected_follower')}
        options={userActions}
        selectedValue={purpose.protectedFollowers}
        onChange={(protectedFollowers: LockPickerPurpose['protectedFollowers']) =>
          mutatePurposeOptions({ protectedFollowers })}
      />
    </React.Fragment>
  )
}

function ChainMutePurposeUI({
  purpose,
  mutatePurposeOptions,
}: {
  purpose: ChainMutePurpose
  mutatePurposeOptions(partialOptions: Partial<Omit<ChainMutePurpose, 'type'>>): void
}) {
  const userActions = {
    [i18n.getMessage('skip')]: 'Skip',
    [i18n.getMessage('do_mute')]: 'Mute',
  } as const
  return (
    <React.Fragment>
      <RadioOptionItem
        legend={i18n.getMessage('my_followers')}
        options={userActions}
        selectedValue={purpose.myFollowers}
        onChange={(myFollowers: ChainMutePurpose['myFollowers']) =>
          mutatePurposeOptions({ myFollowers })}
      />
      <RadioOptionItem
        legend={i18n.getMessage('my_followings')}
        options={userActions}
        selectedValue={purpose.myFollowings}
        onChange={(myFollowings: ChainMutePurpose['myFollowings']) =>
          mutatePurposeOptions({ myFollowings })}
      />
    </React.Fragment>
  )
}

function UnChainMuteOptionsUI({
  purpose,
  mutatePurposeOptions,
}: {
  purpose: UnChainMutePurpose
  mutatePurposeOptions(partialOptions: Partial<Omit<UnChainMutePurpose, 'type'>>): void
}) {
  const userActions: { [label: string]: UnChainMutePurpose['mutedAndAlsoBlocked'] } = {
    [i18n.getMessage('skip')]: 'Skip',
    [i18n.getMessage('unmute')]: 'UnMute',
  }
  return (
    <React.Fragment>
      <RadioOptionItem
        legend={i18n.getMessage('muted_and_also_blocked')}
        options={userActions}
        selectedValue={purpose.mutedAndAlsoBlocked}
        onChange={(mutedAndAlsoBlocked: UnChainMutePurpose['mutedAndAlsoBlocked']) =>
          mutatePurposeOptions({ mutedAndAlsoBlocked })}
      />
    </React.Fragment>
  )
}
