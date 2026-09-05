---
"@be-in-digital/ui": major
"@be-in-digital/admin": major
"@be-in-digital/convex-schema": minor
---

One design system, and per-store theming that reaches a diner

Two structural defects, resolved together because the first cannot work until
the second is settled: theming has to drive one design system.

**Per-store branding painted nothing.** The Design screen has always written
`stores.branding` — colours, typography, logo — and nothing read the colours
back. `--primary` had exactly one definition per app, the literal `24 95% 53%`
in `app/globals.css`, so every establishment the engine has delivered shipped
the same orange. `buildBrandingCss` turns the stored blob into design tokens
and `StoreTheme` paints the storefront with them, following the same
establishment the rest of the storefront follows. Colours are re-emitted from
parsed numbers and font families rebuilt from an allowed character set, because
`updateBranding` validates a type and a length, not grammar. The foreground on
a brand colour is chosen by contrast ratio rather than fixed to white — white
on `#ffeb3b` is 1.07:1, a button whose label cannot be read.

**The design system was forked five ways.** `packages/ui` (50 components),
`apps/reference/components/ui` (37), `apps/themes/components/ui` (37,
byte-identical to reference), `packages/admin/src/ui` (9). Sixteen of the
twenty-six shared names had drifted: a default Button was `h-10` in the package
and `h-9` in the apps, with different focus rings, so one storefront rendered
two button heights depending on the page. There is now one implementation, in
`packages/ui`, on the newer shadcn generation, reached through one specifier.

Breaking changes for `@be-in-digital/ui`:

- `Input`, `Textarea` and `Checkbox` are bare primitives. The composed-field
  API (`label`, `error`, `description` props and a wrapping `div`) is gone —
  pair them with a `Label`, which is what every call site but two already did.
- `Breadcrumb` is the composable seven-part set. The data-driven component that
  took `items` is gone, and with it the `BreadcrumbItem` *type* — that name is
  now a component.
- `Alert` keeps `warning` and `success` but loses its `title` prop and its
  automatic icon map; use `AlertTitle`, `AlertDescription` and your own icon.
- `Button` sizes shift to the current generation (`default` 40px → 36px) and
  gain `xs`, `icon-xs`, `icon-lg`. `Card`, `Switch`, `Label`, `Badge`,
  `Skeleton`, `Table` and `Tooltip` change geometry with them.
- `ButtonProps`, `InputProps` and the other per-component prop interfaces are
  no longer exported; the components are typed from `React.ComponentProps`.
- The package is published as TypeScript source. `exports` points at `src`,
  there is no `dist`, and consumers must transpile it. This is what restores
  the `"use client"` boundaries the bundler was stripping.

`@be-in-digital/admin` no longer carries its own copy of nine primitives, and
re-exports the sidebar from `@be-in-digital/ui`.

`@be-in-digital/convex-schema` gains a typed `StoreBranding` and
`StoreDoc.branding`, which were implicitly `any`.
