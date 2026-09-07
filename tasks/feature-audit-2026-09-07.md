# Feature audit — 7 September 2026, at `cdc6c81`

**70 ship · 6 partial · 17 absent**, of the 93 features enumerated below.

This file exists so that figure can be checked rather than believed. The number it
replaces — 29 shipping · 23 partial · 41 absent — was taken on 1 September 2026 at
`009af63`, and by 7 September it was three audits stale and still quoted in
`CLAUDE.md` as binding, under the words "Quote that, or quote nothing". Nothing
failed when it went out of date, because nothing named the commit it was true at.

`CLAUDE.md` now names one, and `scripts/check-claude-md.mjs` fails the build when
that commit is not an ancestor of `HEAD`. That guard cannot tell you the count is
still right — only that the pin is real and still in this history. **Re-measure
before quoting; do not update the figure without redoing the table below.**

---

## What was counted

The 93 rows are the leaf features of the nine `_project/FEATURES_DIAGRAM.md`
categories that `CLAUDE.md`'s "Key Features" section reproduces:

| Category | Nodes | Count |
| --- | --- | --- |
| 1. Multi-Store Management | `MS1`–`MS5` | 5 |
| 2. Product & Menu Management | `PM1`–`PM9` | 9 |
| 3. Order System | `OS1`–`OS8` | 8 |
| 4. Kitchen Display System | `KDS1`–`KDS12` | 12 |
| 5. Payment Processing | `PAY1`–`PAY8` | 8 |
| 6. Third-Party Integrations | `UE1`–`UE4`, `DR1`–`DR4`, `UD1`–`UD3` | 11 |
| 9. Gamification | `GAM1`–`GAM10`, `ACT1`–`ACT6` | 16 |
| 15. Internationalization | `I18N1`–`I18N10` | 10 |
| 16. Design Customization | `DC1`–`DC8`, `THEME1`–`THEME6` | 14 |
| | | **93** |

**On 92 versus 93.** `FEATURES.md` §3 flags that the old audit's three numbers sum to
93 against a stated total of 92, and leaves the discrepancy unexplained. It is the
integrations row: `FEATURES_DIAGRAM.md`'s own summary table calls that category 10,
while its diagram declares 3 platform nodes over 11 leaves. Counting the 11 leaves
gives 93 and reproduces the old audit's sum exactly; counting the summary table's 10
gives the 92 it stated. The leaves are counted here, because a category node is not a
feature — the platform ships or does not ship through the leaves under it.

**The rubric is `FEATURES.md` §1**, unchanged, and it is strict on purpose:

- **Ships** — an owner or a diner can reach it and use it in `apps/themes`.
- **Partial** — something real exists, and there is a named gap between it and what
  the copy promises. The gap is stated; "partial" alone is not information.
- **Absent** — no implementation. **A schema field, a dead export, a translated
  string or a `<ComingSoon/>` screen is not an implementation**, and eight of the
  seventeen absences below are exactly that. Reading them as "partial" is what
  produces a friendlier number than the product deserves.

The bar is `apps/themes`, never `apps/reference`. The bench proves a feature; the
template delivers it.

---

## The ledger

### 1. Multi-Store Management — 5 ship

| # | Feature | State | Evidence |
| --- | --- | --- | --- |
| MS1 | Store Configuration | **Ships** | `stores` CRUD, `/dashboard/stores` |
| MS2 | Store Hours & Settings | **Ships** | opening hours, services crossing midnight |
| MS3 | Store Location & Geolocation | **Ships** | address autocomplete, coordinates |
| MS4 | Multi-Store Dashboard | **Ships** | store switcher; every scoped query goes through `requireStorePermission` |
| MS5 | Store Status Management | **Ships** | per-store status, cascade on delete (`storeCascade.ts`) |

### 2. Product & Menu Management — 7 ship, 2 absent

| # | Feature | State | Evidence |
| --- | --- | --- | --- |
| PM1 | Product Catalog | **Ships** | `/dashboard/products`, plus the from-an-image creator (`convex/imageToProduct.ts`) |
| PM2 | Categories & Tags | **Ships** | `/dashboard/categories` |
| PM3 | Product Options & Variants | **Ships** | options and variants, required-option enforcement in `orderLine.ts` |
| PM4 | Pricing & Discounts | **Ships** | pricing, promotions applied at order time |
| PM5 | Allergen Management | **Ships** | one vocabulary across admin, storefront filter and diner detail (#356) |
| PM6 | Nutritional Information | **Absent** | `catalog.ts:105` declares `nutritionalInfo`; no component reads it |
| PM7 | Stock Management | **Ships** | stock tracking and auto-disable |
| PM8 | Menu Scheduling | **Ships** | `products.scheduling` written by the form and honoured on the storefront through `isProductAvailable` (`packages/restaurant/src/services/product.ts:33`) |
| PM9 | Image Gallery | **Absent** | products carry `images[]`; every consumer reads `images[0]`. No multi-image uploader, no gallery |

> Not a row here, but tracked: **Menus / formules** is admin-complete and has no
> customer half — `api.menus` has zero storefront readers and `orders.ts` rejects a
> line without a `productId`. It is not one of the 93 nodes; see `FEATURES.md` and
> #352.

### 3. Order System — 7 ship, 1 absent

| # | Feature | State | Evidence |
| --- | --- | --- | --- |
| OS1 | Order Creation | **Ships** | `orders.create`, storefront checkout |
| OS2 | Order Tracking | **Ships** | tracking by token |
| OS3 | Order Status Management | **Ships** | eight states, `tables/orders.ts:23-30` |
| OS4 | Order History | **Ships** | `/dashboard/orders`, paginated since #370; diner history via `getMyOrders` |
| OS5 | Scheduled Orders | **Absent** | `orders.scheduledFor` is in the schema and `orders.create` takes no such argument. Only the Uber Eats importer writes it, so no diner can pick a time |
| OS6 | Order Types | **Ships** | `delivery`, `pickup`, `dine_in`, with a table number since #356 |
| OS7 | Order Notifications | **Ships** | `orderConfirmation` dispatch on payment (`convex-functions/src/orderConfirmation.ts`) |
| OS8 | Order Analytics | **Ships** | `orders.dashboardStats`, server-side over a window since #370; reports a floor past its read cap rather than under-reporting silently |

### 4. Kitchen Display System — 7 ship, 1 partial, 4 absent

| # | Feature | State | Evidence |
| --- | --- | --- | --- |
| KDS1 | Real-time Order Display | **Ships** | live kitchen screen |
| KDS2 | Priority Management | **Absent** | the field exists and all three ticket writers hardcode `priority: "normal"` (`orders.ts:2314`, both webhooks). Nothing can set another value |
| KDS3 | Prep Time Estimation | **Ships** | `estimatedPrepTime` → `estimatedReadyAt`, used for the overdue count (`kitchenTickets.ts:338-372,663`) |
| KDS4 | Multi-Station Support | **Ships** | `stores.stationMapping` |
| KDS5 | Sound Notifications | **Ships** | `packages/admin/src/pages/kitchen/kitchen-sound-manager.tsx` |
| KDS6 | Order Assignment | **Absent** | `assignTo` is a real exported mutation with no caller, and `assignedTo` is a prop type that is never rendered (`ticket-card.tsx:32`). A dead export is not an implementation |
| KDS7 | Kitchen Analytics | **Absent** | no files |
| KDS8 | Platform Badge | **Ships** | `SOURCE_CONFIG` rendered on the ticket card |
| KDS9 | Auto-Print Tickets | **Ships** | `KitchenPrintTrigger` + `kiosk-print.sh --kiosk-printing`. Through the browser, which is the only transport that ships — a thermal printer set as the OS default gives a thermal ticket via its driver |
| KDS10 | Manual Reprint | **Ships** | `kitchenTickets.requestReprint`, with a claim lock and bounded retries (#164) |
| KDS11 | Multi-Printer Support | **Partial** | station routing reaches one printer per station, as that station's OS default. There is no per-printer configuration and no transport we control |
| KDS12 | Printer Status Monitor | **Absent** | no polling; a browser cannot open a raw socket. The three cloud providers in `kitchen-print.ts:151,157,163` are `available: false`. Decided path is cloud printing — LAUNCH-04 §3 |

### 5. Payment Processing — 7 ship, 1 absent

| # | Feature | State | Evidence |
| --- | --- | --- | --- |
| PAY1 | Stripe | **Ships** | webhook verification, `paymentEvents` dedup, settlement binding |
| PAY2 | SumUp | **Ships** | OAuth pair |
| PAY3 | PayPal | **Ships** | OAuth pair |
| PAY4 | Square | **Absent** | a literal in the provider union; the only executable code naming it **refuses** it (`refundPolicy.ts:151-158`). Shown as « bientôt » in the admin and the tour — LAUNCH-04 §5 |
| PAY5 | Cash | **Ships** | marked paid at the counter; #391 stopped one order being collected twice, in cash and by card |
| PAY6 | Payment Tracking | **Ships** | `/dashboard/payments`, paginated since #370 |
| PAY7 | Refund Management | **Ships** | `routeRefund` (`refundPolicy.ts:143`) |
| PAY8 | Invoice Generation | **Ships** | since #367 a paid order issues a numbered `invoices` row in an unbroken series (art. 242 nonies A CGI); listed in the admin (`apps/themes/convex/invoices.ts`) |

### 6. Third-Party Integrations — 10 ship, 1 absent

| # | Feature | State | Evidence |
| --- | --- | --- | --- |
| UE1 | Uber Eats — Menu Sync | **Ships** | `uberEatsMenuSync.ts` |
| UE2 | Uber Eats — Order Import | **Ships** | signed webhook → order |
| UE3 | Uber Eats — Status Updates | **Ships** | status mapping both ways |
| UE4 | Uber Eats — Auto Accept | **Ships** | `orderMode` on `storeIntegrations`, legacy `autoAccept` still honoured |
| DR1 | Deliveroo — Menu Sync | **Ships** | menu sync; #358 stopped a product deletion bricking the menu |
| DR2 | Deliveroo — Order Import | **Ships** | `deliverooWebhook.ts` |
| DR3 | Deliveroo — Status Updates | **Ships** | status mapping |
| DR4 | Deliveroo — Manual/Auto Accept | **Ships** | platform override > store global > legacy flag (`deliverooWebhook.ts:468-484`) |
| UD1 | Uber Direct — Delivery Request | **Ships** | quote then request |
| UD2 | Uber Direct — Real-time Tracking | **Ships** | `uberDirectTrackingUrl` stored and rendered in `uber-direct-panel.tsx`. Operator-facing; the diner is not shown the courier |
| UD3 | Uber Direct — Driver Assignment | **Absent** | no implementation |

### 7. Gamification — 14 ship, 1 partial, 1 absent

| # | Feature | State | Evidence |
| --- | --- | --- | --- |
| GAM1 | QR Code Table Stickers | **Ships** | `gameQRCodes` |
| GAM2 | Action Requirements System | **Ships** | enforced server-side since #355 |
| GAM3 | Spin the Wheel | **Ships** | `tables/gamification.ts:14` |
| GAM4 | Scratch Card | **Ships** | `tables/gamification.ts:15` |
| GAM5 | Prize Management | **Ships** | `/dashboard/games` |
| GAM6 | Winner Notification Email | **Ships** | prize QR by e-mail |
| GAM7 | QR Code Prize Redemption | **Ships** | scanner in the kitchen screen |
| GAM8 | 24h Play Cooldown | **Ships** | plus the anonymous-abuse bounds of #323 |
| GAM9 | Analytics Dashboard | **Partial** | `gamePlay.getStats` reads a 30-day window since #370 and the screens are relabelled to say so. Honest, and not the lifetime total the node names |
| GAM10 | Prize Inventory | **Ships** | stock per prize; #355 bounded what a game can give away |
| ACT1 | Google Review | **Ships** | `google_review` |
| ACT2 | YouTube Subscribe | **Absent** | not in the union (`tables/gamification.ts:34-38`); zero hits for `youtube` anywhere in the game code |
| ACT3 | Instagram Follow | **Ships** | `instagram_follow` |
| ACT4 | Facebook Like | **Ships** | `facebook_like` |
| ACT5 | TikTok Follow | **Ships** | `tiktok_follow` |
| ACT6 | Newsletter Subscribe | **Ships** | `email_subscribe` |

### 8. Internationalization — 5 ship, 3 partial, 2 absent

| # | Feature | State | Evidence |
| --- | --- | --- | --- |
| I18N1 | Dynamic Language Management | **Ships** | `languages`, unlimited |
| I18N2 | Admin Add/Remove Languages | **Ships** | `/dashboard/languages` |
| I18N3 | Auto-Translation GPT-3.5 | **Ships** | `translateText` / `batchTranslate`, per-store daily budget on `stores.translationQuota` |
| I18N4 | Manual Translation Editor | **Ships** | « Traductions UI » tab, `translations.upsert`; a manual translation outranks the batch |
| I18N5 | Bulk Translation Tool | **Partial** | the **catalogue** back-fills on adding a language and the CMS editor has « Traduire tout ». No bulk translator for UI strings, and no reader for `translationJobs`, so a run stopped by the quota looks like one that finished |
| I18N6 | Translation Memory | **Partial** | per-field source hashes in `translations[lang]._meta` skip unchanged text and detect staleness mid-batch. Document-scoped; there is no memory shared across documents or stores |
| I18N7 | Currency Support | **Partial** | stored, and the admin's payment and refund screens format in it. The storefront does not — prices are EUR whatever the owner picked, so the picker is disabled with a stated reason |
| I18N8 | Date/Time Formats | **Absent** | `fr-FR` hardcoded in 32 places across the apps and packages; the language's locale reaches none of them |
| I18N9 | RTL Support | **Absent** | `languages.isRtl` is written by the form and read by nothing that sets a direction — `grep -rn 'dir=' apps/themes/app --include='*.tsx'` → 0. Arabic renders left-to-right; the switch is disabled with a stated reason |
| I18N10 | Language Toggle UI | **Ships** | storefront switcher, cookie-first |

### 9. Design Customization — 8 ship, 1 partial, 5 absent

| # | Feature | State | Evidence |
| --- | --- | --- | --- |
| DC1 | Theme Selection | **Absent** | at runtime. `themeId` has zero readers and zero writers, held that way by `design-surface.test.ts`. A theme is `pnpm template:apply <slug>` at clone time |
| DC2 | Color Customization | **Ships** | since #353: `stores.updateBranding` → `buildBrandingCss` → `StoreTheme` in `app/(storefront)/layout.tsx`, emitted unlayered so it beats `globals.css`'s `@layer base` |
| DC3 | Font Selection | **Partial** | the stored family reaches the page through the same chain, but nothing fetches a webfont: only Inter and Poppins are bundled, and any other family renders only on a device that already has it. The screen says so |
| DC4 | Logo Upload | **Ships** | CMS `branding` block on `storefront-layout` — header, favicon, JSON-LD and admin sidebar all read it |
| DC5 | Banner Management | **Ships** | editable `hero` blocks on seven CMS pages, with media handling |
| DC6 | Layout Options | **Absent** | no field, no screen |
| DC7 | Custom CSS | **Absent** | no field, no screen. Deliberate: nothing interpolates a stored string into the emitted stylesheet |
| DC8 | Mobile Responsive | **Ships** | the storefront and the admin are responsive throughout |
| THEME1 | Fast Food | **Ships** | `apps/themes/templates/fast-food*` |
| THEME2 | Pizzeria | **Ships** | `apps/themes/templates/pizzeria*` |
| THEME3 | Chinese | **Ships** | `apps/themes/templates/asiatique*` |
| THEME4 | Fine Dining | **Absent** | no template of any vertical matches it |
| THEME5 | Café / Bakery | **Absent** | no template of any vertical matches it |
| THEME6 | Sushi Bar | **Ships** | `apps/themes/templates/asiatique-omakase` |

> The five verticals shipped are `asiatique`, `fast-food`, `pizzeria`, `poulet` and
> `default`, 51 templates in total. `poulet` is not one of the six the diagram names;
> it is counted under no row, because the diagram is what is being measured.

---

## Totals

| | Ships | Partial | Absent | Total |
| --- | --- | --- | --- | --- |
| Multi-Store | 5 | 0 | 0 | 5 |
| Product & Menu | 7 | 0 | 2 | 9 |
| Orders | 7 | 0 | 1 | 8 |
| Kitchen Display | 7 | 1 | 4 | 12 |
| Payments | 7 | 0 | 1 | 8 |
| Third-party | 10 | 0 | 1 | 11 |
| Gamification | 14 | 1 | 1 | 16 |
| i18n | 5 | 3 | 2 | 10 |
| Design | 8 | 1 | 5 | 14 |
| **Total** | **70** | **6** | **17** | **93** |

---

## What moved since `009af63`

The jump from 29 to 70 is not a change of rubric. Thirty-four commits landed between
the two measurements, and the ones that moved rows here are, in order of how many:
#353 (per-store colours and typography reach a diner), #367 (order confirmation,
sequence numbering, invoices), #369 (a diner's personal data gets a lifecycle), #370
(the admin queries that used to abort past 16,384 documents), #355 (the game enforces
the actions it asks for), #356 (table number, one allergen vocabulary), #358, #374,
#375, #378, #391.

The old audit also read several rows as absent that were reachable in `apps/reference`
and stubbed in `apps/themes`; those stubs are gone.

## What is still absent, and what it is worth reading first

Seventeen rows, and eight of them share one shape — **a schema field, a dead export
or a hardcoded literal standing in for a feature**: `PM6`, `OS5`, `KDS2`, `KDS6`,
`I18N9`, `DC1`, and the two themes with no template. That shape is the reason the
rubric refuses to call them partial: each one type-checks, each one looks present in
the schema, and none of them does anything.

The card-level ledger is `tasks/sales-readiness-backlog.md`, which is more current
than any prose summary including this one. `FEATURES.md` carries the per-domain
reasoning behind these verdicts.
