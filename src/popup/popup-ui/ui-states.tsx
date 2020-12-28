import { Blocklist, emptyBlocklist } from '../../scripts/background/blocklist-process.js'
import { determineInitialPurpose } from './ui-common.js'
import { MyselfContext } from './contexts.js'

export type SelectUserGroup = 'invalid' | 'current' | 'saved' | 'self'

interface FollowerChainBlockPageStates {
  currentUser: TwitterUser | null
  selectedUserGroup: SelectUserGroup
  setSelectedUserGroup(group: SelectUserGroup): void
  selectedUser: TwitterUser | null
  setSelectedUser(maybeUser: TwitterUser | null): void
  targetList: FollowKind
  setTargetList(fk: FollowKind): void
  targetOptions: FollowerBlockSessionRequest['options']
  setTargetOptions(options: FollowerBlockSessionRequest['options']): void
  mutateOptions(optionsPart: Partial<FollowerBlockSessionRequest['options']>): void
  purpose: Purpose
  setPurpose(ck: Purpose): void
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
  setPurpose(purpose: TweetReactionBlockSessionRequest['purpose']): void
  targetOptions: TweetReactionBlockSessionRequest['options']
  setTargetOptions(options: TweetReactionBlockSessionRequest['options']): void
  mutateOptions(optionsPart: Partial<TweetReactionBlockSessionRequest['options']>): void
}

interface ImportChainBlockPageStates {
  targetOptions: ImportBlockSessionRequest['options']
  setTargetOptions(options: ImportBlockSessionRequest['options']): void
  mutateOptions(optionsPart: Partial<ImportBlockSessionRequest['options']>): void
  blocklist: Blocklist
  setBlocklist(blocklist: Blocklist): void
  nameOfSelectedFiles: string[]
  setNameOfSelectedFiles(nameOfSelectedFiles: string[]): void
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
  targetOptions: {
    myFollowers: 'Skip',
    myFollowings: 'Skip',
    mutualBlocked: 'Skip',
    includeUsersInBio: 'never',
  },
  setTargetOptions() {},
  mutateOptions() {},
  purpose: 'chainblock',
  setPurpose() {},
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
  purpose: 'chainblock',
  setPurpose() {},
  targetOptions: {
    myFollowers: 'Skip',
    myFollowings: 'Skip',
    includeUsersInBio: 'never',
  },
  setTargetOptions() {},
  mutateOptions() {},
})

export const ImportChainBlockPageStatesContext = React.createContext<ImportChainBlockPageStates>({
  targetOptions: {
    myFollowers: 'Skip',
    myFollowings: 'Skip',
    includeUsersInBio: 'never',
  },
  setTargetOptions() {},
  mutateOptions() {},
  blocklist: Object.assign({}, emptyBlocklist),
  setBlocklist() {},
  nameOfSelectedFiles: [],
  setNameOfSelectedFiles() {},
})

export function FollowerChainBlockPageStatesProvider(props: {
  children: React.ReactNode
  initialUser: TwitterUser | null
}) {
  const [targetOptions, setTargetOptions] = React.useState<FollowerBlockSessionRequest['options']>({
    myFollowers: 'Skip',
    myFollowings: 'Skip',
    mutualBlocked: 'Skip',
    includeUsersInBio: 'never',
  })
  const myself = React.useContext(MyselfContext)
  const [selectedUserGroup, setSelectedUserGroup] = React.useState<SelectUserGroup>('current')
  const [selectedUser, setSelectedUser] = React.useState<TwitterUser | null>(props.initialUser)
  const [targetList, setTargetList] = React.useState<FollowKind>('followers')
  const initialPurpose = determineInitialPurpose(myself, selectedUser)
  const [purpose, setPurpose] = React.useState<Purpose>(initialPurpose)
  function mutateOptions(newOptionsPart: Partial<FollowerBlockSessionRequest['options']>) {
    const newOptions = { ...targetOptions, ...newOptionsPart }
    setTargetOptions(newOptions)
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
        purpose,
        setPurpose,
        targetOptions,
        setTargetOptions,
        mutateOptions,
      }}
    >
      {props.children}
    </FollowerChainBlockPageStatesContext.Provider>
  )
}

export function TweetReactionChainBlockPageStatesProvider(props: {
  children: React.ReactNode
  initialTweet: Tweet | null
}) {
  const [targetOptions, setTargetOptions] = React.useState<
    TweetReactionBlockSessionRequest['options']
  >({
    myFollowers: 'Skip',
    myFollowings: 'Skip',
    includeUsersInBio: 'never',
  })
  const [wantBlockRetweeters, setWantBlockRetweeters] = React.useState<boolean>(false)
  const [wantBlockLikers, setWantBlockLikers] = React.useState<boolean>(false)
  const [wantBlockMentionedUsers, setWantBlockMentionedUsers] = React.useState<boolean>(false)
  const [purpose, setPurpose] = React.useState<TweetReactionBlockSessionRequest['purpose']>(
    'chainblock'
  )
  function mutateOptions(newOptionsPart: Partial<TweetReactionBlockSessionRequest['options']>) {
    const newOptions = { ...targetOptions, ...newOptionsPart }
    setTargetOptions(newOptions)
  }
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
        setPurpose,
        targetOptions,
        setTargetOptions,
        mutateOptions,
      }}
    >
      {props.children}
    </TweetReactionChainBlockPageStatesContext.Provider>
  )
}

export function ImportChainBlockPageStatesProvider(props: { children: React.ReactNode }) {
  const [blocklist, setBlocklist] = React.useState<Blocklist>(emptyBlocklist)
  const [nameOfSelectedFiles, setNameOfSelectedFiles] = React.useState<string[]>([])
  const [targetOptions, setTargetOptions] = React.useState<ImportBlockSessionRequest['options']>({
    myFollowers: 'Skip',
    myFollowings: 'Skip',
    includeUsersInBio: 'never',
  })
  function mutateOptions(newOptionsPart: Partial<ImportBlockSessionRequest['options']>) {
    const newOptions = { ...targetOptions, ...newOptionsPart }
    setTargetOptions(newOptions)
  }
  return (
    <ImportChainBlockPageStatesContext.Provider
      value={{
        targetOptions,
        setTargetOptions,
        mutateOptions,
        blocklist,
        setBlocklist,
        nameOfSelectedFiles,
        setNameOfSelectedFiles,
      }}
    >
      {props.children}
    </ImportChainBlockPageStatesContext.Provider>
  )
}
