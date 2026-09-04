/**
 * Language Store - Zustand
 *
 * Client-side state management for locale selection.
 * No Zustand persist — persistence is delegated to core i18n storage
 * (localStorage as source of truth, cookie as backup).
 */

import { create } from 'zustand'
import {
  setLocale,
  getLocaleFromLocalStorage,
  getLocaleFromCookie,
  createTranslator,
  mergeUiStrings,
} from '@be-in-digital/core'
import type { TranslatorFunction } from '@be-in-digital/core'

/**
 * Language document from Convex (subset of fields needed client-side)
 */
export interface Language {
  code: string
  name: string
  nativeName: string
  flagEmoji?: string
  isDefault: boolean
  isActive: boolean
}

/**
 * Language state
 */
export interface LanguageState {
  locale: string
  defaultLocale: string
  availableLanguages: Language[]
  isReady: boolean
  /** UI overrides from Convex: { [langCode]: { [key]: value } } */
  overrides: Record<string, Record<string, string>>
  /** Static JSON strings loaded from locale files */
  staticStrings: Map<string, Record<string, string>>
}

/**
 * Language actions
 */
export interface LanguageActions {
  setLocale: (code: string) => void
  initialize: (storeLanguages: Language[], storeDefault: string) => void
  setOverrides: (overrides: Record<string, Record<string, string>>) => void
  setStaticStrings: (strings: Map<string, Record<string, string>>) => void
}

export type LanguageStore = LanguageState & LanguageActions

/**
 * Normalize a browser locale tag to a base code.
 * "fr-FR" → "fr", "en-US" → "en"
 */
function normalizeLocaleCode(code: string): string {
  return code.split('-')[0] ?? code
}

/**
 * Detect initial locale from client storage and browser preferences.
 *
 * Cascade:
 * 1. localStorage
 * 2. cookie
 * 3. navigator.languages (exact match then base match)
 * 4. store default
 *
 * If localStorage value is invalid (not in available codes),
 * do NOT overwrite cookie — fall through to next source.
 */
function detectInitialLocale(
  availableCodes: string[],
  storeDefault: string
): string {
  // 1. localStorage
  const fromStorage = getLocaleFromLocalStorage()
  if (fromStorage && availableCodes.includes(fromStorage)) {
    return fromStorage
  }

  // 2. cookie
  if (typeof document !== 'undefined') {
    const fromCookie = getLocaleFromCookie(document.cookie)
    if (fromCookie && availableCodes.includes(fromCookie)) {
      return fromCookie
    }
  }

  // 3. navigator.languages
  if (typeof navigator !== 'undefined' && navigator.languages) {
    for (const browserLang of navigator.languages) {
      // Exact match first
      if (availableCodes.includes(browserLang)) {
        return browserLang
      }
      // Base match (fr-FR → fr)
      const base = normalizeLocaleCode(browserLang)
      if (availableCodes.includes(base)) {
        return base
      }
    }
  }

  // 4. Store default
  return storeDefault
}

export const useLanguageStore = create<LanguageStore>()((set, get) => ({
  // Initial state
  locale: 'fr',
  defaultLocale: 'fr',
  availableLanguages: [],
  isReady: false,
  overrides: {},
  staticStrings: new Map(),

  // Actions
  initialize: (storeLanguages, storeDefault) => {
    const availableCodes = storeLanguages
      .filter((l) => l.isActive)
      .map((l) => l.code)

    const detected = detectInitialLocale(availableCodes, storeDefault)

    // If detected locale is no longer active, fallback to store default
    const locale = availableCodes.includes(detected) ? detected : storeDefault

    // Sync localStorage + cookie to the resolved locale
    setLocale(locale)

    set({
      locale,
      defaultLocale: storeDefault,
      availableLanguages: storeLanguages.filter((l) => l.isActive),
      isReady: true,
    })
  },

  setLocale: (code) => {
    const state = get()

    // Idempotent: same locale → no-op
    if (code === state.locale) return

    // Reject unavailable locales
    const availableCodes = state.availableLanguages.map((l) => l.code)
    if (!availableCodes.includes(code)) return

    // Write to localStorage + cookie via core
    setLocale(code)

    set({ locale: code })
  },

  setOverrides: (overrides) => {
    set({ overrides })
  },

  setStaticStrings: (strings) => {
    set({ staticStrings: strings })
  },
}))

/**
 * The state a translator is built from — the four fields, nothing else.
 *
 * Taken as a parameter rather than read off the store so the cascade can be
 * tested without React and without a store instance.
 */
export type TranslatableState = Pick<
  LanguageState,
  'locale' | 'defaultLocale' | 'overrides' | 'staticStrings'
>

/**
 * Build the `t()` the storefront renders through.
 *
 * The cascade, in order:
 *   1. the store's manual override for the current locale
 *   2. the static JSON catalogue for the current locale
 *   3. the same two for the default locale
 *   4. the key itself
 *
 * Steps 3 and 4 are `createTranslator`'s job — it takes the default locale's
 * merged map as its fallback and returns the key when both miss. Step 1 wins
 * over step 2 because the override is the restaurateur correcting the machine,
 * and the machine must not win that argument.
 */
export function buildTranslator(state: TranslatableState): TranslatorFunction {
  const layerFor = (code: string) =>
    mergeUiStrings(state.staticStrings.get(code), state.overrides[code])

  return createTranslator(
    layerFor(state.locale),
    state.locale,
    state.locale === state.defaultLocale ? undefined : layerFor(state.defaultLocale)
  )
}
