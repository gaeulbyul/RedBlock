export interface ModalContent {
  message: string | JSX.Element
  modalType: 'confirm' | 'alert'
  callback?: () => void
}

const modalContextValue = {
  openModal(_content: ModalContent) {},
}

export const ModalContext = React.createContext(modalContextValue)
