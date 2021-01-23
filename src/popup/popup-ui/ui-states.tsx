import { defaultSessionOptions } from '../../scripts/background/chainblock-session/session.js'
import { Blocklist, emptyBlocklist } from '../../scripts/background/blocklist-process.js'
import { determineInitialPurpose } from '../popup.js'
import { RedBlockOptionsContext, MyselfContext } from './contexts.js'

export type SelectUserGroup = 'invalid' | 'current' | 'saved' | 'self'

function checkPurpose(
  availablePurposes: Purpose[],
  purpose: Purpose,
  callback: (p: Purpose) => void
) {
  if (availablePurposes.includes(purpose)) {
    callback(purpose)
  } else {
    const fallbackPurpose = availablePurposes[0]
    console.warn('warning: invalid purpose "%s", falling back to "%s"', purpose, fallbackPurpose)
    callback(fallbackPurpose)
  }
}

function usePurpose(availablePurposes: Purpose[], initialPurpose: Purpose) {
  const [purpose, setPurpose] = React.useState(initialPurpose)
  function setPurposeWithCheck(p: Purpose) {
    checkPurpose(availablePurposes, p, setPurpose)
  }
  return [purpose, setPurposeWithCheck] as const
}

interface PurposeContextType {
  purpose: Purpose
  setPurpose(purpose: Purpose): void
  availablePurposes: Purpose[]
}

export const PurposeContext = React.createContext<PurposeContextType>(null!)

interface SessionOptionsContextType {
  targetOptions: SessionOptions
  mutateOptions(partialOptions: Partial<SessionOptions>): void
}

export const SessionOptionsContext = React.createContext<SessionOptionsContextType>(null!)

function SessionOptionsContextProvider(props: { children: React.ReactNode }) {
  const { skipInactiveUser } = React.useContext(RedBlockOptionsContext)
  const [targetOptions, setTargetOptions] = React.useState<SessionOptions>({
    ...defaultSessionOptions,
    skipInactiveUser,
  })
  function mutateOptions(newOptionsPart: Partial<SessionOptions>) {
    const newOptions = { ...targetOptions, ...newOptionsPart }
    setTargetOptions(newOptions)
  }
  return (
    <SessionOptionsContext.Provider
      value={{
        targetOptions,
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
  purpose: Purpose
}

interface FollowerChainBlockPageStates {
  currentUser: TwitterUser | null
  userSelectionState: UserSelectionState
  setUserSelectionState(userSelectionState: UserSelectionState): void
  targetList: FollowKind
  setTargetList(fk: FollowKind): void
}

interface TweetReactionChainBlockPageStates {
  currentTweet: Tweet | null
  wantBlockRetweeters: boolean
  setWantBlockRetweeters(b: boolean): void
  wantBlockLikers: boolean
  setWantBlockLikers(b: boolean): void
  wantBlockMentionedUsers: boolean
  setWantBlockMentionedUsers(b: boolean): void
}

interface ImportChainBlockPageStates {
  blocklist: Blocklist
  setBlocklist(blocklist: Blocklist): void
  nameOfSelectedFiles: string[]
  setNameOfSelectedFiles(nameOfSelectedFiles: string[]): void
}

interface UserSearchChainBlockPageStates {
  searchQuery: string | null
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
  const { initialUser } = props
  const myself = React.useContext(MyselfContext)
  const initialPurpose = determineInitialPurpose(myself, initialUser)
  const [userSelectionState, setUserSelectionState] = React.useState<UserSelectionState>({
    user: initialUser,
    group: 'current',
    purpose: initialPurpose,
  })
  const [targetList, setTargetList] = React.useState<FollowKind>('followers')
  const availablePurposes: FollowerBlockSessionRequest['purpose'][] = []
  if (userSelectionState.purpose === 'lockpicker') {
    availablePurposes.push('lockpicker')
  } else {
    availablePurposes.push('chainblock', 'unchainblock', 'export')
  }
  const { purpose } = userSelectionState
  function setPurpose(p: Purpose) {
    checkPurpose(availablePurposes, p, purpose =>
      setUserSelectionState({ ...userSelectionState, purpose })
    )
  }
  return (
    <FollowerChainBlockPageStatesContext.Provider
      value={{
        currentUser: props.initialUser,
        userSelectionState,
        setUserSelectionState,
        targetList,
        setTargetList,
      }}
    >
      <PurposeContext.Provider value={{ purpose, setPurpose, availablePurposes }}>
        <SessionOptionsContextProvider>{props.children}</SessionOptionsContextProvider>
      </PurposeContext.Provider>
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
  const availablePurposes: TweetReactionBlockSessionRequest['purpose'][] = ['chainblock', 'export']
  const [purpose, setPurpose] = usePurpose(availablePurposes, 'chainblock')
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
      }}
    >
      <PurposeContext.Provider value={{ purpose, setPurpose, availablePurposes }}>
        <SessionOptionsContextProvider>{props.children}</SessionOptionsContextProvider>
      </PurposeContext.Provider>
    </TweetReactionChainBlockPageStatesContext.Provider>
  )
}

export function ImportChainBlockPageStatesProvider(props: { children: React.ReactNode }) {
  const [blocklist, setBlocklist] = React.useState<Blocklist>(emptyBlocklist)
  const [nameOfSelectedFiles, setNameOfSelectedFiles] = React.useState<string[]>([])
  const availablePurposes: ImportBlockSessionRequest['purpose'][] = ['chainblock', 'unchainblock']
  const [purpose, setPurpose] = usePurpose(availablePurposes, 'chainblock')
  return (
    <ImportChainBlockPageStatesContext.Provider
      value={{
        blocklist,
        setBlocklist,
        nameOfSelectedFiles,
        setNameOfSelectedFiles,
      }}
    >
      <PurposeContext.Provider value={{ purpose, setPurpose, availablePurposes }}>
        <SessionOptionsContextProvider>{props.children}</SessionOptionsContextProvider>
      </PurposeContext.Provider>
    </ImportChainBlockPageStatesContext.Provider>
  )
}

export function UserSearchChainBlockPageStatesProvider(props: {
  children: React.ReactNode
  currentSearchQuery: string | null
}) {
  const availablePurposes: UserSearchBlockSessionRequest['purpose'][] = [
    'chainblock',
    'unchainblock',
  ]
  const [purpose, setPurpose] = usePurpose(availablePurposes, 'chainblock')
  return (
    <UserSearchChainBlockPageStatesContext.Provider
      value={{
        searchQuery: props.currentSearchQuery,
      }}
    >
      <PurposeContext.Provider value={{ purpose, setPurpose, availablePurposes }}>
        <SessionOptionsContextProvider>{props.children}</SessionOptionsContextProvider>
      </PurposeContext.Provider>
    </UserSearchChainBlockPageStatesContext.Provider>
  )
}
