/**
 * Tests for i18n system
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  DEFAULT_I18N_CONFIG,
  RTL_LANGUAGES,
  isRtlLocale,
  getLocaleDirection,
  findLanguageConfig,
} from '../config'
import {
  detectLocaleFromCookie,
  detectLocaleFromLocalStorage,
  detectLocaleFromBrowser,
  detectLocaleFromHeader,
  detectLocale,
} from '../detection'
import {
  setLocaleCookie,
  setLocaleLocalStorage,
  setLocale,
  clearLocale,
  getLocaleFromCookie,
} from '../storage'
import {
  createTranslator,
  createTranslators,
  validateTranslationMap,
  mergeTranslations,
  getMissingKeys,
} from '../translator'
import {
  estimateTranslationCost,
  translateText,
  batchTranslate,
  calculateTotalCost,
  groupTranslationResults,
} from '../gpt-translation'
import type { HttpClient, TranslatedItem } from '../types'

describe('config', () => {
  it('should export default config', () => {
    expect(DEFAULT_I18N_CONFIG.defaultLocale).toBe('fr')
    expect(DEFAULT_I18N_CONFIG.supportedLocales).toContain('fr')
    expect(DEFAULT_I18N_CONFIG.supportedLocales).toContain('en')
    expect(DEFAULT_I18N_CONFIG.cookieName).toBe('beid_locale')
    expect(DEFAULT_I18N_CONFIG.localStorageKey).toBe('beid_locale')
    expect(DEFAULT_I18N_CONFIG.cookieMaxAge).toBe(365 * 24 * 60 * 60)
  })

  it('should identify RTL languages', () => {
    expect(isRtlLocale('ar')).toBe(true)
    expect(isRtlLocale('he')).toBe(true)
    expect(isRtlLocale('fa')).toBe(true)
    expect(isRtlLocale('en')).toBe(false)
    expect(isRtlLocale('fr')).toBe(false)
  })

  it('should get locale direction', () => {
    expect(getLocaleDirection('ar')).toBe('rtl')
    expect(getLocaleDirection('en')).toBe('ltr')
    expect(getLocaleDirection('fr')).toBe('ltr')
  })

  it('should find language config', () => {
    const frConfig = findLanguageConfig('fr')
    expect(frConfig).toBeDefined()
    expect(frConfig?.code).toBe('fr')
    expect(frConfig?.name).toBe('French')
    expect(frConfig?.nativeName).toBe('Français')
    expect(frConfig?.direction).toBe('ltr')

    const arConfig = findLanguageConfig('ar')
    expect(arConfig?.direction).toBe('rtl')
  })
})

describe('detection', () => {
  beforeEach(() => {
    // Reset environment
    delete (global as any).window
    delete (global as any).document
    delete (global as any).localStorage
    delete (global as any).navigator
  })

  describe('detectLocaleFromCookie', () => {
    it('should detect locale from cookie string', () => {
      const cookieString = 'beid_locale=en; other=value'
      const locale = detectLocaleFromCookie(cookieString, {
        ...DEFAULT_I18N_CONFIG,
        supportedLocales: ['fr', 'en', 'es'],
      })
      expect(locale).toBe('en')
    })

    it('should handle URL encoded cookie values', () => {
      const cookieString = 'beid_locale=en%2DUS'
      const locale = detectLocaleFromCookie(cookieString, {
        ...DEFAULT_I18N_CONFIG,
        supportedLocales: ['en-US', 'fr'],
      })
      expect(locale).toBe('en-US')
    })

    it('should return null for unsupported locale', () => {
      const cookieString = 'beid_locale=unsupported'
      const locale = detectLocaleFromCookie(cookieString)
      expect(locale).toBeNull()
    })

    it('should return null for missing cookie', () => {
      const cookieString = 'other=value'
      const locale = detectLocaleFromCookie(cookieString)
      expect(locale).toBeNull()
    })

    it('should return null for invalid cookie format', () => {
      const cookieString = 'invalid'
      const locale = detectLocaleFromCookie(cookieString)
      expect(locale).toBeNull()
    })
  })

  describe('detectLocaleFromLocalStorage', () => {
    it('should return null on server-side', () => {
      const locale = detectLocaleFromLocalStorage()
      expect(locale).toBeNull()
    })

    it('should detect locale from localStorage', () => {
      // Mock browser environment
      ;(global as any).window = {}
      ;(global as any).localStorage = {
        getItem: vi.fn().mockReturnValue('en'),
      }

      const locale = detectLocaleFromLocalStorage({
        ...DEFAULT_I18N_CONFIG,
        supportedLocales: ['fr', 'en'],
      })
      expect(locale).toBe('en')
    })

    it('should return null for unsupported locale', () => {
      ;(global as any).window = {}
      ;(global as any).localStorage = {
        getItem: vi.fn().mockReturnValue('unsupported'),
      }

      const locale = detectLocaleFromLocalStorage()
      expect(locale).toBeNull()
    })
  })

  describe('detectLocaleFromBrowser', () => {
    it('should return null on server-side', () => {
      const locale = detectLocaleFromBrowser()
      expect(locale).toBeNull()
    })

    it('should detect locale from navigator.language', () => {
      ;(global as any).window = {}
      ;(global as any).navigator = { language: 'en-US' }

      const locale = detectLocaleFromBrowser({
        ...DEFAULT_I18N_CONFIG,
        supportedLocales: ['fr', 'en-US'],
      })
      expect(locale).toBe('en-US')
    })

    it('should fallback to language code', () => {
      ;(global as any).window = {}
      ;(global as any).navigator = { language: 'en-US' }

      const locale = detectLocaleFromBrowser({
        ...DEFAULT_I18N_CONFIG,
        supportedLocales: ['fr', 'en'],
      })
      expect(locale).toBe('en')
    })

    it('should return null for unsupported language', () => {
      ;(global as any).window = {}
      ;(global as any).navigator = { language: 'unsupported' }

      const locale = detectLocaleFromBrowser()
      expect(locale).toBeNull()
    })
  })

  describe('detectLocaleFromHeader', () => {
    it('should detect locale from Accept-Language header', () => {
      const header = 'fr-FR,fr;q=0.9,en;q=0.8'
      const locale = detectLocaleFromHeader(header, {
        ...DEFAULT_I18N_CONFIG,
        supportedLocales: ['fr-FR', 'en'],
      })
      expect(locale).toBe('fr-FR')
    })

    it('should respect quality values', () => {
      const header = 'en;q=0.5,fr;q=0.9'
      const locale = detectLocaleFromHeader(header, {
        ...DEFAULT_I18N_CONFIG,
        supportedLocales: ['fr', 'en'],
      })
      expect(locale).toBe('fr')
    })

    it('should fallback to language code', () => {
      const header = 'fr-FR,en-US;q=0.8'
      const locale = detectLocaleFromHeader(header, {
        ...DEFAULT_I18N_CONFIG,
        supportedLocales: ['fr', 'en'],
      })
      expect(locale).toBe('fr')
    })

    it('should return null for empty header', () => {
      const locale = detectLocaleFromHeader('')
      expect(locale).toBeNull()
    })
  })

  describe('detectLocale (cascade)', () => {
    it('should prioritize cookie', () => {
      const locale = detectLocale(
        {
          ...DEFAULT_I18N_CONFIG,
          supportedLocales: ['fr', 'en', 'es'],
        },
        {
          cookieString: 'beid_locale=es',
          acceptLanguage: 'en',
        }
      )
      expect(locale).toBe('es')
    })

    it('should fallback to Accept-Language', () => {
      const locale = detectLocale(
        {
          ...DEFAULT_I18N_CONFIG,
          supportedLocales: ['fr', 'en'],
        },
        {
          acceptLanguage: 'en',
        }
      )
      expect(locale).toBe('en')
    })

    it('should fallback to default locale', () => {
      const locale = detectLocale(DEFAULT_I18N_CONFIG, {})
      expect(locale).toBe('fr')
    })
  })
})

describe('storage', () => {
  beforeEach(() => {
    // Reset environment
    delete (global as any).document
    delete (global as any).window
    delete (global as any).localStorage
  })

  describe('setLocaleCookie', () => {
    it('should create cookie string', () => {
      const cookieString = setLocaleCookie('en')
      expect(cookieString).toContain('beid_locale=en')
      expect(cookieString).toContain('Max-Age=')
      expect(cookieString).toContain('Path=/')
      expect(cookieString).toContain('SameSite=Lax')
    })

    it('should throw for invalid locale', () => {
      expect(() => setLocaleCookie('')).toThrow()
      expect(() => setLocaleCookie('a')).toThrow()
    })

    it('should set cookie in browser', () => {
      const mockDocument = { cookie: '' }
      ;(global as any).document = mockDocument

      setLocaleCookie('en')
      expect(mockDocument.cookie).toContain('beid_locale=en')
    })
  })

  describe('setLocaleLocalStorage', () => {
    it('should set locale in localStorage', () => {
      const mockLocalStorage = {
        setItem: vi.fn(),
      }
      ;(global as any).window = {}
      ;(global as any).localStorage = mockLocalStorage

      setLocaleLocalStorage('en')
      expect(mockLocalStorage.setItem).toHaveBeenCalledWith('beid_locale', 'en')
    })

    it('should throw for invalid locale', () => {
      ;(global as any).window = {}
      ;(global as any).localStorage = { setItem: vi.fn() }

      expect(() => setLocaleLocalStorage('')).toThrow()
    })

    it('should handle localStorage not available', () => {
      expect(() => setLocaleLocalStorage('en')).not.toThrow()
    })
  })

  describe('setLocale', () => {
    it('should set both cookie and localStorage', () => {
      const mockLocalStorage = {
        setItem: vi.fn(),
      }
      ;(global as any).window = {}
      ;(global as any).document = { cookie: '' }
      ;(global as any).localStorage = mockLocalStorage

      const cookieString = setLocale('en')
      expect(cookieString).toContain('beid_locale=en')
      expect(mockLocalStorage.setItem).toHaveBeenCalledWith('beid_locale', 'en')
    })
  })

  describe('clearLocale', () => {
    it('should clear cookie and localStorage', () => {
      const mockLocalStorage = {
        removeItem: vi.fn(),
      }
      const mockDocument = { cookie: '' }
      ;(global as any).window = {}
      ;(global as any).document = mockDocument
      ;(global as any).localStorage = mockLocalStorage

      const cookieString = clearLocale()
      expect(cookieString).toContain('beid_locale=')
      expect(cookieString).toContain('Max-Age=0')
      expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('beid_locale')
    })
  })

  describe('getLocaleFromCookie', () => {
    it('should extract locale from cookie string', () => {
      const cookieString = 'beid_locale=en; other=value'
      const locale = getLocaleFromCookie(cookieString)
      expect(locale).toBe('en')
    })

    it('should return null for invalid cookie', () => {
      const locale = getLocaleFromCookie('invalid')
      expect(locale).toBeNull()
    })
  })
})

describe('translator', () => {
  const translations = {
    hello: 'Bonjour',
    'hello_name': 'Bonjour {{name}}',
    'items': '{{count}} article',
    'welcome': 'Bienvenue sur notre site',
  }

  const fallbackTranslations = {
    hello: 'Hello',
    'hello_name': 'Hello {{name}}',
    'only_in_fallback': 'This is only in fallback',
  }

  describe('createTranslator', () => {
    it('should translate simple keys', () => {
      const t = createTranslator(translations, 'fr')
      expect(t('hello')).toBe('Bonjour')
      expect(t('welcome')).toBe('Bienvenue sur notre site')
    })

    it('should interpolate parameters', () => {
      const t = createTranslator(translations, 'fr')
      expect(t('hello_name', { name: 'Jean' })).toBe('Bonjour Jean')
    })

    it('should handle pluralization', () => {
      const t = createTranslator(translations, 'fr')
      expect(t('items', { count: 1 })).toBe('1 article')
      expect(t('items', { count: 5 })).toBe('5 articles')
    })

    it('should return key for missing translation', () => {
      const t = createTranslator(translations, 'fr')
      expect(t('missing')).toBe('missing')
    })

    it('should use fallback translations', () => {
      const t = createTranslator(translations, 'fr', fallbackTranslations)
      expect(t('only_in_fallback')).toBe('This is only in fallback')
    })

    it('should handle invalid keys', () => {
      const t = createTranslator(translations, 'fr')
      expect(t('')).toBe('')
    })

    it('should handle missing interpolation params', () => {
      const t = createTranslator(translations, 'fr')
      expect(t('hello_name')).toBe('Bonjour {{name}}')
    })
  })

  describe('createTranslators', () => {
    it('should create translators for multiple locales', () => {
      const translationsByLocale = {
        fr: { hello: 'Bonjour' },
        en: { hello: 'Hello' },
      }

      const translators = createTranslators(translationsByLocale, 'en')

      expect(translators.fr('hello')).toBe('Bonjour')
      expect(translators.en('hello')).toBe('Hello')
    })
  })

  describe('validateTranslationMap', () => {
    it('should validate valid translation maps', () => {
      expect(validateTranslationMap({ hello: 'Bonjour' })).toBe(true)
      expect(validateTranslationMap({})).toBe(true)
    })

    it('should reject invalid translation maps', () => {
      expect(validateTranslationMap(null)).toBe(false)
      expect(validateTranslationMap('string')).toBe(false)
      expect(validateTranslationMap({ hello: 123 })).toBe(false)
      expect(validateTranslationMap([1, 2, 3])).toBe(false)
    })
  })

  describe('mergeTranslations', () => {
    it('should merge translation maps', () => {
      const base = { a: '1', b: '2' }
      const override = { b: '3', c: '4' }

      const merged = mergeTranslations(base, override)

      expect(merged.a).toBe('1')
      expect(merged.b).toBe('3')
      expect(merged.c).toBe('4')
    })
  })

  describe('getMissingKeys', () => {
    it('should find missing keys', () => {
      const source = { a: '1', b: '2', c: '3' }
      const target = { a: '1', c: '3' }

      const missing = getMissingKeys(source, target)

      expect(missing).toEqual(['b'])
    })

    it('should return empty array when no keys missing', () => {
      const source = { a: '1', b: '2' }
      const target = { a: '1', b: '2', c: '3' }

      const missing = getMissingKeys(source, target)

      expect(missing).toEqual([])
    })
  })
})

describe('gpt-translation', () => {
  describe('estimateTranslationCost', () => {
    it('should estimate cost for text', () => {
      const cost = estimateTranslationCost(100)
      expect(cost).toBeGreaterThan(0)
      expect(cost).toBeLessThan(0.01)
    })

    it('should scale with text length', () => {
      const shortCost = estimateTranslationCost(100)
      const longCost = estimateTranslationCost(1000)
      expect(longCost).toBeGreaterThan(shortCost)
    })
  })

  describe('translateText', () => {
    const mockHttpClient: HttpClient = {
      post: vi.fn(),
    }

    beforeEach(() => {
      vi.clearAllMocks()
    })

    it('should translate text successfully', async () => {
      const mockResponse = {
        choices: [{ message: { content: 'Hello world' } }],
      }

      ;(mockHttpClient.post as any).mockResolvedValue(mockResponse)

      const result = await translateText(
        'Bonjour le monde',
        'fr',
        'en',
        undefined,
        mockHttpClient,
        'sk-test'
      )

      expect(result).toBe('Hello world')
      expect(mockHttpClient.post).toHaveBeenCalledWith(
        'https://api.openai.com/v1/chat/completions',
        expect.objectContaining({
          model: 'gpt-3.5-turbo',
          messages: expect.any(Array),
        }),
        expect.objectContaining({
          Authorization: 'Bearer sk-test',
        })
      )
    })

    it('should throw error for missing httpClient', async () => {
      await expect(
        translateText('test', 'fr', 'en', undefined, undefined, 'sk-test')
      ).rejects.toThrow('HTTP client is required')
    })

    it('should throw error for missing API key', async () => {
      await expect(
        translateText('test', 'fr', 'en', undefined, mockHttpClient, undefined)
      ).rejects.toThrow('OpenAI API key is required')
    })

    it('should throw error for invalid input', async () => {
      await expect(
        translateText('', 'fr', 'en', undefined, mockHttpClient, 'sk-test')
      ).rejects.toThrow('Invalid translation input')
    })

    it('should retry on failure', async () => {
      ;(mockHttpClient.post as any)
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({
          choices: [{ message: { content: 'Success' } }],
        })

      const result = await translateText(
        'test',
        'fr',
        'en',
        undefined,
        mockHttpClient,
        'sk-test'
      )

      expect(result).toBe('Success')
      expect(mockHttpClient.post).toHaveBeenCalledTimes(2)
    })

    it('should not retry on auth errors', async () => {
      ;(mockHttpClient.post as any).mockRejectedValue(new Error('401 authentication failed'))

      await expect(
        translateText('test', 'fr', 'en', undefined, mockHttpClient, 'sk-test')
      ).rejects.toThrow('401 authentication failed')

      expect(mockHttpClient.post).toHaveBeenCalledTimes(1)
    })
  })

  describe('batchTranslate', () => {
    const mockHttpClient: HttpClient = {
      post: vi.fn(),
    }

    beforeEach(() => {
      vi.clearAllMocks()
    })

    it('should translate multiple items', async () => {
      ;(mockHttpClient.post as any).mockResolvedValue({
        choices: [{ message: { content: 'Translated' } }],
      })

      const items = [
        { text: 'Bonjour', key: 'greeting' },
        { text: 'Au revoir', key: 'goodbye' },
      ]

      const results = await batchTranslate(items, 'fr', 'en', mockHttpClient, 'sk-test', 120)

      expect(results).toHaveLength(2)
      expect(results[0]?.original).toBe('Bonjour')
      expect(results[0]?.translated).toBe('Translated')
      expect(results[0]?.locale).toBe('en')
      expect(results[0]?.cost).toBeGreaterThan(0)
    })

    it('should handle partial failures', async () => {
      // First item: fail all 3 retries
      // Second item: succeed
      ;(mockHttpClient.post as any)
        .mockRejectedValueOnce(new Error('Failed'))
        .mockRejectedValueOnce(new Error('Failed'))
        .mockRejectedValueOnce(new Error('Failed'))
        .mockResolvedValueOnce({
          choices: [{ message: { content: 'Success' } }],
        })

      const items = [{ text: 'First' }, { text: 'Second' }]

      const results = await batchTranslate(items, 'fr', 'en', mockHttpClient, 'sk-test', 120)

      expect(results).toHaveLength(2)
      expect(results[0]?.translated).toBe('First') // Failed, kept original
      expect(results[0]?.cost).toBe(0)
      expect(results[1]?.translated).toBe('Success')
    })
  })

  describe('calculateTotalCost', () => {
    it('should sum costs', () => {
      const results: TranslatedItem[] = [
        { original: 'a', translated: 'b', locale: 'en', cost: 0.001 },
        { original: 'c', translated: 'd', locale: 'en', cost: 0.002 },
      ]

      expect(calculateTotalCost(results)).toBe(0.003)
    })
  })

  describe('groupTranslationResults', () => {
    it('should group by success/failure', () => {
      const results: TranslatedItem[] = [
        { original: 'a', translated: 'A', locale: 'en', cost: 0.001 },
        { original: 'b', translated: 'b', locale: 'en', cost: 0 }, // Failed
        { original: 'c', translated: 'C', locale: 'en', cost: 0.002 },
      ]

      const { successful, failed } = groupTranslationResults(results)

      expect(successful).toHaveLength(2)
      expect(failed).toHaveLength(1)
      expect(failed[0]?.original).toBe('b')
    })
  })
})
