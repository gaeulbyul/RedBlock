import { DialogMessageObj } from '../../scripts/text-generate.js'
import * as i18n from '../../scripts/i18n.js'
import { requestResetCounter } from '../../scripts/background/request-sender.js'
import { UIContext, BlockLimiterContext } from './contexts.js'

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
  return (
    <M.Paper>
      <M.Box padding="12px 16px">
        <T component="div">{i18n.getMessage('please_check_login')}</T>
        <M.Box marginTop="10px">
          <a
            rel="noopener noreferer"
            target="_blank"
            href="https://twitter.com/login"
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

export function DenseExpansionPanel(props: {
  summary: string
  children: React.ReactNode
  defaultExpanded?: boolean
}) {
  const classes = useStylesForExpansionPanels()
  return (
    <M.ExpansionPanel defaultExpanded={props.defaultExpanded}>
      <DenseExpansionPanelSummary expandIcon={<M.Icon>expand_more</M.Icon>}>
        <T>{props.summary}</T>
      </DenseExpansionPanelSummary>
      <M.ExpansionPanelDetails className={classes.details}>
        {props.children}
      </M.ExpansionPanelDetails>
    </M.ExpansionPanel>
  )
}

export function BlockLimiterUI() {
  const { current, max, remained } = React.useContext(BlockLimiterContext)
  function handleResetButtonClick(event: React.MouseEvent<HTMLButtonElement>) {
    event.preventDefault()
    requestResetCounter()
  }
  return remained <= 0 ? (
    <DenseExpansionPanel summary={`${i18n.getMessage('block_counter')}: [${current} / ${max}]`}>
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
    </DenseExpansionPanel>
  ) : (
    <div />
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

export const BigExecuteChainBlockButton = MaterialUI.withStyles(theme => ({
  root: {
    backgroundColor: MaterialUI.colors.red[700],
    color: theme.palette.getContrastText(MaterialUI.colors.red[700]),
    '&:hover': {
      backgroundColor: MaterialUI.colors.red[500],
      color: theme.palette.getContrastText(MaterialUI.colors.red[500]),
    },
  },
}))(BigBaseButton)

export const BigExecuteUnChainBlockButton = MaterialUI.withStyles(theme => ({
  root: {
    backgroundColor: MaterialUI.colors.green[700],
    color: theme.palette.getContrastText(MaterialUI.colors.green[700]),
    '&:hover': {
      backgroundColor: MaterialUI.colors.green[500],
      color: theme.palette.getContrastText(MaterialUI.colors.green[500]),
    },
  },
}))(BigBaseButton)

export const BigExportButton = MaterialUI.withStyles(theme => ({
  root: {
    backgroundColor: MaterialUI.colors.blueGrey[700],
    color: theme.palette.getContrastText(MaterialUI.colors.blueGrey[700]),
    '&:hover': {
      backgroundColor: MaterialUI.colors.blueGrey[500],
      color: theme.palette.getContrastText(MaterialUI.colors.blueGrey[500]),
    },
  },
}))(BigBaseButton)

export const BigExecuteLockPickerButton = MaterialUI.withStyles(theme => ({
  root: {
    backgroundColor: MaterialUI.colors.pink[700],
    color: theme.palette.getContrastText(MaterialUI.colors.pink[700]),
    '&:hover': {
      backgroundColor: MaterialUI.colors.pink[500],
      color: theme.palette.getContrastText(MaterialUI.colors.pink[500]),
    },
  },
}))(BigBaseButton)

export function determineInitialPurpose(
  myself: TwitterUser | null,
  givenUser: TwitterUser | null
): Purpose {
  if (!(myself && givenUser)) {
    console.warn('both null?')
    return 'chainblock'
  }
  if (myself.id_str === givenUser.id_str) {
    return 'lockpicker'
  }
  if (givenUser.following) {
    return 'unchainblock'
  }
  return 'chainblock'
}
