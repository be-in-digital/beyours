/**
 * Examples of i18n system usage
 * These are code examples for documentation purposes
 * @packageDocumentation
 */

/* eslint-disable @typescript-eslint/no-unused-vars */

import type { I18nConfig, TranslationMap, HttpClient } from './types'
import {
  DEFAULT_I18N_CONFIG,
  detectLocale,
  setLocale,
  createTranslator,
  translateText,
  batchTranslate,
  isRtlLocale,
  getLocaleDirection,
  estimateTranslationCost,
} from './index'

// =============================================================================
// Example 1: Basic Translation
// =============================================================================

export function example1_BasicTranslation() {
  const translations: TranslationMap = {
    welcome: 'Bienvenue sur BeYours',
    'menu.home': 'Accueil',
    'menu.products': 'Produits',
    'menu.cart': 'Panier',
  }

  const t = createTranslator(translations, 'fr')

  console.log(t('welcome')) // "Bienvenue sur BeYours"
  console.log(t('menu.home')) // "Accueil"
}

// =============================================================================
// Example 2: Interpolation and Pluralization
// =============================================================================

export function example2_InterpolationAndPluralization() {
  const translations: TranslationMap = {
    'user.greeting': 'Bonjour {{name}}, bienvenue !',
    'cart.items': '{{count}} article dans votre panier',
    'order.total': 'Total : {{amount}}€',
  }

  const t = createTranslator(translations, 'fr')

  console.log(t('user.greeting', { name: 'Jean' }))
  // "Bonjour Jean, bienvenue !"

  console.log(t('cart.items', { count: 1 }))
  // "1 article dans votre panier"

  console.log(t('cart.items', { count: 5 }))
  // "5 articles dans votre panier"

  console.log(t('order.total', { amount: 42.5 }))
  // "Total : 42.5€"
}

// =============================================================================
// Example 3: Fallback Translations
// =============================================================================

export function example3_FallbackTranslations() {
  const frTranslations: TranslationMap = {
    welcome: 'Bienvenue',
    products: 'Produits',
    // "cart" is missing in French
  }

  const enTranslations: TranslationMap = {
    welcome: 'Welcome',
    products: 'Products',
    cart: 'Cart',
  }

  const t = createTranslator(frTranslations, 'fr', enTranslations)

  console.log(t('welcome')) // "Bienvenue"
  console.log(t('products')) // "Produits"
  console.log(t('cart')) // "Cart" (fallback to English)
}

// =============================================================================
// Example 4: Locale Detection (Server-side)
// =============================================================================

export function example4_ServerSideDetection() {
  // Next.js Server Component example
  const config: I18nConfig = {
    ...DEFAULT_I18N_CONFIG,
    supportedLocales: ['fr', 'en', 'es', 'ar'],
  }

  // Mock request data
  const cookieString = 'beid_locale=fr; session=xyz'
  const acceptLanguage = 'fr-FR,fr;q=0.9,en;q=0.8'

  const locale = detectLocale(config, {
    cookieString,
    acceptLanguage,
  })

  console.log(`Detected locale: ${locale}`) // "fr"
}

// =============================================================================
// Example 5: Locale Detection (Client-side)
// =============================================================================

export function example5_ClientSideDetection() {
  const config: I18nConfig = {
    ...DEFAULT_I18N_CONFIG,
    supportedLocales: ['fr', 'en', 'es', 'ar'],
  }

  const locale = detectLocale(config, {
    useLocalStorage: true,
    useBrowser: true,
  })

  console.log(`Detected locale: ${locale}`)
}

// =============================================================================
// Example 6: Setting Locale
// =============================================================================

export function example6_SettingLocale() {
  const config = DEFAULT_I18N_CONFIG

  // Set locale in both cookie and localStorage
  const cookieString = setLocale('fr', config)

  console.log(`Set cookie: ${cookieString}`)
  // "beid_locale=fr; Max-Age=31536000; Path=/; SameSite=Lax"

  // In Next.js, you can set the cookie in the response
  // cookies().set('beid_locale', 'fr', { maxAge: config.cookieMaxAge })
}

// =============================================================================
// Example 7: RTL Languages
// =============================================================================

export function example7_RTLLanguages() {
  const locale = 'ar' // Arabic

  const isRtl = isRtlLocale(locale)
  const direction = getLocaleDirection(locale)

  console.log(`Is RTL: ${isRtl}`) // true
  console.log(`Direction: ${direction}`) // "rtl"

  // In React component:
  // <div dir={direction}>
  //   {content}
  // </div>
}

// =============================================================================
// Example 8: GPT Translation (Simple)
// =============================================================================

export async function example8_GPTTranslationSimple() {
  // HTTP client implementation (using fetch)
  const httpClient: HttpClient = {
    async post(url: string, data: unknown, headers?: Record<string, string>) {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...headers,
        },
        body: JSON.stringify(data),
      })
      return response.json()
    },
  }

  const apiKey = process.env.OPENAI_API_KEY || 'sk-...'

  const translated = await translateText(
    'Pizza Margherita',
    'fr',
    'en',
    'product name', // context
    httpClient,
    apiKey
  )

  console.log(translated) // "Margherita Pizza"
}

// =============================================================================
// Example 9: GPT Translation (Batch)
// =============================================================================

export async function example9_GPTTranslationBatch() {
  const httpClient: HttpClient = {
    async post(url: string, data: unknown, headers?: Record<string, string>) {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...headers,
        },
        body: JSON.stringify(data),
      })
      return response.json()
    },
  }

  const apiKey = process.env.OPENAI_API_KEY || 'sk-...'

  // Products to translate
  const products = [
    { text: 'Pizza Margherita', key: 'product.pizza.name' },
    { text: 'Tomate, mozzarella, basilic', key: 'product.pizza.description' },
    { text: 'Salade César', key: 'product.salad.name' },
  ]

  const results = await batchTranslate(products, 'fr', 'en', httpClient, apiKey, 60)

  results.forEach((result) => {
    console.log(`${result.original} → ${result.translated}`)
    console.log(`Cost: $${result.cost.toFixed(6)}`)
  })

  // Total cost
  const totalCost = results.reduce((sum, r) => sum + r.cost, 0)
  console.log(`Total cost: $${totalCost.toFixed(4)}`)
}

// =============================================================================
// Example 10: Cost Estimation
// =============================================================================

export function example10_CostEstimation() {
  const productName = 'Pizza Margherita'
  const productDescription = 'Tomate, mozzarella, basilic frais'

  const nameCost = estimateTranslationCost(productName.length)
  const descCost = estimateTranslationCost(productDescription.length)

  console.log(`Product name translation cost: $${nameCost.toFixed(6)}`)
  console.log(`Product description translation cost: $${descCost.toFixed(6)}`)

  // Estimate for 100 products
  const totalProducts = 100
  const avgProductLength = 50
  const totalCost = estimateTranslationCost(avgProductLength * totalProducts)

  console.log(`Estimated cost for 100 products: $${totalCost.toFixed(2)}`)
}

// =============================================================================
// Example 11: Multi-locale Translators
// =============================================================================

export function example11_MultiLocaleTranslators() {
  const translationsByLocale = {
    fr: {
      welcome: 'Bienvenue',
      products: 'Produits',
      cart: 'Panier',
    },
    en: {
      welcome: 'Welcome',
      products: 'Products',
      cart: 'Cart',
    },
    es: {
      welcome: 'Bienvenido',
      products: 'Productos',
      cart: 'Carrito',
    },
  }

  const { createTranslators } = require('./translator')
  const translators = createTranslators(translationsByLocale, 'en')

  console.log(translators.fr('welcome')) // "Bienvenue"
  console.log(translators.en('welcome')) // "Welcome"
  console.log(translators.es('welcome')) // "Bienvenido"
}

// =============================================================================
// Example 12: Full Translation Workflow
// =============================================================================

export async function example12_FullTranslationWorkflow() {
  // Step 1: Load source translations
  const frTranslations: TranslationMap = {
    'product.pizza.name': 'Pizza Margherita',
    'product.pizza.description': 'Tomate, mozzarella, basilic',
    'product.salad.name': 'Salade César',
  }

  // Step 2: Check for missing translations
  const enTranslations: TranslationMap = {
    'product.pizza.name': 'Margherita Pizza',
    // Missing description and salad
  }

  const { getMissingKeys } = require('./translator')
  const missingKeys = getMissingKeys(frTranslations, enTranslations)

  console.log('Missing translations:', missingKeys)
  // ["product.pizza.description", "product.salad.name"]

  // Step 3: Translate missing keys
  const httpClient: HttpClient = {
    async post(url: string, data: unknown, headers?: Record<string, string>) {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...headers },
        body: JSON.stringify(data),
      })
      return response.json()
    },
  }

  const apiKey = process.env.OPENAI_API_KEY || 'sk-...'

  const toTranslate = missingKeys.map((key: string) => ({
    text: frTranslations[key] || '',
    key,
  }))

  const results = await batchTranslate(toTranslate, 'fr', 'en', httpClient, apiKey)

  // Step 4: Merge translations
  const { mergeTranslations } = require('./translator')
  const newTranslations: TranslationMap = {}

  results.forEach((result, index) => {
    const key = missingKeys[index]
    if (key) {
      newTranslations[key] = result.translated
    }
  })

  const completeTranslations = mergeTranslations(enTranslations, newTranslations)

  console.log('Complete translations:', completeTranslations)
}

// =============================================================================
// Example 13: React Hook Implementation
// =============================================================================

/**
 * This is an example of how to implement the useTranslation hook in your app
 * The core package only provides types, not the implementation
 */
export function example13_ReactHookImplementation() {
  // This would be in your app/hooks/useTranslation.ts
  /*
  import { createTranslator, getLocaleDirection, isRtlLocale } from '@be-in-digital/core'
  import type { UseTranslationReturn } from '@be-in-digital/core'
  import { useContext } from 'react'
  import { I18nContext } from '@/contexts/I18nContext'

  export function useTranslation(): UseTranslationReturn {
    const context = useContext(I18nContext)

    if (!context) {
      throw new Error('useTranslation must be used within I18nProvider')
    }

    const { locale, setLocale, translations, fallbackTranslations } = context

    const t = createTranslator(translations, locale, fallbackTranslations)
    const direction = getLocaleDirection(locale)
    const isRtl = isRtlLocale(locale)

    return {
      t,
      locale,
      setLocale,
      direction,
      isRtl,
    }
  }
  */
}

// =============================================================================
// Example 14: Next.js Server Component
// =============================================================================

/**
 * Example of using i18n in Next.js Server Component
 */
export async function example14_NextJSServerComponent() {
  // This would be in your app/[locale]/page.tsx
  /*
  import { cookies, headers } from 'next/headers'
  import { detectLocale, createTranslator } from '@be-in-digital/core'
  import { DEFAULT_I18N_CONFIG } from '@be-in-digital/core'

  export default async function Page() {
    const cookieStore = cookies()
    const headersList = headers()

    const locale = detectLocale(DEFAULT_I18N_CONFIG, {
      cookieString: cookieStore.toString(),
      acceptLanguage: headersList.get('accept-language') || '',
    })

    const translations = await loadTranslations(locale)
    const t = createTranslator(translations, locale)

    return (
      <div>
        <h1>{t('welcome')}</h1>
        <p>{t('description')}</p>
      </div>
    )
  }
  */
}

// =============================================================================
// Example 15: Next.js Client Component
// =============================================================================

/**
 * Example of using i18n in Next.js Client Component
 */
export function example15_NextJSClientComponent() {
  // This would be in your app/components/LanguageSwitcher.tsx
  /*
  'use client'

  import { setLocale } from '@be-in-digital/core'
  import { COMMON_LANGUAGES, DEFAULT_I18N_CONFIG } from '@be-in-digital/core'
  import { useRouter } from 'next/navigation'

  export function LanguageSwitcher({ currentLocale }: { currentLocale: string }) {
    const router = useRouter()

    const handleLocaleChange = (locale: string) => {
      setLocale(locale, DEFAULT_I18N_CONFIG)
      router.refresh()
    }

    return (
      <select value={currentLocale} onChange={(e) => handleLocaleChange(e.target.value)}>
        {COMMON_LANGUAGES.map((lang) => (
          <option key={lang.code} value={lang.code}>
            {lang.flagEmoji} {lang.nativeName}
          </option>
        ))}
      </select>
    )
  }
  */
}
