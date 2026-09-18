# `@be-yours/convex-functions`

Everything the backend does. 96 modules of queries, mutations, actions and pure
resolvers, consumed by both apps through thin `convex/` wrappers.

`7.0.1` · 96 source modules · 33,353 lines · **shipped as TypeScript source**

---

## Why it ships as source

`main` points at `./src/index.ts` and there is **no `build` task**, for the same
reason as `convex-schema`: the client's own Convex compiler reads these
functions. A type error here surfaces in `pnpm type-check` or in a consuming
app's build, never in this package's own scripts.

---

## Entry points

The barrel exports the common set; **96 named subpaths** let a Convex module
import exactly one concern without dragging the rest into its isolate. A few
worth knowing:

| Subpath | Holds |
| --- | --- |
| `./autoTranslate` | The GPT translation pipeline. **Deliberately off the barrel** — the apps drive it from this subpath |
| `./eslint/convex-auth` | The custom ESLint rule that refuses an unguarded Convex function, `httpAction` included |
| `./privacy` | The four RGPD obligations — see below |
| `./promotionDiscount` | `HONOURABLE_DISCOUNT_TYPES`, the list of promotion types the order path can actually honour |
| `./refundPolicy` | Refund rules. Refuses Square **by name** — it is announced, not built |
| `./maintenance` | `isReleaseCovered(contract, releasedAt)` — the annual-maintenance freeze |
| `./gamePlay` | `GAME_CONSENT_NOTICE_VERSIONS`, the consent wordings the server accepts |

---

## Usage — the wrapper pattern

This package exports **definitions**, not Convex functions. An app wraps them,
which is what lets one codebase serve two apps and every client deployment.

```ts
// apps/reference/convex/categories.ts
import { query } from "./_generated/server"
import * as defs from "@be-yours/convex-functions/categories"
import { storeQuery, storeMutation, storeIdFromDocument } from "./lib/storeFunctions"

// A storefront query, rendered for anonymous visitors.
// @public-by-design: the category menu carries no store-confidential data.
export const list = query(defs.list)

// Anything that reads or writes behind a permission goes through storeQuery /
// storeMutation, which resolve the store and check the caller's grant.
export const listAll = storeQuery({
  permission: "products:read",
  args: defs.listAll.args,
  handler: (ctx, args) => defs.listAll.handler(ctx, args),
})

const categoryStoreId = storeIdFromDocument("Category not found")

export const create = storeMutation({
  permission: "products:write",
  args: defs.create.args,
  handler: (ctx, args) => defs.create.handler(ctx, args),
})
```

**The `@public-by-design` marker is not a comment, it is an assertion.** The
ESLint rule at `./eslint/convex-auth` refuses an unguarded Convex function —
`httpAction` included — unless one of three markers explains why. A
`@unguarded-tracked` marker additionally requires an issue number.

Pure helpers need no wrapper:

```ts
import { generateOrderNumber, generateSlug, now } from "@be-yours/convex-functions"

generateOrderNumber()            // "ORD-2026-ABC123"
generateSlug("Product Name")     // "product-name"
```

---

## The 96 modules, by domain

| Domain | Modules |
| --- | --- |
| **Catalogue** | `products` · `categories` · `menus` · `orphanProducts` · `externalProductMappings` |
| **Orders** | `orders` · `orderLine` · `orderTotals` · `orderSource` · `orderConfirmation` · `orderCascade` · `timeWindow` |
| **Payments** | `payments` · `paymentLedger` · `paymentEvents` · `paymentSettlement` · `paymentConnections` · `stripeChargeRouting` · `cardChargeFloor` · `refundPolicy` |
| **Invoicing** | `invoices` · `numbering` · `numberSequences` |
| **Promotions** | `promotions` · `promotionDiscount` |
| **Delivery** | `deliveryFee` · `deliveryQuote` · `deliveryZone` |
| **Platforms** | `uberEatsMenuSync` · `uberEatsConnections` · `deliverooMenuSync` · `platformWebhook` · `platformWebhookFailures` |
| **Kitchen** | `kitchenTickets` |
| **Stores** | `stores` · `storeFunctions` · `storeIntegrations` · `storeAudit` · `storeCascade` · `globalSettings` |
| **People** | `userProfiles` · `profileProvisioning` · `teamMembers` · `teamAccess` · `auth` · `accessAudit` · `customerAddresses` · `favorites` |
| **Gamification** | `games` · `gameQRCodes` · `gamePlay` · `requiredActions` · `prizes` · `prizeBudget` |
| **i18n** | `languages` · `translations` · `autoTranslate` |
| **CMS** | `cms` · `cmsPublish` · `cmsMedia` · `htmlSanitize` |
| **Blog** | `blog` · `blogPublish` · `blogAutoConfig` · `blogAutoGenerate` · `blogAutoGuards` · `blogAutoPlanner` · `blogAutoSchedule` · `blogAutoUsage` |
| **Email marketing** | `emailCampaigns` · `emailSegments` · `emailSubscribers` · `emailTemplates` · `emailAutomations` · `emailAutomationRuns` · `emailEvents` · `emailConfig` · `emailAssetReferences` · `campaignDelivery` · `automationDispatch` · `sesSending` · `snsSignature` |
| **Billing (BID)** | `bidSubscription` · `ownerEntitlements` · `maintenance` |
| **Privacy** | `privacy` · `privacyPolicy` |
| **Operations** | `dashboardStats` · `contactMessages` · `backupTables` · `backupRemap` · `rateLimit` · `refusal` · `encryption` · `pagination` · `helpers` |

Two names in that table are worth reading twice. `refusal` is the shared shape a
function returns when it declines rather than throws — `resolveEmailProvider`
uses it, which is why an unknown provider surfaces as a value and not as an
exception. `helpers` is the guard layer every function is expected to go through;
the ESLint rule at `./eslint/convex-auth` refuses a Convex function that skips
it, `httpAction` included.

```bash
# the full export surface
node -e "console.log(Object.keys(require('./packages/convex-functions/package.json').exports).join('\n'))"
```

---

## The rules that are easy to get wrong

**A promotion type the order path cannot honour is refused at creation.**
`free_product` and `bogo` alter the item list rather than the order total, and
no code path builds those items. So `promotions.create` and `promotions.update`
refuse them and the admin form does not offer them. The list lives **once**,
beside the resolver that enforces it: `HONOURABLE_DISCOUNT_TYPES` in
`src/promotionDiscount.ts`. Implement one there and it becomes creatable on the
same commit.

**Square is not implemented.** `refundPolicy.ts` refuses it by name. It is
presented as forthcoming in the admin and in the guided tour. Do not describe it
as available.

**`translationJobs` rows are written and read by nothing.** A batch that stops
on the daily quota therefore looks exactly like one that finished.

**There is no bulk translator for UI strings.** The catalogue has one — adding a
language backfills products, categories and menus — but `translateUIStrings` had
zero callers and a docblock claiming otherwise, and has been deleted. UI strings
go one at a time through `translations.upsert`.

### RGPD — `src/privacy.ts`

A French restaurant running this engine is the **data controller**. Four
obligations, all answered from this module and rendered at
Dashboard → Organisation → **Données personnelles**:

| Article | Function |
| --- | --- |
| 15, 20 — access and portability | `exportDataSubject` — raw rows as JSON, by e-mail or device fingerprint |
| 17 — erasure | `previewErasure`, then `eraseDataSubject`. Multi-pass: a pass returns `complete: false` and the wrapper reschedules until it is true |
| 7.1 — consent | On `gamePlays`. `gamePlay.play` throws `CONSENT_REQUIRED` without it |
| 5.1.e — retention | The **purge expired customer data** cron, window in `globalSettings.dataRetention` |

**A paid order is anonymised, never deleted.** The money, lines, VAT and dates
stay; the customer leaves. Everything else about a diner is deleted outright.

**The invoice survives whole.** A paid order also issues an `invoices` row — a
numbered fiscal document in an unbroken series (art. 242 nonies A CGI), never
edited, never deleted. It keeps the buyer's name, e-mail, phone and address
under art. 17.3.b. The erasure reaches it through `orders.invoiceId`,
**exports** it and **reports** it as retained, so the operator can tell the diner
what was kept and why. Do not add it to the deletion set.

Guarded by `customers:manage` — held by `super_admin` and `client_admin` only,
deliberately not by `customers:read`, which a waiter holds. Every run writes a
`privacy_*` line to `systemAuditLog`.

---

## Commands

| Command | Effect |
| --- | --- |
| `pnpm lint` | ESLint over `src/` |
| `pnpm type-check` | `tsc --noEmit` |
| `pnpm test` · `pnpm test:watch` · `pnpm test:coverage` | Vitest |
| `pnpm clean` | Remove `node_modules` |

> When you add a module under an app's `convex/`, Convex codegen needs a live
> deployment that a fresh checkout does not have. Add the two lines to
> `convex/_generated/api.d.ts` by hand, in the exact existing format, **in both
> apps**.

---

[Root README](../../README.md) · [`convex-schema`](../convex-schema)
