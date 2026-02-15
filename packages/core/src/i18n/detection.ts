/**
 * Locale detection utilities
 * @packageDocumentation
 */

import { z } from 'zod'
import type { I18nConfig, Locale, LocaleDetectionOptions } from './types'
import { DEFAULT_I18N_CONFIG } from './config'

const localeSchema = z.string().min(2).max(10)

/**
 * Detect locale from cookie string
 *
 * @param cookieString - Cookie string from request headers
 * @param config - I18n configuration
 * @returns Detected locale or null
 */
export function detectLocaleFromCookie(
  cookieString: string,
  config: I18nConfig = DEFAULT_I18N_CONFIG
): Locale | null {
  try {
    const cookieName = config.cookieName
    const cookies = cookieString.split(';').map((c) => c.trim())

    for (const cookie of cookies) {
      const [name, value] = cookie.split('=')
      if (name === cookieName && value) {
        const decoded = decodeURIComponent(value)
        const result = localeSchema.safeParse(decoded)
        if (result.success && config.supportedLocales.includes(result.data)) {
          return result.data
        }
      }
    }
  } catch {
    // Invalid cookie format
  }

  return null
}

/**
 * Detect locale from localStorage (client-side only)
 *
 * @param config - I18n configuration
 * @returns Detected locale or null
 */
export function detectLocaleFromLocalStorage(
  config: I18nConfig = DEFAULT_I18N_CONFIG
): Locale | null {
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
    return null
  }

  try {
    const value = localStorage.getItem(config.localStorageKey)
    if (value) {
      const result = localeSchema.safeParse(value)
      if (result.success && config.supportedLocales.includes(result.data)) {
        return result.data
      }
    }
  } catch {
    // localStorage not available or error
  }

  return null
}

/**
 * Detect locale from browser language (client-side only)
 *
 * @param config - I18n configuration
 * @returns Detected locale or null
 */
export function detectLocaleFromBrowser(
  config: I18nConfig = DEFAULT_I18N_CONFIG
): Locale | null {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return null
  }

  try {
    const browserLang = navigator.language || (navigator as any).userLanguage
    if (browserLang) {
      // Try full locale first (e.g., "fr-FR")
      if (config.supportedLocales.includes(browserLang)) {
        return browserLang
      }

      // Try language part only (e.g., "fr" from "fr-FR")
      const langCode = browserLang.split('-')[0]
      if (langCode && config.supportedLocales.includes(langCode)) {
        return langCode
      }
    }
  } catch {
    // Browser detection failed
  }

  return null
}

/**
 * Detect locale from Accept-Language header (server-side)
 *
 * @param acceptLanguage - Accept-Language header value
 * @param config - I18n configuration
 * @returns Detected locale or null
 */
export function detectLocaleFromHeader(
  acceptLanguage: string,
  config: I18nConfig = DEFAULT_I18N_CONFIG
): Locale | null {
  if (!acceptLanguage) {
    return null
  }

  try {
    // Parse Accept-Language header (e.g., "fr-FR,fr;q=0.9,en;q=0.8")
    const languages = acceptLanguage
      .split(',')
      .map((lang) => {
        const parts = lang.trim().split(';')
        const code = parts[0] ?? ''
        const quality = parts[1] ? parseFloat(parts[1].split('=')[1] ?? '1') : 1
        return { code, quality }
      })
      .filter(({ code }) => code.length > 0)
      .sort((a, b) => b.quality - a.quality)

    for (const { code } of languages) {
      // Try full locale first
      if (config.supportedLocales.includes(code as Locale)) {
        return code as Locale
      }

      // Try language part only
      const langCode = code.split('-')[0]
      if (langCode && config.supportedLocales.includes(langCode as Locale)) {
        return langCode as Locale
      }
    }
  } catch {
    // Header parsing failed
  }

  return null
}

/**
 * Detect locale with fallback cascade
 *
 * Priority:
 * 1. Cookie
 * 2. localStorage (client-side)
 * 3. Browser language (client-side) or Accept-Language header (server-side)
 * 4. Default locale
 *
 * @param config - I18n configuration
 * @param options - Detection options
 * @returns Detected locale
 */
export function detectLocale(
  config: I18nConfig = DEFAULT_I18N_CONFIG,
  options: LocaleDetectionOptions = {}
): Locale {
  // 1. Try cookie
  if (options.cookieString) {
    const locale = detectLocaleFromCookie(options.cookieString, config)
    if (locale) return locale
  }

  // 2. Try localStorage (client-side)
  if (options.useLocalStorage !== false) {
    const locale = detectLocaleFromLocalStorage(config)
    if (locale) return locale
  }

  // 3. Try browser or header
  if (options.acceptLanguage) {
    // Server-side
    const locale = detectLocaleFromHeader(options.acceptLanguage, config)
    if (locale) return locale
  } else if (options.useBrowser !== false) {
    // Client-side
    const locale = detectLocaleFromBrowser(config)
    if (locale) return locale
  }

  // 4. Fallback to default
  return config.defaultLocale
}
