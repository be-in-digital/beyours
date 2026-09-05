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
  const match = /^([a-z]{2,3})(?:-([A-Za-z0-9]{2,8}))?$/i.exec(trimmed)
  if (!match) return null

  // Canonicalise the case. `FR` used to come through as `FR`, and the
  // translation lookup is a plain object key — so a store holding `fr` would
  // quietly serve the source language while `<html lang="FR">` claimed
  // otherwise. Language subtag lower, region upper, per BCP 47.
  const language = match[1]!.toLowerCase()
  const region = match[2]?.toUpperCase()
  const canonical = region ? `${language}-${region}` : language

  if (availableCodes && !availableCodes.includes(canonical)) return null

  return canonical
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

  // `Object.hasOwn`, not a bare index: the locale reaches here from a cookie,
  // and `translations["constructor"]` would otherwise answer for every
  // product. Unreachable today — the cookie is validated and the client store
  // gates on the establishment's own languages — but one caller away from not
  // being.
  const translations = doc.translations
  if (translations && Object.hasOwn(translations, locale)) {
    const entry = translations[locale]
    const translated = entry?.[field]
    if (typeof translated === 'string' && translated.trim().length > 0) {
      return translated
    }
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

/** One row of an establishment's `languages` table, as the storefront reads it. */
export interface EstablishmentLanguage {
  code: string
  name: string
  nativeName: string
  flagEmoji?: string | undefined
  isDefault: boolean
  isActive: boolean
}

/** What the storefront should offer, and which of those is the establishment's. */
export interface ResolvedEstablishmentLanguages {
  languages: EstablishmentLanguage[]
  defaultCode: Locale
}

/**
 * Name a locale in English and in itself, for a row we are synthesising.
 *
 * `Intl.DisplayNames` throws on a code it cannot parse, and the admin can type
 * any code at all, so every call is guarded. Falling back to the code itself
 * shows `de` rather than nothing — ugly, but it never hides the language.
 */
function describeLocale(code: string): { name: string; nativeName: string } {
  const label = (inLocale: string): string => {
    try {
      return new Intl.DisplayNames([inLocale], { type: 'language' }).of(code) ?? code
    } catch {
      return code
    }
  }
  return { name: label('en'), nativeName: label(code) }
}

/**
 * The languages an establishment offers, and which one it is written in.
 *
 * Two rules, and the first one is the whole point of this function.
 *
 * **The establishment default is never taken from array order.** It used to be:
 * the storefront read `active.find((l) => l.isDefault)?.code ?? active[0]?.code`,
 * and a fresh deployment seeds no `languages` rows while `languages.create`
 * takes `isDefault` from its caller. So the first language an admin added
 * became `active[0]`, carried no flag, and became the default for every diner —
 * a French restaurant adding English served English to French customers, and
 * the resolved locale was written back to the cookie, so the server half
 * agreed on the next request. Issue #325, NEW2-JOURNEY-2. With no flagged row
 * the answer is the source language, which is what the catalogue is written in.
 *
 * **The default is always selectable.** A store whose only row is the language
 * it just added would otherwise offer one entry, and the selector hides itself
 * below two — leaving the source language reachable by no one. When no active
 * row carries the default, one is synthesised for it. It is not persisted:
 * this is a render-time view of what the diner may choose, not a write.
 *
 * @param rows - The store's `languages` rows. Inactive ones are dropped.
 * @param sourceLocale - The language the catalogue is written in.
 */
export function resolveEstablishmentLanguages(
  rows: readonly EstablishmentLanguage[],
  sourceLocale: string = DEFAULT_I18N_CONFIG.defaultLocale
): ResolvedEstablishmentLanguages {
  const active = rows.filter((row) => row.isActive)

  const defaultCode = active.find((row) => row.isDefault)?.code ?? sourceLocale

  if (active.some((row) => row.code === defaultCode)) {
    return { languages: active, defaultCode }
  }

  const { name, nativeName } = describeLocale(defaultCode)
  return {
    languages: [
      { code: defaultCode, name, nativeName, isDefault: true, isActive: true },
      ...active,
    ],
    defaultCode,
  }
}
