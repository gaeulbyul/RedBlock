import browser from 'webextension-polyfill'

type I18NMessages = typeof import('../_locales/ko/messages.json')
type SubstItem = number | string
type Substitutions = SubstItem | SubstItem[] | undefined
type I18NMessageKeys = keyof I18NMessages

export function getMessage(key: string & I18NMessageKeys, substs: Substitutions = undefined) {
  if (Array.isArray(substs)) {
    return browser.i18n.getMessage(
      key,
      substs.map(s => s.toLocaleString()),
    )
  } else if (typeof substs === 'number') {
    return browser.i18n.getMessage(key, substs.toLocaleString())
  } else {
    return browser.i18n.getMessage(key, substs)
  }
}

export function getUILanguage(): browser.I18n.LanguageCode {
  return browser.i18n.getUILanguage()
}

export function reaction(reaction: ReactionV2Kind): string {
  switch (reaction) {
    case 'Like':
      return getMessage('reaction_like')
    case 'Cheer':
      return getMessage('reaction_cheer')
    case 'Hmm':
      return getMessage('reaction_hmm')
    case 'Sad':
      return getMessage('reaction_sad')
    case 'Haha':
      return getMessage('reaction_haha')
  }
}

function checkMissingTranslations(
  // ko/messages.json 엔 있고 en/messages.json 엔 없는 키가 있으면
  // TypeScript 컴파일러가 타입에러를 일으킨다.
  // tsconfig.json의 resolveJsonModule 옵션을 켜야 함
  keys:
    | Exclude<
      keyof typeof import('../_locales/ko/messages.json'),
      keyof typeof import('../_locales/en/messages.json')
    >
    | Exclude<
      keyof typeof import('../_locales/en/messages.json'),
      keyof typeof import('../_locales/ko/messages.json')
    >,
  find: (_keys: never) => void,
  _check = find(keys),
) {}
checkMissingTranslations
