import { PageEnum } from '../../scripts/common.js'
import type { DialogContent } from './ui-common.js'
import { defaultOptions } from '../../scripts/background/storage.js'

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
