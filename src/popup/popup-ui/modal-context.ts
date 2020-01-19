export interface ModalContent {
  confirmMessage: string | JSX.Element
  callback: () => void
}

const modalContextValue = {
  openModal(_content: ModalContent) {},
}

export const ModalContext = React.createContext(modalContextValue)
