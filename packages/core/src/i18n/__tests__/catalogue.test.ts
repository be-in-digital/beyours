import { describe, it, expect } from 'vitest'
import {
  LOCALE_COOKIE_NAME,
  normalizeStoredLocale,
  pickTranslatedField,
  localizeDocument,
  localizeDocuments,
  mergeUiStrings,
  resolveRequestLocale,
  resolveEstablishmentLanguages,
  createTranslator,
} from '../index'
import type { EstablishmentLanguage } from '../index'

/**
 * Reading a translated catalogue, and reading the locale cookie (#148).
 *
 * The bug these guard was a name mismatch: the app writes `beid_locale` and
 * the server-side CMS and SEO readers looked for `locale`, so `resolvedLocale`
 * was always null and every server-rendered string came back in the source
 * language. There was no test in either direction.
 */

describe('LOCALE_COOKIE_NAME', () => {
  it('is the cookie the app actually writes', () => {
    // `setLocale` writes `DEFAULT_I18N_CONFIG.cookieName`, `app/layout.tsx`
    // reads it, and every SSR reader must use this constant rather than
    // spelling a name out. One of them spelled it `locale` for months.
    expect(LOCALE_COOKIE_NAME).toBe('beid_locale')
  })
})

describe('normalizeStoredLocale', () => {
  it('accepts a plain code and a regional one', () => {
    expect(normalizeStoredLocale('es')).toBe('es')
    expect(normalizeStoredLocale('pt-BR')).toBe('pt-BR')
  })

  it('accepts a language the two-entry supportedLocales constant does not list', () => {
    // The product sells "the admin adds ANY language". A locale must not be
    // dropped because it is missing from a hard-coded ['fr','en'].
    expect(normalizeStoredLocale('ja')).toBe('ja')
  })

  it('decodes a percent-escaped value', () => {
    expect(normalizeStoredLocale('en%2DUS')).toBe('en-US')
  })

  it('rejects nothing, junk and injection attempts', () => {
    expect(normalizeStoredLocale(undefined)).toBeNull()
    expect(normalizeStoredLocale(null)).toBeNull()
    expect(normalizeStoredLocale('')).toBeNull()
    expect(normalizeStoredLocale('%E0%A4%A')).toBeNull()
    // The value reaches a database filter and `<html lang>`.
    expect(normalizeStoredLocale('fr"><script>')).toBeNull()
    expect(normalizeStoredLocale('../../etc/passwd')).toBeNull()
    expect(normalizeStoredLocale('a')).toBeNull()
  })

  it('honours an allow-list when one is given', () => {
    expect(normalizeStoredLocale('es', ['fr', 'en'])).toBeNull()
    expect(normalizeStoredLocale('en', ['fr', 'en'])).toBe('en')
  })
})

describe('resolveRequestLocale', () => {
  it('falls back to the store default when the cookie is absent or refused', () => {
    expect(
      resolveRequestLocale({ cookieValue: undefined, defaultLocale: 'fr' })
    ).toBe('fr')
    expect(
      resolveRequestLocale({
        cookieValue: 'de',
        availableCodes: ['fr', 'en'],
        defaultLocale: 'fr',
      })
    ).toBe('fr')
  })

  it('uses the cookie when the store offers that language', () => {
    expect(
      resolveRequestLocale({
        cookieValue: 'en',
        availableCodes: ['fr', 'en'],
        defaultLocale: 'fr',
      })
    ).toBe('en')
  })
})

describe('pickTranslatedField / localizeDocument', () => {
  const product = {
    name: 'Pizza Margherita',
    description: 'Tomate, mozzarella, basilic frais',
    translations: {
      en: {
        name: 'Margherita Pizza',
        description: 'Tomato, mozzarella, fresh basil',
        _meta: { nameHash: 'abc', nameAuto: true },
      },
      es: { name: 'Pizza Margarita' },
    },
  }

  it('returns the translation for the active locale', () => {
    expect(localizeDocument(product, 'en')).toEqual({
      name: 'Margherita Pizza',
      description: 'Tomato, mozzarella, fresh basil',
    })
  })

  it('falls back field by field, not document by document', () => {
    // Spanish has a name and no description yet. A half-translated catalogue
    // should read as a mixed one, not lose the description entirely.
    expect(localizeDocument(product, 'es')).toEqual({
      name: 'Pizza Margarita',
      description: 'Tomate, mozzarella, basilic frais',
    })
  })

  it('falls back to the source for a language with no translations at all', () => {
    expect(localizeDocument(product, 'de').name).toBe('Pizza Margherita')
    expect(localizeDocument(product, null).name).toBe('Pizza Margherita')
  })

  it('treats a blank translation as absent', () => {
    const blank = { name: 'Tarte Tatin', translations: { en: { name: '   ' } } }
    expect(pickTranslatedField(blank, 'name', 'en')).toBe('Tarte Tatin')
  })

  it('never renders the _meta bookkeeping', () => {
    const localized = localizeDocument(product, 'en')
    expect(JSON.stringify(localized)).not.toContain('nameHash')
  })

  it('keeps every other field when localizing a list', () => {
    const localized = localizeDocuments(
      [{ ...product, price: 1200, images: ['a.jpg'] }],
      'en'
    )
    expect(localized[0]).toMatchObject({
      name: 'Margherita Pizza',
      price: 1200,
      images: ['a.jpg'],
    })
  })

  it('survives a document with no translations column', () => {
    expect(localizeDocument({ name: 'Café' }, 'en')).toEqual({
      name: 'Café',
      description: undefined,
    })
  })
})

describe('mergeUiStrings + createTranslator: the override cascade', () => {
  const staticFr = { 'nav.cart': 'Panier', 'cart.checkout': 'Commander' }
  const staticEn = { 'nav.cart': 'Cart', 'cart.checkout': 'Checkout' }

  function translatorFor(
    locale: string,
    defaultLocale: string,
    staticStrings: Record<string, Record<string, string>>,
    overrides: Record<string, Record<string, string>>
  ) {
    const layer = (code: string) =>
      mergeUiStrings(staticStrings[code], overrides[code])
    return createTranslator(
      layer(locale),
      locale,
      locale === defaultLocale ? undefined : layer(defaultLocale)
    )
  }

  it('resolves override → static JSON → default locale → key', () => {
    const t = translatorFor(
      'en',
      'fr',
      { fr: staticFr, en: staticEn },
      { en: { 'cart.checkout': 'Place my order' } }
    )

    // 1. the restaurateur's override wins
    expect(t('cart.checkout')).toBe('Place my order')
    // 2. the static catalogue answers the rest
    expect(t('nav.cart')).toBe('Cart')
    // 3. a key the target locale lacks falls to the default locale
    expect(
      translatorFor('en', 'fr', { fr: staticFr, en: { 'nav.cart': 'Cart' } }, {})(
        'cart.checkout'
      )
    ).toBe('Commander')
    // 4. and an unknown key is returned as itself, never blank
    expect(t('nothing.here')).toBe('nothing.here')
  })

  it('interpolates the single-brace placeholders the catalogues actually use', () => {
    // `{count}`, not `{{count}}` — what ships in the locale JSON, and what the
    // GPT bulk translator is instructed to leave untouched. Reading only the
    // double form rendered `{count} articles` to the customer, literally.
    const t = translatorFor(
      'fr',
      'fr',
      { fr: { 'cart.items': '{count} articles', 'cart.min': 'Minimum : {amount}' } },
      {}
    )
    expect(t('cart.items', { count: 3 })).toBe('3 articles')
    expect(t('cart.min', { amount: '15 €' })).toBe('Minimum : 15 €')
  })

  it('still interpolates the double-brace form', () => {
    const t = translatorFor('fr', 'fr', { fr: { hi: 'Bonjour {{name}}' } }, {})
    expect(t('hi', { name: 'Jean' })).toBe('Bonjour Jean')
  })

  it('leaves a placeholder alone when its parameter is missing', () => {
    const t = translatorFor('fr', 'fr', { fr: { hi: 'Bonjour {name}' } }, {})
    expect(t('hi', { other: 'x' })).toBe('Bonjour {name}')
  })
})

describe('resolveEstablishmentLanguages', () => {
  const row = (
    code: string,
    over: Partial<EstablishmentLanguage> = {}
  ): EstablishmentLanguage => ({
    code,
    name: code.toUpperCase(),
    nativeName: code.toUpperCase(),
    isDefault: false,
    isActive: true,
    ...over,
  })

  it('takes the establishment default from the flag', () => {
    const { defaultCode } = resolveEstablishmentLanguages([
      row('fr', { isDefault: true }),
      row('en'),
    ])
    expect(defaultCode).toBe('fr')
  })

  it('does NOT take it from array order when nothing is flagged', () => {
    // The whole of #325 / NEW2-JOURNEY-2. A fresh deployment seeds no
    // `languages` rows and `languages.create` takes `isDefault` from its
    // caller, so the first language an admin adds arrives unflagged. Reading
    // `active[0]` served English to every diner of a French restaurant.
    const { defaultCode } = resolveEstablishmentLanguages([row('en')], 'fr')
    expect(defaultCode).toBe('fr')
  })

  it('keeps the source language selectable when no row carries it', () => {
    // Otherwise the store offers one entry, the selector hides below two, and
    // the language the menu is actually written in is reachable by nobody.
    const { languages } = resolveEstablishmentLanguages([row('en')], 'fr')

    expect(languages.map((l) => l.code)).toEqual(['fr', 'en'])
    expect(languages[0]?.isDefault).toBe(true)
    expect(languages).toHaveLength(2)
  })

  it('names the synthesised row in English and in itself', () => {
    const { languages } = resolveEstablishmentLanguages([row('en')], 'fr')
    expect(languages[0]?.name).toBe('French')
    expect(languages[0]?.nativeName).toBe('français')
  })

  it('falls back to the bare code for a language Intl cannot name', () => {
    // The admin can type any code at all, and `Intl.DisplayNames` throws on
    // one it cannot parse. Showing `zz` beats showing nothing.
    const { languages } = resolveEstablishmentLanguages([row('en')], 'zz')
    expect(languages[0]?.code).toBe('zz')
    expect(languages[0]?.name).toBeTruthy()
  })

  it('synthesises nothing when the default is already a real row', () => {
    const rows = [row('fr', { isDefault: true }), row('en')]
    const { languages } = resolveEstablishmentLanguages(rows, 'fr')
    expect(languages).toEqual(rows)
  })

  it('respects an establishment that is genuinely not French', () => {
    // An English restaurant that flagged English default gets English, and no
    // French entry is invented for it.
    const { languages, defaultCode } = resolveEstablishmentLanguages(
      [row('en', { isDefault: true })],
      'fr'
    )
    expect(defaultCode).toBe('en')
    expect(languages.map((l) => l.code)).toEqual(['en'])
  })

  it('drops inactive rows, and ignores a default that was switched off', () => {
    const { languages, defaultCode } = resolveEstablishmentLanguages(
      [row('es', { isDefault: true, isActive: false }), row('en')],
      'fr'
    )
    expect(languages.map((l) => l.code)).toEqual(['fr', 'en'])
    expect(defaultCode).toBe('fr')
  })

  it('offers the source language when the store has no rows at all', () => {
    const { languages, defaultCode } = resolveEstablishmentLanguages([], 'fr')
    expect(defaultCode).toBe('fr')
    expect(languages.map((l) => l.code)).toEqual(['fr'])
  })
})
