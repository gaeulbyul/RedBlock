import React from 'react'

import {
  examineRetrieverByTargetUser,
  examineRetrieverByTweetId,
} from '\\/scripts/background/blockbuster'
import { Blocklist, emptyBlocklist } from '\\/scripts/background/blocklist-process'
import {
  defaultExtraSessionOptions,
  defaultPurposeOptions,
} from '\\/scripts/background/chainblock-session/defaults'
import type { ReactionV2Kind } from '\\/scripts/background/twitter-api'
import { assertNever } from '\\/scripts/common/utilities'
import { determineInitialPurposeType } from '../popup'
import type { TargetGroup } from './components/target-selector'
import { RedBlockOptionsContext, RetrieverContext, TabInfoContext } from './contexts'

function usePurpose<T extends Purpose>(initialPurposeType: T['type']) {
  const initialPurpose = defaultPurposeOptions[initialPurposeType] as T
  const [purpose, setPurpose] = React.useState<T>(initialPurpose)
  function changePurposeType(type: Purpose['type']) {
    setPurpose(defaultPurposeOptions[type] as T)
  }
  function mutatePurposeOptions(partialOptions: Partial<Omit<T, 'type'>>) {
    setPurpose({ ...purpose, ...partialOptions })
  }
  return [purpose, changePurposeType, mutatePurposeOptions] as const
}

type ExtraSessionOptions = SessionRequest<AnySessionTarget>['extraSessionOptions']
type IncludedAudioSpaceParticipants = 'hosts_and_speakers' | 'all_participants'

interface ExtraSessionOptionsContextType {
  extraSessionOptions: ExtraSessionOptions
  mutate(partialOptions: Partial<ExtraSessionOptions>): void
}

export const ExtraSessionOptionsContext = React.createContext<ExtraSessionOptionsContextType>(null!)

function ExtraSessionOptionsContextProvider({ children }: { children: React.ReactNode }) {
  const [extraSessionOptions, setTargetOptions] = React.useState<ExtraSessionOptions>({
    ...defaultExtraSessionOptions,
  })
  function mutate(newOptionsPart: Partial<ExtraSessionOptions>) {
    const newOptions = { ...extraSessionOptions, ...newOptionsPart }
    setTargetOptions(newOptions)
  }
  return (
    <ExtraSessionOptionsContext.Provider
      value={{
        extraSessionOptions,
        mutate,
      }}
    >
      {children}
    </ExtraSessionOptionsContext.Provider>
  )
}

interface UserSelectionState {
  user: TwitterUser
  group: TargetGroup
}

interface FollowerChainBlockPageStates {
  currentUser: TwitterUser | null
  userSelection: UserSelectionState | null
  setUserSelection(userSelection: UserSelectionState | null): void
  targetList: FollowKind
  setTargetList(fk: FollowKind): void
  purpose: SessionRequest<FollowerSessionTarget>['purpose']
  changePurposeType(purposeType: SessionRequest<FollowerSessionTarget>['purpose']['type']): void
  mutatePurposeOptions(
    partialOptions: Partial<Omit<SessionRequest<FollowerSessionTarget>['purpose'], 'type'>>,
  ): void
  availablePurposeTypes: SessionRequest<FollowerSessionTarget>['purpose']['type'][]
}

interface TweetReactionChainBlockPageStates {
  currentTweet: Tweet | null
  includeRetweeters: boolean
  setIncludeRetweeters(b: boolean): void
  includeLikers: boolean
  setIncludeLikers(b: boolean): void
  includeMentionedUsers: boolean
  setIncludeMentionedUsers(b: boolean): void
  includeQuotedUsers: boolean
  setIncludeQuotedUsers(b: boolean): void
  includeNonLinkedMentions: boolean
  setIncludeNonLinkedMentions(b: boolean): void
  includedReactionsV2: ReactionV2Kind[]
  setIncludedReactionsV2(reactions: ReactionV2Kind[]): void
  purpose: SessionRequest<TweetReactionSessionTarget>['purpose']
  changePurposeType(
    purposeType: SessionRequest<TweetReactionSessionTarget>['purpose']['type'],
  ): void
  mutatePurposeOptions(
    partialOptions: Partial<Omit<SessionRequest<TweetReactionSessionTarget>['purpose'], 'type'>>,
  ): void
  availablePurposeTypes: SessionRequest<TweetReactionSessionTarget>['purpose']['type'][]
}

interface ImportChainBlockPageStates {
  blocklist: Blocklist
  setBlocklist(blocklist: Blocklist): void
  nameOfSelectedFiles: string[]
  setNameOfSelectedFiles(nameOfSelectedFiles: string[]): void
  purpose: SessionRequest<ImportSessionTarget>['purpose']
  changePurposeType(purposeType: SessionRequest<ImportSessionTarget>['purpose']['type']): void
  mutatePurposeOptions(
    partialOptions: Partial<Omit<SessionRequest<ImportSessionTarget>['purpose'], 'type'>>,
  ): void
  availablePurposeTypes: SessionRequest<ImportSessionTarget>['purpose']['type'][]
}

interface UserSearchChainBlockPageStates {
  searchQuery: string | null
  purpose: SessionRequest<UserSearchSessionTarget>['purpose']
  changePurposeType(purposeType: SessionRequest<UserSearchSessionTarget>['purpose']['type']): void
  mutatePurposeOptions(
    partialOptions: Partial<Omit<SessionRequest<UserSearchSessionTarget>['purpose'], 'type'>>,
  ): void
  availablePurposeTypes: SessionRequest<UserSearchSessionTarget>['purpose']['type'][]
}

interface AudioSpaceChainBlockPageStates {
  audioSpace: AudioSpace
  includedParticipants: IncludedAudioSpaceParticipants
  setIncludedParticipants(p: IncludedAudioSpaceParticipants): void
  purpose: SessionRequest<AudioSpaceSessionTarget>['purpose']
  changePurposeType(purposeType: SessionRequest<AudioSpaceSessionTarget>['purpose']['type']): void
  mutatePurposeOptions(
    partialOptions: Partial<Omit<SessionRequest<AudioSpaceSessionTarget>['purpose'], 'type'>>,
  ): void
  availablePurposeTypes: SessionRequest<AudioSpaceSessionTarget>['purpose']['type'][]
}

interface LockPickerPageStates {
  purpose: SessionRequest<LockPickerSessionTarget>['purpose']
  changePurposeType(__: any): void // <- 실제론 안 씀
  mutatePurposeOptions(
    partialOptions: Partial<Omit<SessionRequest<LockPickerSessionTarget>['purpose'], 'type'>>,
  ): void
  availablePurposeTypes: SessionRequest<LockPickerSessionTarget>['purpose']['type'][]
}

export const FollowerChainBlockPageStatesContext = React.createContext<
  FollowerChainBlockPageStates
>(null!)
export const TweetReactionChainBlockPageStatesContext = React.createContext<
  TweetReactionChainBlockPageStates
>(null!)
export const ImportChainBlockPageStatesContext = React.createContext<ImportChainBlockPageStates>(
  null!,
)
export const UserSearchChainBlockPageStatesContext = React.createContext<
  UserSearchChainBlockPageStates
>(null!)
export const AudioSpaceChainBlockPageStatesContext = React.createContext<
  AudioSpaceChainBlockPageStates
>(null!)
export const LockPickerPageStatesContext = React.createContext<LockPickerPageStates>(null!)

const examineResultCache = new Map<string, Actor>()

export function FollowerChainBlockPageStatesProvider({
  children,
  initialUser,
}: {
  children: React.ReactNode
  initialUser: TwitterUser | null
}) {
  const { myself } = React.useContext(TabInfoContext)
  const [userSelection, setUserSelection] = React.useState<UserSelectionState | null>(null)
  React.useEffect(() => {
    if (initialUser) {
      setUserSelection({
        user: initialUser,
        group: 'current',
      })
    }
  }, [initialUser])
  const initialPurposeType = determineInitialPurposeType<
    SessionRequest<FollowerSessionTarget>['purpose']
  >(initialUser)
  const [targetList, setTargetList] = React.useState<FollowKind>('followers')
  const availablePurposeTypes: SessionRequest<FollowerSessionTarget>['purpose']['type'][] = [
    'chainblock',
    'unchainblock',
    'chainmute',
    'unchainmute',
    'chainunfollow',
    'export',
  ]
  const [purpose, changePurposeType, mutatePurposeOptions] = usePurpose<
    SessionRequest<FollowerSessionTarget>['purpose']
  >(initialPurposeType)
  const { enableBlockBuster, enableBlockBusterWithTweetDeck } = React.useContext(
    RedBlockOptionsContext,
  )
  const [retriever, setRetriever] = React.useState<Actor>(myself!)
  React.useEffect(() => {
    async function examine(selectedUser: TwitterUser) {
      const key = `user-${selectedUser.id_str}`
      if (examineResultCache.has(key)) {
        setRetriever(examineResultCache.get(key)!)
      } else {
        const newRetriever = await examineRetrieverByTargetUser(myself!, selectedUser, {
          includeTweetDeck: enableBlockBusterWithTweetDeck,
          includeAnotherCookieStores: true,
        })
        examineResultCache.set(key, newRetriever)
        setRetriever(newRetriever)
      }
    }
    const selectedUser = userSelection?.user
    if (enableBlockBuster && selectedUser) {
      examine(selectedUser)
    } else {
      setRetriever(myself!)
    }
  }, [userSelection, enableBlockBuster])
  return (
    <FollowerChainBlockPageStatesContext.Provider
      value={{
        currentUser: initialUser,
        userSelection,
        setUserSelection,
        targetList,
        setTargetList,
        purpose,
        changePurposeType,
        mutatePurposeOptions,
        availablePurposeTypes,
      }}
    >
      <RetrieverContext.Provider value={{ retriever, setRetriever }}>
        <ExtraSessionOptionsContextProvider>{children}</ExtraSessionOptionsContextProvider>
      </RetrieverContext.Provider>
    </FollowerChainBlockPageStatesContext.Provider>
  )
}

export function TweetReactionChainBlockPageStatesProvider({
  children,
  initialTweet,
}: {
  children: React.ReactNode
  initialTweet: Tweet | null
}) {
  const [includeRetweeters, setIncludeRetweeters] = React.useState(false)
  const [includeLikers, setIncludeLikers] = React.useState(false)
  const [includeMentionedUsers, setIncludeMentionedUsers] = React.useState(false)
  const [includeQuotedUsers, setIncludeQuotedUsers] = React.useState(false)
  const [includeNonLinkedMentions, setIncludeNonLinkedMentions] = React.useState(false)
  const [includedReactionsV2, setIncludedReactionsV2] = React.useState<ReactionV2Kind[]>([])
  const availablePurposeTypes: SessionRequest<TweetReactionSessionTarget>['purpose']['type'][] = [
    'chainblock',
    'chainmute',
    'unchainmute',
    'chainunfollow',
    'export',
  ]
  const selectedTweet = initialTweet // TODO: make it state
  const { myself } = React.useContext(TabInfoContext)
  const { enableBlockBuster, enableReactionsV2Support, enableBlockBusterWithTweetDeck } = React
    .useContext(RedBlockOptionsContext)
  let initialPurpose: SessionRequest<TweetReactionSessionTarget>['purpose']['type']
  if (enableReactionsV2Support) {
    availablePurposeTypes.push('unchainblock')
    initialPurpose = determineInitialPurposeType<SessionRequest<FollowerSessionTarget>['purpose']>(
      initialTweet?.user || null,
    )
  } else {
    initialPurpose = 'chainblock'
  }
  const [purpose, changePurposeType, mutatePurposeOptions] = usePurpose<
    SessionRequest<TweetReactionSessionTarget>['purpose']
  >(initialPurpose)
  const [retriever, setRetriever] = React.useState<Actor>(myself!)
  React.useEffect(() => {
    async function examine(tweetId: string) {
      const key = `tweet-${tweetId}`
      if (examineResultCache.has(key)) {
        setRetriever(examineResultCache.get(key)!)
      } else {
        const newRetriever = await examineRetrieverByTweetId(myself!, tweetId, {
          includeTweetDeck: enableBlockBusterWithTweetDeck,
          includeAnotherCookieStores: true,
        })
        examineResultCache.set(key, newRetriever.actor)
        setRetriever(newRetriever.actor)
      }
    }
    const selectedTweetId = selectedTweet?.id_str
    if (enableBlockBuster && selectedTweetId) {
      examine(selectedTweetId)
    } else {
      setRetriever(myself!)
    }
  }, [selectedTweet, enableBlockBuster])
  return (
    <TweetReactionChainBlockPageStatesContext.Provider
      value={{
        currentTweet: initialTweet,
        includeRetweeters,
        setIncludeRetweeters,
        includeLikers,
        setIncludeLikers,
        includeMentionedUsers,
        setIncludeMentionedUsers,
        includeQuotedUsers,
        setIncludeQuotedUsers,
        includeNonLinkedMentions,
        setIncludeNonLinkedMentions,
        includedReactionsV2,
        setIncludedReactionsV2,
        purpose,
        changePurposeType,
        mutatePurposeOptions,
        availablePurposeTypes,
      }}
    >
      <RetrieverContext.Provider value={{ retriever, setRetriever }}>
        <ExtraSessionOptionsContextProvider>{children}</ExtraSessionOptionsContextProvider>
      </RetrieverContext.Provider>
    </TweetReactionChainBlockPageStatesContext.Provider>
  )
}

export function ImportChainBlockPageStatesProvider({ children }: { children: React.ReactNode }) {
  const [blocklist, setBlocklist] = React.useState<Blocklist>(emptyBlocklist)
  const [nameOfSelectedFiles, setNameOfSelectedFiles] = React.useState<string[]>([])
  const availablePurposeTypes: SessionRequest<ImportSessionTarget>['purpose']['type'][] = [
    'chainblock',
    'unchainblock',
    'chainmute',
    'unchainmute',
    'chainunfollow',
  ]
  const [purpose, changePurposeType, mutatePurposeOptions] = usePurpose<
    SessionRequest<ImportSessionTarget>['purpose']
  >('chainblock')
  return (
    <ImportChainBlockPageStatesContext.Provider
      value={{
        blocklist,
        setBlocklist,
        nameOfSelectedFiles,
        setNameOfSelectedFiles,
        purpose,
        changePurposeType,
        mutatePurposeOptions,
        availablePurposeTypes,
      }}
    >
      <ExtraSessionOptionsContextProvider>{children}</ExtraSessionOptionsContextProvider>
    </ImportChainBlockPageStatesContext.Provider>
  )
}

export function UserSearchChainBlockPageStatesProvider({
  children,
  currentSearchQuery,
}: {
  children: React.ReactNode
  currentSearchQuery: string | null
}) {
  const availablePurposeTypes: SessionRequest<UserSearchSessionTarget>['purpose']['type'][] = [
    'chainblock',
    'unchainblock',
    'chainmute',
    'unchainmute',
    'chainunfollow',
  ]
  const [purpose, changePurposeType, mutatePurposeOptions] = usePurpose<
    SessionRequest<UserSearchSessionTarget>['purpose']
  >('chainblock')
  return (
    <UserSearchChainBlockPageStatesContext.Provider
      value={{
        searchQuery: currentSearchQuery,
        purpose,
        changePurposeType,
        mutatePurposeOptions,
        availablePurposeTypes,
      }}
    >
      <ExtraSessionOptionsContextProvider>{children}</ExtraSessionOptionsContextProvider>
    </UserSearchChainBlockPageStatesContext.Provider>
  )
}

export function AudioSpaceChainBlockPageStatesProvider({
  audioSpace,
  children,
}: {
  audioSpace: AudioSpace
  children: React.ReactNode
}) {
  const [purpose, changePurposeType, mutatePurposeOptions] = usePurpose<
    SessionRequest<AudioSpaceSessionTarget>['purpose']
  >('chainblock')
  const [includedParticipants, setIncludedParticipants] = React.useState<
    AudioSpaceChainBlockPageStates['includedParticipants']
  >('hosts_and_speakers')
  return (
    <AudioSpaceChainBlockPageStatesContext.Provider
      value={{
        audioSpace,
        includedParticipants,
        setIncludedParticipants,
        purpose,
        changePurposeType,
        mutatePurposeOptions,
        availablePurposeTypes: [
          'chainblock',
          'unchainblock',
          'chainmute',
          'unchainmute',
          'chainunfollow',
          'export',
        ],
      }}
    >
      <ExtraSessionOptionsContextProvider>{children}</ExtraSessionOptionsContextProvider>
    </AudioSpaceChainBlockPageStatesContext.Provider>
  )
}

export function LockPickerPageStatesProvider({ children }: { children: React.ReactNode }) {
  const [purpose, changePurposeType, mutatePurposeOptions] = usePurpose<
    SessionRequest<LockPickerSessionTarget>['purpose']
  >('lockpicker')
  return (
    <LockPickerPageStatesContext.Provider
      value={{
        purpose,
        changePurposeType,
        mutatePurposeOptions,
        availablePurposeTypes: ['lockpicker'],
      }}
    >
      <ExtraSessionOptionsContextProvider>{children}</ExtraSessionOptionsContextProvider>
    </LockPickerPageStatesContext.Provider>
  )
}

export interface DialogContent {
  message: DialogMessageObj
  dialogType: 'confirm' | 'alert'
  callbackOnOk?(): void
  callbackOnCancel?(): void
}

export interface UIStates {
  tabPage: PageId
  modalOpened: boolean
  modalContent: DialogContent | null
  snackBarMessage: string
  snackBarOpened: boolean
  initialLoading: boolean
  countOfRunningSessions: number
  menuAnchorElem: HTMLElement | null
}

interface UIReducerSwitchTabPage {
  type: 'switch-tab-page'
  tabPage: PageId
}

interface UIReducerOpenSnackBar {
  type: 'open-snack-bar'
  message: string
}

interface UIReducerCloseSnackBar {
  type: 'close-snack-bar'
}

interface UIReducerOpenModal {
  type: 'open-modal'
  content: DialogContent
}

interface UIReducerCloseModal {
  type: 'close-modal'
}

interface UIReducerFinishInitialLoading {
  type: 'finish-initial-loading'
}

interface UIReducerOpenMenu {
  type: 'open-menu'
  menuAnchorElem: HTMLElement
}

interface UIReducerCloseMenu {
  type: 'close-menu'
}

interface UIReducerSetCountOfRunningSessions {
  type: 'set-count-of-running-sessions'
  count: number
}

export type UIReducers =
  | UIReducerSwitchTabPage
  | UIReducerOpenSnackBar
  | UIReducerCloseSnackBar
  | UIReducerOpenModal
  | UIReducerCloseModal
  | UIReducerFinishInitialLoading
  | UIReducerOpenMenu
  | UIReducerCloseMenu
  | UIReducerSetCountOfRunningSessions

export function uiStateReducer(state: UIStates, action: UIReducers): UIStates {
  switch (action.type) {
    case 'switch-tab-page':
      return { ...state, tabPage: action.tabPage }
    case 'open-snack-bar':
      return { ...state, snackBarOpened: true, snackBarMessage: action.message }
    case 'close-snack-bar':
      return { ...state, snackBarOpened: false }
    case 'open-modal':
      return { ...state, modalOpened: true, modalContent: action.content }
    case 'close-modal':
      return { ...state, modalOpened: false }
    case 'finish-initial-loading':
      return { ...state, initialLoading: false }
    case 'open-menu':
      return { ...state, menuAnchorElem: action.menuAnchorElem }
    case 'close-menu':
      return { ...state, menuAnchorElem: null }
    case 'set-count-of-running-sessions':
      return { ...state, countOfRunningSessions: action.count }
    default:
      assertNever(action)
  }
}
