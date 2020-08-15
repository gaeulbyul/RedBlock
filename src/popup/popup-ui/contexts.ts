import { PageEnum } from '../popup.js'
import { defaultOptions } from '../../scripts/background/storage.js'
import type { DialogContent } from './ui-common.js'

export const PageSwitchContext = React.createContext({
  switchPage(_tabIndex: PageEnum) {},
})

export const DialogContext = React.createContext({
  openModal(_content: DialogContent) {},
})

export const SnackBarContext = React.createContext({
  snack(_message: string) {},
})

export const RedBlockOptionsContext = React.createContext({
  ...defaultOptions,
})

export const LoginStatusContext = React.createContext({
  loggedIn: false,
})

export const BlockLimiterContext = React.createContext<BlockLimiterStatus>({
  current: 0,
  max: 500,
})
