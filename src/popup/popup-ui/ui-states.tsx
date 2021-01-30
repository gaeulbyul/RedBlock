import {
  defaultPurposeOptions,
  defaultSessionOptions,
} from '../../scripts/background/chainblock-session/default-options.js'
import { Blocklist, emptyBlocklist } from '../../scripts/background/blocklist-process.js'
import { determineInitialPurposeType } from '../popup.js'
import { RedBlockOptionsContext, MyselfContext } from './contexts.js'

export type SelectUserGroup = 'invalid' | 'current' | 'saved'

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

interface SessionOptionsContextType {
  sessionOptions: SessionOptions
  mutateOptions(partialOptions: Partial<SessionOptions>): void
}

export const SessionOptionsContext = React.createContext<SessionOptionsContextType>(null!)

function SessionOptionsContextProvider(props: { children: React.ReactNode }) {
  const { skipInactiveUser } = React.useContext(RedBlockOptionsContext)
  const [sessionOptions, setTargetOptions] = React.useState<SessionOptions>({
    ...defaultSessionOptions,
    skipInactiveUser,
  })
  function mutateOptions(newOptionsPart: Partial<SessionOptions>) {
    const newOptions = { ...sessionOptions, ...newOptionsPart }
    setTargetOptions(newOptions)
  }
  return (
    <SessionOptionsContext.Provider
      value={{
        sessionOptions,
        mutateOptions,
      }}
    >
      {props.children}
    </SessionOptionsContext.Provider>
  )
}

interface UserSelectionState {
  user: TwitterUser | null
  group: SelectUserGroup
}

interface FollowerChainBlockPageStates {
  currentUser: TwitterUser | null
  userSelection: UserSelectionState
  setUserSelection(userSelection: UserSelectionState): void
  targetList: FollowKind
  setTargetList(fk: FollowKind): void
  purpose: FollowerBlockSessionRequest['purpose']
  changePurposeType(purposeType: FollowerBlockSessionRequest['purpose']['type']): void
  mutatePurposeOptions(
    partialOptions: Partial<Omit<FollowerBlockSessionRequest['purpose'], 'type'>>
  ): void
  availablePurposeTypes: FollowerBlockSessionRequest['purpose']['type'][]
}

interface TweetReactionChainBlockPageStates {
  currentTweet: Tweet | null
  wantBlockRetweeters: boolean
  setWantBlockRetweeters(b: boolean): void
  wantBlockLikers: boolean
  setWantBlockLikers(b: boolean): void
  wantBlockMentionedUsers: boolean
  setWantBlockMentionedUsers(b: boolean): void
  purpose: TweetReactionBlockSessionRequest['purpose']
  changePurposeType(purposeType: TweetReactionBlockSessionRequest['purpose']['type']): void
  mutatePurposeOptions(
    partialOptions: Partial<Omit<TweetReactionBlockSessionRequest['purpose'], 'type'>>
  ): void
  availablePurposeTypes: TweetReactionBlockSessionRequest['purpose']['type'][]
}

interface ImportChainBlockPageStates {
  blocklist: Blocklist
  setBlocklist(blocklist: Blocklist): void
  nameOfSelectedFiles: string[]
  setNameOfSelectedFiles(nameOfSelectedFiles: string[]): void
  purpose: ImportBlockSessionRequest['purpose']
  changePurposeType(purposeType: ImportBlockSessionRequest['purpose']['type']): void
  mutatePurposeOptions(
    partialOptions: Partial<Omit<ImportBlockSessionRequest['purpose'], 'type'>>
  ): void
  availablePurposeTypes: ImportBlockSessionRequest['purpose']['type'][]
}

interface UserSearchChainBlockPageStates {
  searchQuery: string | null
  purpose: UserSearchBlockSessionRequest['purpose']
  changePurposeType(purposeType: UserSearchBlockSessionRequest['purpose']['type']): void
  mutatePurposeOptions(
    partialOptions: Partial<Omit<UserSearchBlockSessionRequest['purpose'], 'type'>>
  ): void
  availablePurposeTypes: UserSearchBlockSessionRequest['purpose']['type'][]
}

export const FollowerChainBlockPageStatesContext = React.createContext<FollowerChainBlockPageStates>(
  null!
)
export const TweetReactionChainBlockPageStatesContext = React.createContext<TweetReactionChainBlockPageStates>(
  null!
)
export const ImportChainBlockPageStatesContext = React.createContext<ImportChainBlockPageStates>(
  null!
)
export const UserSearchChainBlockPageStatesContext = React.createContext<UserSearchChainBlockPageStates>(
  null!
)

export function FollowerChainBlockPageStatesProvider(props: {
  children: React.ReactNode
  initialUser: TwitterUser | null
}) {
  const myself = React.useContext(MyselfContext)
  const [userSelection, setUserSelection] = React.useState<UserSelectionState>({
    user: props.initialUser,
    group: 'current',
  })
  const initialPurposeType = determineInitialPurposeType<FollowerBlockSessionRequest['purpose']>(
    myself,
    props.initialUser
  )
  const [targetList, setTargetList] = React.useState<FollowKind>('followers')
  const availablePurposeTypes: FollowerBlockSessionRequest['purpose']['type'][] = [
    'chainblock',
    'unchainblock',
    'export',
    'chainunfollow',
  ]
  const [purpose, changePurposeType, mutatePurposeOptions] = usePurpose<
    FollowerBlockSessionRequest['purpose']
  >(initialPurposeType)
  return (
    <FollowerChainBlockPageStatesContext.Provider
      value={{
        currentUser: props.initialUser,
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
      <SessionOptionsContextProvider>{props.children}</SessionOptionsContextProvider>
    </FollowerChainBlockPageStatesContext.Provider>
  )
}

export function TweetReactionChainBlockPageStatesProvider(props: {
  children: React.ReactNode
  initialTweet: Tweet | null
}) {
  const [wantBlockRetweeters, setWantBlockRetweeters] = React.useState<boolean>(false)
  const [wantBlockLikers, setWantBlockLikers] = React.useState<boolean>(false)
  const [wantBlockMentionedUsers, setWantBlockMentionedUsers] = React.useState<boolean>(false)
  const availablePurposeTypes: TweetReactionBlockSessionRequest['purpose']['type'][] = [
    'chainblock',
    'export',
    'chainunfollow',
  ]
  const [purpose, changePurposeType, mutatePurposeOptions] = usePurpose<
    TweetReactionBlockSessionRequest['purpose']
  >('chainblock')
  return (
    <TweetReactionChainBlockPageStatesContext.Provider
      value={{
        currentTweet: props.initialTweet,
        wantBlockRetweeters,
        setWantBlockRetweeters,
        wantBlockLikers,
        setWantBlockLikers,
        wantBlockMentionedUsers,
        setWantBlockMentionedUsers,
        purpose,
        changePurposeType,
        mutatePurposeOptions,
        availablePurposeTypes,
      }}
    >
      <SessionOptionsContextProvider>{props.children}</SessionOptionsContextProvider>
    </TweetReactionChainBlockPageStatesContext.Provider>
  )
}

export function ImportChainBlockPageStatesProvider(props: { children: React.ReactNode }) {
  const [blocklist, setBlocklist] = React.useState<Blocklist>(emptyBlocklist)
  const [nameOfSelectedFiles, setNameOfSelectedFiles] = React.useState<string[]>([])
  const availablePurposeTypes: ImportBlockSessionRequest['purpose']['type'][] = [
    'chainblock',
    'unchainblock',
    'chainunfollow',
  ]
  const [purpose, changePurposeType, mutatePurposeOptions] = usePurpose<
    ImportBlockSessionRequest['purpose']
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
      <SessionOptionsContextProvider>{props.children}</SessionOptionsContextProvider>
    </ImportChainBlockPageStatesContext.Provider>
  )
}

export function UserSearchChainBlockPageStatesProvider(props: {
  children: React.ReactNode
  currentSearchQuery: string | null
}) {
  const availablePurposeTypes: UserSearchBlockSessionRequest['purpose']['type'][] = [
    'chainblock',
    'unchainblock',
    'chainunfollow',
  ]
  const [purpose, changePurposeType, mutatePurposeOptions] = usePurpose<
    UserSearchBlockSessionRequest['purpose']
  >('chainblock')
  return (
    <UserSearchChainBlockPageStatesContext.Provider
      value={{
        searchQuery: props.currentSearchQuery,
        purpose,
        changePurposeType,
        mutatePurposeOptions,
        availablePurposeTypes,
      }}
    >
      <SessionOptionsContextProvider>{props.children}</SessionOptionsContextProvider>
    </UserSearchChainBlockPageStatesContext.Provider>
  )
}
