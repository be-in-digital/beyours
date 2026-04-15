/**
 * Translation system with interpolation and pluralization
 * @packageDocumentation
 */

import { z } from 'zod'
import type { TranslationMap, TranslationKey, TranslationParams, TranslatorFunction, Locale } from './types'

const translationKeySchema = z.string().min(1)
const translationParamsSchema = z.record(z.string(), z.union([z.string(), z.number()]))

/**
 * Replace placeholders in a string with values from params
 *
 * Supports:
 * - {{key}} for interpolation
 * - {{count}} for plural forms
 *
 * @param template - Template string with placeholders
 * @param params - Values to interpolate
 * @returns Interpolated string
 */
function interpolate(template: string, params: TranslationParams): string {
  return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
    const value = params[key]
    return value !== undefined ? String(value) : match
  })
}

/**
 * Get the plural form of a translation
 *
 * Simple pluralization:
 * - If count = 0 or 1: singular form
 * - If count > 1: plural form (adds 's' if not already present)
 *
 * For custom plural forms, use separate keys (e.g., "item.zero", "item.one", "item.other")
 *
 * @param singular - Singular form
 * @param count - Count for pluralization
 * @returns Plural form
 */
function pluralize(singular: string, count: number): string {
  if (count === 0 || count === 1) {
    return singular
  }

  // Simple English pluralization (add 's' if not present)
  if (!singular.endsWith('s')) {
    return `${singular}s`
  }

  return singular
}

/**
 * Create a translator function for a given locale
 *
 * @param translations - Translation map for the locale
 * @param locale - Current locale
 * @param fallbackTranslations - Optional fallback translations
 * @returns Translator function
 *
 * @example
 * ```typescript
 * const t = createTranslator(
 *   { 'hello': 'Bonjour {{name}}', 'items': '{{count}} article' },
 *   'fr',
 *   { 'hello': 'Hello {{name}}' }
 * )
 *
 * t('hello', { name: 'Jean' }) // "Bonjour Jean"
 * t('items', { count: 5 }) // "5 articles"
 * t('missing') // "missing" (key returned as fallback)
 * ```
 */
export function createTranslator(
  translations: TranslationMap,
  locale: Locale,
  fallbackTranslations?: TranslationMap
): TranslatorFunction {
  return (key: TranslationKey, params?: TranslationParams): string => {
    // Validate inputs
    const keyResult = translationKeySchema.safeParse(key)
    if (!keyResult.success) {
      if (process.env.NODE_ENV !== 'production') {
        console.warn(`[i18n] Invalid translation key: ${key}`)
      }
      return key
    }

    if (params) {
      const paramsResult = translationParamsSchema.safeParse(params)
      if (!paramsResult.success) {
        if (process.env.NODE_ENV !== 'production') {
          console.warn(`[i18n] Invalid translation params for key "${key}":`, params)
        }
        return key
      }
    }

    // Get translation
    let translation = translations[key]

    // Try fallback if missing
    if (!translation && fallbackTranslations) {
      translation = fallbackTranslations[key]
    }

    // Return key if no translation found
    if (!translation) {
      if (process.env.NODE_ENV !== 'production') {
        console.warn(`[i18n] Missing translation for key "${key}" in locale "${locale}"`)
      }
      return key
    }

    // No params: return as-is
    if (!params) {
      return translation
    }

    // Handle pluralization
    if ('count' in params && typeof params.count === 'number') {
      translation = pluralize(translation, params.count)
    }

    // Interpolate params
    return interpolate(translation, params)
  }
}

/**
 * Batch create translators for multiple locales
 *
 * @param translationsByLocale - Map of locale to translation map
 * @param fallbackLocale - Fallback locale
 * @returns Map of locale to translator function
 */
export function createTranslators(
  translationsByLocale: Record<Locale, TranslationMap>,
  fallbackLocale: Locale
): Record<Locale, TranslatorFunction> {
  const translators: Record<Locale, TranslatorFunction> = {}
  const fallbackTranslations = translationsByLocale[fallbackLocale]

  for (const [locale, translations] of Object.entries(translationsByLocale)) {
    translators[locale] = createTranslator(
      translations,
      locale,
      locale !== fallbackLocale ? fallbackTranslations : undefined
    )
  }

  return translators
}

/**
 * Validate a translation map
 *
 * @param translations - Translation map to validate
 * @returns Whether the translation map is valid
 */
export function validateTranslationMap(translations: unknown): translations is TranslationMap {
  if (typeof translations !== 'object' || translations === null) {
    return false
  }

  for (const [key, value] of Object.entries(translations)) {
    if (typeof key !== 'string' || typeof value !== 'string') {
      return false
    }
  }

  return true
}

/**
 * Merge translation maps (useful for plugins/extensions)
 *
 * @param base - Base translation map
 * @param override - Override translation map
 * @returns Merged translation map
 */
export function mergeTranslations(
  base: TranslationMap,
  override: TranslationMap
): TranslationMap {
  return { ...base, ...override }
}

/**
 * Get missing translation keys between two maps
 *
 * @param source - Source translation map (complete)
 * @param target - Target translation map (to check)
 * @returns Array of missing keys
 */
export function getMissingKeys(
  source: TranslationMap,
  target: TranslationMap
): TranslationKey[] {
  const sourceKeys = Object.keys(source)
  const targetKeys = new Set(Object.keys(target))

  return sourceKeys.filter((key) => !targetKeys.has(key))
}
