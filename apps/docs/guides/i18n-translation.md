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
import { LanguagesPage } from "@be-yours/admin/pages";

// The LanguagesPage component provides:
// - Add new language
// - View translation progress
// - Trigger batch translation
// - Manual translation editor
```

## Auto-Translation with GPT

Two things share the name "auto-translation", and they are not the same code:

| | Where | Calls OpenAI |
|---|---|---|
| What the admin button runs | `@be-yours/convex-functions/autoTranslate` (`getTranslationPlan`, `runTranslationPlan`, `runBatchChunkPlan`, `saveDocumentTranslations`…), wrapped by each app as the `translateCatalogue` and `batchChunk` actions. There is no `translateUIStrings`: it existed in both apps with zero callers, under a docblock claiming the admin languages page called it, and has been deleted — UI strings are translated one at a time through « Traductions UI » (`translations.upsert`) | Yes, `fetch` straight to `api.openai.com`, under a per-store daily quota |
| The reusable helpers | `translateText` / `batchTranslate` in `@be-yours/core` | Only through an **injected** HTTP client |

The core helpers never import an SDK and never read `process.env`: an `HttpClient`
and an API key are handed in, which is what keeps the package loadable from the
Convex runtime.

### Single Translation

The export is `translateText` — there is no `translateWithGPT`.

```typescript
import { translateText } from "@be-yours/core";
import type { HttpClient } from "@be-yours/core";

const result = await translateText(
  "Margherita Pizza",    // text
  "en",                  // source language
  "fr",                  // target language
  "product name",        // context hint (optional)
  httpClient,            // HttpClient — throws without it
  process.env.OPENAI_API_KEY!, // API key — throws without it
  3                      // maxRetries, default 3
);
// → "Pizza Margherita"
```

`httpClient` and `apiKey` sit *after* the optional `context`, so both are typed
optional — but the function throws `"HTTP client is required for translation"` /
`"OpenAI API key is required for translation"` when either is missing. Pass
`undefined` for `context` if you have no hint but do have a client.

`HttpClient` is a single method: `post<T>(url, data, headers?)`.

### Batch Translation

```typescript
import { batchTranslate } from "@be-yours/core";

// Items are { text, key? } — not your documents. Map first.
const items = products.map((p) => ({ text: p.name, key: p._id }));

const translated = await batchTranslate(
  items,
  "en",           // source
  "es",           // target
  httpClient,     // required here, not optional
  apiKey,         // required here, not optional
  60              // rateLimit: max requests per minute, default 60
);
// → [{ original, translated, locale, cost }, ...]
```

There is no options object and no `fields` argument: `batchTranslate` translates
one string per item, in sequence, sleeping between requests to stay under the
rate limit. Each item's `key` is passed through as the translation's context
hint. Companion helpers: `estimateTranslationCost`, `calculateTotalCost`,
`groupTranslationResults`.

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

Overrides are rows in the `translations` table, written by the
`translations.upsert` mutation. `isAutoTranslated: false` is what marks a value
as hand-written:

```typescript
// convex/translations.ts wraps @be-yours/convex-functions/translations
await upsert({
  storeId,
  entityType: "product",
  entityId: productId,
  field: "name",
  languageCode: "fr",
  value: "Pizza Reine",   // Manual override
  isAutoTranslated: false,
});
```

`getUIOverrides` reads them back.

There used to be four more here — `bulkUpsert` for an array of the same shape,
`remove` for one row, and `getForEntity` / `getByLanguage` to read them. None
had a caller anywhere, and #413 removed them along with the rest of the
callerless public surface: the catalogue's bulk translation writes translations
straight onto the document from `autoTranslate`, never through a public
mutation, and the « Traductions UI » tab writes one string at a time through
`upsert`. The definitions remain in `@be-yours/convex-functions`, so
wiring a screen to one means restoring its wrapper.

## Using Translations in Code

### useTranslation Hook

`@be-yours/core` exports the **type** `UseTranslation`, not the hook: the
package ships no JSX and no React runtime, so it can describe a hook and not
run one. The running hook is in `@be-yours/restaurant`, built on the
language store:

```typescript
import { useTranslation } from "@be-yours/restaurant";

function ProductCard({ product }) {
  const { t, locale, defaultLocale, isReady } = useTranslation();

  return (
    <div>
      <h2>{t("product.title")}</h2>
      <span>{formatPrice(product.price)}</span>
    </div>
  );
}
```

`t` resolves a **key** through the cascade override → static JSON → default
locale → the key itself. Text still resolves while `isReady` is false, so a
component may render immediately instead of gating on it.

Product, category and menu names are not keys — their translations live on the
document itself, in the `translations` column the auto-translator writes. Use the
sibling hooks for those:

```tsx
import { useLocalizedDocument, useLocalizedDocuments } from "@be-yours/restaurant";

const product = useLocalizedDocument(rawProduct);      // name/description for the current locale
const products = useLocalizedDocuments(rawProducts);   // same, over a list
```

### Language Switcher

Switching the locale is a store action, not part of `useTranslation`'s return:

```tsx
import { useLanguageStore } from "@be-yours/restaurant/stores";
import { Select } from "@be-yours/ui";

function LanguageSwitcher() {
  const locale = useLanguageStore((s) => s.locale);
  const setLocale = useLanguageStore((s) => s.setLocale);
  const availableLanguages = useLanguageStore((s) => s.availableLanguages);

  return (
    <Select value={locale} onValueChange={setLocale}>
      {availableLanguages.map((lang) => (
        <SelectItem key={lang.code} value={lang.code}>
          {lang.flagEmoji} {lang.nativeName}
        </SelectItem>
      ))}
    </Select>
  );
}
```

`setLocale` is idempotent and refuses a code the store does not list as active;
`initialize(storeLanguages, storeDefault)` is what fills `availableLanguages`.

### Storage

There is no `getLocale`. Reading and writing are separate functions, and reading
differs by where you are:

```typescript
import {
  getLocaleFromCookie,
  getLocaleFromLocalStorage,
  detectLocale,
  resolveRequestLocale,
  setLocale,
  clearLocale,
  DEFAULT_I18N_CONFIG,
} from "@be-yours/core";

// Server: you hold the request's cookie header
const fromCookie = getLocaleFromCookie(request.headers.get("cookie") ?? "");

// Client: no argument needed
const fromStorage = getLocaleFromLocalStorage();

// Either: walk the whole priority chain in one call
const locale = detectLocale(DEFAULT_I18N_CONFIG, {
  cookieString,
  acceptLanguage,
});

// Rendering for a store: the store's own active languages are the allow-list,
// deliberately not config.supportedLocales
const rendered = resolveRequestLocale({
  cookieValue,
  availableCodes: ["fr", "en", "es"],
  defaultLocale: "fr",
});

// Writing: sets cookie + localStorage together
setLocale("en");
```

`setLocaleCookie` and `setLocaleLocalStorage` write one side only;
`getLocaleFromCookie` and `getLocaleFromLocalStorage` return `null` rather than a
fallback when nothing is stored.

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
