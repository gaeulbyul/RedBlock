import { CSSProperties } from 'react'
import * as Storage from '../../scripts/background/storage.js'
import * as TwitterAPI from '../../scripts/background/twitter-api.js'
import { TwitterUser } from '../../scripts/background/twitter-api.js'
import { formatNumber, TwitterUserMap } from '../../scripts/common.js'
import * as TextGenerate from '../../scripts/text-generate.js'
import { insertUserToStorage, removeUserFromStorage, startFollowerChainBlock } from '../popup.js'
import { ModalContext } from './modal-context.js'

type SessionOptions = FollowerBlockSessionRequest['options']
type SelectUserGroup = 'invalid' | 'current' | 'saved'

const SelectedUserContext = React.createContext<TwitterUser | null>(null)

function TargetSavedUsers(props: {
  currentUser: TwitterUser | null
  selectedUserGroup: SelectUserGroup
  savedUsers: TwitterUserMap
  changeUser: (userName: string, group: SelectUserGroup) => Promise<void>
}) {
  const { currentUser, selectedUserGroup, savedUsers, changeUser } = props
  const selectedUser = React.useContext(SelectedUserContext)
  async function insertUser() {
    if (selectedUser) {
      return insertUserToStorage(selectedUser)
    }
  }
  async function removeUser() {
    if (selectedUser) {
      return removeUserFromStorage(selectedUser)
    }
  }
  const currentUserOption = ({ screen_name, name }: TwitterUser) => (
    <optgroup label="현재 유저">
      <option value={`current/${screen_name}`} data-group="current" data-username={screen_name}>
        @{screen_name} &lt;{name}&gt;
      </option>
    </optgroup>
  )
  const sortedByName = (usersMap: TwitterUserMap): TwitterUser[] =>
    _.sortBy(usersMap.toUserArray(), user => user.screen_name.toLowerCase())
  const selectUserFromOption = (elem: EventTarget & HTMLSelectElement) => {
    const selectedOption = elem.selectedOptions[0]
    const group = selectedOption.getAttribute('data-group') as SelectUserGroup
    const userName = selectedOption.getAttribute('data-username')!
    changeUser(userName, group)
  }
  return (
    <div className="chainblock-saved-target">
      <select
        className="chainblock-saved-select"
        value={selectedUser ? `${selectedUserGroup}/${selectedUser.screen_name}` : 'invalid/???'}
        onChange={({ target }) => selectUserFromOption(target)}
      >
        <option value="invalid/???" data-group="invalid" data-username="???">
          체인블락을 실행할 사용자를 선택해주세요.
        </option>
        {currentUser && currentUserOption(currentUser)}
        <optgroup label="저장한 유저">
          {sortedByName(savedUsers).map(({ screen_name, name }, index) => (
            <option key={index} value={'saved/' + screen_name} data-group="saved" data-username={screen_name}>
              @{screen_name} &lt;{name}&gt;
            </option>
          ))}
        </optgroup>
      </select>
      {selectedUser && (
        <div className="controls">
          <button type="button" onClick={insertUser}>
            추가
          </button>
          <button type="button" onClick={removeUser}>
            제거
          </button>
        </div>
      )}
    </div>
  )
}

function TargetUserProfile(props: {
  isAvailable: boolean
  targetList: FollowKind
  options: FollowerBlockSessionRequest['options']
  setTargetList: (fk: FollowKind) => void
  mutateOptions: (part: Partial<SessionOptions>) => void
}) {
  const user = React.useContext(SelectedUserContext)!
  const { isAvailable, targetList, options, setTargetList, mutateOptions } = props
  const { quickMode } = options
  const biggerProfileImageUrl = user.profile_image_url_https.replace('_normal', '_bigger')
  return (
    <div className="target-user-info">
      <div className="profile-image-area">
        <img alt="프로필이미지" className="profile-image" src={biggerProfileImageUrl} />
      </div>
      <div className="profile-right-area">
        <div className="profile-right-info">
          <div className="nickname" title={user.name}>
            {user.name}
          </div>
          <div className="username">
            <a
              target="_blank"
              rel="noopener noreferer"
              href={`https://twitter.com/${user.screen_name}`}
              title={`https://twitter.com/${user.screen_name} 로 이동`}
            >
              @{user.screen_name}
            </a>
          </div>
        </div>
        {isAvailable || (
          <div className="profile-blocked">
            {user.protected && '\u{1f512} 프로텍트가 걸려있어 체인블락을 할 수 없습니다.'}
            {user.blocked_by && '\u26d4 이 사용자에게 차단당하여 체인블락을 할 수 없습니다.'}
          </div>
        )}
        <div className="profile-right-targetlist">
          <label>
            <input
              type="radio"
              disabled={!isAvailable}
              checked={targetList === 'followers'}
              onChange={() => setTargetList('followers')}
            />
            <span title={`@${user.screen_name}의 팔로워를 차단합니다.`}>
              팔로워 {formatNumber(user.followers_count, quickMode)}명
            </span>
          </label>
          <label>
            <input
              type="radio"
              disabled={!isAvailable}
              checked={targetList === 'friends'}
              onChange={() => setTargetList('friends')}
            />
            <span title={`@${user.screen_name}이(가) 팔로우하는 사용자를 차단합니다.`}>
              팔로잉 {formatNumber(user.friends_count, quickMode)}명
            </span>
          </label>
          <br />
          <label>
            <input
              type="radio"
              disabled={!isAvailable}
              checked={targetList === 'mutual-followers'}
              onChange={() => setTargetList('mutual-followers')}
            />
            <span title={`@${user.screen_name}이(가) 맞팔로우한 사용자만 골라서 차단합니다.`}>맞팔로우만</span>
          </label>
          <hr />
          <label>
            <input
              type="checkbox"
              disabled={!isAvailable || targetList === 'mutual-followers'}
              checked={quickMode}
              onChange={() => mutateOptions({ quickMode: !quickMode })}
            />
            <span title="퀵 모드: 최근에 해당 사용자에게 체인블락을 실행하였으나 이후에 새로 생긴 팔로워만 더 빠르게 차단하기 위해 고안한 기능입니다.">
              퀵 모드 (200명 이하만 차단)
            </span>
          </label>
        </div>
      </div>
    </div>
  )
}

function TargetUserProfileEmpty(props: { reason: 'invalid-user' | 'loading' }) {
  let message = ''
  switch (props.reason) {
    case 'invalid-user':
      message = '사용자를 선택해주세요.'
      break
    case 'loading':
      message = '로딩 중...'
      break
  }
  return <div>{message}</div>
}

function TargetChainBlockOptions(props: {
  options: SessionOptions
  mutateOptions: (part: Partial<SessionOptions>) => void
}) {
  const { options, mutateOptions } = props
  const { myFollowers, myFollowings } = options
  return (
    <React.Fragment>
      <fieldset className="chainblock-subopt">
        <legend>내 팔로워</legend>
        <label>
          <input
            type="radio"
            checked={myFollowers === 'Skip'}
            onChange={() => mutateOptions({ myFollowers: 'Skip' })}
          />
          <span>냅두기</span>
        </label>
        <label>
          <input
            type="radio"
            checked={myFollowers === 'Mute'}
            onChange={() => mutateOptions({ myFollowers: 'Mute' })}
          />
          <span>뮤트하기</span>
        </label>
        <label>
          <input
            type="radio"
            checked={myFollowers === 'Block'}
            onChange={() => mutateOptions({ myFollowers: 'Block' })}
          />
          <span>차단하기</span>
        </label>
      </fieldset>
      <fieldset className="chainblock-subopt">
        <legend>내 팔로잉</legend>
        <label>
          <input
            type="radio"
            checked={myFollowings === 'Skip'}
            onChange={() => mutateOptions({ myFollowings: 'Skip' })}
          />
          <span>냅두기</span>
        </label>
        <label>
          <input
            type="radio"
            checked={myFollowings === 'Mute'}
            onChange={() => mutateOptions({ myFollowings: 'Mute' })}
          />
          <span>뮤트하기</span>
        </label>
        <label>
          <input
            type="radio"
            checked={myFollowings === 'Block'}
            onChange={() => mutateOptions({ myFollowings: 'Block' })}
          />
          <span>차단하기</span>
        </label>
      </fieldset>
    </React.Fragment>
  )
}

function TargetUnChainBlockOptions(props: {
  options: SessionOptions
  mutateOptions: (part: Partial<SessionOptions>) => void
}) {
  const { options, mutateOptions } = props
  const { mutualBlocked } = options
  return (
    <React.Fragment>
      <fieldset className="chainblock-subopt">
        <legend>서로 맞차단</legend>
        <label>
          <input
            type="radio"
            checked={mutualBlocked === 'Skip'}
            onChange={() => mutateOptions({ mutualBlocked: 'Skip' })}
          />
          <span>(맞차단인 상태로) 냅두기</span>
        </label>
        <label>
          <input
            type="radio"
            checked={mutualBlocked === 'UnBlock'}
            onChange={() => mutateOptions({ mutualBlocked: 'UnBlock' })}
          />
          <span>차단 해제하기</span>
        </label>
      </fieldset>
    </React.Fragment>
  )
}

const userCache = new Map<string, TwitterUser>()
async function getUserByNameWithCache(userName: string): Promise<TwitterUser> {
  const key = userName.replace(/^@/, '').toLowerCase()
  if (userCache.has(key)) {
    return userCache.get(key)!
  }
  const user = await TwitterAPI.getSingleUserByName(key)
  userCache.set(user.screen_name, user)
  return user
}

export default function NewChainBlockPage(props: { currentUser: TwitterUser | null }) {
  const { currentUser } = props
  const modalContext = React.useContext(ModalContext)
  const [options, setOptions] = React.useState<SessionOptions>({
    quickMode: false,
    myFollowers: 'Skip',
    myFollowings: 'Skip',
    mutualBlocked: 'Skip',
  })
  const [selectedUser, setSelectedUser] = React.useState<TwitterUser | null>(currentUser)
  const [savedUsers, setSavedUsers] = React.useState(new TwitterUserMap())
  const [selectedUserGroup, selectUserGroup] = React.useState<SelectUserGroup>('current')
  const [isLoading, setLoadingState] = React.useState(false)
  const [targetList, setTargetList] = React.useState<FollowKind>('followers')
  const isAvailable = React.useMemo((): boolean => {
    if (!selectedUser) {
      return false
    }
    if (selectedUser.following) {
      return true
    }
    if (selectedUser.protected || selectedUser.blocked_by) {
      return false
    }
    return true
  }, [selectedUser])
  React.useEffect(() => {
    async function loadUsers() {
      const users = await Storage.loadUsers()
      setSavedUsers(users)
      return users
    }
    loadUsers()
    return Storage.onSavedUsersChanged(async users => {
      await loadUsers()
      if (!(selectedUser && users.has(selectedUser.id_str))) {
        setSelectedUser(currentUser)
        selectUserGroup('current')
      }
    })
  }, [])
  function mutateOptions(newOptionsPart: Partial<SessionOptions>) {
    const newOptions = { ...options, ...newOptionsPart }
    setOptions(newOptions)
  }
  function onExecuteChainBlockButtonClicked() {
    const request: FollowerBlockSessionRequest = {
      purpose: 'chainblock',
      target: {
        type: 'follower',
        user: selectedUser!,
        list: targetList,
      },
      options,
    }
    modalContext.openModal({
      modalType: 'confirm',
      message: TextGenerate.generateFollowerBlockConfirmMessageElement(request),
      callback() {
        startFollowerChainBlock(request)
      },
    })
  }
  function onExecuteUnChainBlockButtonClicked() {
    const request: FollowerBlockSessionRequest = {
      purpose: 'unchainblock',
      target: {
        type: 'follower',
        user: selectedUser!,
        list: targetList,
      },
      options,
    }
    modalContext.openModal({
      modalType: 'confirm',
      message: TextGenerate.generateFollowerBlockConfirmMessageElement(request),
      callback() {
        startFollowerChainBlock(request)
      },
    })
  }
  async function changeUser(userName: string, group: SelectUserGroup) {
    const validUserNamePattern = /^[0-9a-z_]{1,15}$/i
    if (!validUserNamePattern.test(userName)) {
      setSelectedUser(null)
      selectUserGroup('invalid')
      return
    }
    try {
      setLoadingState(true)
      const newUser = await getUserByNameWithCache(userName).catch(() => null)
      if (newUser) {
        setSelectedUser(newUser)
        selectUserGroup(group)
      } else {
        modalContext.openModal({
          modalType: 'alert',
          message: `사용자 @${userName}을(를) 찾을 수 없습니다.`,
        })
        setSelectedUser(null)
        selectUserGroup('invalid')
      }
    } finally {
      setLoadingState(false)
    }
  }
  const { Tabs, TabList, Tab, TabPanel } = ReactTabs
  const miniTab: CSSProperties = {
    padding: '3px 10px',
  }
  const firstTab = currentUser && currentUser.following ? 1 : 0
  return (
    <div>
      <SelectedUserContext.Provider value={selectedUser}>
        <div className="chainblock-target">
          <fieldset className="chainblock-opt">
            <legend>차단 대상</legend>
            <TargetSavedUsers
              currentUser={currentUser}
              selectedUserGroup={selectedUserGroup}
              savedUsers={savedUsers}
              changeUser={changeUser}
            />
            <hr />
            {isLoading ? (
              <TargetUserProfileEmpty reason="loading" />
            ) : selectedUser ? (
              <TargetUserProfile
                options={options}
                mutateOptions={mutateOptions}
                targetList={targetList}
                setTargetList={setTargetList}
                isAvailable={isAvailable}
              />
            ) : (
              <TargetUserProfileEmpty reason="invalid-user" />
            )}
          </fieldset>
          <Tabs defaultIndex={firstTab}>
            <TabList>
              <Tab style={miniTab}>{'\u{1f6d1}'} 체인블락</Tab>
              <Tab style={miniTab}>{'\u{1f49a}'} 언체인블락</Tab>
            </TabList>
            <TabPanel>
              <fieldset className="chainblock-opt" disabled={!isAvailable}>
                <legend>체인블락 필터</legend>
                <TargetChainBlockOptions options={options} mutateOptions={mutateOptions} />
                <div className="description">
                  위 필터에 해당하지 않는 나머지 사용자를 모두 <mark>차단</mark>합니다. (단, <b>나와 맞팔로우</b>인
                  사용자는 위 옵션과 무관하게 <b>차단하지 않습니다</b>.)
                </div>
                <div className="menu">
                  <button
                    disabled={!isAvailable}
                    className="menu-item huge-button execute-chainblock"
                    onClick={onExecuteChainBlockButtonClicked}
                  >
                    <span>{'\u{1f6d1}'} 체인블락 실행</span>
                  </button>
                </div>
              </fieldset>
            </TabPanel>
            <TabPanel>
              <fieldset className="chainblock-opt" disabled={!isAvailable}>
                <legend>언체인블락 필터</legend>
                <TargetUnChainBlockOptions options={options} mutateOptions={mutateOptions} />
                <div className="description">
                  위 필터에 해당하지 않는 나머지 사용자를 모두 <mark>차단 해제</mark>합니다.
                </div>
                <div className="menu">
                  <button
                    disabled={!isAvailable}
                    className="menu-item huge-button execute-unchainblock"
                    onClick={onExecuteUnChainBlockButtonClicked}
                  >
                    <span>{'\u{1f49a}'} 언체인블락 실행</span>
                  </button>
                </div>
              </fieldset>
            </TabPanel>
          </Tabs>
        </div>
      </SelectedUserContext.Provider>
    </div>
  )
}
