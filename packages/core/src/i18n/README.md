# i18n System - BeYours Engine

Complete internationalization system with unlimited multi-language support, automatic detection, and GPT-3.5 translation.

## 🌍 Features

- ✅ Support for **every language** (no limit)
- ✅ Automatic detection (cookie → localStorage → browser/header → default)
- ✅ RTL languages supported (Arabic, Hebrew, Persian, etc.)
- ✅ Automatic translation via GPT-3.5-turbo
- ✅ Variable interpolation (`{{name}}`)
- ✅ Simple pluralization
- ✅ Fallback translations
- ✅ TypeScript strict, 100% typed
- ✅ 58 unit tests

## 📦 Installation

The `@be-yours/core` package is already installed in the monorepo.

```typescript
import {
  detectLocale,
  setLocale,
  createTranslator,
  translateText,
  DEFAULT_I18N_CONFIG,
  COMMON_LANGUAGES,
} from '@be-yours/core'
```

## 🚀 Basic Usage

### 1. Configuration

```typescript
import { DEFAULT_I18N_CONFIG } from '@be-yours/core'

// Use the default config
const config = {
  ...DEFAULT_I18N_CONFIG,
  supportedLocales: ['fr', 'en', 'es', 'ar'],
}
```

### 2. Language Detection

```typescript
import { detectLocale } from '@be-yours/core'

// Server side (Next.js)
import { cookies, headers } from 'next/headers'

const cookieString = cookies().toString()
const acceptLanguage = headers().get('accept-language') || ''

const locale = detectLocale(config, {
  cookieString,
  acceptLanguage,
})

// Client side
const locale = detectLocale(config, {
  useLocalStorage: true,
  useBrowser: true,
})
```

### 3. Language Persistence

```typescript
import { setLocale, clearLocale } from '@be-yours/core'

// Set the language (cookie + localStorage)
setLocale('fr', config)

// Clear the language
clearLocale(config)
```

### 4. Translation

```typescript
import { createTranslator } from '@be-yours/core'

const translations = {
  welcome: 'Bienvenue',
  hello_name: 'Bonjour {{name}}',
  items_count: '{{count}} article',
}

const t = createTranslator(translations, 'fr')

t('welcome') // "Bienvenue"
t('hello_name', { name: 'Jean' }) // "Bonjour Jean"
t('items_count', { count: 5 }) // "5 articles"
```

## 🤖 Automatic GPT Translation

### Setup

```typescript
import { translateText, batchTranslate } from '@be-yours/core'

// Create an HTTP client (fetch example)
const httpClient = {
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

const apiKey = process.env.OPENAI_API_KEY!
```

### Simple Translation

```typescript
const translated = await translateText(
  'Bonjour le monde',
  'fr',
  'en',
  'greeting', // optional context
  httpClient,
  apiKey
)
// "Hello world"
```

### Batch Translation

```typescript
const items = [
  { text: 'Pizza Margherita', key: 'product_name' },
  { text: 'Tomate, mozzarella, basilic', key: 'product_description' },
]

const results = await batchTranslate(items, 'fr', 'en', httpClient, apiKey)

results.forEach((result) => {
  console.log(`${result.original} → ${result.translated}`)
  console.log(`Coût: $${result.cost.toFixed(6)}`)
})
```

### Cost Estimation

```typescript
import { estimateTranslationCost } from '@be-yours/core'

const cost = estimateTranslationCost(text.length)
// ~$0.001 per product
// ~$0.01 per page
```

## 🎨 RTL Languages (Right-to-Left)

```typescript
import { isRtlLocale, getLocaleDirection } from '@be-yours/core'

const isRtl = isRtlLocale('ar') // true
const direction = getLocaleDirection('ar') // 'rtl'

// In your component
<div dir={direction}>
  {/* Content */}
</div>
```

### Supported RTL languages

- 🇸🇦 `ar` - Arabic
- 🇮🇱 `he` - Hebrew
- 🇮🇷 `fa` - Persian
- 🇵🇰 `ur` - Urdu
- 🇦🇫 `ps` - Pashto
- 🇵🇰 `sd` - Sindhi
- 🇮🇱 `yi` - Yiddish

## 🔧 React Hooks (to be implemented in the app)

The core package only exports the hook **types**. The implementation has to be done in the application.

### Available types

```typescript
import type {
  UseTranslation,
  UseLocale,
  UseTranslator,
  UseDirection,
  I18nProviderProps,
} from '@be-yours/core'
```

### Implementation example

```typescript
// app/hooks/useTranslation.ts
import { createTranslator } from '@be-yours/core'
import type { UseTranslationReturn } from '@be-yours/core'

export function useTranslation(): UseTranslationReturn {
  const { locale, setLocale } = useLocale()
  const translations = useTranslations(locale)

  const t = createTranslator(translations, locale)
  const direction = getLocaleDirection(locale)
  const isRtl = isRtlLocale(locale)

  return { t, locale, setLocale, direction, isRtl }
}
```

## 📊 Translation Structure

### Recommended format

```typescript
// translations/fr.json
{
  "common.welcome": "Bienvenue",
  "common.hello": "Bonjour",
  "product.name": "Nom du produit",
  "product.description": "Description",
  "order.items": "{{count}} article",
  "order.total": "Total : {{amount}}€",
  "error.not_found": "Page non trouvée",
  "error.server": "Erreur serveur"
}
```

### Namespaces

Use dot notation to organize keys:

- `common.*` - Shared text
- `product.*` - Products
- `order.*` - Orders
- `auth.*` - Authentication
- `admin.*` - Admin
- `error.*` - Error messages

## 🧪 Tests

The i18n system is fully covered by 58 unit tests.

```bash
pnpm --filter @be-yours/core test
```

### Coverage

- ✅ Config and detection (23 tests)
- ✅ Storage (cookies, localStorage) (11 tests)
- ✅ Translation and interpolation (14 tests)
- ✅ GPT translation (10 tests)

## 🔐 Environment Variables

```bash
# For GPT translation (optional)
OPENAI_API_KEY=sk-...
```

## 📚 API Reference

### Types

```typescript
type Locale = string
type TranslationMap = Record<string, string>
type Direction = 'ltr' | 'rtl'

interface I18nConfig {
  defaultLocale: Locale
  supportedLocales: Locale[]
  fallbackLocale: Locale
  cookieName: string
  localStorageKey: string
  cookieMaxAge: number
}
```

### Main Functions

| Function | Description |
|----------|-------------|
| `detectLocale()` | Detects the language through the cascade |
| `setLocale()` | Sets the language (cookie + localStorage) |
| `createTranslator()` | Creates a translation function |
| `translateText()` | Translates via GPT-3.5 |
| `batchTranslate()` | Translates several items |
| `isRtlLocale()` | Checks whether a locale is RTL |
| `getLocaleDirection()` | Returns the direction |

## 💰 GPT-3.5 Costs

| Volume | Estimated Cost |
|--------|-------------|
| 1 product | ~$0.001 |
| 100 products | ~$0.10 |
| 1 full page | ~$0.01 |
| 1000 translations | ~$1.00 |

*Based on GPT-3.5-turbo ($0.0005/1K input, $0.0015/1K output)*

## 🎯 Best Practices

1. **Always provide a fallback**
   ```typescript
   const t = createTranslator(translations, locale, fallbackTranslations)
   ```

2. **Use descriptive keys**
   ```typescript
   // ✅ Good
   t('product.add_to_cart')

   // ❌ Bad
   t('btn1')
   ```

3. **Preload translations**
   ```typescript
   // Load every translation at startup
   const translations = await loadTranslations(locale)
   ```

4. **Handle missing keys**
   ```typescript
   const missing = getMissingKeys(frTranslations, enTranslations)
   if (missing.length > 0) {
     console.warn('Missing translations:', missing)
   }
   ```

5. **Optimize GPT translations**
   ```typescript
   // Translate in batches to cut costs
   const results = await batchTranslate(items, 'fr', 'en', httpClient, apiKey)
   ```

## 🚀 Migrating from an existing system

```typescript
import { mergeTranslations, getMissingKeys } from '@be-yours/core'

// Merge the old and new translations
const merged = mergeTranslations(oldTranslations, newTranslations)

// Identify the missing keys
const missing = getMissingKeys(sourceTranslations, targetTranslations)

// Translate the missing keys
const toTranslate = missing.map(key => ({
  text: sourceTranslations[key],
  key,
}))

const translated = await batchTranslate(toTranslate, 'fr', 'en', httpClient, apiKey)
```

## 📝 Notes

- The system supports an **unlimited number of languages**
- Detection follows a **cascade**: cookie → localStorage → browser/header → default
- GPT translations include a **retry system** with exponential backoff
- **Rate limiting** is built in (60 req/min by default)
- Every function is **100% typed** with TypeScript strict mode

---

**Version**: 2.0.0
**Package**: `@be-yours/core`
**Tests**: 58/58 passing ✅
