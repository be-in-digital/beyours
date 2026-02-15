/**
 * Locale storage utilities (cookie and localStorage)
 * @packageDocumentation
 */

import { z } from 'zod'
import type { I18nConfig, Locale } from './types'
import { DEFAULT_I18N_CONFIG } from './config'

const localeSchema = z.string().min(2).max(10)

/**
 * Set locale in cookie (works on both client and server)
 *
 * @param locale - The locale to set
 * @param config - I18n configuration
 * @returns Cookie string to set (use document.cookie or Set-Cookie header)
 */
export function setLocaleCookie(
  locale: Locale,
  config: I18nConfig = DEFAULT_I18N_CONFIG
): string {
  const result = localeSchema.safeParse(locale)
  if (!result.success) {
    throw new Error(`Invalid locale: ${locale}`)
  }

  const cookieValue = encodeURIComponent(locale)
  const maxAge = config.cookieMaxAge
  const cookieString = `${config.cookieName}=${cookieValue}; Max-Age=${maxAge}; Path=/; SameSite=Lax`

  // Set cookie in browser if available
  if (typeof document !== 'undefined') {
    document.cookie = cookieString
  }

  return cookieString
}

/**
 * Set locale in localStorage (client-side only)
 *
 * @param locale - The locale to set
 * @param config - I18n configuration
 */
export function setLocaleLocalStorage(
  locale: Locale,
  config: I18nConfig = DEFAULT_I18N_CONFIG
): void {
  const result = localeSchema.safeParse(locale)
  if (!result.success) {
    throw new Error(`Invalid locale: ${locale}`)
  }

  if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
    return
  }

  try {
    localStorage.setItem(config.localStorageKey, locale)
  } catch {
    // localStorage not available or quota exceeded
  }
}

/**
 * Set locale in both cookie and localStorage
 *
 * @param locale - The locale to set
 * @param config - I18n configuration
 * @returns Cookie string to set
 */
export function setLocale(
  locale: Locale,
  config: I18nConfig = DEFAULT_I18N_CONFIG
): string {
  const cookieString = setLocaleCookie(locale, config)
  setLocaleLocalStorage(locale, config)
  return cookieString
}

/**
 * Clear locale from both cookie and localStorage
 *
 * @param config - I18n configuration
 * @returns Cookie string to set for clearing
 */
export function clearLocale(config: I18nConfig = DEFAULT_I18N_CONFIG): string {
  // Clear cookie
  const cookieString = `${config.cookieName}=; Max-Age=0; Path=/`

  if (typeof document !== 'undefined') {
    document.cookie = cookieString
  }

  // Clear localStorage
  if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
    try {
      localStorage.removeItem(config.localStorageKey)
    } catch {
      // localStorage not available
    }
  }

  return cookieString
}

/**
 * Get current locale from cookie string (server-side helper)
 *
 * @param cookieString - Cookie string from request headers
 * @param config - I18n configuration
 * @returns Current locale or null
 */
export function getLocaleFromCookie(
  cookieString: string,
  config: I18nConfig = DEFAULT_I18N_CONFIG
): Locale | null {
  try {
    const cookies = cookieString.split(';').map((c) => c.trim())

    for (const cookie of cookies) {
      const [name, value] = cookie.split('=')
      if (name === config.cookieName && value) {
        const decoded = decodeURIComponent(value)
        const result = localeSchema.safeParse(decoded)
        if (result.success) {
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
 * Get current locale from localStorage (client-side helper)
 *
 * @param config - I18n configuration
 * @returns Current locale or null
 */
export function getLocaleFromLocalStorage(
  config: I18nConfig = DEFAULT_I18N_CONFIG
): Locale | null {
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
    return null
  }

  try {
    const value = localStorage.getItem(config.localStorageKey)
    if (value) {
      const result = localeSchema.safeParse(value)
      if (result.success) {
        return result.data
      }
    }
  } catch {
    // localStorage not available
  }

  return null
}
