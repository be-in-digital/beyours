# `@be-yours/cms`

The block registry behind the custom CMS: block and field definitions, the
validation that keeps a page well-formed, media handling, and the SVG
sanitiser.

`3.1.0` · 9 source files · 982 lines · shipped as `dist/` (tsup) · the smallest
package that a client actually notices

---

## Entry points

| Subpath | Holds |
| --- | --- |
| `.` | Types, the registry, validation, media |
| `./sanitize` | `sanitizeSvg` and `SanitizeResult` — the **SVG** sanitiser, and nothing else |

```ts
import {
  type BlockDefinition,
  type PageDefinition,
  containsActiveContent,          // DOM-free detection — on the barrel
} from "@be-yours/cms"

import { sanitizeSvg } from "@be-yours/cms/sanitize"   // the parser
```

### The sanitiser is split across the two entry points, deliberately

An uploaded SVG is a document that can carry script, so it gets both a check and
a cleaner — and they do **not** live in the same place:

| Function | Entry point | Needs |
| --- | --- | --- |
| `containsActiveContent` | `.` (the barrel) | nothing — DOM-free, dependency-free |
| `inspectSvgForActiveContent` → `ActiveContentReport` | `.` | nothing |
| `sanitizeSvg` → `SanitizeResult` | `./sanitize` | `isomorphic-dompurify`, and therefore a DOM |

The barrel is imported by Convex isolate modules — `convex/cms.ts`,
`cmsAutoTranslate.ts`, `cmsSeedData.ts`, `cmsMediaConfirmUpload.ts` — which have
no DOM. Re-exporting `sanitizeSvg` from it made **the whole backend fail to
push**:

```
Failed to analyze cms.js: Cannot read properties of undefined (reading 'bind')
```

So the refusal check stays on the barrel, where a Convex isolate can reach it,
and only the server-side callers that actually clean an SVG pull the parser in.
Do not "tidy" `sanitizeSvg` back onto the barrel.

**HTML sanitisation is a different problem and lives elsewhere** —
`@be-yours/convex-functions/htmlSanitize`.

---

## How the pieces fit

| Directory | Role |
| --- | --- |
| `src/registry/` | What a block **is** — its fields, their types, their defaults |
| `src/registry/blocks/` | One module per block type |
| `src/validation/` | What a page must satisfy before it is stored or published |
| `src/media/` | Media references inside block values |
| `src/sanitize/` | Untrusted SVG in, safe SVG out, plus the active-content report |

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
`@be-yours/ui`'s `buildBrandingCss`.

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
