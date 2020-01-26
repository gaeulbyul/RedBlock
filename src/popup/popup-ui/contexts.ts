import { DialogContent } from './ui-common.js'

const dialogContextValue = {
  openModal(_content: DialogContent) {},
}

export const DialogContext = React.createContext(dialogContextValue)

const snackBarContextValue = {
  snack(_message: string) {},
}

export const SnackBarContext = React.createContext(snackBarContextValue)
