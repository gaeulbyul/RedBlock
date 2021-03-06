import { DialogMessageObj, checkResultToString } from '../../scripts/text-generate.js'
import { requestResetCounter } from '../../scripts/background/request-sender.js'
import { MyselfContext, BlockLimiterContext, RedBlockOptionsContext } from './contexts.js'
import { ExtraTargetContext } from './ui-states.js'
import { TargetCheckResult, validateRequest } from '../../scripts/background/target-checker.js'

const M = MaterialUI
const T = MaterialUI.Typography

export interface DialogContent {
  message: DialogMessageObj
  dialogType: 'confirm' | 'alert'
  callbackOnOk?(): void
  callbackOnCancel?(): void
}

export function RedBlockPopupUITheme(darkMode: boolean) {
  return MaterialUI.createMuiTheme({
    typography: {
      fontSize: 12,
    },
    palette: {
      type: darkMode ? 'dark' : 'light',
      primary: MaterialUI.colors.pink,
      secondary: darkMode ? MaterialUI.colors.lightBlue : MaterialUI.colors.indigo,
    },
  })
}

export const MyTooltip = MaterialUI.withStyles(() => ({
  tooltip: {
    fontSize: 12,
  },
}))(MaterialUI.Tooltip)

export const SmallAvatar = MaterialUI.withStyles(theme => ({
  root: {
    width: 16,
    height: 16,
    border: `1px solid ${theme.palette.background.paper}`,
  },
}))(M.Avatar)

function Icon({ name }: { name: string }) {
  // overflow: purpose 탭 아이콘 짤림 문제방지
  // (특히 탭 라벨이 두 줄이상으로 넘어갈때)
  return <M.Icon style={{ overflow: 'visible' }}>{name}</M.Icon>
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
      <M.Box px={2} py={1.5}>
        <T component="div">{i18n.getMessage('please_check_login')}</T>
        <M.Box mt={1}>
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

const DenseExpansionPanel = MaterialUI.withStyles(theme => ({
  root: {
    margin: theme.spacing(1, 0),
    '&:first-child': {
      margin: '0',
    },
    '&$expanded': {
      margin: theme.spacing(1, 0),
    },
  },
  expanded: {},
}))(MaterialUI.ExpansionPanel)

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

const useStylesForExpansionPanels = MaterialUI.makeStyles(theme =>
  MaterialUI.createStyles({
    details: {
      padding: theme.spacing(1, 2),
    },
  })
)

export function RBExpansionPanel(props: {
  summary: string
  children: React.ReactNode
  defaultExpanded?: boolean
  warning?: boolean
}) {
  const classes = useStylesForExpansionPanels()
  return (
    <DenseExpansionPanel defaultExpanded={props.defaultExpanded}>
      <DenseExpansionPanelSummary expandIcon={<M.Icon>expand_more</M.Icon>}>
        <T color={props.warning ? 'error' : 'initial'}>{props.summary}</T>
      </DenseExpansionPanelSummary>
      <M.ExpansionPanelDetails className={classes.details}>
        {props.children}
      </M.ExpansionPanelDetails>
    </DenseExpansionPanel>
  )
}

export function BlockLimiterUI() {
  const { current, max } = React.useContext(BlockLimiterContext)
  const myself = React.useContext(MyselfContext)!
  function handleResetButtonClick(event: React.MouseEvent<HTMLButtonElement>) {
    event.preventDefault()
    requestResetCounter(myself.user.id_str)
  }
  const exceed = current >= max
  const warningIcon = exceed ? '\u26a0\ufe0f' : ''
  return (
    <RBExpansionPanel
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
    </RBExpansionPanel>
  )
}

export function TwitterUserProfile(props: { user: TwitterUser; children?: React.ReactNode }) {
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

const BigBaseButton = MaterialUI.withStyles(theme => ({
  root: {
    width: '100%',
    padding: theme.spacing(1),
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

const BigRedButton = MaterialUI.withStyles(theme => ({
  root: {
    backgroundColor: MaterialUI.colors.red[700],
    color: theme.palette.getContrastText(MaterialUI.colors.red[700]),
    '&:hover': {
      backgroundColor: MaterialUI.colors.red[500],
      color: theme.palette.getContrastText(MaterialUI.colors.red[500]),
    },
  },
}))(BigBaseButton)

const BigGreenButton = MaterialUI.withStyles(theme => ({
  root: {
    backgroundColor: MaterialUI.colors.green[700],
    color: theme.palette.getContrastText(MaterialUI.colors.green[700]),
    '&:hover': {
      backgroundColor: MaterialUI.colors.green[500],
      color: theme.palette.getContrastText(MaterialUI.colors.green[500]),
    },
  },
}))(BigBaseButton)

const BigGrayButton = MaterialUI.withStyles(theme => ({
  root: {
    backgroundColor: MaterialUI.colors.blueGrey[700],
    color: theme.palette.getContrastText(MaterialUI.colors.blueGrey[700]),
    '&:hover': {
      backgroundColor: MaterialUI.colors.blueGrey[500],
      color: theme.palette.getContrastText(MaterialUI.colors.blueGrey[500]),
    },
  },
}))(BigBaseButton)

const PurposeTab = MaterialUI.withStyles(theme => ({
  root: {
    lineHeight: 1.5,
    paddingLeft: theme.spacing(1),
    paddingRight: theme.spacing(1),
    '@media (min-width: 600px)': {
      minWidth: 'initial',
    },
  },
}))(MaterialUI.Tab)

export function LinearProgressWithLabel(props: { value: number }) {
  return (
    <M.Box display="flex" alignItems="center">
      <M.Box width="100%" mr={1}>
        <M.LinearProgress variant="determinate" {...props} />
      </M.Box>
      <M.Box minWidth={35}>
        <T variant="body2" color="textSecondary">{`${Math.round(props.value)}%`}</T>
      </M.Box>
    </M.Box>
  )
}

export function PurposeSelectionUI(props: {
  purpose: SessionRequest['purpose']
  changePurposeType(purposeType: SessionRequest['purpose']['type']): void
  mutatePurposeOptions(partialOptions: Partial<Omit<SessionRequest['purpose'], 'type'>>): void
  availablePurposeTypes: SessionRequest['purpose']['type'][]
}) {
  const { purpose, changePurposeType, mutatePurposeOptions, availablePurposeTypes } = props
  const chainblockable = availablePurposeTypes.includes('chainblock')
  const unchainblockable = availablePurposeTypes.includes('unchainblock')
  const exportable = availablePurposeTypes.includes('export')
  const lockpickable = availablePurposeTypes.includes('lockpicker')
  const chainunfollowable = availablePurposeTypes.includes('chainunfollow')
  const chainmutable = availablePurposeTypes.includes('chainmute')
  const unchainmutable = availablePurposeTypes.includes('unchainmute')
  //const narrow = MaterialUI.useMediaQuery('(max-width:500px)')
  return (
    <div style={{ width: '100%' }}>
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
          <ExtraTargetUI />
          <M.Divider />
          <div className="description">
            {i18n.getMessage('chainblock_description')}{' '}
            {i18n.getMessage('my_mutual_followers_wont_block_or_mute')}
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
      {chainmutable && (
        <TabPanel value={purpose.type} index="chainmute">
          {purpose.type === 'chainmute' && (
            <ChainMutePurposeUI {...{ purpose, mutatePurposeOptions }} />
          )}
          <ExtraTargetUI />
          <M.Divider />
          <div className="description">
            {i18n.getMessage('chainmute_description')}{' '}
            {i18n.getMessage('my_mutual_followers_wont_block_or_mute')}
          </div>
        </TabPanel>
      )}
      {unchainmutable && (
        <TabPanel value={purpose.type} index="unchainmute">
          {purpose.type === 'unchainmute' && (
            <UnChainMuteOptionsUI {...{ purpose, mutatePurposeOptions }} />
          )}
          <div className="description">{i18n.getMessage('unchainmute_description')}</div>
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

const useStylesForFormControl = MaterialUI.makeStyles(() =>
  MaterialUI.createStyles({
    fieldset: {
      display: 'flex',
    },
  })
)

function RadioOptionItem(props: {
  legend: React.ReactNode
  options: { [label: string]: string }
  selectedValue: string
  onChange(newValue: string): void
}) {
  const classes = useStylesForFormControl()
  return (
    <M.FormControl component="fieldset" className={classes.fieldset}>
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

function ExtraTargetUI() {
  const { extraTarget, mutate } = React.useContext(ExtraTargetContext)
  const { revealBioBlockMode } = React.useContext(RedBlockOptionsContext)
  const bioBlockModes: { [label: string]: BioBlockMode } = {
    [i18n.getMessage('bioblock_never')]: 'never',
    [i18n.getMessage('bioblock_all')]: 'all',
    // [i18n.getMessage('bioblock_smart')]: 'smart',
  }
  return (
    <React.Fragment>
      {revealBioBlockMode && (
        <RadioOptionItem
          legend="BioBlock &#7517;"
          options={bioBlockModes}
          selectedValue={extraTarget.bioBlock}
          onChange={(bioBlock: BioBlockMode) => mutate({ bioBlock })}
        />
      )}
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

function ChainMutePurposeUI(props: {
  purpose: ChainMutePurpose
  mutatePurposeOptions(partialOptions: Partial<Omit<ChainMutePurpose, 'type'>>): void
}) {
  const { purpose, mutatePurposeOptions } = props
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
          mutatePurposeOptions({ myFollowers })
        }
      />
      <RadioOptionItem
        legend={i18n.getMessage('my_followings')}
        options={userActions}
        selectedValue={purpose.myFollowings}
        onChange={(myFollowings: ChainMutePurpose['myFollowings']) =>
          mutatePurposeOptions({ myFollowings })
        }
      />
    </React.Fragment>
  )
}

function UnChainMuteOptionsUI(props: {
  purpose: UnChainMutePurpose
  mutatePurposeOptions(partialOptions: Partial<Omit<UnChainMutePurpose, 'type'>>): void
}) {
  const { purpose, mutatePurposeOptions } = props
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
          mutatePurposeOptions({ mutedAndAlsoBlocked })
        }
      />
    </React.Fragment>
  )
}

export function RequestCheckResultUI(props: { request: SessionRequest }) {
  const checkResult = validateRequest(props.request)
  const checkResultMsg = checkResultToString(checkResult)
  const isOk = checkResult === TargetCheckResult.Ok
  return (
    <div>
      {!isOk && (
        <M.Paper square>
          <T component="div">
            <M.Box px={2} py={1} mb={1} color="warning.main">
              {checkResultMsg}
            </M.Box>
          </T>
        </M.Paper>
      )}
    </div>
  )
}
