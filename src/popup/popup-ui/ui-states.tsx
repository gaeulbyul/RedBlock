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

export type SelectUserGroup = 'invalid' | 'current' | 'saved' | 'other tab'

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

type ExtraTarget = SessionRequest['extraTarget']

interface ExtraTargetContextType {
  extraTarget: ExtraTarget
  mutate(partialOptions: Partial<ExtraTarget>): void
}

export const ExtraTargetContext = React.createContext<ExtraTargetContextType>(null!)

function ExtraTargetContextProvider(props: { children: React.ReactNode }) {
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
      {props.children}
    </ExtraTargetContext.Provider>
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
  wantBlockQuotedUsers: boolean
  setWantBlockQuotedUsers(b: boolean): void
  wantBlockNonLinkedMentions: boolean
  setWantBlockNonLinkedMentions(b: boolean): void
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

interface LockPickerPageStates {
  purpose: LockPickerSessionRequest['purpose']
  changePurposeType(__: any): void // <- 실제론 안 씀
  mutatePurposeOptions(
    partialOptions: Partial<Omit<LockPickerSessionRequest['purpose'], 'type'>>
  ): void
  availablePurposeTypes: LockPickerSessionRequest['purpose']['type'][]
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
export const LockPickerPageStatesContext = React.createContext<LockPickerPageStates>(null!)

const examineResultCache = new Map<string, Actor>()

export function FollowerChainBlockPageStatesProvider(props: {
  children: React.ReactNode
  initialUser: TwitterUser | null
}) {
  const myself = React.useContext(MyselfContext)!
  const [userSelection, setUserSelection] = React.useState<UserSelectionState>({
    user: props.initialUser,
    group: props.initialUser ? 'current' : 'invalid',
  })
  const initialPurposeType = determineInitialPurposeType<FollowerBlockSessionRequest['purpose']>(
    myself.user,
    props.initialUser
  )
  const [targetList, setTargetList] = React.useState<FollowKind>('followers')
  const availablePurposeTypes: FollowerBlockSessionRequest['purpose']['type'][] = [
    'chainblock',
    'unchainblock',
    'chainmute',
    'unchainmute',
    'chainunfollow',
    'export',
  ]
  const [purpose, changePurposeType, mutatePurposeOptions] = usePurpose<
    FollowerBlockSessionRequest['purpose']
  >(initialPurposeType)
  const { enableAntiBlock } = React.useContext(RedBlockOptionsContext)
  const [retriever, setRetriever] = React.useState(myself)
  React.useEffect(() => {
    async function examine(selectedUser: TwitterUser) {
      const key = `user-${selectedUser.id_str}`
      const cached = examineResultCache.get(key)
      if (cached) {
        setRetriever(cached)
      } else {
        const newRetriever = await examineRetrieverByTargetUser(myself, selectedUser).then(
          result => result || myself
        )
        examineResultCache.set(key, newRetriever)
        setRetriever(newRetriever)
      }
    }
    const selectedUser = userSelection.user
    if (enableAntiBlock && selectedUser) {
      examine(selectedUser)
    } else {
      setRetriever(myself)
    }
  }, [userSelection.user, enableAntiBlock])
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
      <RetrieverContext.Provider value={{ retriever, setRetriever }}>
        <ExtraTargetContextProvider>{props.children}</ExtraTargetContextProvider>
      </RetrieverContext.Provider>
    </FollowerChainBlockPageStatesContext.Provider>
  )
}

export function TweetReactionChainBlockPageStatesProvider(props: {
  children: React.ReactNode
  initialTweet: Tweet | null
}) {
  const [wantBlockRetweeters, setWantBlockRetweeters] = React.useState(false)
  const [wantBlockLikers, setWantBlockLikers] = React.useState(false)
  const [wantBlockMentionedUsers, setWantBlockMentionedUsers] = React.useState(false)
  const [wantBlockQuotedUsers, setWantBlockQuotedUsers] = React.useState(false)
  const [wantBlockNonLinkedMentions, setWantBlockNonLinkedMentions] = React.useState(false)
  const availablePurposeTypes: TweetReactionBlockSessionRequest['purpose']['type'][] = [
    'chainblock',
    'chainmute',
    'unchainmute',
    'chainunfollow',
    'export',
  ]
  const [purpose, changePurposeType, mutatePurposeOptions] = usePurpose<
    TweetReactionBlockSessionRequest['purpose']
  >('chainblock')
  const selectedTweet = props.initialTweet // TODO: make it state
  const myself = React.useContext(MyselfContext)!
  const { enableAntiBlock } = React.useContext(RedBlockOptionsContext)
  const [retriever, setRetriever] = React.useState<Actor>(myself)
  React.useEffect(() => {
    async function examine(tweetId: string) {
      const key = `tweet-${tweetId}`
      const cached = examineResultCache.get(key)
      if (cached) {
        setRetriever(cached)
      } else {
        const newRetriever = await examineRetrieverByTweetId(myself, tweetId).then(
          result => result || myself
        )
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
        currentTweet: props.initialTweet,
        wantBlockRetweeters,
        setWantBlockRetweeters,
        wantBlockLikers,
        setWantBlockLikers,
        wantBlockMentionedUsers,
        setWantBlockMentionedUsers,
        wantBlockQuotedUsers,
        setWantBlockQuotedUsers,
        wantBlockNonLinkedMentions,
        setWantBlockNonLinkedMentions,
        purpose,
        changePurposeType,
        mutatePurposeOptions,
        availablePurposeTypes,
      }}
    >
      <RetrieverContext.Provider value={{ retriever, setRetriever }}>
        <ExtraTargetContextProvider>{props.children}</ExtraTargetContextProvider>
      </RetrieverContext.Provider>
    </TweetReactionChainBlockPageStatesContext.Provider>
  )
}

export function ImportChainBlockPageStatesProvider(props: { children: React.ReactNode }) {
  const [blocklist, setBlocklist] = React.useState<Blocklist>(emptyBlocklist)
  const [nameOfSelectedFiles, setNameOfSelectedFiles] = React.useState<string[]>([])
  const availablePurposeTypes: ImportBlockSessionRequest['purpose']['type'][] = [
    'chainblock',
    'unchainblock',
    'chainmute',
    'unchainmute',
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
      <ExtraTargetContextProvider>{props.children}</ExtraTargetContextProvider>
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
    'chainmute',
    'unchainmute',
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
      <ExtraTargetContextProvider>{props.children}</ExtraTargetContextProvider>
    </UserSearchChainBlockPageStatesContext.Provider>
  )
}

export function LockPickerPageStatesProvider(props: { children: React.ReactNode }) {
  const [purpose, changePurposeType, mutatePurposeOptions] = usePurpose<
    LockPickerSessionRequest['purpose']
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
      <ExtraTargetContextProvider>{props.children}</ExtraTargetContextProvider>
    </LockPickerPageStatesContext.Provider>
  )
}
