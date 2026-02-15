/**
 * Default configuration and constants for the i18n system
 * @packageDocumentation
 */

import type { I18nConfig, Locale, LanguageConfig } from './types'

/**
 * List of known right-to-left languages
 */
export const RTL_LANGUAGES: Locale[] = ['ar', 'he', 'fa', 'ur', 'ps', 'sd', 'yi']

/**
 * Default i18n configuration
 */
export const DEFAULT_I18N_CONFIG: I18nConfig = {
  defaultLocale: 'fr',
  supportedLocales: ['fr', 'en'],
  fallbackLocale: 'fr',
  cookieName: 'beid_locale',
  localStorageKey: 'beid_locale',
  cookieMaxAge: 365 * 24 * 60 * 60, // 365 days in seconds
}

/**
 * Common language configurations
 */
export const COMMON_LANGUAGES: LanguageConfig[] = [
  {
    code: 'fr',
    name: 'French',
    nativeName: 'Français',
    direction: 'ltr',
    flagEmoji: '🇫🇷',
  },
  {
    code: 'en',
    name: 'English',
    nativeName: 'English',
    direction: 'ltr',
    flagEmoji: '🇬🇧',
  },
  {
    code: 'es',
    name: 'Spanish',
    nativeName: 'Español',
    direction: 'ltr',
    flagEmoji: '🇪🇸',
  },
  {
    code: 'de',
    name: 'German',
    nativeName: 'Deutsch',
    direction: 'ltr',
    flagEmoji: '🇩🇪',
  },
  {
    code: 'it',
    name: 'Italian',
    nativeName: 'Italiano',
    direction: 'ltr',
    flagEmoji: '🇮🇹',
  },
  {
    code: 'pt',
    name: 'Portuguese',
    nativeName: 'Português',
    direction: 'ltr',
    flagEmoji: '🇵🇹',
  },
  {
    code: 'ar',
    name: 'Arabic',
    nativeName: 'العربية',
    direction: 'rtl',
    flagEmoji: '🇸🇦',
  },
  {
    code: 'zh',
    name: 'Chinese',
    nativeName: '中文',
    direction: 'ltr',
    flagEmoji: '🇨🇳',
  },
  {
    code: 'ja',
    name: 'Japanese',
    nativeName: '日本語',
    direction: 'ltr',
    flagEmoji: '🇯🇵',
  },
  {
    code: 'ko',
    name: 'Korean',
    nativeName: '한국어',
    direction: 'ltr',
    flagEmoji: '🇰🇷',
  },
]

/**
 * Check if a locale is right-to-left
 *
 * @param locale - The locale to check
 * @returns Whether the locale is RTL
 */
export function isRtlLocale(locale: Locale): boolean {
  return RTL_LANGUAGES.includes(locale)
}

/**
 * Get the text direction for a locale
 *
 * @param locale - The locale to check
 * @returns The text direction ('ltr' or 'rtl')
 */
export function getLocaleDirection(locale: Locale): 'ltr' | 'rtl' {
  return isRtlLocale(locale) ? 'rtl' : 'ltr'
}

/**
 * Find a language configuration by locale code
 *
 * @param locale - The locale to find
 * @returns The language configuration or undefined
 */
export function findLanguageConfig(locale: Locale): LanguageConfig | undefined {
  return COMMON_LANGUAGES.find((lang) => lang.code === locale)
}
