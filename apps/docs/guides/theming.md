# Theming Guide

> How a restaurant's look is actually set: design tokens in `packages/ui`, colour
> presets in the admin Design page, and branding from the CMS.

There is **no `@be-yours/themes` package**. One was planned, and what
existed contained nothing but `export {}`; it has been removed. No import of it
works, and nothing in the engine loads a named theme. This guide describes the
three mechanisms that do run.

## Table of Contents

- [1. Design Tokens](#1-design-tokens)
- [2. Colour Presets in the Admin](#2-colour-presets-in-the-admin)
- [3. Branding from the CMS](#3-branding-from-the-cms)
- [What Is Not Wired Up](#what-is-not-wired-up)

## 1. Design Tokens

Every component in `packages/ui` draws its colours from CSS custom properties —
`hsl(var(--primary))`, `hsl(var(--input))` and so on. The properties themselves
are defined per application, in `app/globals.css`. That file is the theme: change
a token there and the whole design system moves with it.

```css
:root {
  --primary: 15 80% 50%;     /* Warm orange */
  --background: 30 20% 98%;  /* Cream */
  --accent: 15 70% 45%;      /* Terracotta */
  --radius: 0.75rem;         /* Rounded corners */
}

.dark {
  --primary: 15 80% 60%;
  --background: 15 10% 10%;
}
```

Fonts are chosen the same way — in the app, through Next.js font loading and the
Tailwind config — not by the engine.

> **Note on Tailwind sources.** `apps/*/app/globals.css` declares the engine
> packages as Tailwind sources (`@source "../node_modules/@be-yours/ui/src/**/*"`).
> Without those lines, a class used only inside `packages/ui` or `packages/admin`
> produces no CSS at all. Do not remove them, and do not rewrite them as relative
> paths into `packages/` — the file ships verbatim to the client boilerplate,
> where this app is the repository root. The comment in `globals.css` explains
> the failure this prevents.

## 2. Colour Presets in the Admin

The admin Design page ships six presets, one per restaurant type. They are a
local list inside `packages/admin/src/pages/design/design-page.tsx` — plain
colour triples, not a package, not a plugin, not something an app can extend.

| Preset id | Label (admin, French) | Primary | Secondary | Accent |
|-----------|----------------------|---------|-----------|--------|
| `fast-food` | Fast Food | `#FF6B00` | `#FFF3E0` | `#FF9800` |
| `pizzeria` | Pizzeria | `#D32F2F` | `#FFEBEE` | `#FF5722` |
| `chinese` | Chinois | `#C62828` | `#FFF8E1` | `#FFD600` |
| `fine-dining` | Gastronomie | `#1A237E` | `#E8EAF6` | `#9FA8DA` |
| `cafe` | Café | `#4E342E` | `#EFEBE9` | `#8D6E63` |
| `sushi` | Sushi | `#1B5E20` | `#E8F5E9` | `#66BB6A` |

Clicking a preset fills the three colour inputs. Nothing is saved until the
owner presses save, and what is saved is the three colours — **not the preset
id**. A store does not remember which preset it came from.

The page is exported as `DesignPage`:

```tsx
import { DesignPage } from "@be-yours/admin/pages";

export default function Page() {
  return <DesignPage />;
}
```

Saving calls the `stores.updateBranding` mutation. The accepted fields are
enumerated once, in `BRANDING_FIELDS` (`packages/convex-functions/src/stores.ts`),
and stored on `stores.branding`:

| Field | Notes |
|-------|-------|
| `primaryColor`, `secondaryColor`, `accentColor` | Hex strings |
| `fontHeading`, `fontBody` | Font family names, default `Inter` |
| `logoUrl`, `faviconUrl` | Rendered into `<img src>` / a favicon link |

Two rules are enforced server-side: no value exceeds `MAX_BRANDING_VALUE_LENGTH`
(512), and `assertBrandingValues` refuses a `javascript:` or `data:` scheme on
the two URL fields. `v.object` also rejects any field not named above, so a typo
in a save handler is an error at the call rather than a stray key in the
document.

Writing branding needs `stores:write`. `stores:read` is enough to open the page,
which is why a `manager` can see the screen and not save from it —
`brandingControlState` decides that, and `BrandingControl` wraps the disabled
button so the refusal explains itself on hover.

## 3. Branding from the CMS

This is the branding a visitor actually sees. The CMS `storefront-layout` page
carries a `branding` block:

| Field | Type | Description |
|-------|------|-------------|
| `logo` | image | Storefront header and admin sidebar. PNG/SVG, 200x60px minimum |
| `favicon` | image | Browser icon. Square PNG, 32x32 or 64x64 |
| `brandName` | text | Required, max 50 chars. Shown when no logo is set; also the logo's alt text |

Read by `components/storefront/storefront-header.tsx`,
`components/dynamic-favicon.tsx`, `lib/structured-data.ts`, `lib/cms/seo.ts`
(as the OpenGraph `siteName`) and the admin layout.

```tsx
const logoMedia = cms.block("branding").field("logo");
const brandName = cms.block("branding").field("brandName").text ?? "BeYours";
```

## What Is Not Wired Up

Be honest about these when scoping work:

- **The saved colours never reach the storefront.** `stores.branding.primaryColor`
  and its siblings are written by the Design page and read back by the Design
  page. Nothing converts them into `--primary` or any other CSS variable, so
  applying a preset changes what the admin form shows and nothing a customer
  sees. Wiring them up means emitting the tokens into the storefront layout.
- **`fontHeading` / `fontBody` are stored, not loaded.** They are free-text font
  names with no font loading behind them; the Design page previews them with an
  inline `fontFamily` and that is the extent of it. The font-pairing table this
  guide used to publish described nothing that existed.
- **`themeId` is a dead field.** It is declared on `storesTable`, in the
  validators and in `StoreDoc`, and has zero writers and zero readers — the same
  shape as the `printerSettings` table, which was removed for it. Do not build
  on it without adding the writer first.
- **There are no per-theme component variants.** Every vertical renders the same
  `packages/ui` components. Visual differences between templates come from
  `apps/themes/templates/`, not from a theme object.
