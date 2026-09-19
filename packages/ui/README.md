# `@be-yours/ui`

The design system: 46 base components, 8 restaurant components, 5 admin
components, plus the branding compiler and the accessibility tooling the
contrast guard runs on.

`4.3.1` · 71 source files · 8,501 lines · **shipped as TypeScript source**

---

## Why it ships as source

`main` points at `./src/index.ts` and there is **no `build` task**. A type error
here surfaces in `pnpm type-check` or in a consuming app's build, never in this
package's own scripts.

---

## Entry points

| Subpath | Holds |
| --- | --- |
| `.` | `cn`, the branding compiler, and every component |
| `./components` | The 46 base components |
| `./restaurant` | Storefront components |
| `./admin` | Admin-shell components |
| `./branding` | `buildBrandingCss` and its colour helpers |
| `./contrast` · `./contrast-scan` | The WCAG contrast measurement used by `tests/a11y/contrast.test.ts` |
| `./target-size` | Touch-target measurement |

---

## Per-establishment branding

`stores.updateBranding` writes `store.branding`; `buildBrandingCss`
(`src/lib/branding.ts`) derives design tokens from it; and `StoreTheme`, mounted
in each app's `app/(storefront)/layout.tsx`, emits them **unlayered** so they
beat the defaults in `globals.css`'s `@layer base`.

```ts
import { buildBrandingCss } from "@be-yours/ui/branding"

const css = buildBrandingCss(store.branding, { scopes: STOREFRONT_SCOPES })
```

**`scopes` is not optional in practice, and the missing half cost the feature
its whole point.** Unlayering settles a conflict between two rules that reach
the same element. But `globals.css` declares the storefront palette on
`.storefront-theme` — a `<div>` in `components/storefront/storefront-shell.tsx` —
while `StoreTheme` wrote to `:root` and `.dark` on `<html>`. A property declared
on an element beats the one it would have inherited, so nine tokens were
overwritten straight back to the engine green.

Measured in Chromium: a store that picked `#d32f2f` had a red admin and a green
storefront. The storefront now passes `[".storefront-theme"]`.

> **The 51 vertical templates still have the identical defect.**
> `site/theme.css` also targets `:root` and `.dark`, so `pnpm template:apply`
> repaints the admin and the sign-in pages and **not** the storefront. Recorded
> in `tasks/wcag-contrast-audit-2026-09-08.md`; not fixed.

Typography carries one real limit, and the Design screen states it: nothing
fetches a webfont, so a family other than the bundled Inter and Poppins renders
only on a device that already has it.

---

## Accessibility

Three guards, each measuring rather than asserting a policy.

**Contrast.** `tests/a11y/contrast.test.ts` in both apps sweeps every `.tsx`
they render and fails on any pair below the WCAG 2.1 AA floor, using
`./contrast` and `./contrast-scan` from here. A region may *declare* the surface
a shell paints elsewhere — a hex for a literal, a token name for one that paints
`bg-background` — and the files whose surface is still unresolvable are pinned by
name, so a new one fails.

> It once dropped all 150 of its findings for want of that and guarded nothing.
> See `tasks/wcag-contrast-audit-2026-09-08.md` § The 150.

**Motion.** `prefers-reduced-motion` is honoured in two places because there are
two animation systems: a universal block in `app/globals.css` for CSS, and
`<MotionConfig reducedMotion="user">` in `app/providers.tsx` for framer-motion,
which writes inline `style` per frame and no stylesheet can reach.

**Live regions.** Every cart mutation is announced by one polite region in
`StorefrontShell` — not in the cart sheet, which unmounts, and a live region must
be in the document before its contents change.

---

## Commands

| Command | Effect |
| --- | --- |
| `pnpm lint` · `pnpm type-check` | Quality |
| `pnpm test` · `pnpm test:watch` · `pnpm test:coverage` | Vitest |
| `pnpm clean` | Remove `node_modules` |

---

[Root README](../../README.md) · [`admin`](../admin)
