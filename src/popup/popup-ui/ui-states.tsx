import { Blocklist, emptyBlocklist } from '../../scripts/background/blocklist-process.js'
import { determineInitialPurpose } from '../popup.js'
import { MyselfContext } from './contexts.js'

// TODO: ���ǿɼ��� �⺻���� session.ts ���� import�ؼ�����?

export type SelectUserGroup = 'invalid' | 'current' | 'saved' | 'self'

interface PurposeContextType {
  purpose: Purpose
  setPurpose(purpose: Purpose): void
  availablePurposes: Purpose[]
}

export const PurposeContext = React.createContext<PurposeContextType>({
  purpose: 'chainblock',
  setPurpose() {},
  availablePurposes: ['chainblock'],
})

function PurposeContextProvider(props: {
  children: React.ReactNode
  initialPurpose: Purpose
  availablePurposes: Array<Purpose>
}) {
  const { children, initialPurpose, availablePurposes } = props
  const [purpose, setPurpose] = React.useState(initialPurpose)
  if (!availablePurposes.includes(purpose)) {
    throw new Error(`invalid purpose: "${purpose}" is not in [${availablePurposes}]`)
  }
  function setPurposeWithCheck(newPurpose: Purpose) {
    if (availablePurposes.includes(newPurpose)) {
      setPurpose(newPurpose)
    }
  }
  return (
    <PurposeContext.Provider
      value={{
        purpose,
        setPurpose: setPurposeWithCheck,
        availablePurposes,
      }}
    >
      {children}
    </PurposeContext.Provider>
  )
}

interface SessionOptionsContextType {
  targetOptions: SessionOptions
  mutateOptions(partialOptions: Partial<SessionOptions>): void
}

export const SessionOptionsContext = React.createContext<SessionOptionsContextType>({
  targetOptions: {
    myFollowers: 'Skip',
    myFollowings: 'Skip',
    mutualBlocked: 'Skip',
    includeUsersInBio: 'never',
  },
  mutateOptions() {},
})

function SessionOptionsContextProvider(props: { children: React.ReactNode }) {
  const [targetOptions, setTargetOptions] = React.useState<SessionOptions>({
    myFollowers: 'Skip',
    myFollowings: 'Skip',
    mutualBlocked: 'Skip',
    includeUsersInBio: 'never',
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

interface FollowerChainBlockPageStates {
  currentUser: TwitterUser | null
  selectedUserGroup: SelectUserGroup
  setSelectedUserGroup(group: SelectUserGroup): void
  selectedUser: TwitterUser | null
  setSelectedUser(maybeUser: TwitterUser | null): void
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

export const FollowerChainBlockPageStatesContext = React.createContext<
  FollowerChainBlockPageStates
>({
  currentUser: null,
  selectedUserGroup: 'current',
  setSelectedUserGroup() {},
  selectedUser: null,
  setSelectedUser() {},
  targetList: 'followers',
  setTargetList() {},
})

export const TweetReactionChainBlockPageStatesContext = React.createContext<
  TweetReactionChainBlockPageStates
>({
  currentTweet: null,
  wantBlockRetweeters: false,
  setWantBlockRetweeters() {},
  wantBlockLikers: false,
  setWantBlockLikers() {},
  wantBlockMentionedUsers: false,
  setWantBlockMentionedUsers() {},
})

export const ImportChainBlockPageStatesContext = React.createContext<ImportChainBlockPageStates>({
  blocklist: Object.assign({}, emptyBlocklist),
  setBlocklist() {},
  nameOfSelectedFiles: [],
  setNameOfSelectedFiles() {},
})

export const UserSearchChainBlockPageStatesContext = React.createContext<
  UserSearchChainBlockPageStates
>({
  searchQuery: null,
})

export function FollowerChainBlockPageStatesProvider(props: {
  children: React.ReactNode
  initialUser: TwitterUser | null
}) {
  const myself = React.useContext(MyselfContext)
  const initialPurpose = determineInitialPurpose(myself, props.initialUser)
  const [selectedUserGroup, setSelectedUserGroup] = React.useState<SelectUserGroup>('current')
  const [selectedUser, setSelectedUser] = React.useState<TwitterUser | null>(props.initialUser)
  const [targetList, setTargetList] = React.useState<FollowKind>('followers')
  const availablePurposes: FollowerBlockSessionRequest['purpose'][] = []
  if (initialPurpose === 'lockpicker') {
    availablePurposes.push('lockpicker')
  } else {
    availablePurposes.push('chainblock', 'unchainblock', 'export')
  }
  return (
    <FollowerChainBlockPageStatesContext.Provider
      value={{
        currentUser: props.initialUser,
        selectedUserGroup,
        setSelectedUserGroup,
        selectedUser,
        setSelectedUser,
        targetList,
        setTargetList,
      }}
    >
      <PurposeContextProvider initialPurpose={initialPurpose} availablePurposes={availablePurposes}>
        <SessionOptionsContextProvider>{props.children}</SessionOptionsContextProvider>
      </PurposeContextProvider>
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
      <PurposeContextProvider initialPurpose="chainblock" availablePurposes={availablePurposes}>
        <SessionOptionsContextProvider>{props.children}</SessionOptionsContextProvider>
      </PurposeContextProvider>
    </TweetReactionChainBlockPageStatesContext.Provider>
  )
}

export function ImportChainBlockPageStatesProvider(props: { children: React.ReactNode }) {
  const [blocklist, setBlocklist] = React.useState<Blocklist>(emptyBlocklist)
  const [nameOfSelectedFiles, setNameOfSelectedFiles] = React.useState<string[]>([])
  const availablePurposes: ImportBlockSessionRequest['purpose'][] = ['chainblock', 'unchainblock']
  return (
    <ImportChainBlockPageStatesContext.Provider
      value={{
        blocklist,
        setBlocklist,
        nameOfSelectedFiles,
        setNameOfSelectedFiles,
      }}
    >
      <PurposeContextProvider initialPurpose="chainblock" availablePurposes={availablePurposes}>
        <SessionOptionsContextProvider>{props.children}</SessionOptionsContextProvider>
      </PurposeContextProvider>
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
  return (
    <UserSearchChainBlockPageStatesContext.Provider
      value={{
        searchQuery: props.currentSearchQuery,
      }}
    >
      <PurposeContextProvider initialPurpose="chainblock" availablePurposes={availablePurposes}>
        <SessionOptionsContextProvider>{props.children}</SessionOptionsContextProvider>
      </PurposeContextProvider>
    </UserSearchChainBlockPageStatesContext.Provider>
  )
}
