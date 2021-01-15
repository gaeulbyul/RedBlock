import { DialogMessageObj } from '../../scripts/text-generate.js'
import * as i18n from '../../scripts/i18n.js'
import { requestResetCounter } from '../../scripts/background/request-sender.js'
import { UIContext, BlockLimiterContext } from './contexts.js'
import { PurposeContext, SessionOptionsContext } from './ui-states.js'

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

function purposeToIcon(purpose: Purpose): JSX.Element {
  switch (purpose) {
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
  function handleResetButtonClick(event: React.MouseEvent<HTMLButtonElement>) {
    event.preventDefault()
    requestResetCounter()
  }
  return (
    <RBExpansionPanel summary={`${i18n.getMessage('block_counter')}: [${current} / ${max}]`}>
      <M.Box display="flex" flexDirection="row">
        <M.Box flexGrow="1">
          <T component="div" variant="body2">
            {i18n.getMessage('wtf_twitter')}
          </T>
        </M.Box>
        <M.Button type="button" variant="outlined" onClick={handleResetButtonClick}>
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
  switch (purpose) {
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
  const startIcon = purposeToIcon(purpose)
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

export function ChainBlockPurposeUI() {
  const { purpose, setPurpose, availablePurposes } = React.useContext(PurposeContext)
  const classes = useStylesForTab()
  const chainblockable = availablePurposes.includes('chainblock')
  const unchainblockable = availablePurposes.includes('unchainblock')
  const exportable = availablePurposes.includes('export')
  const lockpickable = availablePurposes.includes('lockpicker')
  const chainunfollowable = availablePurposes.includes('chainunfollow')
  return (
    <div style={{ width: '100%' }}>
      <M.Tabs
        style={{ display: availablePurposes.length >= 2 ? 'flex' : 'none' }}
        variant="fullWidth"
        value={purpose}
        onChange={(_ev, val) => setPurpose(val)}
      >
        {chainblockable && (
          <M.Tab
            value="chainblock"
            className={classes.tab}
            icon={purposeToIcon('chainblock')}
            label={i18n.getMessage('chainblock')}
          />
        )}
        {unchainblockable && (
          <M.Tab
            value="unchainblock"
            className={classes.tab}
            icon={purposeToIcon('unchainblock')}
            label={i18n.getMessage('unchainblock')}
          />
        )}
        {lockpickable && (
          <M.Tab
            value="lockpicker"
            className={classes.tab}
            icon={purposeToIcon('lockpicker')}
            label={i18n.getMessage('lockpicker')}
          />
        )}
        {chainunfollowable && (
          <M.Tab
            value="chainunfollow"
            className={classes.tab}
            icon={purposeToIcon('chainunfollow')}
            label={i18n.getMessage('chainunfollow')}
          />
        )}
        {exportable && (
          <M.Tab
            value="export"
            className={classes.tab}
            icon={purposeToIcon('export')}
            label={i18n.getMessage('export')}
          />
        )}
      </M.Tabs>
      <M.Divider />
      {chainblockable && (
        <TabPanel value={purpose} index="chainblock">
          <ChainBlockOptionsUI />
          <M.Divider />
          <div className="description">
            {i18n.getMessage('chainblock_description')}{' '}
            {i18n.getMessage('my_mutual_followers_wont_block')}
            <div className="wtf">{i18n.getMessage('wtf_twitter') /* massive block warning */}</div>
          </div>
        </TabPanel>
      )}
      {unchainblockable && (
        <TabPanel value={purpose} index="unchainblock">
          <UnChainBlockOptionsUI />
          <div className="description">{i18n.getMessage('unchainblock_description')}</div>
        </TabPanel>
      )}
      {lockpickable && (
        <TabPanel value={purpose} index="lockpicker">
          <div className="description">{i18n.getMessage('lockpicker_description')}</div>
        </TabPanel>
      )}
      {chainunfollowable && (
        <TabPanel value={purpose} index="chainunfollow">
          <div className="description">{i18n.getMessage('chainunfollow_description')}</div>
        </TabPanel>
      )}
      {exportable && (
        <TabPanel value={purpose} index="export">
          <div className="description">{i18n.getMessage('export_description')}</div>
        </TabPanel>
      )}
    </div>
  )
}

function ChainBlockOptionsUI() {
  const { targetOptions, mutateOptions } = React.useContext(SessionOptionsContext)
  const { myFollowers, myFollowings, includeUsersInBio } = targetOptions
  const userActions: Array<[UserAction, string]> = [
    ['Skip', i18n.getMessage('skip')],
    ['Mute', i18n.getMessage('do_mute')],
    ['Block', i18n.getMessage('do_block')],
  ]
  const userActionsToMyFollowings = userActions.concat([['UnFollow', i18n.getMessage('unfollow')]])
  const userActionsToMyFollowers = userActions.concat([
    ['BlockAndUnBlock', i18n.getMessage('block_and_unblock')],
  ])
  const bioBlockModes: Array<[BioBlockMode, string]> = [
    ['never', i18n.getMessage('bioblock_never')],
    ['all', i18n.getMessage('bioblock_all')],
    ['smart', i18n.getMessage('bioblock_smart')],
  ]
  return (
    <React.Fragment>
      <M.FormControl component="fieldset">
        <M.FormLabel component="legend">{i18n.getMessage('my_followers')}</M.FormLabel>
        <M.RadioGroup row>
          {userActionsToMyFollowers.map(([action, localizedAction], index) => (
            <M.FormControlLabel
              key={index}
              control={<M.Radio size="small" />}
              checked={myFollowers === action}
              onChange={() => mutateOptions({ myFollowers: action })}
              label={localizedAction}
            />
          ))}
        </M.RadioGroup>
      </M.FormControl>
      <br />
      <M.FormControl component="fieldset">
        <M.FormLabel component="legend">{i18n.getMessage('my_followings')}</M.FormLabel>
        <M.RadioGroup row>
          {userActionsToMyFollowings.map(([action, localizedAction], index) => (
            <M.FormControlLabel
              key={index}
              control={<M.Radio size="small" />}
              checked={myFollowings === action}
              onChange={() => mutateOptions({ myFollowings: action })}
              label={localizedAction}
            />
          ))}
        </M.RadioGroup>
      </M.FormControl>
      <br />
      <M.FormControl>
        <M.FormLabel component="legend">
          BioBlock &#x1F9EA; <WhatIsBioBlock />
        </M.FormLabel>
        <M.RadioGroup row>
          {bioBlockModes.map(([mode, localizedMode], index) => (
            <M.FormControlLabel
              key={index}
              control={<M.Radio size="small" />}
              checked={includeUsersInBio === mode}
              onChange={() => mutateOptions({ includeUsersInBio: mode })}
              label={localizedMode}
            />
          ))}
        </M.RadioGroup>
      </M.FormControl>
    </React.Fragment>
  )
}

function UnChainBlockOptionsUI() {
  // const { options, mutateOptions } = props
  const { targetOptions, mutateOptions } = React.useContext(SessionOptionsContext)
  const { mutualBlocked } = targetOptions
  const userActions: Array<[UserAction, string]> = [
    ['Skip', i18n.getMessage('skip')],
    ['UnBlock', i18n.getMessage('do_unblock')],
  ]
  return (
    <React.Fragment>
      <M.FormControl component="fieldset">
        <M.FormLabel component="legend">{i18n.getMessage('mutually_blocked')}</M.FormLabel>
        <M.RadioGroup row>
          {userActions.map(([action, localizedAction], index) => (
            <M.FormControlLabel
              key={index}
              control={<M.Radio size="small" />}
              checked={mutualBlocked === action}
              onChange={() => mutateOptions({ mutualBlocked: action })}
              label={localizedAction}
            />
          ))}
        </M.RadioGroup>
      </M.FormControl>
    </React.Fragment>
  )
}
