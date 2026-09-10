# `@be-in-digital/cms`

The block registry behind the custom CMS: block and field definitions, the
validation that keeps a page well-formed, media handling, and HTML
sanitisation.

`3.1.0` · 9 source files · 982 lines · shipped as `dist/` (tsup) · the smallest
package that a client actually notices

---

## Entry points

| Subpath | Holds |
| --- | --- |
| `.` | Types, the registry, validation, media |
| `./sanitize` | HTML sanitisation, isolated so it can be imported on its own |

```ts
import type { BlockDefinition, PageDefinition } from "@be-in-digital/cms"
import { sanitize } from "@be-in-digital/cms/sanitize"
```

---

## How the pieces fit

| Directory | Role |
| --- | --- |
| `src/registry/` | What a block **is** — its fields, their types, their defaults |
| `src/registry/blocks/` | One module per block type |
| `src/validation/` | What a page must satisfy before it is stored or published |
| `src/media/` | Media references inside block values |
| `src/sanitize/` | Untrusted HTML in, safe HTML out |

The registry is the source of truth in both directions: the editor renders its
form from a block definition, and validation reads the same definition to judge
what came back. Adding a field in one place and not the other is the failure
this shape exists to prevent.

---

## The `branding` block is load-bearing

Logo, favicon and brand name are per store, and they reach the product through
the CMS `branding` block on the `storefront-layout` page. That is the **only**
branding the storefront header, the favicon, the JSON-LD and the admin sidebar
read. Colours and typography travel separately, through `store.branding` and
`@be-in-digital/ui`'s `buildBrandingCss`.

---

## Consumed from `dist/`

`main` is `./dist/index.js`. Rebuild after editing `src/`, or run `pnpm dev` and
leave tsup watching.

---

## Commands

| Command | Effect |
| --- | --- |
| `pnpm build` | tsup → `dist/` |
| `pnpm dev` | tsup in watch mode |
| `pnpm lint` · `pnpm type-check` | Quality |
| `pnpm test` · `pnpm test:watch` · `pnpm test:coverage` | Vitest |
| `pnpm clean` | Remove `dist/` and `node_modules` |

---

[Root README](../../README.md)
