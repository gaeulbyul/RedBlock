import { PageEnum } from '../popup.js'
import { defaultOptions } from '../../scripts/background/storage.js'
import type { DialogContent } from './components.js'
import type { TwitterUser } from '../../scripts/background/twitter-api.js'

interface UIContextType {
  openDialog(content: DialogContent): void
  openSnackBar(message: string): void
  switchPage(tabIndex: PageEnum): void
  shrinkedPopup: boolean
  popupOpenedInTab: boolean
  menuAnchorElem: HTMLElement | null
  setMenuAnchorElem(elem: HTMLElement | null): void
}

export const UIContext = React.createContext<UIContextType>({
  openDialog() {},
  openSnackBar() {},
  switchPage() {},
  shrinkedPopup: false,
  popupOpenedInTab: false,
  menuAnchorElem: null,
  setMenuAnchorElem() {},
})

export const RedBlockOptionsContext = React.createContext({
  ...defaultOptions,
})

export const MyselfContext = React.createContext<TwitterUser | null>(null)

export const BlockLimiterContext = React.createContext<BlockLimiterStatus>({
  current: 0,
  max: 500,
  remained: 500,
})
