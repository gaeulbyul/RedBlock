type I18NMessages = typeof import('../_locales/ko/messages.json')
type Substitutions = string | string[] | undefined

export type I18NMessageKeys = keyof I18NMessages

export function getMessage(key: string & I18NMessageKeys, substs: Substitutions = undefined) {
  return browser.i18n.getMessage(key, substs)
}
