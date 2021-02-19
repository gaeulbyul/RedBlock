import * as i18n from '../../scripts/i18n.js'

// NOTE:
// 아래의 값을 변경할 때,
// popup-ui.tsx의 initialPageMatch 정규식 부분도 수정할 것.
export const enum PageEnum {
  Sessions,
  NewSession,
  NewTweetReactionBlock,
  NewSearchChainBlock,
  Blocklist,
  LockPicker,
  Utilities,
}

export function pageIcon(page: PageEnum): React.ReactElement {
  const M = MaterialUI
  switch (page) {
    case PageEnum.Sessions:
      return <M.Icon>play_circle_filled_white_icon</M.Icon>
    case PageEnum.NewSession:
      return <M.Icon>group</M.Icon>
    case PageEnum.NewTweetReactionBlock:
      return <M.Icon>repeat</M.Icon>
    case PageEnum.NewSearchChainBlock:
      return <M.Icon>search</M.Icon>
    case PageEnum.Blocklist:
      return <M.Icon>list_alt</M.Icon>
    case PageEnum.LockPicker:
      return <M.Icon>no_encryption</M.Icon>
    case PageEnum.Utilities:
      return <M.Icon>build</M.Icon>
  }
}

export function pageLabel(page: PageEnum, sessionsCount = 0): string {
  switch (page) {
    case PageEnum.Sessions:
      return `${i18n.getMessage('running_sessions')} (${sessionsCount})`
    case PageEnum.NewSession:
      return i18n.getMessage('new_follower_session')
    case PageEnum.NewTweetReactionBlock:
      return i18n.getMessage('new_tweetreaction_session')
    case PageEnum.NewSearchChainBlock:
      return i18n.getMessage('new_searchblock_session')
    case PageEnum.Blocklist:
      return i18n.getMessage('blocklist_page')
    case PageEnum.LockPicker:
      return i18n.getMessage('lockpicker')
    case PageEnum.Utilities:
      return i18n.getMessage('miscellaneous')
  }
}
