import { PageEnum } from '../../scripts/common.js'
import { DialogContent } from './ui-common.js'

export const PageSwitchContext = React.createContext({
  switchPage(_tabIndex: PageEnum) {},
})

export const DialogContext = React.createContext({
  openModal(_content: DialogContent) {},
})

export const SnackBarContext = React.createContext({
  snack(_message: string) {},
})
