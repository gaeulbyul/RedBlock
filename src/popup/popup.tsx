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
  function TargetUserProfile(props: {
    user: TwitterUser
    options: ChainBlockSessionOptions
    mutateOptions: (part: Partial<ChainBlockSessionOptions>) => void
  }) {
    const { user, options, mutateOptions } = props
    const { targetList } = options
    return (
      <div className="target-user-info">
        <div className="profile-image-area">
          <img alt="프로필이미지" className="profile-image" src={user.profile_image_url_https} />
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
            <br />
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

  interface PopupAppProps {
    user: TwitterUser
  }

  function PopupApp(props: PopupAppProps) {
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
        <div className="chainblock-filters">
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

  function PopupAppWithoutUser() {
    return (
      <div className="non-twitter">
        <div className="text">
          Red Block의 체인블락은 트위터의 사용자 프로필페이지에서 사용할 수 있습니다. <br />
          (예: https://twitter.com/<i style={{ backgroundColor: 'brown' }}>사용자이름</i>)
        </div>
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
    const targetUser = await (userName ? TwitterAPI.getSingleUserByName(userName) : null)
    const appRoot = document.getElementById('app')!
    const app = targetUser ? <PopupApp user={targetUser} /> : <PopupAppWithoutUser />
    ReactDOM.render(app, appRoot)
    showVersionOnFooter()
  }
}

RedBlock.Popup.UI.initializeUI()
