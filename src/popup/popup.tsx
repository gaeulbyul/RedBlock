namespace RedBlock.Popup {
  type Tab = browser.tabs.Tab
  export async function requestChainBlock(userName: string, options: ChainBlockSessionOptions) {
    browser.runtime.sendMessage<RBStartAction, void>({
      action: Action.StartChainBlock,
      userName,
      options,
    })
    window.close()
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

function formatNumber(input: unknown): string {
  if (typeof input === 'number') {
    const formatted = input.toLocaleString()
    return `${formatted}`
  } else {
    return '??'
  }
}

namespace RedBlock.Popup.UI {
  function calculatePercentage(session: ChainBlockSessionInfo): number {
    const { target, progress, status } = session
    // const isInitial = status === ChainBlockSessionStatus.Initial
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
  function TargetUserProfile(props: {
    user: TwitterUser
    options: ChainBlockSessionOptions
    mutateOptions: (part: Partial<ChainBlockSessionOptions>) => void
  }) {
    const { user, options, mutateOptions } = props
    const { targetList } = options
    const biggerProfileImageUrl = user.profile_image_url_https.replace('_normal', '_bigger')
    return (
      <div className="target-user-info">
        <div className="profile-image-area">
          <img alt="프로필이미지" className="profile-image" src={biggerProfileImageUrl} />
        </div>
        <div className="profile-right-area">
          <div className="profile-right-info">
            <div className="nickname">{user.name}</div>
            <div className="username">@{user.screen_name}</div>
          </div>
          <div className="profile-right-targetlist">
            <label>
              <input
                type="radio"
                name="chainblock-target"
                value="followers"
                checked={targetList === 'followers'}
                onChange={() => mutateOptions({ targetList: 'followers' })}
              />
              <span>팔로워 {formatNumber(user.followers_count)}명</span>
            </label>
            <label>
              <input
                type="radio"
                name="chainblock-target"
                value="friends"
                checked={targetList === 'friends'}
                onChange={() => mutateOptions({ targetList: 'friends' })}
              />
              <span>팔로잉 {formatNumber(user.friends_count)}명</span>
            </label>
          </div>
        </div>
      </div>
    )
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
              name="chainblock-my-followers"
              value="skip"
              checked={myFollowers === 'skip'}
              onChange={() => mutateOptions({ myFollowers: 'skip' })}
            />
            <span>냅두기</span>
          </label>
          <label>
            <input
              type="radio"
              name="chainblock-my-followers"
              value="block"
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
              name="chainblock-my-followings"
              value="skip"
              checked={myFollowings === 'skip'}
              onChange={() => mutateOptions({ myFollowings: 'skip' })}
            />
            <span>냅두기</span>
          </label>
          <label>
            <input
              type="radio"
              name="chainblock-my-followings"
              value="block"
              checked={myFollowings === 'block'}
              onChange={() => mutateOptions({ myFollowings: 'block' })}
            />
            <span>차단하기</span>
          </label>
        </fieldset>
      </React.Fragment>
    )
  }

  interface NewChainBlockPageProps {
    user: TwitterUser
  }

  function NewChainBlockPage(props: NewChainBlockPageProps) {
    const [options, setOptions] = React.useState<ChainBlockSessionOptions>({
      targetList: 'followers',
      myFollowers: 'skip',
      myFollowings: 'skip',
    })
    function mutateOptions(newOptionsPart: Partial<ChainBlockSessionOptions>) {
      const newOptions = { ...options, ...newOptionsPart }
      // console.dir({ options, newOptions })
      setOptions(newOptions)
    }
    function onExecuteChainBlockButtonClicked() {
      RedBlock.Popup.requestChainBlock(props.user.screen_name, options)
    }
    return (
      <div>
        <div className="chainblock-target">
          <fieldset className="chainblock-opt">
            <legend>차단 대상</legend>
            <TargetUserProfile options={options} mutateOptions={mutateOptions} user={props.user} />
          </fieldset>
          <fieldset className="chainblock-opt">
            <legend>필터</legend>
            <TargetListOptions options={options} mutateOptions={mutateOptions} />
            <div className="description">
              단, <b>나와 맞팔로우</b>인 사용자는 위 옵션과 무관하게 <b>차단하지 않습니다</b>.
            </div>
          </fieldset>
          <div className="menu">
            <button className="menu-item execute-chainblock" onClick={onExecuteChainBlockButtonClicked}>
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
      const sep = ' / '
      const statusMessage = this.statusToString(status)
      return (
        <div>
          <small>
            {statusMessage} {sep}
            <b>차단: {progress.blockSuccess.toLocaleString()}</b> {sep}
            이미 차단함: {progress.alreadyBlocked.toLocaleString()} {sep}
            스킵: {progress.skipped.toLocaleString()} {sep}
            실패: {progress.blockFail.toLocaleString()}
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
                        @{user.screen_name}
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

  interface PopupAppProps {
    user: TwitterUser | null
  }

  function PopupApp(props: PopupAppProps) {
    const { Tabs, TabList, Tab, TabPanel } = ReactTabs
    const { user } = props
    return (
      <div>
        <React.StrictMode>
          <Tabs>
            <TabList>
              <Tab>&#9939; 실행중</Tab>
              {user && <Tab>&#10133; 새 세션</Tab>}
            </TabList>
            <TabPanel>
              <ChainBlockSessionsPage />
            </TabPanel>
            {user && (
              <TabPanel>
                <NewChainBlockPage user={user} />
              </TabPanel>
            )}
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
    const { getUserNameFromTab, getCurrentTab } = RedBlock.Popup
    const { TwitterAPI } = RedBlock.Background
    const tab = await getCurrentTab()
    const userName = tab ? getUserNameFromTab(tab) : null
    const appRoot = document.getElementById('app')!
    const targetUser = await (userName ? TwitterAPI.getSingleUserByName(userName) : null)
    const app = <PopupApp user={targetUser} />
    ReactDOM.render(app, appRoot)
    showVersionOnFooter()
  }
}

RedBlock.Popup.UI.initializeUI()
