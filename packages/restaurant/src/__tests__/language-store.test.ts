/**
 * Language Store Tests
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { useLanguageStore } from '../stores/language'
import type { Language } from '../stores/language'

// Mock core i18n storage functions
vi.mock('@beindigital-engine/core', () => ({
  setLocale: vi.fn(),
  getLocaleFromLocalStorage: vi.fn(() => null),
  getLocaleFromCookie: vi.fn(() => null),
}))

import {
  setLocale,
  getLocaleFromLocalStorage,
  getLocaleFromCookie,
} from '@beindigital-engine/core'

const mockedSetLocale = vi.mocked(setLocale)
const mockedGetFromLS = vi.mocked(getLocaleFromLocalStorage)
const mockedGetFromCookie = vi.mocked(getLocaleFromCookie)

const FR: Language = {
  code: 'fr',
  name: 'French',
  nativeName: 'Français',
  flagEmoji: '🇫🇷',
  isDefault: true,
  isActive: true,
}

const EN: Language = {
  code: 'en',
  name: 'English',
  nativeName: 'English',
  flagEmoji: '🇬🇧',
  isDefault: false,
  isActive: true,
}

const ES: Language = {
  code: 'es',
  name: 'Spanish',
  nativeName: 'Español',
  flagEmoji: '🇪🇸',
  isDefault: false,
  isActive: true,
}

const INACTIVE: Language = {
  code: 'de',
  name: 'German',
  nativeName: 'Deutsch',
  flagEmoji: '🇩🇪',
  isDefault: false,
  isActive: false,
}

// Save/restore navigator to prevent Node.js 21+ navigator.languages from leaking
const originalNavigator = globalThis.navigator

describe('Language Store', () => {
  beforeEach(() => {
    // Reset store state
    useLanguageStore.setState({
      locale: 'fr',
      defaultLocale: 'fr',
      availableLanguages: [],
      isReady: false,
    })

    // Reset mocks
    vi.clearAllMocks()
    mockedGetFromLS.mockReturnValue(null)
    mockedGetFromCookie.mockReturnValue(null)

    // Neutralize navigator to prevent Node.js 21+ navigator.languages
    // from interfering (Node defines it as ['en-US'] by default)
    Object.defineProperty(globalThis, 'navigator', {
      value: { languages: undefined },
      writable: true,
      configurable: true,
    })
  })

  afterEach(() => {
    // Restore original navigator
    Object.defineProperty(globalThis, 'navigator', {
      value: originalNavigator,
      writable: true,
      configurable: true,
    })
  })

  describe('initial state', () => {
    it('should have default values', () => {
      const state = useLanguageStore.getState()
      expect(state.locale).toBe('fr')
      expect(state.defaultLocale).toBe('fr')
      expect(state.availableLanguages).toEqual([])
      expect(state.isReady).toBe(false)
    })
  })

  describe('initialize', () => {
    it('should set available languages and mark as ready', () => {
      useLanguageStore.getState().initialize([FR, EN, ES], 'fr')

      const state = useLanguageStore.getState()
      expect(state.availableLanguages).toHaveLength(3)
      expect(state.defaultLocale).toBe('fr')
      expect(state.isReady).toBe(true)
    })

    it('should detect locale from localStorage', () => {
      mockedGetFromLS.mockReturnValue('en')

      useLanguageStore.getState().initialize([FR, EN, ES], 'fr')

      expect(useLanguageStore.getState().locale).toBe('en')
    })

    it('should detect locale from cookie when localStorage returns null', () => {
      mockedGetFromLS.mockReturnValue(null)
      mockedGetFromCookie.mockReturnValue('es')

      // Mock document so the cookie branch is reached
      Object.defineProperty(globalThis, 'document', {
        value: { cookie: '' },
        writable: true,
        configurable: true,
      })

      useLanguageStore.getState().initialize([FR, EN, ES], 'fr')

      expect(useLanguageStore.getState().locale).toBe('es')

      // Cleanup document mock
      Object.defineProperty(globalThis, 'document', {
        value: undefined,
        writable: true,
        configurable: true,
      })
    })

    it('should fallback to store default when no storage found', () => {
      mockedGetFromLS.mockReturnValue(null)
      mockedGetFromCookie.mockReturnValue(null)

      useLanguageStore.getState().initialize([FR, EN, ES], 'fr')

      expect(useLanguageStore.getState().locale).toBe('fr')
    })

    it('should ignore invalid localStorage value (not in available codes)', () => {
      mockedGetFromLS.mockReturnValue('de')
      mockedGetFromCookie.mockReturnValue('en')

      // Mock document for cookie fallback
      Object.defineProperty(globalThis, 'document', {
        value: { cookie: '' },
        writable: true,
        configurable: true,
      })

      useLanguageStore.getState().initialize([FR, EN, ES], 'fr')

      // de is not in available codes, so falls through to cookie → en
      expect(useLanguageStore.getState().locale).toBe('en')

      Object.defineProperty(globalThis, 'document', {
        value: undefined,
        writable: true,
        configurable: true,
      })
    })

    it('should detect locale from navigator.languages (exact match)', () => {
      mockedGetFromLS.mockReturnValue(null)
      mockedGetFromCookie.mockReturnValue(null)

      Object.defineProperty(globalThis, 'navigator', {
        value: { languages: ['en', 'fr'] },
        writable: true,
        configurable: true,
      })

      useLanguageStore.getState().initialize([FR, EN, ES], 'fr')

      expect(useLanguageStore.getState().locale).toBe('en')
    })

    it('should detect locale from navigator.languages (base match fr-FR → fr)', () => {
      mockedGetFromLS.mockReturnValue(null)
      mockedGetFromCookie.mockReturnValue(null)

      Object.defineProperty(globalThis, 'navigator', {
        value: { languages: ['fr-FR', 'en-US'] },
        writable: true,
        configurable: true,
      })

      useLanguageStore.getState().initialize([FR, EN, ES], 'fr')

      expect(useLanguageStore.getState().locale).toBe('fr')
    })

    it('should filter out inactive languages from availableLanguages', () => {
      useLanguageStore.getState().initialize([FR, EN, INACTIVE], 'fr')

      const state = useLanguageStore.getState()
      expect(state.availableLanguages).toHaveLength(2)
      expect(state.availableLanguages.map((l) => l.code)).toEqual(['fr', 'en'])
    })

    it('should fallback to default when current locale becomes inactive', () => {
      mockedGetFromLS.mockReturnValue('de')

      useLanguageStore.getState().initialize([FR, EN], 'fr')

      // de is not available, falls through cascade to default
      expect(useLanguageStore.getState().locale).toBe('fr')
    })

    it('should call setLocale from core to sync storage', () => {
      useLanguageStore.getState().initialize([FR, EN, ES], 'fr')

      expect(mockedSetLocale).toHaveBeenCalledWith('fr')
    })

    it('should transition isReady from false to true', () => {
      expect(useLanguageStore.getState().isReady).toBe(false)

      useLanguageStore.getState().initialize([FR, EN], 'fr')

      expect(useLanguageStore.getState().isReady).toBe(true)
    })
  })

  describe('setLocale', () => {
    beforeEach(() => {
      useLanguageStore.getState().initialize([FR, EN, ES], 'fr')
      vi.clearAllMocks()
    })

    it('should change the locale', () => {
      useLanguageStore.getState().setLocale('en')

      expect(useLanguageStore.getState().locale).toBe('en')
    })

    it('should call core setLocale for storage sync', () => {
      useLanguageStore.getState().setLocale('en')

      expect(mockedSetLocale).toHaveBeenCalledWith('en')
    })

    it('should be idempotent (same locale = no-op)', () => {
      useLanguageStore.getState().setLocale('fr')

      expect(mockedSetLocale).not.toHaveBeenCalled()
    })

    it('should reject unavailable locale', () => {
      useLanguageStore.getState().setLocale('de')

      expect(useLanguageStore.getState().locale).toBe('fr')
      expect(mockedSetLocale).not.toHaveBeenCalled()
    })

    it('should update when switching to a valid locale', () => {
      useLanguageStore.getState().setLocale('es')

      expect(useLanguageStore.getState().locale).toBe('es')
      expect(mockedSetLocale).toHaveBeenCalledWith('es')
    })
  })
})
