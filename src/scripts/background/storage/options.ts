function deleteUnusedOptions(options: RedBlockStorage['options'] | null) {
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

export async function loadOptions(): Promise<RedBlockStorage['options']> {
  const { options } = ((await browser.storage.local.get('options')) as unknown) as RedBlockStorage
  deleteUnusedOptions(options)
  return Object.assign({}, defaultOptions, options)
}

export async function saveOptions(newOptions: RedBlockStorage['options']): Promise<void> {
  const options: RedBlockStorage['options'] = Object.assign({}, defaultOptions, newOptions)
  deleteUnusedOptions(options)
  const storageObject = { options }
  return browser.storage.local.set(storageObject as any)
}

export const defaultOptions: Readonly<RedBlockStorage['options']> = Object.freeze({
  removeSessionAfterComplete: false,
})
