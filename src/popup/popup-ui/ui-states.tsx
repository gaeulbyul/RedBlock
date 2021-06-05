import {
  defaultPurposeOptions,
  defaultExtraTarget,
} from '../../scripts/background/chainblock-session/default-options.js'
import { Blocklist, emptyBlocklist } from '../../scripts/background/blocklist-process.js'
import { determineInitialPurposeType } from '../popup.js'
import { MyselfContext, RetrieverContext, RedBlockOptionsContext } from './contexts.js'
import {
  examineRetrieverByTargetUser,
  examineRetrieverByTweetId,
} from '../../scripts/background/antiblock.js'
import type { TargetGroup } from './components/target-selector.js'

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

type ExtraTarget = SessionRequest<AnySessionTarget>['extraTarget']
type IncludedAudioSpaceParticipants = 'hosts_and_speakers' | 'all_participants'

interface ExtraTargetContextType {
  extraTarget: ExtraTarget
  mutate(partialOptions: Partial<ExtraTarget>): void
}

export const ExtraTargetContext = React.createContext<ExtraTargetContextType>(null!)

function ExtraTargetContextProvider({ children }: { children: React.ReactNode }) {
  const [extraTarget, setTargetOptions] = React.useState<ExtraTarget>({
    ...defaultExtraTarget,
  })
  function mutate(newOptionsPart: Partial<ExtraTarget>) {
    const newOptions = { ...extraTarget, ...newOptionsPart }
    setTargetOptions(newOptions)
  }
  return (
    <ExtraTargetContext.Provider
      value={{
        extraTarget,
        mutate,
      }}
    >
      {children}
    </ExtraTargetContext.Provider>
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
    partialOptions: Partial<Omit<SessionRequest<FollowerSessionTarget>['purpose'], 'type'>>
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
  purpose: SessionRequest<TweetReactionSessionTarget>['purpose']
  changePurposeType(
    purposeType: SessionRequest<TweetReactionSessionTarget>['purpose']['type']
  ): void
  mutatePurposeOptions(
    partialOptions: Partial<Omit<SessionRequest<TweetReactionSessionTarget>['purpose'], 'type'>>
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
    partialOptions: Partial<Omit<SessionRequest<ImportSessionTarget>['purpose'], 'type'>>
  ): void
  availablePurposeTypes: SessionRequest<ImportSessionTarget>['purpose']['type'][]
}

interface UserSearchChainBlockPageStates {
  searchQuery: string | null
  purpose: SessionRequest<UserSearchSessionTarget>['purpose']
  changePurposeType(purposeType: SessionRequest<UserSearchSessionTarget>['purpose']['type']): void
  mutatePurposeOptions(
    partialOptions: Partial<Omit<SessionRequest<UserSearchSessionTarget>['purpose'], 'type'>>
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
    partialOptions: Partial<Omit<SessionRequest<AudioSpaceSessionTarget>['purpose'], 'type'>>
  ): void
  availablePurposeTypes: SessionRequest<AudioSpaceSessionTarget>['purpose']['type'][]
}

interface LockPickerPageStates {
  purpose: SessionRequest<LockPickerSessionTarget>['purpose']
  changePurposeType(__: any): void // <- 실제론 안 씀
  mutatePurposeOptions(
    partialOptions: Partial<Omit<SessionRequest<LockPickerSessionTarget>['purpose'], 'type'>>
  ): void
  availablePurposeTypes: SessionRequest<LockPickerSessionTarget>['purpose']['type'][]
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
export const AudioSpaceChainBlockPageStatesContext = React.createContext<AudioSpaceChainBlockPageStates>(
  null!
)
export const LockPickerPageStatesContext = React.createContext<LockPickerPageStates>(null!)

const examineResultCache = new Map<string, Actor | null>()

export function FollowerChainBlockPageStatesProvider({
  children,
  initialUser,
}: {
  children: React.ReactNode
  initialUser: TwitterUser | null
}) {
  const myself = React.useContext(MyselfContext)!
  let initialSelectionState: UserSelectionState | null
  if (initialUser) {
    initialSelectionState = {
      user: initialUser,
      group: 'current',
    }
  } else {
    initialSelectionState = null
  }
  const [userSelection, setUserSelection] = React.useState(initialSelectionState)
  const initialPurposeType = determineInitialPurposeType<
    SessionRequest<FollowerSessionTarget>['purpose']
  >(myself.user, initialUser)
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
  const { enableAntiBlock } = React.useContext(RedBlockOptionsContext)
  const [retriever, setRetriever] = React.useState<Actor | null>(myself)
  React.useEffect(() => {
    async function examine(selectedUser: TwitterUser) {
      const key = `user-${selectedUser.id_str}`
      if (examineResultCache.has(key)) {
        setRetriever(examineResultCache.get(key)!)
      } else {
        const newRetriever = await examineRetrieverByTargetUser(myself, selectedUser)
        examineResultCache.set(key, newRetriever)
        setRetriever(newRetriever)
      }
    }
    const selectedUser = userSelection?.user
    if (enableAntiBlock && selectedUser) {
      examine(selectedUser)
    } else {
      setRetriever(myself)
    }
  }, [userSelection, enableAntiBlock])
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
        <ExtraTargetContextProvider>{children}</ExtraTargetContextProvider>
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
  const availablePurposeTypes: SessionRequest<TweetReactionSessionTarget>['purpose']['type'][] = [
    'chainblock',
    'chainmute',
    'unchainmute',
    'chainunfollow',
    'export',
  ]
  const [purpose, changePurposeType, mutatePurposeOptions] = usePurpose<
    SessionRequest<TweetReactionSessionTarget>['purpose']
  >('chainblock')
  const selectedTweet = initialTweet // TODO: make it state
  const myself = React.useContext(MyselfContext)!
  const { enableAntiBlock } = React.useContext(RedBlockOptionsContext)
  const [retriever, setRetriever] = React.useState<Actor | null>(myself)
  React.useEffect(() => {
    async function examine(tweetId: string) {
      const key = `tweet-${tweetId}`
      if (examineResultCache.has(key)) {
        setRetriever(examineResultCache.get(key)!)
      } else {
        const newRetriever = await examineRetrieverByTweetId(myself, tweetId)
        examineResultCache.set(key, newRetriever)
        setRetriever(newRetriever)
      }
    }
    const selectedTweetId = selectedTweet?.id_str
    if (enableAntiBlock && selectedTweetId) {
      examine(selectedTweetId)
    } else {
      setRetriever(myself)
    }
  }, [selectedTweet, enableAntiBlock])
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
        purpose,
        changePurposeType,
        mutatePurposeOptions,
        availablePurposeTypes,
      }}
    >
      <RetrieverContext.Provider value={{ retriever, setRetriever }}>
        <ExtraTargetContextProvider>{children}</ExtraTargetContextProvider>
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
      <ExtraTargetContextProvider>{children}</ExtraTargetContextProvider>
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
      <ExtraTargetContextProvider>{children}</ExtraTargetContextProvider>
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
      <ExtraTargetContextProvider>{children}</ExtraTargetContextProvider>
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
      <ExtraTargetContextProvider>{children}</ExtraTargetContextProvider>
    </LockPickerPageStatesContext.Provider>
  )
}
