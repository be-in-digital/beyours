# i18n System - BeInDigital Engine

Système d'internationalisation complet avec support multi-langues illimité, détection automatique, et traduction GPT-3.5.

## 🌍 Fonctionnalités

- ✅ Support de **toutes les langues** (pas de limite)
- ✅ Détection automatique (cookie → localStorage → navigateur/header → défaut)
- ✅ Langues RTL supportées (arabe, hébreu, persan, etc.)
- ✅ Traduction automatique via GPT-3.5-turbo
- ✅ Interpolation de variables (`{{name}}`)
- ✅ Pluralisation simple
- ✅ Traductions fallback
- ✅ TypeScript strict, 100% typé
- ✅ 58 tests unitaires

## 📦 Installation

Le package `@be-in-digital/core` est déjà installé dans le monorepo.

```typescript
import {
  detectLocale,
  setLocale,
  createTranslator,
  translateText,
  DEFAULT_I18N_CONFIG,
  COMMON_LANGUAGES,
} from '@be-in-digital/core/i18n'
```

## 🚀 Usage Basique

### 1. Configuration

```typescript
import { DEFAULT_I18N_CONFIG } from '@be-in-digital/core/i18n'

// Utiliser la config par défaut
const config = {
  ...DEFAULT_I18N_CONFIG,
  supportedLocales: ['fr', 'en', 'es', 'ar'],
}
```

### 2. Détection de la langue

```typescript
import { detectLocale } from '@be-in-digital/core/i18n'

// Côté serveur (Next.js)
import { cookies, headers } from 'next/headers'

const cookieString = cookies().toString()
const acceptLanguage = headers().get('accept-language') || ''

const locale = detectLocale(config, {
  cookieString,
  acceptLanguage,
})

// Côté client
const locale = detectLocale(config, {
  useLocalStorage: true,
  useBrowser: true,
})
```

### 3. Persistance de la langue

```typescript
import { setLocale, clearLocale } from '@be-in-digital/core/i18n'

// Définir la langue (cookie + localStorage)
setLocale('fr', config)

// Effacer la langue
clearLocale(config)
```

### 4. Traduction

```typescript
import { createTranslator } from '@be-in-digital/core/i18n'

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

## 🤖 Traduction Automatique GPT

### Setup

```typescript
import { translateText, batchTranslate } from '@be-in-digital/core/i18n'

// Créer un HTTP client (exemple avec fetch)
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

### Traduction Simple

```typescript
const translated = await translateText(
  'Bonjour le monde',
  'fr',
  'en',
  'greeting', // contexte optionnel
  httpClient,
  apiKey
)
// "Hello world"
```

### Traduction en Batch

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

### Estimation des Coûts

```typescript
import { estimateTranslationCost } from '@be-in-digital/core/i18n'

const cost = estimateTranslationCost(text.length)
// ~$0.001 par produit
// ~$0.01 par page
```

## 🎨 Langues RTL (Right-to-Left)

```typescript
import { isRtlLocale, getLocaleDirection } from '@be-in-digital/core/i18n'

const isRtl = isRtlLocale('ar') // true
const direction = getLocaleDirection('ar') // 'rtl'

// Dans votre composant
<div dir={direction}>
  {/* Contenu */}
</div>
```

### Langues RTL supportées

- 🇸🇦 `ar` - Arabe
- 🇮🇱 `he` - Hébreu
- 🇮🇷 `fa` - Persan
- 🇵🇰 `ur` - Ourdou
- 🇦🇫 `ps` - Pashto
- 🇵🇰 `sd` - Sindhi
- 🇮🇱 `yi` - Yiddish

## 🔧 Hooks React (à implémenter dans l'app)

Le package core exporte uniquement les **types** des hooks. L'implémentation doit être faite dans l'application.

### Types disponibles

```typescript
import type {
  UseTranslation,
  UseLocale,
  UseTranslator,
  UseDirection,
  I18nProviderProps,
} from '@be-in-digital/core/i18n'
```

### Exemple d'implémentation

```typescript
// app/hooks/useTranslation.ts
import { createTranslator } from '@be-in-digital/core/i18n'
import type { UseTranslationReturn } from '@be-in-digital/core/i18n'

export function useTranslation(): UseTranslationReturn {
  const { locale, setLocale } = useLocale()
  const translations = useTranslations(locale)

  const t = createTranslator(translations, locale)
  const direction = getLocaleDirection(locale)
  const isRtl = isRtlLocale(locale)

  return { t, locale, setLocale, direction, isRtl }
}
```

## 📊 Structure des Traductions

### Format recommandé

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

Utilisez la notation par points pour organiser :

- `common.*` - Textes communs
- `product.*` - Produits
- `order.*` - Commandes
- `auth.*` - Authentification
- `admin.*` - Admin
- `error.*` - Messages d'erreur

## 🧪 Tests

Le système i18n est entièrement testé avec 58 tests unitaires.

```bash
pnpm --filter @be-in-digital/core test
```

### Couverture

- ✅ Config et détection (23 tests)
- ✅ Storage (cookies, localStorage) (11 tests)
- ✅ Traduction et interpolation (14 tests)
- ✅ GPT translation (10 tests)

## 🔐 Variables d'Environnement

```bash
# Pour la traduction GPT (optionnel)
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

### Fonctions Principales

| Fonction | Description |
|----------|-------------|
| `detectLocale()` | Détecte la langue avec cascade |
| `setLocale()` | Définit la langue (cookie + localStorage) |
| `createTranslator()` | Crée une fonction de traduction |
| `translateText()` | Traduit via GPT-3.5 |
| `batchTranslate()` | Traduit plusieurs items |
| `isRtlLocale()` | Vérifie si RTL |
| `getLocaleDirection()` | Retourne la direction |

## 💰 Coûts GPT-3.5

| Volume | Coût Estimé |
|--------|-------------|
| 1 produit | ~$0.001 |
| 100 produits | ~$0.10 |
| 1 page complète | ~$0.01 |
| 1000 traductions | ~$1.00 |

*Basé sur GPT-3.5-turbo ($0.0005/1K input, $0.0015/1K output)*

## 🎯 Best Practices

1. **Toujours fournir un fallback**
   ```typescript
   const t = createTranslator(translations, locale, fallbackTranslations)
   ```

2. **Utiliser des clés descriptives**
   ```typescript
   // ✅ Bon
   t('product.add_to_cart')

   // ❌ Mauvais
   t('btn1')
   ```

3. **Précharger les traductions**
   ```typescript
   // Charger toutes les traductions au démarrage
   const translations = await loadTranslations(locale)
   ```

4. **Gérer les clés manquantes**
   ```typescript
   const missing = getMissingKeys(frTranslations, enTranslations)
   if (missing.length > 0) {
     console.warn('Missing translations:', missing)
   }
   ```

5. **Optimiser les traductions GPT**
   ```typescript
   // Traduire en batch pour économiser
   const results = await batchTranslate(items, 'fr', 'en', httpClient, apiKey)
   ```

## 🚀 Migration depuis un système existant

```typescript
import { mergeTranslations, getMissingKeys } from '@be-in-digital/core/i18n'

// Fusionner les anciennes et nouvelles traductions
const merged = mergeTranslations(oldTranslations, newTranslations)

// Identifier les clés manquantes
const missing = getMissingKeys(sourceTranslations, targetTranslations)

// Traduire les clés manquantes
const toTranslate = missing.map(key => ({
  text: sourceTranslations[key],
  key,
}))

const translated = await batchTranslate(toTranslate, 'fr', 'en', httpClient, apiKey)
```

## 📝 Notes

- Le système supporte un **nombre illimité de langues**
- La détection suit une **cascade** : cookie → localStorage → browser/header → default
- Les traductions GPT incluent un **système de retry** avec backoff exponentiel
- Le **rate limiting** est intégré (60 req/min par défaut)
- Toutes les fonctions sont **100% typées** avec TypeScript strict

---

**Version**: 2.0.0
**Package**: `@be-in-digital/core`
**Tests**: 58/58 passés ✅
