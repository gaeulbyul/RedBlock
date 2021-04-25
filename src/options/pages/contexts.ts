interface RedBlockOptionsContextType {
  options: RedBlockOptions
  uiOptions: RedBlockUIOptions
  updateOptions(newOptionsPart: Partial<RedBlockOptions>): void
  updateUIOptions(newUIOptionsPart: Partial<RedBlockUIOptions>): void
}

export const RedBlockOptionsContext = React.createContext<RedBlockOptionsContextType>(null!)
