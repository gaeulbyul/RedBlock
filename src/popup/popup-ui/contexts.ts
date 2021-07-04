import React from 'react'

import { defaultOptions } from '../../scripts/background/storage'
import type { PageId, AvailablePages } from './pages'
import type { DialogContent } from './components'

interface UIContextType {
  openDialog(content: DialogContent): void
  openSnackBar(message: string): void
  switchPage(pageId: PageId): void
  shrinkedPopup: boolean
  popupOpenedInTab: boolean
  menuAnchorElem: HTMLElement | null
  setMenuAnchorElem(elem: HTMLElement | null): void
  availablePages: AvailablePages
  initialLoading: boolean
}

export const UIContext = React.createContext<UIContextType>(null!)

export const RedBlockOptionsContext = React.createContext({
  ...defaultOptions,
})

export const BlockLimiterContext = React.createContext<BlockLimiterStatus>({
  current: 0,
  max: 500,
  remained: 500,
})

//export const TwitterAPIClientContext = React.createContext<TwClient>(null!)
export const MyselfContext = React.createContext<Actor | null>(null)

interface RetrieverContextType {
  retriever: Actor
  setRetriever(retriever: Actor): void
}

export const RetrieverContext = React.createContext<RetrieverContextType>(null!)
