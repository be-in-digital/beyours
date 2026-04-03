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
} from '@be-in-digital/core'

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
interface LanguageState {
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
interface LanguageActions {
  setLocale: (code: string) => void
  initialize: (storeLanguages: Language[], storeDefault: string) => void
  setOverrides: (overrides: Record<string, Record<string, string>>) => void
  setStaticStrings: (strings: Map<string, Record<string, string>>) => void
}

type LanguageStore = LanguageState & LanguageActions

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
