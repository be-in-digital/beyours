# `@be-yours/convex-schema`

The data model. 77 tables across 33 table modules, plus the validators and the
generated data-model types every other package builds on.

`6.2.0` · 44 source files · 7,177 lines · **shipped as TypeScript source**

---

## Why it ships as source

`main` points at `./src/index.ts` and there is **no `build` task**. The client's
own Convex compiler has to read these definitions — a transpiled bundle would
not do. The consequence is worth stating plainly: a type error here surfaces
only in `pnpm type-check`, or in the build of an app that consumes it. Never in
this package's own scripts.

---

## Entry points

| Subpath | Holds |
| --- | --- |
| `.` | Everything below, re-exported |
| `./tables` | The 33 table modules |
| `./validators` | Shared Convex validators |
| `./types` | Hand-written types over the schema |
| `./dataModel` | `SchemaDataModel`, `TableName`, `Doc<T>`, `DocId<T>`, and the three ctx types |

```ts
import { schema } from "@be-yours/convex-schema"
import type { Doc, DocId } from "@be-yours/convex-schema/dataModel"
```

---

## Structure

```
src/
├── tables/              33 modules, 77 exported table definitions
│   ├── stores.ts              stores, storeIntegrations
│   ├── catalog.ts             categories, products, menus
│   ├── orders.ts              orders, promotionUsages
│   ├── payments.ts            payments, paymentEvents, paymentConnections
│   ├── invoices.ts            invoices, numberSequences
│   ├── kitchen.ts             kitchenTickets
│   ├── i18n.ts                languages, translations, translationJobs
│   ├── gamification.ts        gameQRCodes, requiredActions, games, prizes,
│   │                          gamePlays, prizeRedemptions, prizeIssuance,
│   │                          gameReferrals
│   ├── cms.ts                 the 17 cms* page and block tables
│   ├── autoBlog.ts            blogArticles, blogCategories, blogTags,
│   │                          blogAutoConfig, blogAutoQueue, blogAutoUsage
│   ├── emailMarketing.ts      campaigns, segments, subscribers, templates,
│   │                          automations, automationRuns, events, config
│   ├── maintenance.ts         maintenanceContracts, platformReleases,
│   │                          migrationRequests, ownerEntitlements
│   ├── globalSettings.ts      the deployment singleton
│   ├── systemAuditLog.ts      every privileged action, including privacy_*
│   └── …                      18 more
├── schema.ts            the composed schema — 77 tables
├── validators.ts        Zod validators for the mutation inputs
├── types.ts             hand-written types over the schema
├── dataModel.ts         the generated DataModel / Doc / Id types
└── index.ts             the barrel
```

Table modules are grouped by **domain, not by table**: one file often defines
several, because a table that is meaningless without its siblings belongs beside
them. `catalog.ts` holds `categories`, `products` and `menus` for that reason.

```bash
# the full list of exported table symbols
grep -rhoE 'export const [a-zA-Z]+Table' packages/convex-schema/src/tables/*.ts
```

---

## Usage

An app composes its own schema from the table definitions. Nothing forces it to
take all 77 — but the engine functions assume the ones they read.

```ts
import { defineSchema } from "convex/server"
import {
  storesTable,
  categoriesTable,
  productsTable,
  menusTable,
  ordersTable,
} from "@be-yours/convex-schema/tables"

export default defineSchema({
  stores: storesTable,
  categories: categoriesTable,
  products: productsTable,
  menus: menusTable,
  orders: ordersTable,
  // the client's own tables go here
})
```

Both apps take the composed schema instead, which is the supported path:

```ts
export { default } from "@be-yours/convex-schema"
```

Validating a mutation input:

```ts
import { createProductSchema, updateStoreSchema } from "@be-yours/convex-schema/validators"

const parsed = createProductSchema.parse(args)
```

Typing a document or an id:

```ts
import type { Doc, DocId } from "@be-yours/convex-schema/dataModel"

function priceOf(product: Doc<"products">): number { … }
function forStore(storeId: DocId<"stores">) { … }
```

**The id type is `DocId<T>`, not `Id<T>`.** Convex's own generated code calls it
`Id`, and this package deliberately does not: a name that collides with an app's
`_generated/dataModel` would be settled by import order rather than by intent.
The context types are named the same way — `SchemaQueryCtx`,
`SchemaMutationCtx`, `SchemaActionCtx`.

---

## The rules that are easy to get wrong

**Multi-tenancy is a whole backend, not a column.** One Convex deployment per
client. There is no shared database and no SQL anywhere in the product.

**Inside a deployment, always filter by `storeId`** — declared `v.id("stores")`.
There is no `restaurant_id` field anywhere in this repository; if you are
looking for one, you are reading a different codebase.

**The auth tables are not here.** `user`, `session`, `account`, `verification`
and `jwks` are owned by the Better Auth component and are deliberately absent
from `src/schema.ts` — see its own comment at `:80-87`. There is no `users`
table and no `sessions` table to query.

**There is no `reviews` table and no `ratings` table.** Nothing in the product
can produce a star, which is why a hard-coded testimonial or rating in
`apps/themes` is a defect rather than a placeholder.

### Three fields that exist and mean nothing

| Field | State |
| --- | --- |
| `stores.integrations` | Declared `v.optional(v.any())` because old documents hold it. **Nothing reads or writes it** (`src/tables/stores.ts:149-154`). Platform links live in the `storeIntegrations` table, keyed by `storeId` + `platform` |
| `themeId` | Zero writers, zero readers. There is no runtime theme selector; a site's look is fixed at clone time by `pnpm template:apply` |
| — | `printerSettings` used to be a fourth. It was declared for the unbuilt ESC/POS path, never gained a reader or a writer, and has been **removed**. Print configuration lives on `stores.printConfig` |

### Where the singletons live

`globalSettings` is one row for the whole deployment, not a field on `stores`.
`payments.cardProvider` is declared at `src/tables/globalSettings.ts:118` and
admits `stripe | sumup | none` — `none` being an establishment saying it does
not take cards at all, which removes the tile from the checkout rather than
greying it.

`dataRetention` also lives there, and drives the purge cron; it defaults to the
CNIL's three years.

---

## Adding a table

1. Write the module under `src/tables/`.
2. Register it in `src/schema.ts`.
3. Export whatever the callers need from `src/index.ts`.
4. `pnpm changeset` — this package is published, and a schema change that never
   reaches the registry never reaches a client.

---

## Commands

| Command | Effect |
| --- | --- |
| `pnpm lint` | ESLint over `src/` |
| `pnpm type-check` | `tsc --noEmit` — the only compiler that ever sees this package alone |
| `pnpm test` · `pnpm test:watch` · `pnpm test:coverage` | Vitest |
| `pnpm clean` | Remove `node_modules` |

---

[Root README](../../README.md) · [ARCHITECTURE.md](../../ARCHITECTURE.md)
