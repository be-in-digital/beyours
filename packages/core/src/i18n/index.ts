/**
 * i18n system for BeInDigital Engine
 * @packageDocumentation
 */

// Types
export type {
  Locale,
  TranslationKey,
  TranslationValue,
  TranslationMap,
  Direction,
  LanguageConfig,
  I18nConfig,
  TranslationContext,
  TranslationParams,
  TranslatorFunction,
  LocaleDetectionOptions,
  TranslatedItem,
  HttpClient,
  UseTranslationReturn,
  UseLocaleReturn,
  LanguageSwitcherProps,
} from './types'

// Config
export {
  RTL_LANGUAGES,
  DEFAULT_I18N_CONFIG,
  COMMON_LANGUAGES,
  isRtlLocale,
  getLocaleDirection,
  findLanguageConfig,
} from './config'

// Detection
export {
  detectLocaleFromCookie,
  detectLocaleFromLocalStorage,
  detectLocaleFromBrowser,
  detectLocaleFromHeader,
  detectLocale,
} from './detection'

// Storage
export {
  setLocaleCookie,
  setLocaleLocalStorage,
  setLocale,
  clearLocale,
  getLocaleFromCookie,
  getLocaleFromLocalStorage,
} from './storage'

// Translator
export {
  createTranslator,
  createTranslators,
  validateTranslationMap,
  mergeTranslations,
  getMissingKeys,
} from './translator'

// GPT Translation
export {
  estimateTranslationCost,
  translateText,
  batchTranslate,
  calculateTotalCost,
  groupTranslationResults,
} from './gpt-translation'

// Hook types (implementation in app)
export type {
  UseTranslation,
  UseLocale,
  UseTranslator,
  UseDirection,
  LanguageSwitcherComponent,
  I18nProviderProps,
  I18nProviderComponent,
} from './hooks'
