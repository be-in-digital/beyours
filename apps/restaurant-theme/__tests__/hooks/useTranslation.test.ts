/**
 * useTranslation Hook Tests
 *
 * Tests the merge logic that combines static JSON strings with Convex overrides.
 * The hook reads from the Zustand useLanguageStore (locale, defaultLocale, overrides, staticStrings).
 */

import { describe, it, expect } from 'vitest'

/**
 * Simulates the merge logic from useTranslation hook.
 * Priority (lowest → highest): staticDefault → overrideDefault → staticLocale → overrideLocale
 */
function buildMergedStrings(
  locale: string,
  defaultLocale: string,
  overrides: Record<string, Record<string, string>>,
  staticStrings: Map<string, Record<string, string>>
): Record<string, string> {
  const result: Record<string, string> = {}

  // 4. Static JSON default locale (ultimate fallback)
  const defaultStatic = staticStrings.get(defaultLocale)
  if (defaultStatic) Object.assign(result, defaultStatic)

  // 3. Convex override default locale
  const defaultOverrides = overrides[defaultLocale]
  if (defaultOverrides) Object.assign(result, defaultOverrides)

  // 2. Static JSON current locale
  if (locale !== defaultLocale) {
    const localeStatic = staticStrings.get(locale)
    if (localeStatic) Object.assign(result, localeStatic)
  }

  // 1. Convex override current locale
  if (locale !== defaultLocale) {
    const localeOverrides = overrides[locale]
    if (localeOverrides) Object.assign(result, localeOverrides)
  }

  return result
}

describe('useTranslation merge logic', () => {
  it('should use static default as ultimate fallback', () => {
    const staticStrings = new Map([
      ['fr', { 'nav.home': 'Accueil', 'nav.cart': 'Panier' }],
    ])

    const merged = buildMergedStrings('fr', 'fr', {}, staticStrings)

    expect(merged['nav.home']).toBe('Accueil')
    expect(merged['nav.cart']).toBe('Panier')
  })

  it('should prefer static locale over static default', () => {
    const staticStrings = new Map([
      ['fr', { 'nav.home': 'Accueil' }],
      ['en', { 'nav.home': 'Home' }],
    ])

    const merged = buildMergedStrings('en', 'fr', {}, staticStrings)

    expect(merged['nav.home']).toBe('Home')
  })

  it('should prefer Convex override over static JSON for same locale', () => {
    const staticStrings = new Map([
      ['fr', { 'nav.home': 'Accueil', 'nav.cart': 'Panier' }],
    ])
    const overrides = {
      fr: { 'nav.home': 'Accueil (custom)' },
    }

    const merged = buildMergedStrings('fr', 'fr', overrides, staticStrings)

    expect(merged['nav.home']).toBe('Accueil (custom)')
    expect(merged['nav.cart']).toBe('Panier') // unchanged
  })

  it('should prefer current locale override over default locale override', () => {
    const staticStrings = new Map([
      ['fr', { 'nav.home': 'Accueil' }],
    ])
    const overrides = {
      fr: { 'nav.home': 'Accueil (FR override)' },
      en: { 'nav.home': 'Home (EN override)' },
    }

    const merged = buildMergedStrings('en', 'fr', overrides, staticStrings)

    expect(merged['nav.home']).toBe('Home (EN override)')
  })

  it('should fallback to default locale static when current locale has no value', () => {
    const staticStrings = new Map<string, Record<string, string>>([
      ['fr', { 'nav.home': 'Accueil', 'footer.text': 'Texte pied' }],
      ['en', { 'nav.home': 'Home' }], // en has no footer.text
    ])

    const merged = buildMergedStrings('en', 'fr', {}, staticStrings)

    expect(merged['nav.home']).toBe('Home')
    expect(merged['footer.text']).toBe('Texte pied') // fallback to fr
  })

  it('should return raw key when no translation exists', () => {
    const staticStrings = new Map<string, Record<string, string>>()

    const merged = buildMergedStrings('en', 'fr', {}, staticStrings)

    // t() returns merged[key] ?? key — if not found, returns the key itself
    const key = 'nav.unknown'
    expect(merged[key] ?? key).toBe('nav.unknown')
  })

  it('should handle default locale override when locale equals default', () => {
    const staticStrings = new Map([
      ['fr', { 'nav.home': 'Accueil' }],
    ])
    const overrides = {
      fr: { 'nav.home': 'Accueil modifié' },
    }

    const merged = buildMergedStrings('fr', 'fr', overrides, staticStrings)

    expect(merged['nav.home']).toBe('Accueil modifié')
  })

  it('should produce different results when locale changes', () => {
    const staticStrings = new Map([
      ['fr', { 'nav.home': 'Accueil' }],
      ['en', { 'nav.home': 'Home' }],
      ['es', { 'nav.home': 'Inicio' }],
    ])

    const mergedFr = buildMergedStrings('fr', 'fr', {}, staticStrings)
    const mergedEn = buildMergedStrings('en', 'fr', {}, staticStrings)
    const mergedEs = buildMergedStrings('es', 'fr', {}, staticStrings)

    expect(mergedFr['nav.home']).toBe('Accueil')
    expect(mergedEn['nav.home']).toBe('Home')
    expect(mergedEs['nav.home']).toBe('Inicio')
  })

  it('should invalidate when overrides change', () => {
    const staticStrings = new Map([
      ['fr', { 'nav.home': 'Accueil' }],
    ])

    const merged1 = buildMergedStrings('fr', 'fr', {}, staticStrings)
    expect(merged1['nav.home']).toBe('Accueil')

    const merged2 = buildMergedStrings(
      'fr',
      'fr',
      { fr: { 'nav.home': 'Accueil v2' } },
      staticStrings
    )
    expect(merged2['nav.home']).toBe('Accueil v2')
  })

  it('should handle empty overrides gracefully', () => {
    const staticStrings = new Map([
      ['fr', { 'nav.home': 'Accueil' }],
    ])

    const merged = buildMergedStrings('en', 'fr', {}, staticStrings)

    expect(merged['nav.home']).toBe('Accueil')
  })

  it('should handle multiple keys with mixed overrides', () => {
    const staticStrings = new Map([
      ['fr', {
        'nav.home': 'Accueil',
        'nav.cart': 'Panier',
        'nav.menu': 'Menu',
      }],
      ['en', {
        'nav.home': 'Home',
        'nav.cart': 'Cart',
        'nav.menu': 'Menu',
      }],
    ])
    const overrides = {
      en: { 'nav.cart': 'Shopping Cart' }, // Only override cart in EN
    }

    const merged = buildMergedStrings('en', 'fr', overrides, staticStrings)

    expect(merged['nav.home']).toBe('Home')      // from static en
    expect(merged['nav.cart']).toBe('Shopping Cart') // from override en
    expect(merged['nav.menu']).toBe('Menu')        // from static en
  })
})
