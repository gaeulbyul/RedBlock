import { isRunningStatus, SessionStatus, getLimitResetTime } from '../scripts/common.js'
import * as TextGenerate from '../scripts/text-generate.js'
import { cleanupSessions, stopAllChainBlock, stopChainBlock } from './message-sender.js'
import { DialogContext } from './contexts.js'

const M = MaterialUI
const T = MaterialUI.Typography

function calculatePercentage(session: SessionInfo): number | null {
  const { status, count } = session
  if (status === SessionStatus.Completed) {
    return 100
  }
  const max = count.total
  if (typeof max === 'number') {
    return Math.round((count.scraped / max) * 1000) / 10
  } else {
    return null
  }
}

const useStylesForSessionItem = MaterialUI.makeStyles(() =>
  MaterialUI.createStyles({
    card: {
      margin: '15px 0',
    },
    expand: {
      marginLeft: 'auto',
    },
  })
)

export function ChainBlockSessionItem(props: { session: SessionInfo }) {
  const { session } = props
  const { purpose, target } = session.request
  const modalContext = React.useContext(DialogContext)
  const classes = useStylesForSessionItem()
  const [expanded, setExpanded] = React.useState(false)
  function toggleExpand() {
    setExpanded(!expanded)
  }
  const isChainBlock = purpose === 'chainblock'
  const isUnchainBlock = purpose === 'unchainblock'
  const isFollowerChainBlock = target.type === 'follower'
  let user: TwitterUser
  let targetListKor = ''
  switch (target.type) {
    case 'follower':
      user = target.user
      switch (target.list) {
        case 'followers':
          targetListKor = '팔로워'
          break
        case 'friends':
          targetListKor = '팔로잉'
          break
        case 'mutual-followers':
          targetListKor = '맞팔로워'
          break
      }
      break
    case 'tweetReaction':
      user = target.tweet.user
      switch (target.reaction) {
        case 'retweeted':
          targetListKor = '리트윗'
          break
        case 'liked':
          targetListKor = '마음에 들어'
          break
      }
      break
  }
  const purposeKor = isChainBlock ? '체인블락' : '언체인블락'
  const cardTitle = `${purposeKor} ${statusToString(session.status)}`
  let subheader = ''
  if (isFollowerChainBlock) {
    subheader += `@${user.screen_name}의 ${targetListKor}`
  } else {
    subheader += `@${user.screen_name}이(가) 작성한 트윗을 ${targetListKor}한 사용자`
  }
  function statusToString(status: SessionStatus): string {
    const statusMessageObj: { [key: number]: string } = {
      [SessionStatus.Initial]: '대기 중',
      [SessionStatus.Completed]: '완료',
      [SessionStatus.Running]: '실행 중…',
      [SessionStatus.RateLimited]: '리밋',
      [SessionStatus.Stopped]: '정지',
      [SessionStatus.Error]: '오류 발생!',
    }
    const statusMessage = statusMessageObj[status]
    return statusMessage
  }
  function renderControls({ sessionId, status, request }: SessionInfo) {
    function requestStopChainBlock() {
      if (isRunningStatus(status)) {
        const message = TextGenerate.confirmStopMessage(request)
        modalContext.openModal({
          dialogType: 'confirm',
          message,
          callback() {
            stopChainBlock(sessionId)
          },
        })
        return
      }
      stopChainBlock(sessionId)
    }
    let closeButtonText = '닫기'
    let closeButtonTitleText = ''
    if (isRunningStatus(status)) {
      closeButtonText = '중지'
      closeButtonTitleText = TextGenerate.stopButtonTooltipMessage(request)
    }
    return (
      <React.Fragment>
        <M.Button title={closeButtonTitleText} onClick={requestStopChainBlock}>
          {closeButtonText}
        </M.Button>
        <M.Tooltip placement="left" title="자세한 집계수치 보기">
          <M.IconButton className={classes.expand} onClick={toggleExpand}>
            <M.Icon>{expanded ? 'expand_less' : 'expand_more'}</M.Icon>
          </M.IconButton>
        </M.Tooltip>
      </React.Fragment>
    )
  }
  function renderTable({ progress: p }: SessionInfo) {
    const { TableContainer, Table, TableBody, TableRow: Row, TableCell: Cell } = MaterialUI
    const { success: s } = p
    return (
      <TableContainer>
        <Table>
          <TableBody>
            <Row>
              <Cell>차단</Cell>
              <Cell align="right">{s.Block.toLocaleString()}</Cell>
            </Row>
            <Row>
              <Cell>차단해제</Cell>
              <Cell align="right">{s.UnBlock.toLocaleString()}</Cell>
            </Row>
            <Row>
              <Cell>뮤트</Cell>
              <Cell align="right">{s.Mute.toLocaleString()}</Cell>
            </Row>
            <Row>
              <Cell>이미 처리함</Cell>
              <Cell align="right">{p.already.toLocaleString()}</Cell>
            </Row>
            <Row>
              <Cell>스킵</Cell>
              <Cell align="right">{p.skipped.toLocaleString()}</Cell>
            </Row>
            <Row>
              <Cell>실패</Cell>
              <Cell align="right">{p.failure.toLocaleString()}</Cell>
            </Row>
          </TableBody>
        </Table>
      </TableContainer>
    )
  }
  let name = user.name
  if (target.type === 'tweetReaction') {
    name = `<트윗> ${name}`
  }
  const biggerProfileImageUrl = user.profile_image_url_https.replace('_normal', '_bigger')
  const percentage = calculatePercentage(session)
  const progressBar =
    typeof percentage === 'number' ? (
      <M.LinearProgress variant="determinate" value={percentage} />
    ) : (
      <M.LinearProgress variant="indeterminate" />
    )
  const succProgress = session.progress.success
  return (
    <M.Card className={classes.card}>
      <M.CardHeader avatar={<M.Avatar src={biggerProfileImageUrl} />} title={cardTitle} subheader={subheader} />
      <M.CardContent>
        {progressBar}
        <T>
          <span>상태: {statusToString(session.status)}</span>
          {isChainBlock && <span> / 차단: {succProgress.Block.toLocaleString()}</span>}
          {isUnchainBlock && <span> / 차단해제: {succProgress.UnBlock.toLocaleString()}</span>}
        </T>
        {session.limit && <T color="textSecondary">예상 제한해제 시간 (±5분): {getLimitResetTime(session.limit)}</T>}
      </M.CardContent>
      <M.Divider variant="middle" />
      <M.CardActions disableSpacing>{renderControls(session)}</M.CardActions>
      <M.Collapse in={expanded} unmountOnExit>
        <M.CardContent>
          <M.Divider />
          {renderTable(session)}
        </M.CardContent>
      </M.Collapse>
    </M.Card>
  )
}

export function ChainBlockSessionsGlobalControl(props: { showPageOpenButton: boolean }) {
  const { openModal } = React.useContext(DialogContext)
  function openAsPage() {
    browser.tabs.create({
      active: true,
      url: '/sessions-page/index.html',
    })
  }
  function requestStopAllChainBlock() {
    openModal({
      dialogType: 'confirm',
      message: {
        title: `실행중인 체인블락 및 언체인블락을 모두 중단하시겠습니까?`,
      },
      callback: stopAllChainBlock,
    })
  }
  return (
    <M.ButtonGroup>
      <M.Button onClick={requestStopAllChainBlock}>
        <M.Icon>highlight_off</M.Icon>
        모두 정지
      </M.Button>
      <M.Button onClick={cleanupSessions}>
        <M.Icon>clear_all</M.Icon>
        완료작업 지우기
      </M.Button>
      {props.showPageOpenButton && (
        <M.Tooltip placement="bottom" title="세션목록 페이지 열기">
          <M.Button onClick={openAsPage}>
            <M.Icon>open_in_new</M.Icon>
          </M.Button>
        </M.Tooltip>
      )}
    </M.ButtonGroup>
  )
}
