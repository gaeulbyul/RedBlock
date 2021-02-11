interface RedBlockOptionsContextType {
  options: RedBlockOptions
  updateOptions(newOptionsPart: Partial<RedBlockOptions>): void
}

export const RedBlockOptionsContext = React.createContext<RedBlockOptionsContextType>(null!)
