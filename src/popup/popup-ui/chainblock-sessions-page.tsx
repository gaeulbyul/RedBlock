import { isRunningStatus, SessionStatus } from '../../scripts/common.js'
import * as TextGenerate from '../../scripts/text-generate.js'
import { cleanupSessions, stopAllChainBlock, stopChainBlock } from '../popup.js'
import { ModalContext } from './contexts.js'

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

const useStylesForExpandButton = MaterialUI.makeStyles(() =>
  MaterialUI.createStyles({
    expand: {
      marginLeft: 'auto',
    },
  })
)

function ChainBlockSessionItem(props: { session: SessionInfo }) {
  const { session } = props
  const { purpose, target } = session.request
  const modalContext = React.useContext(ModalContext)
  const classes = useStylesForExpandButton()
  const [expanded, setExpanded] = React.useState(false)
  function toggleExpand() {
    setExpanded(!expanded)
  }
  const isChainBlock = purpose === 'chainblock'
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
  let subheader = ''
  if (isFollowerChainBlock) {
    subheader += `@${user.screen_name}의 ${targetListKor}`
  } else {
    subheader += `@${user.screen_name}가 작성한 트윗을 ${targetListKor}한 사용자`
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
          modalType: 'confirm',
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
      closeButtonTitleText = TextGenerate.stopButtonTitleMessage(request)
    }
    return (
      <React.Fragment>
        <M.Button title={closeButtonTitleText} onClick={requestStopChainBlock}>
          {closeButtonText}
        </M.Button>
        <M.IconButton className={classes.expand} onClick={toggleExpand}>
          <M.Icon>{expanded ? 'expand_more' : 'expand_less'}</M.Icon>
        </M.IconButton>
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
  return (
    <M.Card>
      <M.CardHeader avatar={<M.Avatar src={biggerProfileImageUrl} />} title={purposeKor} subheader={subheader} />
      <M.CardContent>
        {progressBar}
        <T>상태: {statusToString(session.status)}</T>
      </M.CardContent>
      <M.Divider variant="middle" />
      <M.CardActions disableSpacing>{renderControls(session)}</M.CardActions>
      <M.Collapse in={expanded} unmountOnExit>
        <M.CardContent>{renderTable(session)}</M.CardContent>
      </M.Collapse>
    </M.Card>
  )
}

export default function ChainBlockSessionsPage(props: { sessions: SessionInfo[] }) {
  const { sessions } = props
  const modalContext = React.useContext(ModalContext)
  function renderGlobalControls() {
    function requestStopAllChainBlock() {
      const message = `실행중인 체인블락 및 언체인블락을 모두 중단하시겠습니까?`
      modalContext.openModal({
        modalType: 'confirm',
        message,
        callback: stopAllChainBlock,
      })
    }
    return (
      <div className="controls align-to-end">
        <button type="button" onClick={requestStopAllChainBlock}>
          모두 정지
        </button>
        <button type="button" onClick={cleanupSessions}>
          완료작업 지우기
        </button>
      </div>
    )
  }
  function renderSessions() {
    return (
      <div className="chainblock-sessions">
        {sessions.map(session => (
          <ChainBlockSessionItem session={session as SessionInfo} key={session.sessionId} />
        ))}
      </div>
    )
  }
  function renderEmptySessions() {
    return (
      <div className="chainblock-suggest-start">
        현재 진행중인 세션이 없습니다. 체인블락을 실행하려면 "새 세션" 탭을 눌러주세요.
      </div>
    )
  }
  const isSessionExist = sessions.length > 0
  return (
    <div>
      {renderGlobalControls()}
      <hr />
      {isSessionExist ? renderSessions() : renderEmptySessions()}
    </div>
  )
}
