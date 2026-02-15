/**
 * Types for the i18n system
 * @packageDocumentation
 */

/**
 * Locale code (e.g., "fr", "en", "es", "ar")
 */
export type Locale = string

/**
 * Translation key used to identify a translation
 */
export type TranslationKey = string

/**
 * Translation value (the actual translated text)
 */
export type TranslationValue = string

/**
 * Map of translation keys to their values
 */
export type TranslationMap = Record<TranslationKey, TranslationValue>

/**
 * Text direction for a language
 */
export type Direction = 'ltr' | 'rtl'

/**
 * Configuration for a language
 */
export interface LanguageConfig {
  /** ISO language code */
  code: Locale
  /** English name of the language */
  name: string
  /** Native name of the language */
  nativeName: string
  /** Text direction */
  direction: Direction
  /** Optional flag emoji */
  flagEmoji?: string
}

/**
 * Configuration for the i18n system
 */
export interface I18nConfig {
  /** Default locale to use */
  defaultLocale: Locale
  /** List of supported locales */
  supportedLocales: Locale[]
  /** Fallback locale when a translation is missing */
  fallbackLocale: Locale
  /** Name of the cookie to store the locale */
  cookieName: string
  /** Key for localStorage */
  localStorageKey: string
  /** Cookie max age in seconds */
  cookieMaxAge: number
}

/**
 * Context for translation operations
 */
export interface TranslationContext {
  /** Current locale */
  locale: Locale
  /** Translations for the current locale */
  translations: TranslationMap
  /** Text direction for the current locale */
  direction: Direction
  /** Whether the locale is right-to-left */
  isRtl: boolean
}

/**
 * Parameters for interpolation in translations
 */
export type TranslationParams = Record<string, string | number>

/**
 * Translator function type
 */
export type TranslatorFunction = (key: TranslationKey, params?: TranslationParams) => string

/**
 * Options for locale detection
 */
export interface LocaleDetectionOptions {
  /** Cookie string (server-side) */
  cookieString?: string
  /** Accept-Language header (server-side) */
  acceptLanguage?: string
  /** Whether to use localStorage (client-side) */
  useLocalStorage?: boolean
  /** Whether to use browser detection (client-side) */
  useBrowser?: boolean
}

/**
 * Translated item result
 */
export interface TranslatedItem {
  /** Original text */
  original: string
  /** Translated text */
  translated: string
  /** Target locale */
  locale: Locale
  /** Estimated cost in USD */
  cost: number
}

/**
 * HTTP client interface for GPT translation
 */
export interface HttpClient {
  /**
   * Make a POST request to the OpenAI API
   */
  post<T = unknown>(url: string, data: unknown, headers?: Record<string, string>): Promise<T>
}

/**
 * Return type for useTranslation hook
 */
export interface UseTranslationReturn {
  /** Translator function */
  t: TranslatorFunction
  /** Current locale */
  locale: Locale
  /** Set the locale */
  setLocale: (locale: Locale) => void
  /** Text direction */
  direction: Direction
  /** Whether the locale is RTL */
  isRtl: boolean
}

/**
 * Return type for useLocale hook
 */
export interface UseLocaleReturn {
  /** Current locale */
  locale: Locale
  /** Set the locale */
  setLocale: (locale: Locale) => void
  /** Text direction */
  direction: Direction
  /** Whether the locale is RTL */
  isRtl: boolean
}

/**
 * Props for LanguageSwitcher component
 */
export interface LanguageSwitcherProps {
  /** Available languages */
  languages: LanguageConfig[]
  /** Current locale */
  currentLocale: Locale
  /** Callback when locale changes */
  onLocaleChange: (locale: Locale) => void
}
