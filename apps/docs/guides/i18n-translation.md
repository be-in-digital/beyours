# Internationalization & Translation Guide

> Dynamic, unlimited languages with GPT-3.5-turbo auto-translation.

## Table of Contents

- [Overview](#overview)
- [How It Works](#how-it-works)
- [Admin: Adding Languages](#admin-adding-languages)
- [Auto-Translation with GPT](#auto-translation-with-gpt)
- [Manual Translation](#manual-translation)
- [Using Translations in Code](#using-translations-in-code)
- [Costs](#costs)

## Overview

BeYours's i18n system is dynamic — restaurant owners can add **any language** from the admin dashboard. Translations are generated automatically using GPT-3.5-turbo, with an option for manual override.

## How It Works

1. Admin adds a new language (e.g., Spanish)
2. System queues all untranslated content for GPT translation
3. GPT-3.5-turbo translates each piece of content
4. Translations are stored in the database
5. Users see content in their selected language

### Language Detection Priority

1. URL parameter (`?lang=fr`)
2. Cookie (`locale` cookie)
3. localStorage (`locale` key)
4. Browser `Accept-Language` header
5. Default language (configurable)

## Admin: Adding Languages

```tsx
// From the admin dashboard
import { LanguagesPage } from "@be-in-digital/admin/pages";

// The LanguagesPage component provides:
// - Add new language
// - View translation progress
// - Trigger batch translation
// - Manual translation editor
```

## Auto-Translation with GPT

### Single Translation

```typescript
import { translateWithGPT } from "@be-in-digital/core";

const result = await translateWithGPT(
  "Margherita Pizza",    // text
  "en",                  // source language
  "fr",                  // target language
  "product name"         // context hint for better accuracy
);
// → "Pizza Margherita"
```

### Batch Translation

```typescript
import { batchTranslate } from "@be-in-digital/core";

// Translate all products to Spanish
await batchTranslate(products, "en", "es");

// Translate specific fields
await batchTranslate(products, "en", "de", {
  fields: ["name", "description"],
});
```

### Context Hints

Provide context hints for more accurate translations:

| Context | Effect |
|---------|--------|
| `"product name"` | Short, concise translation |
| `"product description"` | Natural flowing text |
| `"menu category"` | Food category terminology |
| `"button text"` | UI action text |
| `"error message"` | Clear error communication |

## Manual Translation

Override any automatic translation:

```typescript
import { useTranslation } from "@be-in-digital/core";

// In the admin translation editor
await updateTranslation({
  key: "product_123_name",
  locale: "fr",
  value: "Pizza Reine", // Manual override
  isManual: true,       // Won't be overwritten by auto-translate
});
```

## Using Translations in Code

### useTranslation Hook

```typescript
import { useTranslation } from "@be-in-digital/core";

function ProductCard({ product }) {
  const { t, locale, setLocale, availableLocales } = useTranslation();

  return (
    <div>
      <h2>{t(product.name)}</h2>
      <p>{t(product.description)}</p>
      <span>{formatPrice(product.price)}</span>
    </div>
  );
}
```

### Language Switcher

```tsx
import { useTranslation } from "@be-in-digital/core";
import { Select } from "@be-in-digital/ui";

function LanguageSwitcher() {
  const { locale, setLocale, availableLocales } = useTranslation();

  return (
    <Select value={locale} onValueChange={setLocale}>
      {availableLocales.map((lang) => (
        <SelectItem key={lang.code} value={lang.code}>
          {lang.flag} {lang.name}
        </SelectItem>
      ))}
    </Select>
  );
}
```

### Storage

```typescript
import { getLocale, setLocale } from "@be-in-digital/core";

// Get current locale
const locale = getLocale(); // "fr"

// Set locale (saves to cookie + localStorage)
setLocale("en");
```

## Costs

GPT-3.5-turbo translation is extremely cost-effective:

| Content | Estimated Cost |
|---------|----------------|
| 1 product (name + description) | ~$0.001 |
| 100 products | ~$0.10 |
| 1 CMS page | ~$0.01 |
| Full restaurant catalog | ~$0.50 |

### Environment Variable

```env
OPENAI_API_KEY=sk-...
```
