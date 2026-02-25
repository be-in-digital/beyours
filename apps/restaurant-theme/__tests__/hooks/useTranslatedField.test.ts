/**
 * useTranslatedField Hook Tests
 *
 * Tests the fallback chain for dynamic content translation:
 * 1. entity.translations[locale][field]
 * 2. entity.translations[defaultLocale][field]
 * 3. entity[field] (source value)
 */

import { describe, it, expect, vi } from 'vitest'

// Mock Zustand store
vi.mock('@beindigital-engine/restaurant', () => ({
  useLanguageStore: vi.fn(),
}))

/**
 * Pure function that replicates useTranslatedField logic for testing.
 */
function getTranslatedField(
  entity: Record<string, unknown> & {
    translations?: Record<string, Record<string, string | undefined>>
  } | null | undefined,
  field: string,
  locale: string,
  defaultLocale: string
): string {
  if (!entity) return ''

  // 1. Current locale translation
  const localeValue = entity.translations?.[locale]?.[field]
  if (localeValue) return localeValue

  // 2. Default locale translation
  const defaultValue = entity.translations?.[defaultLocale]?.[field]
  if (defaultValue) return defaultValue

  // 3. Source field value
  const sourceValue = entity[field]
  return typeof sourceValue === 'string' ? sourceValue : ''
}

describe('useTranslatedField logic', () => {
  describe('fallback chain', () => {
    it('should return current locale translation when available', () => {
      const entity = {
        name: 'Pizza Margherita',
        translations: {
          en: { name: 'Margherita Pizza' },
          es: { name: 'Pizza Margarita' },
        },
      }

      expect(getTranslatedField(entity, 'name', 'en', 'fr')).toBe('Margherita Pizza')
    })

    it('should fallback to default locale when current locale not found', () => {
      const entity = {
        name: 'Pizza Margherita',
        translations: {
          fr: { name: 'Pizza Margherita (FR)' },
        },
      }

      expect(getTranslatedField(entity, 'name', 'en', 'fr')).toBe('Pizza Margherita (FR)')
    })

    it('should fallback to source field when no translations exist', () => {
      const entity = {
        name: 'Pizza Margherita',
        translations: {},
      }

      expect(getTranslatedField(entity, 'name', 'en', 'fr')).toBe('Pizza Margherita')
    })

    it('should fallback to source field when translations key is undefined', () => {
      const entity = {
        name: 'Pizza Margherita',
      }

      expect(getTranslatedField(entity, 'name', 'en', 'fr')).toBe('Pizza Margherita')
    })
  })

  describe('null/undefined entity', () => {
    it('should return empty string for null entity', () => {
      expect(getTranslatedField(null, 'name', 'en', 'fr')).toBe('')
    })

    it('should return empty string for undefined entity', () => {
      expect(getTranslatedField(undefined, 'name', 'en', 'fr')).toBe('')
    })
  })

  describe('missing field', () => {
    it('should return empty string when field does not exist on entity', () => {
      const entity = {
        name: 'Pizza',
      }

      expect(getTranslatedField(entity, 'description', 'fr', 'fr')).toBe('')
    })

    it('should return empty string when field exists but is not a string', () => {
      const entity = {
        name: 'Pizza',
        price: 1200,
      }

      expect(getTranslatedField(entity, 'price', 'fr', 'fr')).toBe('')
    })
  })

  describe('description field', () => {
    it('should translate description independently from name', () => {
      const entity = {
        name: 'Pizza Margherita',
        description: 'Tomate, mozzarella, basilic',
        translations: {
          en: {
            name: 'Margherita Pizza',
            description: 'Tomato, mozzarella, basil',
          },
        },
      }

      expect(getTranslatedField(entity, 'description', 'en', 'fr')).toBe(
        'Tomato, mozzarella, basil'
      )
    })

    it('should handle partial translations (name translated, description not)', () => {
      const entity = {
        name: 'Pizza Margherita',
        description: 'Tomate, mozzarella, basilic',
        translations: {
          en: {
            name: 'Margherita Pizza',
            // description not translated
          },
        },
      }

      // description falls through to source field
      expect(getTranslatedField(entity, 'description', 'en', 'fr')).toBe(
        'Tomate, mozzarella, basilic'
      )
    })
  })

  describe('same locale as default', () => {
    it('should still check translations for default locale', () => {
      const entity = {
        name: 'Pizza original',
        translations: {
          fr: { name: 'Pizza traduite FR' },
        },
      }

      expect(getTranslatedField(entity, 'name', 'fr', 'fr')).toBe('Pizza traduite FR')
    })
  })

  describe('empty translation values', () => {
    it('should skip empty string translations and fallback', () => {
      const entity = {
        name: 'Pizza Margherita',
        translations: {
          en: { name: '' }, // empty = falsy → skip
          fr: { name: 'Pizza FR' },
        },
      }

      // Empty string is falsy, should fall through to fr
      expect(getTranslatedField(entity, 'name', 'en', 'fr')).toBe('Pizza FR')
    })

    it('should skip undefined translation values and fallback', () => {
      const entity = {
        name: 'Pizza Margherita',
        translations: {
          en: { name: undefined },
        },
      }

      expect(getTranslatedField(entity, 'name', 'en', 'fr')).toBe('Pizza Margherita')
    })
  })
})
