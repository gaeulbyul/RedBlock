import { PageEnum } from '../popup.js'
import { defaultOptions } from '../../scripts/background/storage.js'
import type { DialogContent } from './ui-common.js'
import type { TwitterUser } from '../../scripts/background/twitter-api.js'

export const UIContext = React.createContext({
  openDialog(_content: DialogContent) {},
  openSnackBar(_message: string) {},
  switchPage(_tabIndex: PageEnum) {},
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
