# @be-in-digital/cms — Complete Documentation

> Generic CMS package for BeYours Engine.
> This package contains **no predefined pages**. Each application defines its own CMS pages.

---

## Table of contents

1. [Overview](#1-overview)
2. [Architecture](#2-architecture)
3. [Installation](#3-installation)
4. [Step-by-step guide: adding the CMS to a new application](#4-step-by-step-guide-adding-the-cms-to-a-new-application)
5. [Type reference](#5-type-reference)
6. [Registry API](#6-registry-api)
7. [Reusable blocks](#7-reusable-blocks)
8. [Validation](#8-validation)
9. [Media handling](#9-media-handling)
10. [SVG sanitization](#10-svg-sanitization)
11. [Initialization (Frontend + Backend)](#11-initialization-frontend--backend)
12. [Concrete examples](#12-concrete-examples)
13. [Common errors and solutions](#13-common-errors-and-solutions)
14. [Diagrams](#14-diagrams)
15. [Glossary](#15-glossary)

---

## 1. Overview

### What is this package?

`@be-in-digital/cms` is a **content definition framework** for the BeYours CMS. It provides:

- A **configurable registry** of pages and groups
- Strict **TypeScript types** to define the content structure
- **Validation** of submitted data (server-side, before persistence)
- **Media handling** (size limits, MIME types)
- **SVG sanitization** (security)

### What this package does NOT do

- It contains **no page definition**. The application defines them.
- It handles **no UI** (no React components).
- It handles **no persistence** (no database). The `convex-functions` package takes care of that.
- It handles **no authentication**.

### Core principle

```
┌─────────────────────────────────┐
│   packages/cms                  │  ← Types, API, validation (generic)
│   Contains NO page              │
└────────────┬────────────────────┘
             │ imported by
             ▼
┌─────────────────────────────────┐
│   apps/mon-app/cms/             │  ← Page definitions (app-specific)
│   groups.ts + pages/*.ts        │
└────────────┬────────────────────┘
             │ setCmsRegistry()
             ▼
┌─────────────────────────────────┐
│   In-memory registry            │  ← Used by admin UI, Convex, storefront
│   getPageDefinition(), etc.     │
└─────────────────────────────────┘
```

---

## 2. Architecture

### Package structure

```
packages/cms/src/
├── index.ts                        # Entry point — all exports
├── registry/
│   ├── types.ts                    # Types: PageDefinition, BlockDefinition, etc.
│   ├── index.ts                    # API: setCmsRegistry, getPageDefinition, etc.
│   ├── validation.ts               # Integrity validation at initialization
│   └── blocks/
│       └── seoBlock.ts             # Reusable SEO block
├── validation/
│   └── validateBlockValues.ts      # Validation of submitted values
├── media/
│   └── types.ts                    # Media limits, upload validation
└── sanitize/
    └── svgSanitizer.ts             # SVG cleaning (security)
```

### Application-side structure (example: reference)

```
apps/reference/
├── cms/                             # CMS definitions specific to the app
│   ├── groups.ts                    # Page groups (6 groups)
│   ├── index.ts                     # Barrel → exports appCmsConfig
│   └── pages/                       # 1 file per page (20 files)
│       ├── homepage.ts
│       ├── sign-in.ts
│       ├── menu.ts
│       └── ...
├── lib/cms/
│   └── init.ts                      # Initialization file (side-effect import)
├── app/
│   ├── (admin)/layout.tsx           # import "@/lib/cms/init"
│   ├── (storefront)/layout.tsx      # import "@/lib/cms/init"
│   └── preview/layout.tsx           # import "@/lib/cms/init"
└── convex/
    ├── cms.ts                       # import + setCmsRegistry() at the top of the file
    └── cmsAutoTranslate.ts          # same
```

---

## 3. Installation

The package is already available in the monorepo. To use it in an app:

```json
// package.json of your app
{
  "dependencies": {
    "@be-in-digital/cms": "workspace:*"
  }
}
```

Then:

```bash
pnpm install
```

---

## 4. Step-by-step guide: adding the CMS to a new application

This guide starts from scratch. Follow each step in order.

### Step 1: Create the `cms/` folder in your app

```bash
mkdir -p apps/mon-app/cms/pages
```

### Step 2: Define the groups

Groups organize your pages in the admin dashboard. Each group has:
- `id` — unique identifier (never duplicated)
- `label` — name shown in the interface
- `order` — display order (never duplicated, lower = first)

Create `apps/mon-app/cms/groups.ts`:

```typescript
import type { CmsGroupDefinition } from "@be-in-digital/cms"

export const cmsGroups: CmsGroupDefinition[] = [
  { id: "main",    label: "Pages principales", order: 1 },
  { id: "auth",    label: "Authentification",   order: 2 },
  { id: "account", label: "Espace client",      order: 3 },
]
```

**Rules:**
- `id` must be unique (otherwise an error at initialization)
- `order` must be unique (otherwise an error at initialization)
- Each group must have at least one page assigned (otherwise an error at initialization)
- Don't use free-form strings for names — always reference `group.id`

### Step 3: Define a page

Create one file per page in `apps/mon-app/cms/pages/`. Example for a homepage:

```typescript
// apps/mon-app/cms/pages/homepage.ts
import type { PageDefinition } from "@be-in-digital/cms"
import { seoBlock } from "@be-in-digital/cms"

export const homepagePage: PageDefinition = {
  slug: "homepage",           // Unique identifier, matches the route
  label: "Page d'accueil",    // Name shown in the admin
  description: "Page d'accueil principale du site",  // Optional
  groupId: "main",            // References a group defined in groups.ts

  blocks: [
    // The SEO block is provided by the package (reusable)
    seoBlock,

    // Custom block
    {
      key: "hero",                     // Unique key within the page
      label: "Section principale",     // Name shown in the admin
      description: "Bannière en haut de la page",  // Optional
      fields: {
        title: {
          type: "text",                // Field type (see the Type reference section)
          label: "Titre principal",    // Name shown in the admin
          required: true,              // Required field?
          maxLength: 100,              // Max length (text/richtext only)
          hasCodeFallback: true,       // Does the code have a default value?
        },
        subtitle: {
          type: "richtext",
          label: "Sous-titre",
          maxLength: 500,
          hasCodeFallback: true,
        },
        backgroundImage: {
          type: "image",
          label: "Image de fond",
          translatable: false,         // Images are not translatable
          hasCodeFallback: true,
        },
      },
    },
  ],
}
```

### Step 4: Create the barrel file (index.ts)

Create `apps/mon-app/cms/index.ts` to tie everything together:

```typescript
import type { PageDefinition } from "@be-in-digital/cms"
import { cmsGroups } from "./groups"
import { homepagePage } from "./pages/homepage"
import { signInPage } from "./pages/sign-in"
// ... import all your pages

const pages: Record<string, PageDefinition> = {
  homepage: homepagePage,
  "sign-in": signInPage,
  // ... all your pages
}

export const appCmsConfig = {
  pages,
  groups: cmsGroups,
}
```

**Important:** the key in `pages` (`"homepage"`, `"sign-in"`) must match the page `slug` exactly.

### Step 5: Create the initialization file

Create `apps/mon-app/lib/cms/init.ts`:

```typescript
import { setCmsRegistry } from "@be-in-digital/cms"
import { appCmsConfig } from "@/cms"

setCmsRegistry(appCmsConfig)
```

This file is imported for its side effect only (just `import "@/lib/cms/init"`, without extracting anything).

### Step 6: Initialize in the Next.js layouts

Add the import at the top of **every root layout** that uses the CMS:

```typescript
// app/(admin)/layout.tsx
import "@/lib/cms/init"    // ← FIRST LINE after "use client"

// ... rest of the layout
```

```typescript
// app/(storefront)/layout.tsx
import "@/lib/cms/init"    // ← FIRST LINE

// ... rest of the layout
```

```typescript
// app/preview/layout.tsx (if you have a preview mode)
import "@/lib/cms/init"

// ... rest of the layout
```

**Why every layout?** Next.js can load any layout independently. If a user lands directly on `/preview/homepage`, the registry must be initialized.

### Step 7: Initialize in the Convex files

Every Convex file that uses the CMS (`getPageDefinition`, `getBlockDefinition`, etc.) must initialize the registry **at the top of the file**:

```typescript
// convex/cms.ts
import { setCmsRegistry } from "@be-in-digital/cms"
import { appCmsConfig } from "../cms"   // ← RELATIVE import (not @/cms)
setCmsRegistry(appCmsConfig)

// ... the rest of the Convex code
```

**Why a relative import?** The Convex tsconfig and the Next.js tsconfig resolve `@/` differently. The relative import `../cms` is safer and works everywhere.

**Why in every Convex file?** Convex loads modules independently. If `cms.ts` and `cmsAutoTranslate.ts` both use the registry, each of them has to initialize it.

### Step 8: Verify

```bash
# Build the CMS package
pnpm turbo build --filter=@be-in-digital/cms

# Run the tests
pnpm --filter @be-in-digital/cms test

# Deploy Convex
cd apps/mon-app && pnpx convex dev --once

# Build Next.js
pnpm turbo build --filter=@be-in-digital/mon-app
```

If `setCmsRegistry()` detects an error in your configuration, it prints an explicit message:

```
Error: [CMS Registry] Invalid config:
  - Duplicate group id: "main"
  - Page "settings" references unknown groupId "admin"
  - Group "empty" (label: "Empty Group") has no pages assigned
```

---

## 5. Type reference

### FieldType

Supported field types:

| Type       | Description                          | Stored data                 |
|------------|--------------------------------------|-----------------------------|
| `text`     | Plain text (single line)             | `textValue: string`         |
| `richtext` | Rich text (HTML)                     | `textValue: string`         |
| `image`    | Image (JPEG, PNG, WebP, SVG)         | `mediaId: string`           |
| `video`    | Video (MP4, WebM) or YouTube embed   | `mediaId` or `embedUrl`     |
| `file`     | File (PDF, DOCX, XLSX, PPTX)         | `mediaId: string`           |
| `select`   | Dropdown list                        | `textValue: string`         |

### FieldDefinition

Defines an editable field inside a block.

```typescript
interface FieldDefinition {
  type: FieldType                    // REQUIRED — field type
  label: string                      // REQUIRED — name shown in the admin
  description?: string               // Help text shown under the field
  required?: boolean                 // Must the field have a value? (default: false)
  maxLength?: number                 // Max length (text/richtext only)
  placeholder?: string               // Placeholder in the input
  translatable?: boolean             // Can it be translated? (default: true for text, false for media)
  hasCodeFallback: boolean           // REQUIRED — does the code have a default value?
  options?: SelectOption[]           // REQUIRED for type "select" only
  group?: string                     // Group fields together visually in the admin
}
```

**`hasCodeFallback` explained:**

- `true` = the storefront component shows a default value if nothing is entered in the CMS. The admin can "reset" the field to fall back to the code.
- `false` = no fallback. If the field is empty, nothing is displayed. If `required: true` AND `hasCodeFallback: false`, the field MUST have a value to publish.

### BlockDefinition

A block is an editable section inside a page (e.g. "Hero", "Formulaire", "SEO").

```typescript
interface BlockDefinition {
  key: string                        // REQUIRED — unique key within the page
  label: string                      // REQUIRED — name shown in the admin
  description?: string               // Help text
  fields: Record<string, FieldDefinition>  // REQUIRED — fields of the block
}
```

**Rule:** `key` values must be unique within a single page.

### PageDefinition

A complete CMS page.

```typescript
interface PageDefinition {
  slug: string                       // REQUIRED — unique internal identifier (e.g. "sign-in", "homepage")
  label: string                      // REQUIRED — name shown in the admin
  description?: string               // Description in the admin
  groupId?: string                   // Group ID (references CmsGroupDefinition.id)
  blocks: BlockDefinition[]          // REQUIRED — at least 1 block
}
```

**Slug vs route:** the `slug` is an internal CMS identifier, not a URL path. It doesn't always match the Next.js route. Examples:

| CMS slug       | Next.js route     |
|----------------|-------------------|
| `homepage`     | `/`               |
| `sign-in`      | `/sign-in`        |
| `product-detail` | `/product/[productId]` |
| `storefront-layout` | *(layout, not a route)* |

The application maps the CMS slug to the route, through the Convex queries `getPageBlocks({ pageSlug: "homepage" })`.

### CmsGroupDefinition

A group organizes pages in the admin dashboard.

```typescript
interface CmsGroupDefinition {
  id: string                         // REQUIRED — unique identifier
  label: string                      // REQUIRED — displayed name
  order: number                      // REQUIRED — position (lower = first)
}
```

### CmsFieldValue

The value stored in the database for a field. Used on the backend (Convex).

```typescript
interface CmsFieldValue {
  type: FieldType                    // Field type
  textValue?: string                 // Text value (text, richtext, select)
  mediaId?: string                   // Reference to cmsMedia (image, video, file)
  altText?: string                   // Alternative text (for images)
  embedUrl?: string                  // Embed URL (for YouTube/Vimeo videos)
  embedProvider?: "youtube" | "vimeo"
  isCleared?: boolean                // Explicit reset to the code fallback
}
```

### SelectOption

Option for a `select` field.

```typescript
interface SelectOption {
  value: string                      // Stored value
  label: string                      // Text shown in the dropdown
}
```

---

## 6. Registry API

### setCmsRegistry(config)

Initializes the CMS registry. **Must be called before any access to the registry.**

```typescript
import { setCmsRegistry } from "@be-in-digital/cms"

setCmsRegistry({
  pages: { ... },           // Record<string, PageDefinition>
  groups: [ ... ],          // CmsGroupDefinition[]
})
```

- Validates the configuration (see the Validation section)
- Sorts the groups by `order`
- Throws an error listing **every** violation if the config is invalid
- Can be called several times (replaces the previous config)

### getCmsRegistry()

Returns the full registry.

```typescript
const { pages, groups } = getCmsRegistry()
// pages: Record<string, PageDefinition>
// groups: CmsGroupDefinition[] (sorted by order)
```

### getCmsGroups()

Returns the groups sorted by `order`.

```typescript
const groups = getCmsGroups()
// [{ id: "main", label: "Principal", order: 1 }, ...]
```

### getPageDefinition(slug)

Returns a page definition by its slug.

```typescript
const page = getPageDefinition("homepage")
// PageDefinition | undefined
```

### getAllPageSlugs()

Returns all registered slugs.

```typescript
const slugs = getAllPageSlugs()
// ["homepage", "sign-in", "menu", ...]
```

### getBlockDefinition(pageSlug, blockKey)

Returns a specific block from a page.

```typescript
const block = getBlockDefinition("homepage", "hero")
// BlockDefinition | undefined
```

### getFieldDefinition(pageSlug, blockKey, fieldKey)

Returns a specific field from a block.

```typescript
const field = getFieldDefinition("homepage", "hero", "title")
// FieldDefinition | undefined
```

---

## 7. Reusable blocks

### seoBlock

Ready-to-use SEO block, to add to indexable pages.

```typescript
import { seoBlock } from "@be-in-digital/cms"

export const homepagePage: PageDefinition = {
  slug: "homepage",
  label: "Page d'accueil",
  groupId: "main",
  blocks: [
    seoBlock,        // ← Add as the first block
    {
      key: "hero",
      // ...
    },
  ],
}
```

The `seoBlock` block contains 4 fields:

| Field            | Type     | Description                                  |
|------------------|----------|----------------------------------------------|
| `metaTitle`      | `text`   | Title in Google results (70 chars max)        |
| `metaDescription`| `text`   | Google description (160 chars max)            |
| `ogImage`        | `image`  | Social sharing image                          |
| `robots`         | `select` | Robots directives (index/noindex, follow/nofollow) |

**When to use it:** on every page that should show up in Google (homepage, menu, categories, product pages, etc.). Don't add it to the authentication pages or the cart.

---

## 8. Validation

### Validation at initialization (setCmsRegistry)

`setCmsRegistry()` runs 4 checks automatically:

| #  | Check                                 | Example error                                                 |
|----|---------------------------------------|---------------------------------------------------------------|
| 1  | `group.id` unique                     | `Duplicate group id: "main"`                                  |
| 2  | `group.order` unique                  | `Duplicate group order: 1`                                    |
| 3  | Every `page.groupId` exists           | `Page "settings" references unknown groupId "admin"`          |
| 4  | No orphan group                       | `Group "empty" (label: "Vide") has no pages assigned`         |

If several violations exist, **all** of them are listed in the same error message.

### Value validation (validateBlockValues)

Used on the Convex side, before persisting a draft. Validates the data entered by the admin against the block definition.

```typescript
import { validateBlockValues, getBlockDefinition } from "@be-in-digital/cms"

const blockDef = getBlockDefinition("homepage", "hero")
const result = validateBlockValues(values, blockDef)

if (!result.valid) {
  // result.errors holds the details
  console.error(result.errors)
}
```

**Checks performed:**

| Code              | Description                                                    |
|-------------------|----------------------------------------------------------------|
| `unknown_field`   | The field doesn't exist in the block definition                |
| `type_mismatch`   | The value type doesn't match (e.g. text in an image field)     |
| `required`        | Required field with no code fallback and no value              |
| `max_length`      | Text exceeding the maximum length (HTML stripped for richtext) |
| `invalid_option`  | Select value not present in the allowed options                |

**Note:** fields with `isCleared: true` are not validated (explicit reset to the fallback).

---

## 9. Media handling

### Supported media types

| Type    | Accepted MIME types                    | Max size    |
|---------|----------------------------------------|-------------|
| `image` | JPEG, PNG, WebP, SVG                   | 10 MB       |
| `video` | MP4, WebM                              | 100 MB      |
| `file`  | PDF, DOCX, XLSX, PPTX                  | 25 MB       |

### validateMediaUpload(filename, mimeType, size)

Validates a file before upload.

```typescript
import { validateMediaUpload } from "@be-in-digital/cms"

const result = validateMediaUpload("photo.jpg", "image/jpeg", 2_000_000)

if (result.valid) {
  console.log(result.kind)  // "image"
} else {
  console.error(result.error)
  // { code: "file_too_large", message: "Fichier trop volumineux..." }
}
```

**Error codes:**

| Code               | Description                                        |
|--------------------|----------------------------------------------------|
| `invalid_filename` | Empty filename                                     |
| `invalid_mime`     | MIME type not allowed                              |
| `file_too_large`   | File exceeding the maximum size for this type      |

### Utility functions

```typescript
import { getMediaKind, getExtensionFromMimeType, CMS_MEDIA_LIMITS } from "@be-in-digital/cms"

getMediaKind("image/jpeg")           // "image"
getMediaKind("video/mp4")            // "video"
getMediaKind("application/pdf")      // "file"
getMediaKind("text/html")            // null (unsupported)

getExtensionFromMimeType("image/png")     // "png"
getExtensionFromMimeType("video/mp4")     // "mp4"
getExtensionFromMimeType("unknown/type")  // "bin" (fallback)

CMS_MEDIA_LIMITS.image.maxSize       // 10485760 (10 MB in bytes)
CMS_MEDIA_LIMITS.image.mimeTypes     // ["image/jpeg", "image/jpg", ...]
```

---

## 10. SVG sanitization

Uploaded SVGs are cleaned automatically to strip dangerous elements.

```typescript
import { sanitizeSvg } from "@be-in-digital/cms"

const result = sanitizeSvg(svgContent)
// result.sanitized    → cleaned SVG
// result.removedElements → ["<script>", "onclick", ...]
```

**Removed elements:**
- `<script>`, `<iframe>`, `<object>`, `<embed>`, `<form>`, `<input>`, `<foreignObject>`, etc.
- `onclick`, `onload`, `onerror` attributes, etc.
- `javascript:` URIs in the `href` / `xlink:href` attributes

**Limit:** 1 MB max per SVG. Beyond that, an error is thrown.

---

## 11. Initialization (Frontend + Backend)

### Why initialize?

The CMS registry is an **in-memory singleton**. It must be populated before any code can call `getPageDefinition()`, `getBlockDefinition()`, etc.

### Where to initialize?

| Context               | File                              | Method                                   |
|-----------------------|-----------------------------------|------------------------------------------|
| Admin layout          | `app/(admin)/layout.tsx`          | `import "@/lib/cms/init"`                |
| Storefront layout     | `app/(storefront)/layout.tsx`     | `import "@/lib/cms/init"`                |
| Preview layout        | `app/preview/layout.tsx`          | `import "@/lib/cms/init"`                |
| Convex `cms.ts`       | `convex/cms.ts`                   | `import { appCmsConfig } from "../cms"`  |
| Convex auto-translate | `convex/cmsAutoTranslate.ts`      | same                                     |

### Why does this work?

- `setCmsRegistry()` is **idempotent** — calling it several times causes no problem
- The Convex functions (`getPageDefinition`, etc.) are called **inside the handlers**, not at module load time. So the registry is already initialized when they run.
- Side-effect imports (`import "@/lib/cms/init"`) are executed only once by the bundler.

### When to add a new initialization?

You must add `setCmsRegistry()` if:
- You create a **new Next.js root layout** that uses the CMS
- You create a **new Convex file** that imports from `@be-in-digital/cms`

---

## 12. Concrete examples

### Example 1: Simple page (sign-in page)

```typescript
// cms/pages/sign-in.ts
import type { PageDefinition } from "@be-in-digital/cms"

export const signInPage: PageDefinition = {
  slug: "sign-in",
  label: "Page de connexion",
  groupId: "auth",
  blocks: [
    {
      key: "hero",
      label: "Section principale",
      fields: {
        title: {
          type: "text",
          label: "Titre",
          required: true,
          maxLength: 100,
          hasCodeFallback: true,
        },
        subtitle: {
          type: "richtext",
          label: "Sous-titre",
          maxLength: 500,
          hasCodeFallback: true,
        },
        image: {
          type: "image",
          label: "Image d'illustration",
          translatable: false,
          hasCodeFallback: true,
        },
      },
    },
    {
      key: "form",
      label: "Formulaire de connexion",
      fields: {
        heading: {
          type: "text",
          label: "Titre du formulaire",
          required: true,
          maxLength: 100,
          hasCodeFallback: true,
        },
        submitLabel: {
          type: "text",
          label: "Texte du bouton",
          required: true,
          maxLength: 50,
          hasCodeFallback: true,
        },
        forgotLink: {
          type: "text",
          label: "Texte lien mot de passe oublié",
          maxLength: 100,
          hasCodeFallback: true,
        },
        signupLink: {
          type: "text",
          label: "Texte lien inscription",
          maxLength: 100,
          hasCodeFallback: true,
        },
      },
    },
  ],
}
```

### Example 2: Page with an SEO block and visually grouped fields

```typescript
// cms/pages/homepage.ts
import type { PageDefinition } from "@be-in-digital/cms"
import { seoBlock } from "@be-in-digital/cms"

export const homepagePage: PageDefinition = {
  slug: "homepage",
  label: "Page d'accueil",
  groupId: "storefront",
  blocks: [
    seoBlock,    // ← Reusable SEO block first
    {
      key: "features",
      label: "Section avantages",
      fields: {
        // Fields sharing the same `group` are displayed together in the admin
        feature1Image: {
          type: "image",
          label: "Icône",
          translatable: false,
          hasCodeFallback: true,
          group: "Avantage 1",      // ← Visual grouping
        },
        feature1Label: {
          type: "text",
          label: "Texte",
          maxLength: 60,
          hasCodeFallback: true,
          group: "Avantage 1",      // ← Same group = same card in the UI
        },
        feature2Image: {
          type: "image",
          label: "Icône",
          translatable: false,
          hasCodeFallback: true,
          group: "Avantage 2",
        },
        feature2Label: {
          type: "text",
          label: "Texte",
          maxLength: 60,
          hasCodeFallback: true,
          group: "Avantage 2",
        },
      },
    },
  ],
}
```

### Example 3: Page with a select field

```typescript
{
  key: "seo",
  label: "SEO",
  fields: {
    robots: {
      type: "select",
      label: "Directives robots",
      translatable: false,
      hasCodeFallback: true,
      options: [
        { value: "index, follow",     label: "Index, Follow (par défaut)" },
        { value: "noindex, follow",   label: "Noindex, Follow" },
        { value: "index, nofollow",   label: "Index, Nofollow" },
        { value: "noindex, nofollow", label: "Noindex, Nofollow" },
      ],
    },
  },
}
```

### Example 4: Add a new page to an existing app

1. Create the file `cms/pages/faq.ts`:

```typescript
import type { PageDefinition } from "@be-in-digital/cms"

export const faqPage: PageDefinition = {
  slug: "faq",
  label: "Questions fréquentes",
  groupId: "storefront",  // Must reference an existing group
  blocks: [
    {
      key: "header",
      label: "En-tête",
      fields: {
        title: {
          type: "text",
          label: "Titre de la page",
          maxLength: 100,
          hasCodeFallback: true,
        },
        description: {
          type: "text",
          label: "Description",
          maxLength: 300,
          hasCodeFallback: true,
        },
      },
    },
  ],
}
```

2. Import it in `cms/index.ts`:

```typescript
import { faqPage } from "./pages/faq"

const pages: Record<string, PageDefinition> = {
  // ... existing pages
  faq: faqPage,   // ← Add here (the key MUST match the slug)
}
```

3. Redeploy Convex and rebuild Next.js:

```bash
cd apps/mon-app && pnpx convex dev --once
pnpm turbo build --filter=@be-in-digital/mon-app
```

The new page shows up automatically in the admin dashboard, in the "Vitrine" group.

---

## 13. Common errors and solutions

### "CMS Registry is not initialized"

**Cause:** you call `getPageDefinition()` or another registry function before `setCmsRegistry()`.

**Solution:** check that:
- The Next.js layout has `import "@/lib/cms/init"` on the first line
- The Convex file has `setCmsRegistry(appCmsConfig)` at the top of the file

---

### "[CMS Registry] Invalid config: Duplicate group id"

**Cause:** two groups in `groups.ts` have the same `id`.

**Solution:** each group must have a unique `id`.

```typescript
// ❌ Error
[
  { id: "main", label: "Principal", order: 1 },
  { id: "main", label: "Secondaire", order: 2 },   // duplicate!
]

// ✅ Correct
[
  { id: "main", label: "Principal", order: 1 },
  { id: "secondary", label: "Secondaire", order: 2 },
]
```

---

### "[CMS Registry] Invalid config: Duplicate group order"

**Cause:** two groups have the same `order` number.

**Solution:** each `order` must be unique.

---

### "[CMS Registry] Invalid config: Page references unknown groupId"

**Cause:** a page uses a `groupId` that doesn't exist in any group.

**Solution:** check that the page's `groupId` matches an `id` in `groups.ts`.

```typescript
// groups.ts
[{ id: "storefront", label: "Vitrine", order: 1 }]

// pages/faq.ts
{ slug: "faq", groupId: "store" }   // ❌ "store" doesn't exist
{ slug: "faq", groupId: "storefront" }  // ✅ Correct
```

---

### "[CMS Registry] Invalid config: Group has no pages assigned"

**Cause:** a group exists in `groups.ts` but no page references it.

**Solution:** either delete the group, or add at least one page with that `groupId`.

---

### "The key in pages doesn't match the slug"

**Cause:** in `cms/index.ts`, the object key doesn't match the `slug` of the PageDefinition.

```typescript
// ❌ Error
const pages = {
  "home": homepagePage,  // key "home" but slug "homepage"
}

// ✅ Correct
const pages = {
  "homepage": homepagePage,  // key = slug
}
```

---

### "Cannot find module '../cms'"

**Cause:** the Convex file can't find the `cms/` folder with a relative import.

**Solution:** check the relative path. From `convex/cms.ts`, the `cms/` folder is one level up: `"../cms"`.

---

### Import `@/cms` doesn't work in Convex

**Cause:** the Convex tsconfig resolves `@/` to a different folder than Next.js.

**Solution:** always use a **relative import** in Convex files:

```typescript
// ❌ In a Convex file
import { appCmsConfig } from "@/cms"

// ✅ In a Convex file
import { appCmsConfig } from "../cms"
```

---

## 14. Diagrams

### CMS data flow

```
┌──────────────────────────────────────────────────────────────────────┐
│                           INITIALIZATION                             │
│                                                                      │
│  apps/mon-app/cms/           →   setCmsRegistry()   →   Registry     │
│  (groups.ts + pages/*.ts)         (validation)           (memory)    │
└──────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────┐
│                            ADMIN (WRITE)                             │
│                                                                      │
│  Dashboard    →  Form        →  saveDraftBlock()  →  Convex DB       │
│  (listPages)     (generated       (validation         (cmsBlocks)    │
│                   from the         validateBlockValues               │
│                   registry)        + registry)                       │
│                                                                      │
│                               →  publishPage()    →  cmsBlocks       │
│                                   (copy draft         (isDraft:false)│
│                                    to published)                     │
└──────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────┐
│                          STOREFRONT (READ)                           │
│                                                                      │
│  Component   →  getPageBlocks()  →  Published values  →  Render      │
│  (page.tsx)      (Convex query)      + fallback code      (HTML)     │
│                                      if field empty                  │
│                                      and hasCodeFallback             │
└──────────────────────────────────────────────────────────────────────┘
```

### Type hierarchy

```
CmsGroupDefinition
  └── id, label, order

PageDefinition
  ├── slug, label, description, groupId
  └── blocks: BlockDefinition[]
        ├── key, label, description
        └── fields: Record<string, FieldDefinition>
              ├── type, label, description
              ├── required, maxLength, placeholder
              ├── translatable, hasCodeFallback
              ├── options (select only)
              └── group (visual grouping)

CmsFieldValue (stored in DB)
  ├── type
  ├── textValue (text, richtext, select)
  ├── mediaId (image, video, file)
  ├── altText, embedUrl, embedProvider
  └── isCleared (reset to fallback)
```

---

## 15. Glossary

| Term             | Definition                                                                                         |
|------------------|----------------------------------------------------------------------------------------------------|
| **Registry**     | In-memory singleton holding every CMS page and group, initialized by `setCmsRegistry()`           |
| **Page**         | CMS unit identified by a slug (e.g. `sign-in`, `homepage`). The slug is an internal identifier — it doesn't always match the URL path (e.g. slug `homepage` → route `/`). |
| **Block**        | Editable section of a page (e.g. "Hero", "Formulaire", "SEO"). Holds fields.                      |
| **Field**        | Atomic editable unit (e.g. title, image, button text). Has a type and constraints.                 |
| **Group**        | Organizational category used to group pages in the admin dashboard.                                 |
| **Slug**         | URL identifier of a page (e.g. `"sign-in"`, `"homepage"`). Must be unique.                        |
| **Draft**        | Values modified but not published yet.                                                             |
| **Published**    | Published values — visible on the storefront.                                                      |
| **Fallback**     | Default value hard-coded in the component, used when the CMS is empty.                             |
| **`hasCodeFallback`** | Indicates whether the component shows a default value when the CMS is empty.                  |
| **`isCleared`**  | Explicit reset of a field to its fallback value (removes the CMS value).                           |
| **Side-effect import** | `import "@/lib/cms/init"` — runs the file without extracting anything, just for its effects. |
| **seoBlock**     | Reusable SEO block provided by the package (metaTitle, metaDescription, ogImage, robots).          |
| **Barrel file**  | `index.ts` file that re-exports everything in a folder.                                           |

---

## Complete package exports

```typescript
// Types
export type {
  FieldType,
  SelectOption,
  FieldDefinition,
  BlockDefinition,
  PageDefinition,
  CmsFieldValue,
  CmsBlockValues,
  CmsGroupDefinition,
} from "@be-in-digital/cms"

// Registry API
export {
  setCmsRegistry,
  getCmsRegistry,
  getCmsGroups,
  getPageDefinition,
  getBlockDefinition,
  getFieldDefinition,
  getAllPageSlugs,
} from "@be-in-digital/cms"

// Reusable blocks
export { seoBlock } from "@be-in-digital/cms"

// Value validation
export { validateBlockValues } from "@be-in-digital/cms"
export type { ValidationError, ValidationResult } from "@be-in-digital/cms"

// SVG sanitization
export { sanitizeSvg } from "@be-in-digital/cms"
export type { SanitizeResult } from "@be-in-digital/cms"

// Media
export {
  CMS_MEDIA_LIMITS,
  MIME_TO_EXT,
  getMediaKind,
  getExtensionFromMimeType,
  validateMediaUpload,
} from "@be-in-digital/cms"
export type {
  MediaKind,
  MediaLimits,
  MediaValidationError,
  MediaValidationResult,
} from "@be-in-digital/cms"
```
