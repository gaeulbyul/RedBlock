import { DialogMessageObj } from '../../scripts/text-generate.js'

const M = MaterialUI

export interface DialogContent {
  message: DialogMessageObj
  dialogType: 'confirm' | 'alert'
  callback?: () => void
}

export function RBDialog(props: { isOpen: boolean; content: DialogContent | null; closeModal: () => void }) {
  const { isOpen, content, closeModal } = props
  if (!content) {
    return <div></div>
  }
  const { message, callback, dialogType } = content
  const { title, contentLines, warningLines } = message
  function confirmOk() {
    callback!()
    closeModal()
  }
  function renderControls() {
    switch (dialogType) {
      case 'confirm':
        return (
          <React.Fragment>
            <M.Button onClick={confirmOk} color="primary">
              네
            </M.Button>
            <M.Button onClick={closeModal}>아니요</M.Button>
          </React.Fragment>
        )
      case 'alert':
        return (
          <React.Fragment>
            <M.Button onClick={closeModal} color="primary">
              닫기
            </M.Button>
          </React.Fragment>
        )
    }
  }
  const { Dialog, DialogTitle, DialogContent, DialogContentText, DialogActions } = MaterialUI
  return (
    <Dialog open={isOpen}>
      <DialogTitle>{title}</DialogTitle>
      <DialogContent>
        {contentLines && contentLines.map((line, index) => <DialogContentText key={index}>{line}</DialogContentText>)}
        {warningLines &&
          warningLines.map((line, index) => (
            <DialogContentText key={index} color="error">
              {line}
            </DialogContentText>
          ))}
      </DialogContent>
      <DialogActions>{renderControls()}</DialogActions>
    </Dialog>
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
      {value === index && <M.Box p={1}>{children}</M.Box>}
    </M.Typography>
  )
}
