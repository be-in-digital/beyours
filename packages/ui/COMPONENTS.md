# @be-in-digital/ui — the design system

The one implementation of every shared component. Built on Radix UI, Tailwind
CSS v4 and class-variance-authority, published as TypeScript source.

## There used to be five of these

Until the convergence, the same design system existed in five places:

| Where | Files | Generation |
|---|---|---|
| `packages/ui/src/components` | 50 | hybrid — 11 new, 38 old, 1 in between |
| `apps/reference/components/ui` | 37 | new |
| `apps/themes/components/ui` | 37 | new, byte-identical to reference |
| `packages/admin/src/ui` | 9 | new — its `button.tsx` had zero importers |
| `apps/site/components/**/ui` | 38 | its own token vocabulary; out of scope |

Sixteen of the twenty-six shared names had drifted. A default Button was `h-10`
here and `h-9` there with a different focus ring, so one storefront rendered two
button heights depending on the page, and twelve files per app imported from
both systems at once. The apps' two copies were byte-identical to *each other*,
so every twin check in the repository was blind to it.

The newer generation won — `data-slot` attributes the e2e suite and
`app/globals.css` already select on, `size-*` utilities, Tailwind v4 focus
rings, `aria-invalid` states. What only the package had was merged back rather
than dropped: the dialog's `max-h`/`overflow-y-auto` fix, the Alert's `warning`
and `success` variants, the sidebar's `useOptionalSidebar` and `min-w-0` inset.

`packages/ui/src/__tests__/design-system-singularity.test.ts` is what keeps it
to one: it asserts the three deleted directories stay deleted, that nothing
imports a local UI path, and that the surviving geometry is the newer one.

## Package structure

```
src/
├── index.ts                        # the public surface
├── lib/
│   ├── utils.ts                    # cn()
│   └── branding.ts                 # an establishment's colours -> design tokens
├── hooks/
│   ├── use-mobile.ts
│   └── useGooglePlacesAutocomplete.ts
├── types/address.ts
└── components/
    ├── index.ts
    ├── 46 base components          # Accordion … Tooltip
    ├── restaurant/ (8)             # ProductCard, CartItem, OrderStatusBadge,
    │                               # QuantitySelector, PriceDisplay,
    │                               # AllergenBadge, SpiceLevelIndicator,
    │                               # StoreStatusBadge
    └── admin/ (5)                  # AdminLayout, StatCard, ActionBar,
                                    # FilterBar, StatusTimeline
```

## Imports — one specifier

```typescript
import { Button, Input, Card, ProductCard, StatCard } from "@be-in-digital/ui"
```

`./components`, `./restaurant` and `./admin` still resolve, to the same modules,
so nothing breaks — but do not reach for them. Two spellings for one module is
how the last fork grew: a reader could not tell from an import line which design
system it named. The singularity test fails on a new one.

`@be-in-digital/ui/branding` is the exception, and deliberate: it is a pure
function with no React in it, so a server component can pull it in without
dragging the component graph behind it.

## Consumed as source, not as a bundle

`exports` points at `src`. The package used to publish a `tsup` bundle, and
esbuild strips `"use client"` when it bundles — `dist/index.mjs` contained none,
while 22 source files declare it. Every interactive component reached through
the root specifier therefore had no client boundary of its own, and worked only
because every importer happened to be a client module already. Publishing source
is what `@be-in-digital/admin` has always done, and it is the one engine package
that never had this problem.

Consequences: a change here is visible to a running app with no rebuild, and a
consumer compiles this TypeScript itself — so anything the source needs at
compile time (`@types/google.maps`) is a real dependency, not a dev one.

## Styling

The package ships **no CSS**. Tailwind v4 detects only the importing app's own
files, so both apps carry `@source "../node_modules/@be-in-digital/ui/src/**/*"`
in `app/globals.css`. That makes `files: ["src"]` load-bearing: dropping it
would silently cost a client site every rule that only this package uses.
`scripts/check-mirror-css.mjs` compares the monorepo and client-clone builds on
every pull request.

## Twenty of the fifty-nine components have no consumer

Measured, not estimated:

```
Container, DataTable, EmptyState, FormField, InputGroup, Navbar, PageHeader,
Progress, RadioGroup, ScrollArea, Section, Spinner, Toast,
admin/ActionBar, admin/AdminLayout, admin/FilterBar,
restaurant/CartItem, restaurant/PriceDisplay, restaurant/ProductCard,
restaurant/QuantitySelector
```

They are kept, on purpose. `ProductCard` and `QuantitySelector` are the design
system's two flagship restaurant components and the apps render their own
`storefront-product-card.tsx` instead — that is a gap worth closing on its own
terms, not by deletion. The rest are a published package's surface: a client on
an older app can import any of them, so removing one is a breaking major that
buys nothing. `tasks/reference-themes-divergence.md` records the verdict.

Nothing new should be added to that list. A component with no consumer is a
component nobody has proven, and this package's history is what happens when
that goes unremarked.

## Features

- TypeScript strict mode, React 19
- Server-component ready except where `"use client"` says otherwise
- CVA variants, `tailwind-merge`, Lucide icons
- Radix primitives through the unified `radix-ui` package

## Dependencies

`class-variance-authority`, `clsx`, `tailwind-merge`, `lucide-react`,
`radix-ui`, `recharts` (Chart), `embla-carousel-react` (Carousel),
`@types/google.maps` (AddressAutocomplete).

## Peer dependencies

`react` ^19, `react-dom` ^19, `react-hook-form` ^7, `@hookform/resolvers` ^3.
