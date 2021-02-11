function deleteUnusedOptions(options: RedBlockOptions | null) {
  // 최초 설치 후 실행시 null/undefined가 온다.
  if (!options) {
    return
  }
  const optionsAsAny = options as any
  delete optionsAsAny.tweetReactionBasedChainBlock
  delete optionsAsAny.experimental_tweetReactionBasedChainBlock
  delete optionsAsAny.enableRailgun
  delete optionsAsAny.useStandardBlockAPI
}

export async function loadOptions(): Promise<RedBlockOptions> {
  const { options } = ((await browser.storage.local.get('options')) as unknown) as RedBlockStorage
  deleteUnusedOptions(options)
  return Object.assign({}, defaultOptions, options)
}

export async function saveOptions(newOptions: RedBlockOptions): Promise<void> {
  const options: RedBlockOptions = Object.assign({}, defaultOptions, newOptions)
  deleteUnusedOptions(options)
  const storageObject = { options }
  return browser.storage.local.set(storageObject as any)
}

export const defaultOptions = Object.freeze<RedBlockOptions>({
  removeSessionAfterComplete: false,
  skipInactiveUser: 'never',
  revealBioBlockMode: false,
  enableAntiBlock: false,
  firstPartyIsolationCompatibleMode: false,
})
