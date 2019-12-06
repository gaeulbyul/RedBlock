namespace RedBlock.Popup {
  type Tab = browser.tabs.Tab
  export async function requestChainBlock(userName: string, options: ChainBlockSessionOptions) {
    browser.runtime.sendMessage<RBStartAction, void>({
      action: Action.StartChainBlock,
      userName,
      options,
    })
  }

  export async function getCurrentTab(): Promise<Tab | null> {
    const tabs = await browser.tabs.query({
      active: true,
      currentWindow: true,
    })
    const currentTab = tabs[0]
    if (!currentTab || !currentTab.url) {
      return null
    }
    return currentTab
  }

  export function getUserNameFromTab(tab: Tab): string | null {
    if (!tab || !tab.url) {
      return null
    }
    const url = new URL(tab.url)
    return getUserNameFromURL(url)
  }
}

namespace RedBlock.Popup.UI {
  const { getUserNameFromTab, getCurrentTab, requestChainBlock } = RedBlock.Popup
  const { TwitterAPI, Storage } = RedBlock.Background

  function calculatePercentage(session: ChainBlockSessionInfo): number {
    const { target, progress, status } = session
    const isCompleted = status === ChainBlockSessionStatus.Completed
    const max = (isCompleted ? progress.totalScraped : target.totalCount) || undefined
    if (isCompleted) {
      return 100
    } else if (typeof max === 'number') {
      return Math.round((progress.totalScraped / max) * 1000) / 10
    } else {
      return 0
    }
  }

  function renderProfileImageWithProgress(session: ChainBlockSessionInfo) {
    const {
      target: { user },
    } = session
    const width = 72
    const strokeWidth = 4
    const radius = width / 2 - strokeWidth * 2
    const circumference = radius * 2 * Math.PI
    const percent = calculatePercentage(session)
    const strokeDasharray = `${circumference} ${circumference}`
    const strokeDashoffset = circumference - (percent / 100) * circumference
    // if omit _${size}, will get original-size image
    const biggerProfileImageUrl = user.profile_image_url_https.replace('_normal', '_bigger')
    return (
      <svg width={width} height={width}>
        <defs>
          <circle id="profile-circle" cx={width / 2} cy={width / 2} r={radius}></circle>
          <clipPath id="profile-circle-clip">
            <use href="#profile-circle" />
          </clipPath>
        </defs>
        <g clipPath="url(#profile-circle-clip)">
          <image
            clipPath="url(#profile-circle-clip)"
            width={width}
            height={width}
            href={biggerProfileImageUrl}
            transform="scale(0.9)"
            style={{
              transformOrigin: '50% 50%',
            }}
          />
          <use
            href="#profile-circle"
            stroke="crimson"
            strokeWidth={strokeWidth}
            fill="transparent"
            style={{
              strokeDasharray,
              strokeDashoffset,
              transform: 'rotate(-90deg)',
              transformOrigin: '50% 50%',
              transition: 'stroke-dashoffset 400ms ease-in-out',
            }}
          ></use>
        </g>
      </svg>
    )
  }

  function TargetSavedUsers(props: {
    currentUser: TwitterUser | null
    savedUsers: TwitterUserMap
    changeUser: (userName: string) => Promise<void>
  }) {
    const { currentUser, savedUsers, changeUser } = props
    const currentUserOption = ({ screen_name, name }: TwitterUser) => (
      <optgroup label="현재 유저">
        <option value={screen_name}>
          @{screen_name} &lt;{name}&gt;
        </option>
      </optgroup>
    )
    const noUserOption = <option value="???">체인블락을 실행할 사용자를 선택해주세요.</option>
    const sortedByName = (usersMap: TwitterUserMap): TwitterUser[] =>
      _.sortBy(usersMap.toUserArray(), user => user.screen_name.toLowerCase())
    return (
      <div className="chainblock-saved-target">
        <select className="chainblock-saved-select" onChange={event => changeUser(event.target.value)}>
          {currentUser ? currentUserOption(currentUser) : noUserOption}
          <optgroup label="저장한 유저">
            {sortedByName(savedUsers).map(({ screen_name, name }, index) => (
              <option key={index} value={screen_name}>
                @{screen_name} &lt;{name}&gt;
              </option>
            ))}
          </optgroup>
        </select>
      </div>
    )
  }

  function TargetUserProfile(props: {
    user: TwitterUser
    options: ChainBlockSessionOptions
    mutateOptions: (part: Partial<ChainBlockSessionOptions>) => void
  }) {
    const { user, options, mutateOptions } = props
    const { targetList, quickMode } = options
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
          <div className="profile-right-targetlist">
            <label>
              <input
                type="radio"
                checked={targetList === 'followers'}
                onChange={() => mutateOptions({ targetList: 'followers' })}
              />
              <span title="상대방을 팔로우하는 사용자를 차단합니다.">
                팔로워 {formatNumber(user.followers_count, quickMode)}명
              </span>
            </label>
            <label>
              <input
                type="radio"
                checked={targetList === 'friends'}
                onChange={() => mutateOptions({ targetList: 'friends' })}
              />
              <span title="상대방이 팔로우하는 사용자를 차단합니다.">
                팔로잉 {formatNumber(user.friends_count, quickMode)}명
              </span>
            </label>
            <br />
            <label>
              <input
                type="radio"
                checked={targetList === 'mutual-followers'}
                onChange={() => mutateOptions({ targetList: 'mutual-followers' })}
              />
              <span title="상대방과 맞팔로우한 사용자만 추려서 차단합니다.">
                맞팔로우만<sup>&beta;</sup>
              </span>
            </label>
            <hr />
            <label>
              <input
                type="checkbox"
                checked={quickMode}
                disabled={targetList === 'mutual-followers'}
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
    options: ChainBlockSessionOptions
    mutateOptions: (part: Partial<ChainBlockSessionOptions>) => void
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
              checked={myFollowers === 'skip'}
              onChange={() => mutateOptions({ myFollowers: 'skip' })}
            />
            <span>냅두기</span>
          </label>
          <label>
            <input
              type="radio"
              checked={myFollowers === 'block'}
              onChange={() => mutateOptions({ myFollowers: 'block' })}
            />
            <span>차단하기</span>
          </label>
        </fieldset>
        <fieldset className="chainblock-subopt">
          <legend>내 팔로잉</legend>
          <label>
            <input
              type="radio"
              checked={myFollowings === 'skip'}
              onChange={() => mutateOptions({ myFollowings: 'skip' })}
            />
            <span>냅두기</span>
          </label>
          <label>
            <input
              type="radio"
              checked={myFollowings === 'block'}
              onChange={() => mutateOptions({ myFollowings: 'block' })}
            />
            <span>차단하기</span>
          </label>
        </fieldset>
      </React.Fragment>
    )
  }

  function NewChainBlockPage(props: { currentUser: TwitterUser | null }) {
    const { currentUser } = props
    const [options, setOptions] = React.useState<ChainBlockSessionOptions>({
      targetList: 'followers',
      myFollowers: 'skip',
      myFollowings: 'skip',
      saveTargetUser: false,
      quickMode: false,
    })
    const [selectedUser, selectUser] = React.useState<TwitterUser | null>(currentUser)
    const [savedUsers, setSavedUsers] = React.useState(new TwitterUserMap())
    const [isLoading, setLoadingState] = React.useState(false)
    React.useEffect(() => {
      async function loadUsers() {
        const users = await Storage.loadUsers()
        setSavedUsers(users)
      }
      loadUsers()
    }, [])
    React.useEffect(() => {
      if (selectedUser) {
        setOptions({
          ...options,
          saveTargetUser: savedUsers.has(selectedUser.id_str),
        })
      }
    }, [savedUsers, selectedUser])
    function mutateOptions(newOptionsPart: Partial<ChainBlockSessionOptions>) {
      const newOptions = { ...options, ...newOptionsPart }
      setOptions(newOptions)
    }
    function toggleSaveState() {
      mutateOptions({
        saveTargetUser: !options.saveTargetUser,
      })
    }
    function onExecuteChainBlockButtonClicked() {
      if (selectedUser) {
        requestChainBlock(selectedUser.screen_name, options)
      }
    }
    async function changeUser(userName: string) {
      const validUserNamePattern = /^[0-9a-z_]{1,15}$/i
      if (!validUserNamePattern.test(userName)) {
        selectUser(null)
        return
      }
      try {
        setLoadingState(true)
        const newUser = await TwitterAPI.getSingleUserByName(userName.replace(/^@/, '')).catch(() => null)
        if (newUser) {
          selectUser(newUser)
        } else {
          window.alert(`사용자 @${userName}을 찾을 수 없습니다.`)
          selectUser(null)
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
            <TargetSavedUsers currentUser={currentUser} savedUsers={savedUsers} changeUser={changeUser} />
            <hr />
            {isLoading ? (
              <TargetUserProfileEmpty reason="loading" />
            ) : selectedUser ? (
              <TargetUserProfile options={options} mutateOptions={mutateOptions} user={selectedUser} />
            ) : (
              <TargetUserProfileEmpty reason="invalid-user" />
            )}
          </fieldset>
          <fieldset className="chainblock-opt" disabled={selectedUser == null}>
            <legend>필터</legend>
            <TargetListOptions options={options} mutateOptions={mutateOptions} />
            <div className="description">
              단, <b>나와 맞팔로우</b>인 사용자는 위 옵션과 무관하게 <b>차단하지 않습니다</b>.
            </div>
          </fieldset>
          <fieldset className="chainblock-opt" disabled={selectedUser == null}>
            <legend>부가기능</legend>
            <label>
              <input type="checkbox" checked={options.saveTargetUser} onChange={toggleSaveState} />이 사용자를 저장하기
            </label>
            <div className="description">
              사용자를 저장하면 "저장한 유저" 목록에 추가됩니다. 이렇게 하면 상대방의 프로필페이지를 방문하지 않고
              체인블락을 실행할 수 있게 됩니다. 목록에서 사용자를 삭제하려면 체크를 해제해주세요.
            </div>
          </fieldset>
          <div className="menu">
            <button
              disabled={selectedUser == null}
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

  interface ChainBlockSessionsPageState {
    sessions: ChainBlockSessionInfo[]
  }

  class ChainBlockSessionsPage extends React.Component<{}, ChainBlockSessionsPageState> {
    public state: ChainBlockSessionsPageState = { sessions: [] }
    private _interval = -1
    private __msgListener_real(msgobj: any) {
      if (!(typeof msgobj === 'object' && 'messageType' in msgobj)) {
        return
      }
      if (msgobj.messageType === 'ChainBlockInfoMessage') {
        const msg = msgobj as RBChainBlockInfoMessage
        this.setState({
          sessions: msg.infos,
        })
      }
    }
    private _msgListener = this.__msgListener_real.bind(this)
    public componentDidMount() {
      browser.runtime.onMessage.addListener(this._msgListener)
      this._interval = window.setInterval(() => {
        browser.runtime
          .sendMessage<RBRequestProgress>({
            action: Action.RequestProgress,
          })
          .catch(() => {})
      }, UI_UPDATE_DELAY)
    }
    public componentWillUnmount() {
      browser.runtime.onMessage.removeListener(this._msgListener)
      window.clearInterval(this._interval)
    }
    private statusToString(status: ChainBlockSessionStatus): string {
      const statusMessageObj: { [key: number]: string } = {
        [ChainBlockSessionStatus.Initial]: '대기 중',
        [ChainBlockSessionStatus.Completed]: '완료',
        [ChainBlockSessionStatus.Running]: '실행 중…',
        [ChainBlockSessionStatus.RateLimited]: '리밋',
        [ChainBlockSessionStatus.Stopped]: '정지',
        [ChainBlockSessionStatus.Error]: '오류 발생!',
      }
      const statusMessage = `[${statusMessageObj[status]}]`
      return statusMessage
    }
    private renderText({ progress, status }: ChainBlockSessionInfo) {
      const statusMessage = this.statusToString(status)
      return (
        <div>
          <small>
            {statusMessage} {' / '}
            <b>차단: {progress.blockSuccess.toLocaleString()}</b>
            {progress.alreadyBlocked > 0 && ` / 이미 차단함: ${progress.alreadyBlocked.toLocaleString()}`}
            {progress.skipped > 0 && ` / 스킵: ${progress.skipped.toLocaleString()}`}
            {progress.blockFail > 0 && ` / 실패: ${progress.blockFail.toLocaleString()}`}
          </small>
        </div>
      )
    }
    private isRunning(status: ChainBlockSessionStatus): boolean {
      const runningStatuses = [
        ChainBlockSessionStatus.Initial,
        ChainBlockSessionStatus.Running,
        ChainBlockSessionStatus.RateLimited,
      ]
      return runningStatuses.includes(status)
    }
    private renderControls({ sessionId, status, target }: ChainBlockSessionInfo) {
      const isRunning = this.isRunning(status)
      const userName = target.user.screen_name
      function requestStopChainBlock() {
        if (isRunning) {
          const confirmMessage = `@${userName}에게 실행중인 체인블락을 중단하시겠습니까?`
          if (!window.confirm(confirmMessage)) {
            return
          }
        }
        browser.runtime.sendMessage<RBStopAction>({
          action: Action.StopChainBlock,
          sessionId,
        })
      }
      let closeButtonText = '닫기'
      let closeButtonTitleText = ''
      if (isRunning) {
        closeButtonText = '중지'
        closeButtonTitleText = `@${userName}에게 실행중인 체인블락을 중지합니다.`
      }
      return (
        <div className="controls">
          <button type="button" title={closeButtonTitleText} onClick={requestStopChainBlock}>
            {closeButtonText}
          </button>
        </div>
      )
    }
    render() {
      // const emptySessions = this.state.sessions.length <= 0
      // if (emptySessions) {
      //   return (
      //     <div className="chainblock-suggest-start">
      //       체인블락을 실행하려면 "세 세션" 탭을 눌러주세요.
      //     </div>
      //   )
      // }
      return (
        <div className="chainblock-sessions">
          {this.state.sessions.map(session => {
            const { target } = session
            const { user } = target
            return (
              <div className="session" key={session.sessionId}>
                <div className="target-user-info">
                  <div className="profile-image-area">{renderProfileImageWithProgress(session)}</div>
                  <div className="profile-right-area">
                    <div className="profile-right-info">
                      <div className="ellipsis nickname" title={user.name}>
                        {user.name}
                      </div>
                      <div className="username" title={'@' + user.screen_name}>
                        <a
                          target="_blank"
                          rel="noopener noreferer"
                          href={`https://twitter.com/${user.screen_name}`}
                          title={`https://twitter.com/${user.screen_name} 로 이동`}
                        >
                          @{user.screen_name}
                        </a>
                      </div>
                      {this.renderText(session)}
                    </div>
                  </div>
                </div>
                {this.renderControls(session)}
              </div>
            )
          })}
        </div>
      )
    }
  }

  function PopupApp(props: { currentUser: TwitterUser | null }) {
    const { Tabs, TabList, Tab, TabPanel } = ReactTabs
    const { currentUser } = props
    return (
      <div>
        <React.StrictMode>
          <Tabs>
            <TabList>
              <Tab>&#9939; 실행중</Tab>
              <Tab>&#10133; 새 세션</Tab>
            </TabList>
            <TabPanel>
              <ChainBlockSessionsPage />
            </TabPanel>
            <TabPanel>
              <NewChainBlockPage currentUser={currentUser} />
            </TabPanel>
          </Tabs>
        </React.StrictMode>
      </div>
    )
  }

  function showVersionOnFooter() {
    const manifest = browser.runtime.getManifest()
    document.querySelector('footer.info')!.textContent = `${manifest.name} v${manifest.version}`
  }

  export async function initializeUI() {
    const tab = await getCurrentTab()
    const userName = tab ? getUserNameFromTab(tab) : null
    const appRoot = document.getElementById('app')!
    const targetUser = await (userName ? TwitterAPI.getSingleUserByName(userName) : null)
    const app = <PopupApp currentUser={targetUser} />
    ReactDOM.render(app, appRoot)
    showVersionOnFooter()
  }
}

RedBlock.Popup.UI.initializeUI()
