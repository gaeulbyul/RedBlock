namespace RedBlock.Popup.UI.Pages.NewChainBlock {
  type SessionRequest = RedBlock.Background.ChainBlockSession.SessionRequest
  type SessionOptions = SessionRequest['options']
  type SelectUserGroup = 'invalid' | 'current' | 'saved'
  const { TwitterAPI, Storage } = RedBlock.Background
  function TargetSavedUsers(props: {
    currentUser: TwitterUser | null
    selectedUser: TwitterUser | null
    selectedUserGroup: SelectUserGroup
    savedUsers: TwitterUserMap
    changeUser: (userName: string, group: SelectUserGroup) => Promise<void>
  }) {
    const { currentUser, selectedUser, selectedUserGroup, savedUsers, changeUser } = props
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
    user: TwitterUser
    isAvailable: boolean
    targetList: FollowKind
    options: SessionRequest['options']
    setTargetList: (fk: FollowKind) => void
    mutateOptions: (part: Partial<SessionOptions>) => void
  }) {
    const { user, isAvailable, targetList, options, setTargetList, mutateOptions } = props
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
              {user.blocked_by && '\u26d4 해당 사용자에게 차단당하여 체인블락을 할 수 없습니다.'}
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
              <span title="상대방을 팔로우하는 사용자를 차단합니다.">
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
              <span title="상대방이 팔로우하는 사용자를 차단합니다.">
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
              <span title="상대방과 맞팔로우한 사용자만 추려서 차단합니다.">
                맞팔로우만<sup>&beta;</sup>
              </span>
            </label>
            <hr />
            <label>
              <input
                type="checkbox"
                disabled={!isAvailable || targetList === 'mutual-followers'}
                checked={quickMode}
                onChange={() => mutateOptions({ quickMode: !quickMode })}
              />
              <span title="퀵 모드: 최대 200명 이하의 사용자를 대상으로 합니다. 최근에 해당 사용자에게 체인블락을 실행하였으나 이후에 새로 생긴 팔로워를 더 빠르게 차단하기 위해 고안한 기능입니다.">
                퀵 모드<sup>&beta;</sup>
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

  function TargetListOptions(props: {
    options: SessionOptions
    mutateOptions: (part: Partial<SessionOptions>) => void
  }) {
    const { options, mutateOptions } = props
    const { myFollowers, myFollowings, verified } = options
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
              checked={myFollowings === 'Block'}
              onChange={() => mutateOptions({ myFollowings: 'Block' })}
            />
            <span>차단하기</span>
          </label>
        </fieldset>
        <fieldset className="chainblock-subopt">
          <legend>인증된 계정 (파란 체크마크가 붙은 계정)</legend>
          <label>
            <input type="radio" checked={verified === 'Skip'} onChange={() => mutateOptions({ verified: 'Skip' })} />
            <span>냅두기</span>
          </label>
          <label>
            <input type="radio" checked={verified === 'Block'} onChange={() => mutateOptions({ verified: 'Block' })} />
            <span>차단하기</span>
          </label>
        </fieldset>
      </React.Fragment>
    )
  }

  const userCache = new Map<string, TwitterUser>()
  async function getUserByNameWithCache(userName_: string): Promise<TwitterUser> {
    const userName = userName_.replace(/^@/, '')
    if (userCache.has(userName)) {
      return userCache.get(userName)!
    }
    const user = await TwitterAPI.getSingleUserByName(userName)
    userCache.set(user.screen_name, user)
    return user
  }

  export function NewChainBlockPage(props: { currentUser: TwitterUser | null }) {
    const { currentUser } = props
    const [options, setOptions] = React.useState<SessionOptions>({
      quickMode: false,
      myFollowers: 'Skip',
      myFollowings: 'Skip',
      verified: 'Skip',
      mutualBlocked: 'Skip',
    })
    const [selectedUser, selectUser] = React.useState<TwitterUser | null>(currentUser)
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
      browser.storage.onChanged.addListener(async () => {
        const users = await loadUsers()
        if (!(selectedUser && users.has(selectedUser.id_str))) {
          selectUser(null)
        }
      })
      return () => browser.storage.onChanged.removeListener(loadUsers)
    }, [])
    function mutateOptions(newOptionsPart: Partial<SessionOptions>) {
      const newOptions = { ...options, ...newOptionsPart }
      setOptions(newOptions)
    }
    function onExecuteChainBlockButtonClicked() {
      startChainBlock(selectedUser!.screen_name, targetList, options)
    }
    async function changeUser(userName: string, group: SelectUserGroup) {
      const validUserNamePattern = /^[0-9a-z_]{1,15}$/i
      if (!validUserNamePattern.test(userName)) {
        selectUser(null)
        selectUserGroup('invalid')
        return
      }
      try {
        setLoadingState(true)
        const newUser = await getUserByNameWithCache(userName).catch(() => null)
        if (newUser) {
          selectUser(newUser)
          selectUserGroup(group)
        } else {
          window.alert(`사용자 @${userName}을 찾을 수 없습니다.`)
          selectUser(null)
          selectUserGroup('invalid')
        }
      } finally {
        setLoadingState(false)
      }
    }
    return (
      <div>
        <div className="chainblock-target">
          <fieldset className="chainblock-opt">
            <legend>차단 대상</legend>
            <TargetSavedUsers
              currentUser={currentUser}
              selectedUser={selectedUser}
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
                user={selectedUser}
                isAvailable={isAvailable}
              />
            ) : (
              <TargetUserProfileEmpty reason="invalid-user" />
            )}
          </fieldset>
          <fieldset className="chainblock-opt" disabled={!isAvailable}>
            <legend>필터</legend>
            <TargetListOptions options={options} mutateOptions={mutateOptions} />
            <div className="description">
              단, <b>나와 맞팔로우</b>인 사용자는 위 옵션과 무관하게 <b>차단하지 않습니다</b>.
            </div>
          </fieldset>
          <div className="menu">
            <button
              disabled={!isAvailable}
              className="menu-item execute-chainblock"
              onClick={onExecuteChainBlockButtonClicked}
            >
              <span>체인블락 실행</span>
            </button>
          </div>
        </div>
      </div>
    )
  }
}
