import { ModalContent } from './contexts.js'

const modalStyle = Object.assign({}, ReactModal.defaultStyles)
modalStyle.overlay!.backgroundColor = 'rgba(33, 33, 33, .50)'

export function RBModal(props: { isOpen: boolean; content: ModalContent | null; closeModal: () => void }) {
  const { isOpen, content, closeModal } = props
  if (!content) {
    return <div></div>
  }
  const { message, callback, modalType } = content
  function confirmOk() {
    callback!()
    closeModal()
  }
  function renderControls() {
    switch (modalType) {
      case 'confirm':
        return (
          <React.Fragment>
            <button onClick={confirmOk}>네</button>
            <button onClick={closeModal}>아니오</button>
          </React.Fragment>
        )
      case 'alert':
        return (
          <React.Fragment>
            <button onClick={closeModal}>닫기</button>
          </React.Fragment>
        )
    }
  }
  return (
    <ReactModal isOpen={isOpen} style={modalStyle}>
      <div className="modal-content">
        <div className="confirm-message">{message}</div>
        <div className="controls modal-controls">{renderControls()}</div>
      </div>
    </ReactModal>
  )
}

// from https://material-ui.com/components/tabs/#SimpleTabs.tsx
export function TabPanel(props: { children?: React.ReactNode; index: any; value: any }) {
  const { children, value, index, ...other } = props
  const M = MaterialUI
  return (
    <M.Typography
      component="div"
      role="tabpanel"
      hidden={value !== index}
      id={`simple-tabpanel-${index}`}
      aria-labelledby={`simple-tab-${index}`}
      {...other}
    >
      {value === index && <M.Box p={3}>{children}</M.Box>}
    </M.Typography>
  )
}
