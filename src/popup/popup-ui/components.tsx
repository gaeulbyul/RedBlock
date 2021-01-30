import { DialogMessageObj } from '../../scripts/text-generate.js'
import * as i18n from '../../scripts/i18n.js'
import { requestResetCounter } from '../../scripts/background/request-sender.js'
import {
  UIContext,
  MyselfContext,
  BlockLimiterContext,
  TwitterAPIClientContext,
} from './contexts.js'
import { SessionOptionsContext } from './ui-states.js'

const M = MaterialUI
const T = MaterialUI.Typography

export interface DialogContent {
  message: DialogMessageObj
  dialogType: 'confirm' | 'alert'
  callbackOnOk?(): void
  callbackOnCancel?(): void
}

export function RedBlockUITheme(darkMode: boolean) {
  return MaterialUI.createMuiTheme({
    palette: {
      type: darkMode ? 'dark' : 'light',
      primary: MaterialUI.colors.pink,
      secondary: darkMode ? MaterialUI.colors.lightBlue : MaterialUI.colors.indigo,
    },
  })
}

export function Icon({ name }: { name: string }) {
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
  }
}

export function RBDialog(props: {
  isOpen: boolean
  content: DialogContent | null
  closeModal(): void
}) {
  const { isOpen, content, closeModal } = props
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
        {contentLines &&
          contentLines.map((line, index) => (
            <DialogContentText key={index}>{line}</DialogContentText>
          ))}
        {warningLines &&
          warningLines.map((line, index) => (
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
export function TabPanel(props: { children?: React.ReactNode; index: any; value: any }) {
  const { children, value, index } = props
  return (
    <T component="div" role="tabpanel" hidden={value !== index}>
      {value === index && <M.Box p={1}>{children}</M.Box>}
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
      <M.Box padding="12px 16px">
        <T component="div">{i18n.getMessage('please_check_login')}</T>
        <M.Box marginTop="10px">
          <a
            rel="noopener noreferer"
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

const DenseExpansionPanel = MaterialUI.withStyles({
  root: {
    margin: '8px 0',
    '&:first-child': {
      margin: '0',
    },
    '&$expanded': {
      margin: '8px 0',
    },
  },
  expanded: {},
})(MaterialUI.ExpansionPanel)

const DenseExpansionPanelSummary = MaterialUI.withStyles({
  root: {
    minHeight: 16,
    '&$expanded': {
      minHeight: 16,
    },
  },
  content: {
    '&$expanded': {
      margin: 0,
    },
  },
  expanded: {},
})(MaterialUI.ExpansionPanelSummary)

const useStylesForExpansionPanels = MaterialUI.makeStyles(() =>
  MaterialUI.createStyles({
    details: {
      padding: '8px 16px',
    },
  })
)

export function RBExpansionPanel(props: {
  summary: string
  children: React.ReactNode
  defaultExpanded?: boolean
}) {
  const classes = useStylesForExpansionPanels()
  return (
    <DenseExpansionPanel defaultExpanded={props.defaultExpanded}>
      <DenseExpansionPanelSummary expandIcon={<M.Icon>expand_more</M.Icon>}>
        <T>{props.summary}</T>
      </DenseExpansionPanelSummary>
      <M.ExpansionPanelDetails className={classes.details}>
        {props.children}
      </M.ExpansionPanelDetails>
    </DenseExpansionPanel>
  )
}

export function BlockLimiterUI() {
  const { current, max } = React.useContext(BlockLimiterContext)
  const {
    cookieOptions: { cookieStoreId },
  } = React.useContext(TwitterAPIClientContext)
  const myself = React.useContext(MyselfContext)
  function handleResetButtonClick(event: React.MouseEvent<HTMLButtonElement>) {
    event.preventDefault()
    requestResetCounter({ cookieStoreId, userId: myself!.id_str })
  }
  return (
    <RBExpansionPanel summary={`${i18n.getMessage('block_counter')}: [${current} / ${max}]`}>
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
    </RBExpansionPanel>
  )
}

export function TwitterUserProfile(props: { user: TwitterUser; children: React.ReactNode }) {
  const { user } = props
  const biggerProfileImageUrl = user.profile_image_url_https.replace('_normal', '_bigger')
  return (
    <div className="target-user-info">
      <div className="profile-image-area">
        <img
          alt={i18n.getMessage('profile_image')}
          className="profile-image"
          src={biggerProfileImageUrl}
        />
      </div>
      <div className="profile-right-area">
        <div className="profile-right-info">
          <div className="nickname" title={user.name}>
            {user.name}
          </div>
          <div className="username">
            <a
              target="_blank"
              rel="noopener noreferer"
              href={`https://twitter.com/${user.screen_name}`}
              title={i18n.getMessage('go_to_url', `https://twitter.com/${user.screen_name}`)}
            >
              @{user.screen_name}
            </a>
          </div>
        </div>
        {props.children}
      </div>
    </div>
  )
}

export function WhatIsBioBlock() {
  const { openDialog } = React.useContext(UIContext)
  function handleClick(event: React.MouseEvent) {
    event.preventDefault()
    openDialog({
      dialogType: 'alert',
      message: {
        title: 'BioBlock',
        contentLines: [`BioBlock: ${i18n.getMessage('bioblock_description')}`],
      },
    })
  }
  return (
    <M.IconButton size="small" onClick={handleClick}>
      <M.Icon>help_outline</M.Icon>
    </M.IconButton>
  )
}

const BigBaseButton = MaterialUI.withStyles(() => ({
  root: {
    width: '100%',
    padding: '10px',
    fontSize: 'larger',
  },
}))(MaterialUI.Button)

export function BigExecuteButton(props: {
  purpose: Purpose
  disabled: boolean
  type?: 'button' | 'submit'
  onClick?(event: React.MouseEvent): void
}): JSX.Element {
  const { purpose, disabled, onClick } = props
  const type = props.type || 'button'
  let BigButton: typeof BigExecuteChainBlockButton
  let label: string
  switch (purpose.type) {
    case 'chainblock':
      BigButton = BigExecuteChainBlockButton
      label = i18n.getMessage('execute_chainblock')
      break
    case 'unchainblock':
      BigButton = BigExecuteUnChainBlockButton
      label = i18n.getMessage('execute_unchainblock')
      break
    case 'lockpicker':
      BigButton = BigExecuteLockPickerButton
      label = i18n.getMessage('lockpicker')
      break
    case 'chainunfollow':
      BigButton = BigChainUnfollowButton
      label = i18n.getMessage('chainunfollow')
      break
    case 'export':
      BigButton = BigExportButton
      label = i18n.getMessage('export')
      break
  }
  const startIcon = purposeTypeToIcon(purpose.type)
  return <BigButton {...{ type, startIcon, disabled, onClick }}>{label}</BigButton>
}

const BigExecuteChainBlockButton = MaterialUI.withStyles(theme => ({
  root: {
    backgroundColor: MaterialUI.colors.red[700],
    color: theme.palette.getContrastText(MaterialUI.colors.red[700]),
    '&:hover': {
      backgroundColor: MaterialUI.colors.red[500],
      color: theme.palette.getContrastText(MaterialUI.colors.red[500]),
    },
  },
}))(BigBaseButton)

const BigExecuteUnChainBlockButton = MaterialUI.withStyles(theme => ({
  root: {
    backgroundColor: MaterialUI.colors.green[700],
    color: theme.palette.getContrastText(MaterialUI.colors.green[700]),
    '&:hover': {
      backgroundColor: MaterialUI.colors.green[500],
      color: theme.palette.getContrastText(MaterialUI.colors.green[500]),
    },
  },
}))(BigBaseButton)

const BigExportButton = MaterialUI.withStyles(theme => ({
  root: {
    backgroundColor: MaterialUI.colors.blueGrey[700],
    color: theme.palette.getContrastText(MaterialUI.colors.blueGrey[700]),
    '&:hover': {
      backgroundColor: MaterialUI.colors.blueGrey[500],
      color: theme.palette.getContrastText(MaterialUI.colors.blueGrey[500]),
    },
  },
}))(BigBaseButton)

const BigExecuteLockPickerButton = MaterialUI.withStyles(theme => ({
  root: {
    backgroundColor: MaterialUI.colors.pink[700],
    color: theme.palette.getContrastText(MaterialUI.colors.pink[700]),
    '&:hover': {
      backgroundColor: MaterialUI.colors.pink[500],
      color: theme.palette.getContrastText(MaterialUI.colors.pink[500]),
    },
  },
}))(BigBaseButton)

const BigChainUnfollowButton = MaterialUI.withStyles(theme => ({
  root: {
    backgroundColor: MaterialUI.colors.deepOrange[700],
    color: theme.palette.getContrastText(MaterialUI.colors.deepOrange[700]),
    '&:hover': {
      backgroundColor: MaterialUI.colors.deepOrange[500],
      color: theme.palette.getContrastText(MaterialUI.colors.deepOrange[500]),
    },
  },
}))(BigBaseButton)

const useStylesForTab = MaterialUI.makeStyles(() =>
  MaterialUI.createStyles({
    tab: {
      paddingLeft: 0,
      paddingRight: 0,
    },
  })
)

export function PurposeSelectionUI(props: {
  purpose: SessionRequest['purpose']
  changePurposeType(purposeType: SessionRequest['purpose']['type']): void
  mutatePurposeOptions(partialOptions: Partial<Omit<SessionRequest['purpose'], 'type'>>): void
  availablePurposeTypes: SessionRequest['purpose']['type'][]
}) {
  const { purpose, changePurposeType, mutatePurposeOptions, availablePurposeTypes } = props
  const classes = useStylesForTab()
  const chainblockable = availablePurposeTypes.includes('chainblock')
  const unchainblockable = availablePurposeTypes.includes('unchainblock')
  const exportable = availablePurposeTypes.includes('export')
  const lockpickable = availablePurposeTypes.includes('lockpicker')
  const chainunfollowable = availablePurposeTypes.includes('chainunfollow')
  return (
    <div style={{ width: '100%' }}>
      <M.Tabs
        style={{ display: availablePurposeTypes.length >= 2 ? 'flex' : 'none' }}
        variant="fullWidth"
        value={purpose.type}
        onChange={(_ev, val) => changePurposeType(val)}
      >
        {chainblockable && (
          <M.Tab
            value="chainblock"
            className={classes.tab}
            icon={purposeTypeToIcon('chainblock')}
            label={i18n.getMessage('chainblock')}
          />
        )}
        {unchainblockable && (
          <M.Tab
            value="unchainblock"
            className={classes.tab}
            icon={purposeTypeToIcon('unchainblock')}
            label={i18n.getMessage('unchainblock')}
          />
        )}
        {lockpickable && (
          <M.Tab
            value="lockpicker"
            className={classes.tab}
            icon={purposeTypeToIcon('lockpicker')}
            label={i18n.getMessage('lockpicker')}
          />
        )}
        {chainunfollowable && (
          <M.Tab
            value="chainunfollow"
            className={classes.tab}
            icon={purposeTypeToIcon('chainunfollow')}
            label={i18n.getMessage('chainunfollow')}
          />
        )}
        {exportable && (
          <M.Tab
            value="export"
            className={classes.tab}
            icon={purposeTypeToIcon('export')}
            label={i18n.getMessage('export')}
          />
        )}
      </M.Tabs>
      <M.Divider />
      {chainblockable && (
        <TabPanel value={purpose.type} index="chainblock">
          {purpose.type === 'chainblock' && (
            <ChainBlockPurposeUI {...{ purpose, mutatePurposeOptions }} />
          )}
          <SessionOptionsUI />
          <M.Divider />
          <div className="description">
            {i18n.getMessage('chainblock_description')}{' '}
            {i18n.getMessage('my_mutual_followers_wont_block')}
            <div className="wtf">{i18n.getMessage('wtf_twitter') /* massive block warning */}</div>
          </div>
        </TabPanel>
      )}
      {unchainblockable && (
        <TabPanel value={purpose.type} index="unchainblock">
          {purpose.type === 'unchainblock' && (
            <UnChainBlockOptionsUI {...{ purpose, mutatePurposeOptions }} />
          )}
          <M.Divider />
          <div className="description">{i18n.getMessage('unchainblock_description')}</div>
        </TabPanel>
      )}
      {lockpickable && (
        <TabPanel value={purpose.type} index="lockpicker">
          {purpose.type === 'lockpicker' && (
            <LockPickerOptionsUI {...{ purpose, mutatePurposeOptions }} />
          )}
          <div className="description">{i18n.getMessage('lockpicker_description')}</div>
        </TabPanel>
      )}
      {chainunfollowable && (
        <TabPanel value={purpose.type} index="chainunfollow">
          <div className="description">{i18n.getMessage('chainunfollow_description')}</div>
        </TabPanel>
      )}
      {exportable && (
        <TabPanel value={purpose.type} index="export">
          <div className="description">{i18n.getMessage('export_description')}</div>
        </TabPanel>
      )}
    </div>
  )
}

function RadioOptionItem(props: {
  legend: React.ReactNode
  options: { [label: string]: string }
  selectedValue: string
  onChange(newValue: string): void
}) {
  return (
    <M.FormControl component="fieldset">
      <M.FormLabel component="legend">{props.legend}</M.FormLabel>
      <M.RadioGroup row>
        {Object.entries(props.options).map(([label, value], index) => (
          <M.FormControlLabel
            key={index}
            control={<M.Radio size="small" />}
            checked={props.selectedValue === value}
            onChange={() => props.onChange(value)}
            label={label}
          />
        ))}
      </M.RadioGroup>
    </M.FormControl>
  )
}

function SessionOptionsUI() {
  const { sessionOptions, mutateOptions } = React.useContext(SessionOptionsContext)
  const bioBlockModes: { [label: string]: BioBlockMode } = {
    [i18n.getMessage('bioblock_never')]: 'never',
    [i18n.getMessage('bioblock_all')]: 'all',
    [i18n.getMessage('bioblock_smart')]: 'smart',
  }
  return (
    <React.Fragment>
      <RadioOptionItem
        legend={
          <span>
            BioBlock &#x1F9EA; <WhatIsBioBlock />
          </span>
        }
        options={bioBlockModes}
        selectedValue={sessionOptions.includeUsersInBio}
        onChange={(newMode: BioBlockMode) => mutateOptions({ includeUsersInBio: newMode })}
      />
    </React.Fragment>
  )
}

function ChainBlockPurposeUI(props: {
  purpose: ChainBlockPurpose
  mutatePurposeOptions(partialOptions: Partial<Omit<ChainBlockPurpose, 'type'>>): void
}) {
  const { purpose, mutatePurposeOptions } = props
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
          mutatePurposeOptions({ myFollowers })
        }
      />
      <br />
      <RadioOptionItem
        legend={i18n.getMessage('my_followings')}
        options={userActionsToMyFollowings}
        selectedValue={purpose.myFollowings}
        onChange={(myFollowings: ChainBlockPurpose['myFollowings']) =>
          mutatePurposeOptions({ myFollowings })
        }
      />
    </React.Fragment>
  )
}

function UnChainBlockOptionsUI(props: {
  purpose: UnChainBlockPurpose
  mutatePurposeOptions(partialOptions: Partial<Omit<UnChainBlockPurpose, 'type'>>): void
}) {
  const { purpose, mutatePurposeOptions } = props
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
          mutatePurposeOptions({ mutualBlocked })
        }
      />
    </React.Fragment>
  )
}

function LockPickerOptionsUI(props: {
  purpose: LockPickerPurpose
  mutatePurposeOptions(partialOptions: Partial<Omit<LockPickerPurpose, 'type'>>): void
}) {
  const { purpose, mutatePurposeOptions } = props
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
          mutatePurposeOptions({ protectedFollowers })
        }
      />
    </React.Fragment>
  )
}
