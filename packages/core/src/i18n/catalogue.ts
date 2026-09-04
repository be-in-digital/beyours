/**
 * Reading translated catalogue text off a document (#147/#148).
 *
 * Two storage models live side by side and they are not interchangeable. CMS
 * blocks, blog posts and UI strings go into the `translations` **table**, keyed
 * by entity and field. Products, categories and menus instead carry their
 * translations **on the document**, in a `translations` column keyed by
 * language code — that is what the auto-translator writes, and it is what the
 * storefront has to read. A page holding a product already holds its
 * translations; it must not go looking for them by id.
 *
 * @packageDocumentation
 */

import { DEFAULT_I18N_CONFIG } from './config'
import type { I18nConfig, Locale } from './types'

/** The per-language entry the auto-translator writes on a catalogue document. */
export interface DocumentTranslationEntry {
  name?: string | undefined
  description?: string | undefined
  /** Source hashes and manual-override flags. Never rendered. */
  _meta?: unknown
}

/** The shape `localizeDocument` needs. Any product, category or menu satisfies it. */
export interface TranslatableDocument {
  name?: string | null | undefined
  description?: string | null | undefined
  translations?: Record<string, DocumentTranslationEntry> | null | undefined
}

/** What the storefront renders. */
export interface LocalizedText {
  name: string
  description: string | undefined
}

/** The cookie the whole app agrees on. Read it by this name or read nothing. */
export const LOCALE_COOKIE_NAME = DEFAULT_I18N_CONFIG.cookieName

/**
 * A stored locale value, or null when there isn't a usable one.
 *
 * Server-side counterpart to `getLocaleFromCookie`, which parses a whole
 * `Cookie` header. Next's `cookies()` has already done that parsing, so what
 * is left is the validation: a cookie is attacker-controlled, and this value
 * ends up in a database filter and in `<html lang>`.
 *
 * @param value - The raw cookie value, e.g. from `cookies().get(LOCALE_COOKIE_NAME)`
 * @param availableCodes - The store's active language codes. When given, a
 *   code outside the list is rejected rather than passed on.
 */
export function normalizeStoredLocale(
  value: string | null | undefined,
  availableCodes?: readonly string[]
): Locale | null {
  if (!value) return null

  let decoded: string
  try {
    decoded = decodeURIComponent(value)
  } catch {
    // A malformed percent-escape is not a locale.
    return null
  }

  const trimmed = decoded.trim()

  // ISO 639-1 with an optional region: `fr`, `pt-BR`. Anything else is either
  // a mistake or an injection attempt.
  if (!/^[a-z]{2,3}(-[A-Za-z0-9]{2,8})?$/i.test(trimmed)) return null

  if (availableCodes && !availableCodes.includes(trimmed)) return null

  return trimmed
}

/**
 * Pick one translated field, falling back to the source text.
 *
 * An empty or whitespace-only translation counts as absent: a product with a
 * blank English name must show its French one, not nothing at all.
 */
export function pickTranslatedField(
  doc: TranslatableDocument,
  field: 'name' | 'description',
  locale: string | null | undefined
): string | undefined {
  const source = doc[field] ?? undefined
  if (!locale) return source || undefined

  const translated = doc.translations?.[locale]?.[field]
  if (typeof translated === 'string' && translated.trim().length > 0) {
    return translated
  }

  return source || undefined
}

/**
 * The name and description to render for one catalogue document.
 *
 * Falls through to the source language for any field the translator has not
 * reached yet, so a half-translated catalogue reads as a mixed one rather
 * than a broken one.
 */
export function localizeDocument(
  doc: TranslatableDocument,
  locale: string | null | undefined
): LocalizedText {
  return {
    name: pickTranslatedField(doc, 'name', locale) ?? '',
    description: pickTranslatedField(doc, 'description', locale),
  }
}

/**
 * Return the document with `name` and `description` replaced in place.
 *
 * Handy for a list the storefront renders straight through: the caller keeps
 * every other field — price, images, options — and only the prose moves.
 */
export function localizeDocuments<T extends TranslatableDocument>(
  docs: readonly T[],
  locale: string | null | undefined
): T[] {
  return docs.map((doc) => {
    const { name, description } = localizeDocument(doc, locale)
    return {
      ...doc,
      name,
      ...(description === undefined ? {} : { description }),
    }
  })
}

/**
 * Merge a store's manual UI overrides over its static JSON catalogue.
 *
 * The cascade the language store resolves through is override → static JSON →
 * default locale → key. This builds one layer of it; `createTranslator` walks
 * the rest by taking the default locale's merged map as its fallback.
 */
export function mergeUiStrings(
  staticStrings: Record<string, string> | undefined,
  overrides: Record<string, string> | undefined
): Record<string, string> {
  return { ...(staticStrings ?? {}), ...(overrides ?? {}) }
}

/**
 * The locale to render for, given what the request carries and what the store
 * actually offers.
 *
 * Deliberately does NOT consult `config.supportedLocales`: that list is a
 * two-entry constant (`fr`, `en`), while the product sells "the admin adds any
 * language". The store's own active languages are the allow-list.
 */
export function resolveRequestLocale(options: {
  cookieValue?: string | null | undefined
  availableCodes?: readonly string[] | undefined
  defaultLocale?: string | undefined
  config?: I18nConfig
}): Locale {
  const fallback =
    options.defaultLocale ?? (options.config ?? DEFAULT_I18N_CONFIG).defaultLocale

  return (
    normalizeStoredLocale(options.cookieValue, options.availableCodes) ?? fallback
  )
}
