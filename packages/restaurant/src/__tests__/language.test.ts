import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { useLanguageStore, buildTranslator } from '../stores/language'
import { resolveEstablishmentLanguages } from '@be-in-digital/core'

/**
 * The language store (#148).
 *
 * Nothing tested this file at all, which is how it stayed broken so long:
 * `initialize` had one call site in a component nobody mounted, `setOverrides`
 * and `setStaticStrings` had none, and the store therefore sat at `locale:
 * 'fr'`, `isReady: false` for the whole of every storefront session.
 */

const initialState = useLanguageStore.getState()

function resetStore() {
  useLanguageStore.setState({
    locale: 'fr',
    defaultLocale: 'fr',
    availableLanguages: [],
    isReady: false,
    overrides: {},
    staticStrings: new Map(),
  })
}

const FR = { code: 'fr', name: 'French', nativeName: 'Français', isDefault: true, isActive: true }
const EN = { code: 'en', name: 'English', nativeName: 'English', isDefault: false, isActive: true }
const ES = { code: 'es', name: 'Spanish', nativeName: 'Español', isDefault: false, isActive: true }

beforeEach(() => {
  resetStore()
  // The store persists through core's storage helpers, which reach for
  // localStorage and document.cookie. Give them somewhere to write.
  const store = new Map<string, string>()
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
  })
  vi.stubGlobal('window', {})
  vi.stubGlobal('document', { cookie: '' })
  // Node 22 ships a real `navigator`, and `detectInitialLocale` consults
  // `navigator.languages` between the cookie and the store default. Left
  // alone it answers `en` and every assertion here measures the test runner's
  // locale instead of the store's logic.
  vi.stubGlobal('navigator', { languages: [] as string[] })
})

afterEach(() => {
  vi.unstubAllGlobals()
  useLanguageStore.setState(initialState)
})

describe('initialize', () => {
  it('marks the store ready and adopts the establishment default', () => {
    useLanguageStore.getState().initialize([FR, EN], 'fr')

    const state = useLanguageStore.getState()
    expect(state.isReady).toBe(true)
    expect(state.locale).toBe('fr')
    expect(state.defaultLocale).toBe('fr')
    expect(state.availableLanguages.map((l) => l.code)).toEqual(['fr', 'en'])
  })

  it('keeps a stored locale the establishment still offers', () => {
    localStorage.setItem('beid_locale', 'en')

    useLanguageStore.getState().initialize([FR, EN], 'fr')

    expect(useLanguageStore.getState().locale).toBe('en')
  })

  it('drops a stored locale the establishment has switched off', () => {
    // A restaurant that removes Spanish must not leave returning visitors on
    // a language it no longer translates.
    localStorage.setItem('beid_locale', 'es')

    useLanguageStore.getState().initialize([FR, EN], 'fr')

    expect(useLanguageStore.getState().locale).toBe('fr')
  })

  it('offers the visitor their browser language when the establishment has it', () => {
    vi.stubGlobal('navigator', { languages: ['en-GB', 'en'] })

    useLanguageStore.getState().initialize([FR, EN], 'fr')

    // `en-GB` is not on offer; the base code is.
    expect(useLanguageStore.getState().locale).toBe('en')
  })

  it('ignores a browser language the establishment does not speak', () => {
    vi.stubGlobal('navigator', { languages: ['de-DE', 'de'] })

    useLanguageStore.getState().initialize([FR, EN], 'fr')

    expect(useLanguageStore.getState().locale).toBe('fr')
  })

  it('drops a language that is present but inactive', () => {
    useLanguageStore.getState().initialize([FR, { ...ES, isActive: false }], 'fr')

    expect(useLanguageStore.getState().availableLanguages.map((l) => l.code)).toEqual(['fr'])
  })
})

describe('setLocale', () => {
  it('accepts a language the establishment offers', () => {
    useLanguageStore.getState().initialize([FR, EN], 'fr')

    useLanguageStore.getState().setLocale('en')

    expect(useLanguageStore.getState().locale).toBe('en')
    expect(localStorage.getItem('beid_locale')).toBe('en')
  })

  it('refuses one it does not', () => {
    useLanguageStore.getState().initialize([FR, EN], 'fr')

    useLanguageStore.getState().setLocale('de')

    expect(useLanguageStore.getState().locale).toBe('fr')
  })
})

describe('buildTranslator', () => {
  function stateWith(
    locale: string,
    staticStrings: Record<string, Record<string, string>>,
    overrides: Record<string, Record<string, string>> = {}
  ) {
    return {
      locale,
      defaultLocale: 'fr',
      overrides,
      staticStrings: new Map(Object.entries(staticStrings)),
    }
  }

  const catalogues = {
    fr: { 'nav.cart': 'Panier', 'cart.checkout': 'Commander' },
    en: { 'nav.cart': 'Cart' },
  }

  it('renders the target language', () => {
    const t = buildTranslator(stateWith('en', catalogues))
    expect(t('nav.cart')).toBe('Cart')
  })

  it('falls back to the default language for a key the target lacks', () => {
    const t = buildTranslator(stateWith('en', catalogues))
    expect(t('cart.checkout')).toBe('Commander')
  })

  it('lets the restaurateur override the catalogue', () => {
    const t = buildTranslator(
      stateWith('en', catalogues, { en: { 'nav.cart': 'Basket' } })
    )
    expect(t('nav.cart')).toBe('Basket')
  })

  it('returns the key rather than nothing when both miss', () => {
    const t = buildTranslator(stateWith('en', catalogues))
    expect(t('nav.nowhere')).toBe('nav.nowhere')
  })

  it('resolves against the default language before anything is loaded', () => {
    // The first paint happens before the catalogues arrive. It must still be
    // readable — this is the state the storefront renders in for a moment on
    // every cold load.
    const t = buildTranslator(stateWith('fr', {}))
    expect(t('nav.cart')).toBe('nav.cart')
  })
})

describe('the store as the storefront sees it', () => {
  it('goes from unusable to usable once the initialiser has run', () => {
    // Before: this is exactly the state that shipped — `isReady` false,
    // no languages, and a translator that can only echo keys.
    expect(useLanguageStore.getState().isReady).toBe(false)
    expect(useLanguageStore.getState().availableLanguages).toEqual([])

    useLanguageStore.getState().initialize([FR, EN], 'fr')
    useLanguageStore.getState().setStaticStrings(
      new Map([
        ['fr', { 'nav.cart': 'Panier' }],
        ['en', { 'nav.cart': 'Cart' }],
      ])
    )
    useLanguageStore.getState().setOverrides({ en: { 'nav.cart': 'Basket' } })
    useLanguageStore.getState().setLocale('en')

    const state = useLanguageStore.getState()
    expect(state.isReady).toBe(true)
    expect(buildTranslator(state)('nav.cart')).toBe('Basket')
  })
})

describe('a fresh deployment, where the admin adds the first language', () => {
  /**
   * NEW2-JOURNEY-2, issue #325 — driven end to end, exactly as the storefront
   * does it: resolve what the establishment offers, then initialise the store.
   *
   * A fresh deployment seeds no `languages` rows, and `languages.create` takes
   * `isDefault` from its caller, so the row an admin creates arrives unflagged.
   * The storefront used to read `active[0]?.code` for the establishment
   * default, so that one row became the default for every diner.
   */
  const ADDED_ENGLISH = {
    code: 'en',
    name: 'English',
    nativeName: 'English',
    isDefault: false,
    isActive: true,
  }

  function mountStorefront(rows: typeof ADDED_ENGLISH[]) {
    const { languages, defaultCode } = resolveEstablishmentLanguages(rows, 'fr')
    useLanguageStore.getState().initialize(languages, defaultCode)
  }

  it('leaves a French diner in French', () => {
    vi.stubGlobal('document', { cookie: 'beid_locale=fr' })
    vi.stubGlobal('navigator', { languages: ['fr-FR', 'fr'] })

    mountStorefront([ADDED_ENGLISH])

    // Before the fix this was 'en': their cookie said fr, their browser said
    // fr, the menu is written in French, and they got English anyway.
    expect(useLanguageStore.getState().locale).toBe('fr')
  })

  it('does not write the flip back to the cookie', () => {
    // `initialize` syncs the resolved locale to localStorage and the cookie, so
    // a wrong answer here also flips <html lang>, the SSR CMS reader and the
    // SEO tags on the next request. It was not a client-only glitch.
    mountStorefront([ADDED_ENGLISH])

    expect(localStorage.getItem('beid_locale')).toBe('fr')
  })

  it('offers both languages, so the selector has something to show', () => {
    // `language-selector-dropdown.tsx` renders null at one language. With only
    // the added row there was no way back to the language the menu is in.
    mountStorefront([ADDED_ENGLISH])

    const state = useLanguageStore.getState()
    expect(state.availableLanguages.map((l) => l.code)).toEqual(['fr', 'en'])
    expect(state.availableLanguages.length).toBeGreaterThan(1)
  })

  it('still lets that diner choose the language the admin added', () => {
    mountStorefront([ADDED_ENGLISH])

    useLanguageStore.getState().setLocale('en')

    expect(useLanguageStore.getState().locale).toBe('en')
  })

  it('honours a browser preference for the added language', () => {
    // Adding English is not decorative: an English visitor should get English.
    // What must not happen is a French visitor being switched with them.
    vi.stubGlobal('navigator', { languages: ['en-GB', 'en'] })

    mountStorefront([ADDED_ENGLISH])

    expect(useLanguageStore.getState().locale).toBe('en')
  })
})
