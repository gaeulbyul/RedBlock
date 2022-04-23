import React from 'react'

import { defaultOptions } from '../../scripts/background/storage/options'
import { infoless } from '../popup'
import type { AvailablePages } from './pages'
import type { UIReducers, UIStates } from './ui-states'

interface UIContextType {
  uiStates: UIStates
  dispatchUIStates: React.Dispatch<UIReducers>
  shrinkedPopup: boolean
  popupOpenedInTab: boolean
  availablePages: AvailablePages
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

// export const TwitterAPIClientContext = React.createContext<TwClient>(null!)
// export const TabInfoContext = React.createContext<Actor | null>(null)
export const TabInfoContext = React.createContext(infoless)

interface RetrieverContextType {
  retriever: Actor
  setRetriever(retriever: Actor): void
}

export const RetrieverContext = React.createContext<RetrieverContextType>(null!)
