/**
 * Translation system with interpolation
 * @packageDocumentation
 */

import { z } from 'zod'
import type { TranslationMap, TranslationKey, TranslationParams, TranslatorFunction, Locale } from './types'

const translationKeySchema = z.string().min(1)
const translationParamsSchema = z.record(z.string(), z.union([z.string(), z.number()]))

/**
 * Replace placeholders in a string with values from params
 *
 * Supports both brace styles, and it has to:
 * - `{{key}}` — what this module was written for
 * - `{key}` — what the shipped locale catalogues actually use
 *   (`{count} article`, `Livraison gratuite à partir de {amount}`), and what
 *   the GPT bulk translator is told to preserve verbatim
 *   (`@be-yours/convex-functions/autoTranslate`)
 *
 * Reading only the double form meant every catalogue string carrying a value
 * rendered its placeholder to the customer: `{count} articles`, literally.
 *
 * An unknown placeholder is left as it stands rather than blanked, so a
 * missing parameter is visible in review instead of silently eating a number.
 *
 * @param template - Template string with placeholders
 * @param params - Values to interpolate
 * @returns Interpolated string
 */
function interpolate(template: string, params: TranslationParams): string {
  // The double-brace alternative is listed first: alternation is ordered, so
  // `{{name}}` is consumed whole and never mistaken for `{name}` wrapped in
  // stray braces.
  return template.replace(
    /\{\{(\w+)\}\}|\{(\w+)\}/g,
    (match, doubled?: string, single?: string) => {
      const key = doubled ?? single
      if (key === undefined) return match
      const value = params[key]
      return value !== undefined ? String(value) : match
    }
  )
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
 * t('items', { count: 5 }) // "5 article" — the caller picks the plural key
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

    // No automatic pluralization. It appended an English "s" to the WHOLE
    // string whenever a `count` param was present, which is wrong in the
    // language this product is written in and wrong in most others:
    //
    //   "Choisir exactement {count}"  + {count: 3}  ->  "Choisir exactement 3s"
    //   "Table {count}"               + {count: 4}  ->  "Table 4s"
    //
    // The catalogues already carry explicit pairs — `cart.item` beside
    // `cart.items`, `{count} article` beside `{count} articles` — so the
    // caller picks the key and the translator only substitutes.
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
