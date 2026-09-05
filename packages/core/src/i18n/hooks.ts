/**
 * React hook types for i18n (implementation should be in the app)
 * @packageDocumentation
 */

import type React from 'react'

import type {
  UseTranslationReturn,
  UseLocaleReturn,
  LanguageSwitcherProps,
  TranslatorFunction,
  Locale,
  Direction,
  LanguageConfig,
} from './types'

/**
 * Hook type for useTranslation
 *
 * Implementation example:
 * ```typescript
 * import { useTranslation } from '@/hooks/useTranslation'
 *
 * function MyComponent() {
 *   const { t, locale, setLocale, direction, isRtl } = useTranslation()
 *
 *   return (
 *     <div dir={direction}>
 *       <h1>{t('welcome', { name: 'User' })}</h1>
 *       <button onClick={() => setLocale('fr')}>Français</button>
 *     </div>
 *   )
 * }
 * ```
 */
export type UseTranslation = () => UseTranslationReturn

/**
 * Hook type for useLocale
 *
 * Implementation example:
 * ```typescript
 * import { useLocale } from '@/hooks/useLocale'
 *
 * function LocaleInfo() {
 *   const { locale, setLocale, direction, isRtl } = useLocale()
 *
 *   return (
 *     <div>
 *       <p>Current locale: {locale}</p>
 *       <p>Direction: {direction}</p>
 *       <p>Is RTL: {isRtl ? 'Yes' : 'No'}</p>
 *     </div>
 *   )
 * }
 * ```
 */
export type UseLocale = () => UseLocaleReturn

/**
 * Hook type for useTranslator (returns only the translator function)
 *
 * Implementation example:
 * ```typescript
 * import { useTranslator } from '@/hooks/useTranslator'
 *
 * function MyComponent() {
 *   const t = useTranslator()
 *
 *   return <h1>{t('title')}</h1>
 * }
 * ```
 */
export type UseTranslator = () => TranslatorFunction

/**
 * Hook type for useDirection
 *
 * Implementation example:
 * ```typescript
 * import { useDirection } from '@/hooks/useDirection'
 *
 * function MyComponent() {
 *   const { direction, isRtl } = useDirection()
 *
 *   return <div dir={direction}>Content</div>
 * }
 * ```
 */
export type UseDirection = () => {
  direction: Direction
  isRtl: boolean
}

/**
 * Component type for LanguageSwitcher
 *
 * Implementation example:
 * ```typescript
 * import { LanguageSwitcher } from '@/components/LanguageSwitcher'
 * import { COMMON_LANGUAGES } from '@be-in-digital/core'
 *
 * function Header() {
 *   const { locale, setLocale } = useLocale()
 *
 *   return (
 *     <header>
 *       <LanguageSwitcher
 *         languages={COMMON_LANGUAGES}
 *         currentLocale={locale}
 *         onLocaleChange={setLocale}
 *       />
 *     </header>
 *   )
 * }
 * ```
 */
export type LanguageSwitcherComponent = (props: LanguageSwitcherProps) => React.ReactElement

/**
 * Provider props type for I18nProvider
 *
 * Implementation example:
 * ```typescript
 * import { I18nProvider } from '@/providers/I18nProvider'
 * import { DEFAULT_I18N_CONFIG } from '@be-in-digital/core'
 *
 * function App({ children }) {
 *   return (
 *     <I18nProvider
 *       config={DEFAULT_I18N_CONFIG}
 *       translations={translations}
 *       initialLocale="fr"
 *     >
 *       {children}
 *     </I18nProvider>
 *   )
 * }
 * ```
 */
export interface I18nProviderProps {
  /** i18n configuration */
  config?: import('./types').I18nConfig
  /** Translations by locale */
  translations: Record<Locale, import('./types').TranslationMap>
  /** Initial locale (if not detected) */
  initialLocale?: Locale
  /** Children components */
  children: React.ReactNode
}

/**
 * Provider type for I18nProvider
 */
export type I18nProviderComponent = (props: I18nProviderProps) => React.ReactElement

// Re-export types for convenience
export type {
  UseTranslationReturn,
  UseLocaleReturn,
  LanguageSwitcherProps,
  TranslatorFunction,
  Locale,
  Direction,
  LanguageConfig,
}
