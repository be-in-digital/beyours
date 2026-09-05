# Unbounded Convex queries — what was fixed, and what is left

Source cards: **NEW-P** (four unbounded queries on the four screens an owner opens
most) and **NEW-J-1** (`emailEvents.sentCountsSince`) in `tasks/fix-prompts.md`.
Measured at commit `009af63`; re-measured here before and after each fix.

## Why any of this matters

Convex aborts a transaction that reads more than **16,384 documents**. A query that
reads its whole table therefore does not get gradually slower — it works, then one
day it throws, on every load, permanently, and no action available to a restaurant
owner clears it. Every item below is that shape: cost proportional to the
establishment's lifetime trade rather than to what the screen shows.

## Fixed

Measurements are document reads, taken with the counting `ctx.db` double in
`packages/convex-functions/src/__tests__/support/countingDb.ts`.

| Item | Screen | Before | After |
| --- | --- | --- | --- |
| **P-1** `orders.list` | `/dashboard`, `/dashboard/orders` | 5,000 orders → 5,000 rows, 3.07 MB | one page: 15 reads |
| **P-1** dashboard aggregates | `/dashboard` | computed in the browser over the whole history | `orders.dashboardStats`, server-side over a window: 241 reads for two years of trade |
| **P-1** recent-orders table | `/dashboard` | `orders.slice(0, 10)` of the whole history | `orders.recent`: 10 reads |
| **P-2** `gamePlay.getStats` | Jeux, Gagnants | 8,000 reads to return five integers | four indexed slices, windowed + capped, `truncated` reported |
| **P-3** `payments.getByStore` | `/dashboard/payments` | 4,000 payments → 4,000 rows | one page: 15 reads, both filters indexed |
| **P-4** `emailAutomationRuns.stepsSentTo` | automation dispatch | 2,000 reads to return 4 step ids | 4 reads |
| **J-1** `emailEvents.sentCountsSince` | campaign send | 18,000 reads to answer about 0 events — past the ceiling | bounded by the week and the cap |

Also fixed, from the "verify each" list on the card:

- `orders.getByStatus` — removed. It was `list` with the status filter made
  mandatory and collected whole, and it had no caller. `list` now takes an
  optional `status` and pages.
- `orders.getByCustomer` (engine) — removed. Collected one customer's whole
  history; the app-level wrapper had already been deleted for a separate reason.
- `orders.getMyOrders` (both apps) — bounded to the 50 most recent.
- `translations.getByLanguage` — paginated. A `.take()` was rejected here on
  purpose: a truncated dictionary renders as untranslated text, which nobody
  notices, rather than as an error.
- `promotions.remove` — batched. It collected every usage row of a promotion into
  one transaction, so the coupons that worked were the ones that could not be
  deleted. The offer row now goes in the first transaction and the usage rows are
  swept 512 at a time by `promotions.purgeUsages`, the same shape as
  `stores.purgeStoreData`.

### Corrections to the card

- **`kitchenTickets.getByStation` / `getPrintStuckCount` / `getForDisplay` were
  already bounded.** Every read in `kitchenTickets.ts` uses `.take()` or
  `.paginate()`; the single `.collect()` left (`getByOrder`, line 137) is bounded
  by the number of stations one order is routed to. #137's fix landed.
- **`contactMessages.list` was already paginated**, with the status filter already
  on the server.
- **`orders.by_external_order` is not dead.** It is used at
  `packages/convex-functions/src/orders.ts:1313` and `:1430` — the webhook
  idempotency and status-update lookups — and held by tests in both apps
  (`uber-eats-webhook.test.ts`, "#163.4 · the by_external_order index, not a table
  scan"). The card's "free win" had already been taken.

### Behaviour changes an owner will see

- **Gamification counters are a 30-day window, not lifetime totals.** The cards on
  Jeux and Gagnants are relabelled `(30 j)` and print a trailing `+` when the
  scan hits its cap. `Lots à valider` stays a live count: it is the queue the staff works
  from, not a statistic.
- **`/dashboard/orders` and `/dashboard/payments` page** with a "Charger plus"
  button, mirroring the Messages screen.
- **Order search narrows the orders already loaded.** `orderNumber` and the
  customer's name are not indexed and a substring match could not use an index
  anyway, so a server-side search would be the full scan the screen was just
  rescued from. "Charger plus" widens what the search can see. If exact
  order-number lookup is wanted later, `orders.by_orderNumber` is declared and
  currently dead.
- **The dashboard's day boundaries are computed in the browser and passed to the
  server.** "Today" is the restaurant's day: a service that closes at 01:00 in
  Paris is still on yesterday's takings, and a server deriving midnight itself
  would move the boundary by an hour or two depending on the season.

### Schema changes

| Index | Table | Why |
| --- | --- | --- |
| `by_subscriber_type_occurredAt` (new) | `emailEvents` | J-1: puts `type` and the week in the index instead of a JavaScript filter |
| `by_storeId_provider_status` (new) | `payments` | the "Fournisseur" filter, and both filters together |
| `by_automation_subscriber_step` → `by_automation_subscriber_occurrence_step` | `emailAutomationRuns` | `occurrenceKey` moved before `stepId` so the read can narrow on three equalities; the write still equals all four |
| `by_automationId` (removed) | `emailAutomationRuns` | its only reader was the broken `stepsSentTo`. An index nothing reads is still a write on every insert |
| `by_storeId_status_createdAt` (new) | `orders` | a status tab ordered by `_creationTime` — when the row was written — so a late platform webhook broke the Date column's ordering |
| `by_storeId_status` (now used) | `payments` | declared since the table was written, read by nothing until now |
| `by_storeId_status` → `by_storeId_status_expiresAt` | `prizeRedemptions` | "what is still waiting at the till" — expired prizes never stop being rows, so the expiry belongs in the index. The old index was its prefix and no query used it |
| `by_storeId_status_redeemedAt` (new) | `prizeRedemptions` | "how many prizes were handed over this month". Without it the count had to be taken over redemptions *created* in the window, which is a different question wearing the same label |

### What an adversarial pass found in this change

A verifier briefed to prove the fix does not work found six defects the bounding
itself introduced. All six are fixed and held by tests; they are recorded because
the shape they share is worth remembering — **a bound that is correct about read
counts and wrong about something else**.

1. **A status tab listed orders in the wrong order.** `by_storeId_status` carries
   no timestamp, so `.order("desc")` fell back to `_creationTime` — when the row
   was written, not when the order was placed. A platform webhook arriving late
   floated to the top of the tab and the Date column stopped being monotonic.
   Fixed with `orders.by_storeId_status_createdAt`, the shape `kitchenTickets`
   has carried since #137.
2. **`/dashboard` under-reported silently past its cap.** `truncated` was
   computed, carried through two modules and typed into the hook — and rendered
   by nobody, while the code comment claimed "the answer says `truncated` when it
   happens". At 250 orders a day the breakdown pies were 33% low with no marker
   on screen. `OrderBreakdown` now says so.
3. **Order search returned false negatives.** It filters the loaded page, and the
   table answered "Aucune commande trouvée" — a claim about the whole history —
   when the match was simply on a later page. The placeholder and the empty state
   now both say what is being searched.
4. **`recent`'s clamp did not clamp `NaN`.** `v.number()` accepts NaN over the
   wire and it survives `Math.min(Math.max(1, Math.floor(NaN)), 50)`, reaching
   `.take()`, which refuses it with an error naming an argument the caller never
   sent.
5. **`paginationOpts.numItems` was unclamped.** Convex only refuses a negative
   page size, so every paginated query was bounded by its caller rather than by
   itself — `{ numItems: 1_000_000 }` reinstated the transaction the pagination
   existed to prevent. `pagination.ts` now clamps every one of them, including
   the two that shipped before this change.
6. **The last chart bar lost its upper bound.** The browser code closed today's
   bucket at tomorrow's local midnight; the server version had no upper bound at
   all, so an order stamped in the future counted as today's takings. `todayEnd`
   is now supplied alongside `dayStarts`.

Everything else the pass checked came back clean, including an arithmetic parity
run of the old browser aggregation against the new pure function over 400 mixed
orders — identical on every figure, every bar and the order of the breakdown
entries.

### Tests

- `packages/convex-functions/src/__tests__/queryBounds.test.ts` — 36 cases
  asserting **document read counts** rather than answers, because a test that
  checks the answer passes on ten rows and passes again on ten million. Verified
  by injection: restoring the `.collect()` in `orders.list` fails two cases
  ("expected 500 to be less than or equal to 15"), and restoring the JavaScript
  filter in `stepsSentTo` fails one ("expected 8000 to be 4").
- `packages/convex-functions/src/__tests__/support/countingDb.ts` — the double.
  It reads the real declared indexes out of `@be-in-digital/convex-schema` and
  enforces Convex's own rule (equalities cover a prefix; a range bound only on the
  next field), so "narrow it in JavaScript instead" cannot pass either. Its own
  behaviour is held by four cases.
- `packages/admin/src/__tests__/dashboard-windows.test.ts` — 12 cases on the half of the
  dashboard that stayed in the browser: the local-midnight boundaries (including
  the DST case a fixed 24-hour subtraction gets wrong) and the French labels.
- `apps/{reference,themes}/tests/convex/query-bounds.test.ts` — 17 cases each,
  byte-identical, driving the real API through the real schema. This is the layer
  that proves the five new, renamed and widened indexes exist in what the apps
  deploy.

---

## Not fixed — the rest of the sweep

The card's list was what one pass reached. A full sweep of every `.collect()` in
`packages/convex-functions/src`, `apps/*/convex` and `apps/site/convex` found
**187 calls, of which 97 are unbounded**. The ones below are real and uncarded.
None of them is on the four screens NEW-P names, which is why they are listed
rather than fixed.

Ordered by how fast the table grows.

### Grows with trade — these will fail the same way

| Query | File | Note |
| --- | --- | --- |
| `emailSubscribers.countByStatus` | `emailSubscribers.ts:174` | materialises the whole mailing list for six counters; `by_storeId_status` exists and is unused |
| `emailSubscribers.list` | `emailSubscribers.ts:100,105` | the whole list, then filtered on `source` in JavaScript |
| `emailSegments.countMatchingSubscribers` | `emailSegments.ts:65` | the entire active list, evaluated rule by rule |
| `emailCampaigns.list` / `listByStatus` | `emailCampaigns.ts:50,86` | `sent` accumulates forever |
| `emailCampaigns.dueForSending` | `emailCampaigns.ts:270` | full-table scan across every store, on a cron, with a Convex `.filter()` and no index |
| `gamePlay.findLatestPlay` / `completedActionIdsFor` | `gamePlay.ts:157,177` | every play this device ever made, on a public storefront read; `["storeId","fingerprint","playedAt"]` would fit |
| `products.getTrending` | `products.ts:153` | a 30-day window but every order inside it |
| `favorites.listByUser` / `clearAll` | `favorites.ts:18,84` | one customer's favourites across every store |
| `orphanProducts.listByStorePlatform` / `listPending` | `orphanProducts.ts:23,38` | grows with every unmatched item each menu sync produces; nothing prunes them |
| `externalProductMappings.*` | `externalProductMappings.ts:23,150` | one row per product per platform |

### Grows with the catalogue or the tenant count

`products.list` / `getByCategory` / `getFeatured` / `getManualTrending` /
`setTrendingProducts` / `duplicateCatalog` (`products.ts`), `categories.remove` and
`categories.listActiveWithCounts` (an N+1 — one full product collect per active
category, on a storefront query), `translations.getUIOverrides`,
`autoTranslate.saveUITranslations` / `getBatchChunkPlan` / `createBatchJob`,
`blog.listPublishedArticles` / `listByCategory` / `listByTag` / `listAdminArticles`
/ `deleteCategory` / `deleteTag` / `listTags`, `cmsMedia.listMedia` /
`deleteMedia`, `stores.list` and `stores.listAll` (full-table scans, `by_status`
declared and unused), `teamMembers.list` (a full-table scan for the `allStores`
rows), `languages.listAll`, `emailAutomations.listActiveByTrigger` (full table,
on a cron), `storeIntegrations.listByPlatformEnabled`,
`blogAutoPlanner.planAutoBlogJobsCore`, `storeCascade.detachStoreFromProfiles`.

### App-level and operational

`apps/*/convex`: `userProfiles.claimFirstAdmin` and `seedFixture` (full profile
scans; `by_role` exists and is unused), `teamMembers.sweepInvitations` (every
member of every store, on a cron), `seedKitchenOrders.cleanKitchenSeed`,
`migrations.*`, `systemInternal.exportTable` / `importTable` / `remapProfileStores`.
`apps/site` has 10 more, including `saIncidents.nextNumber`, which collects the
whole incident table to read its `.length`.

### The scan-then-filter pattern

Separately from the counts above, **46 sites** are
`.withIndex(...).collect()` followed by a JavaScript filter on a field the index
does not carry — the shape of three of the five defects fixed here. Several have
an index that already exists and is not used: `cms.by_storeId_pageSlug`,
`cms.by_storeId_pageSlug_blockKey_isDraft` (four call sites),
`cmsMedia.by_storeId_kind`, `cmsMedia.by_storeId_folder`, and
`emailSubscribers.by_storeId_status`. `prizeRedemptions.by_storeId_status` was on
that list too; it is now wired, widened into `by_storeId_status_expiresAt`.

A further **6 sites** apply `limit` with `.slice()` after a full `.collect()`
where `.take(n)` on the same index would be exact.

---

## Dead indexes

**191 declared in the engine schema after this change, 48 referenced by no
`withIndex` call anywhere** (25%). Matched per `(table, index)`, because index
names are only unique per table — twelve of the forty-eight carry a name that is
live on some *other* table, which is exactly how they stayed invisible.

An index nothing reads is not free: it is written on every insert and update of
its table.

Dead, and the name is dead everywhere:

```
categories.by_storeId_sortOrder      products.by_storeId_source
orders.by_orderNumber                orders.by_source
languages.by_storeId_code            gamePlays.by_playerEmail
gamePlays.by_qrCodeId                prizeRedemptions.by_playerEmail
customerAddresses.by_userId_localId  emailAutomations.by_storeId_trigger
cmsMedia.by_storeId_kind             cmsMedia.by_storeId_folder
blogArticles.by_status_scheduledPublishAt
blogAutoQueue.by_configId            migrationRequests.by_requestedBy
systemAuditLog.by_targetStoreId_performedAt
systemAuditLog.by_targetUserId_performedAt
platformWebhookFailures.by_receivedAt
platformWebhookFailures.by_platform_receivedAt
platformWebhookFailures.by_externalOrderId
cms.by_name
```

plus the whole legacy singleton-CMS family — `by_cms` appears in no `withIndex`
call in the repository, on any of the fifteen tables that declare it: `cmsHome`,
`cmsMenu`, `cmsAbout`, `cmsContact`, `cmsBlogPosts`, `cmsCart`, `cmsCheckout`,
`cmsTracking`, `cmsSignin`, `cmsSignup`, `cmsPrivacy`, `cmsTerms`, `cms404`,
`cmsMaintenance`, `cmsAccount`.

Dead on their own table, though the name is live elsewhere:

```
stores.by_status                     categories.by_storeId_slug
products.by_storeId_isActive         menus.by_storeId_isActive
kitchenTickets.by_storeId_status     uberEatsConnections.by_status
translationJobs.by_status            gameQRCodes.by_storeId_isActive
promotions.by_storeId_isActive       emailAutomationRuns.by_subscriberId
platformReleases.by_releasedAt       cmsBlogPosts.by_slug
```

Several of these are the fix to an entry in the sweep above rather than something
to delete — `stores.by_status` is what `stores.list` needs, `products.by_storeId_isActive`
is what `getFeatured` needs, `emailSubscribers.by_storeId_status` is what
`countByStatus` needs. Deciding delete-or-wire per index is a job of its own —
`prizeRedemptions.by_storeId_status` was on this list and is now wired, widened
into `by_storeId_status_expiresAt`.

`apps/site` has its own schema (52 indexes, 11 dead by the same measure); it is
outside this card's scope and was not re-verified index by index here.

## Not yours to close

Nothing here needs a third-party console. Two decisions do belong to the product
owner rather than to this change:

- **The gamification window (30 days) and its caps** (`GAME_STATS_SCAN_LIMIT`
  2,000 plays; `REDEMPTION_SCAN_LIMIT` 1,000 per redemption slice, of which
  there are three). Chosen to be generous, to match the dashboard's own
  breakdown window, and to keep the whole handler under 5,100 documents against
  Convex's 16,384 ceiling. None of it is a business decision anyone has taken.
- **`DASHBOARD_ORDER_SCAN_LIMIT` (5,000).** At 60 orders a day that is 83 days,
  well past the 30-day window it bounds. An establishment busy enough to truncate
  it wants a rollup table, not a bigger cap.
