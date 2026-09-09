# B10 — six build-vs-remove decisions, measured

Written 7 September 2026, alongside the seven straight fixes in batch B10
(#281, #188, #212, #263, #41, #168, #37 — all landed).

Six items in that batch are **not** engineering calls. Each is a surface the
product half-has: an admin screen with no customer half, a customer half with no
admin screen, or a table nobody reads. Building any of them is roughly a week;
removing any of them takes back something that was announced. That is an owner's
decision, so this note measures each one and stops.

**How to read it.** Every number below was measured on this commit, not quoted
from the issue that raised it. Where the measurement disagrees with the issue,
the measurement is given and the disagreement said out loud. Each item ends with
a recommendation, which is a recommendation and not a decision.

**The cost of not deciding** is the same in all six cases and worth naming once:
the surface stays, the owner keeps seeing it, and the next audit re-measures it.
Three of the six are visible to a paying client today.

---

## 1 · The 16 dead `cms*` tables — #330 / NEW2-DATA-5

**Recommendation: remove eleven, keep three, and treat the kept three as a
separate finding — they are not really about tables at all.**

### Measured

The schema registers 76 tables. Seventeen are `cms*`. Counting every reference
outside `schema.ts`, in both apps and every package:

| Table | References | |
|---|---|---|
| `cmsMedia` | 60 | live — the media library |
| `cmsBlocks` | 38 | live — the block editor's content |
| `cmsPages` | 20 | live — per-store draft/published state |
| `cmsHome` | 4 | **see below** — all four are schema or RGPD scoping |
| `cmsAbout`, `cmsAccount`, `cmsBlogPosts`, `cmsCart`, `cmsCheckout`, `cmsContact`, `cmsMaintenance`, `cmsMenu`, `cmsPrivacy`, `cmsSignin`, `cmsSignup`, `cmsTerms`, `cmsTracking` | **0 each** | dead |

So the count is thirteen with zero references, not sixteen, plus `cmsHome`,
which has no reader or writer of its own and is enumerated by something else.

### What they actually are

Not an unbuilt feature — a **superseded design**. They are a
document-per-page CMS (`cms` parent, `cmsId` foreign key, `localizedText`
fields), and the CMS that ships is block-based: `cmsPages` + `cmsBlocks` +
`cmsMedia`, driving **20 page definitions** in `apps/*/cms/pages/`.

Line the two up and ten of the thirteen — plus `cmsHome` — are the same
page twice:

| Dead table | Live block page |
|---|---|
| `cmsAbout` | `about.ts` |
| `cmsAccount` | `account.ts` (+ 3 sub-pages) |
| `cmsBlogPosts` | `blog.ts` |
| `cmsCart` | `cart.ts` |
| `cmsCheckout` | `checkout.ts` |
| `cmsContact` | `contact.ts` |
| `cmsMenu` | `menu.ts` |
| `cmsSignin` | `sign-in.ts` |
| `cmsSignup` | `sign-up.ts` |
| `cmsTracking` | `order-tracking.ts` |
| `cmsHome` | `homepage.ts` |

Those eleven are decided: the replacement shipped. Removing them takes nothing
away from anybody. (`cmsHome` needs one extra step — see below.)

### The three that are not superseded, and the finding underneath them

The remaining three of the thirteen — `cmsPrivacy`, `cmsTerms` and
`cmsMaintenance` — have **no live block page**. That is not a tidiness
question:

- `apps/*/app/(storefront)/` has **no privacy route, no terms route, no
  mentions légales route.** The only `privacy` directory in either app is the
  admin's RGPD screen.
- A French establishment selling online owes CGV and mentions légales. The
  engine answers the four RGPD obligations properly (`privacy.ts`, the
  operator runbook, the consent record) and then ships a storefront with
  nowhere to publish the notice.

So the honest reading of `cmsPrivacy` and `cmsTerms` is not "dead table" but
"the only trace of a legal page nobody built". **Deleting them would erase the
last evidence of the gap.** Whatever is decided about the other ten, this needs
its own issue.

`cmsMaintenance` is a third thing again — a maintenance-mode page, which is a
product decision nobody has taken.

### `cmsHome` and the erasure report

`cmsHome` is named twice in `packages/convex-functions/src/privacy.ts` (`:106`,
`:976`) and rendered in the admin as « Témoignages sur la page d'accueil »
(`privacy-report.tsx:55`). So the RGPD erasure and export **scope over a table
that nothing can ever write**. The operator is shown a sweep of a table that is
structurally empty. Nothing is lost — but the report says something untrue, and
that is the one part of this item with a compliance edge.

(This also narrows #330's "distorting backup/erasure scoping": exactly one of
the fourteen distorts it, and it is `cmsHome`. Removing it therefore means
removing those two `privacy.ts` entries and the `privacy-report.tsx` label in
the same commit — which is a correction to the erasure report either way, since
today it claims to have swept something it cannot have.)

### If removed

`defineTable` with no documents costs nothing at runtime, so the case is not
performance. It is that 17 % of a client's registered schema describes a CMS
that does not exist, which every future reader has to rule out. ~520 lines of
`packages/convex-schema/src/tables/cms.ts` (of 926) go with them.

**A removal is not reversible against live data.** Convex drops a table's
documents when it leaves the schema. Before removing, confirm no client
deployment holds rows — these tables predate the block editor, so a backend
migrated rather than freshly cloned may.

---

## 2 · Menus / formules — #352

**Recommendation: build, and treat the two money questions as the gate.**
The issue already records « Decision taken 5 Sep 2026: build it ». Nothing
measured here contradicts that; what follows is what it will cost.

### Measured

- **Admin half: complete.** Schema (`catalog.ts:172-222`), CRUD
  (`convex-functions/src/menus.ts`), RBAC (`menus:read` / `menus:write`), a
  « Menus / Formules » tab, a 473-line list and a 761-line section builder.
- **Customer half: absent.** `api.menus` has **0** call sites across
  `apps/themes/app` and `apps/themes/components`.
- **The seven customer-facing strings are already translated into three
  languages** (`lib/i18n/locales/{fr,en,es}.json:79-85` — `menu.combo`,
  `menu.selectOption`, `menu.included`, `menu.addComboToCart`, `menu.sections`,
  `menu.fixedItem`, `menu.pickFrom`) and referenced **0** times outside those
  files. Someone translated « Ajouter la formule au panier » before anyone built
  the button.
- **The order refuses one.** `orders.ts` throws `line_without_product`
  (declared `:101`, thrown `:905`); a `CartItem` is flat, with no `menuId` and
  no nested lines.
- The guided tour, auto-launched 1.2 s after a first login, tells every new
  owner the tab exists — « Deux onglets : Produits individuels et
  Menus/Formules » (`tour-steps.ts:159`). It is telling the truth about the
  admin and not about the product.

### What has to be decided before code, not during

1. **VAT across a mixed-rate formule.** Tax is computed per line from
   `product.taxRate`. A formule holding 10 % food and 20 % alcohol at one fixed
   price has to split it — pro rata on à-la-carte value is the standard French
   treatment. Wrong here means wrong invoices, silently, in a numbered fiscal
   series that cannot be edited.
2. **Promotions × formules.** `discountableLines` is keyed on `productId` +
   `categoryId`. Does a category promotion apply to a dish bought inside a
   formule? The answer changes what a customer is charged.

### Three loose ends that are "decide or delete" whatever is decided

- `menus.list` is public and **unfiltered by `isActive`** — a storefront
  reading it as-is would show deactivated formules. `listActive` on
  `by_storeId_isActive` has to exist before anything customer-facing reads it.
- `platformVisibility` is collected by the dialog, badged in the list, and read
  by neither `uberEatsMenuSync` nor `deliverooMenuSync`. Map it or remove the
  two switches.
- `prizes.menuId` is declared, the prize type « Menu offert » exists in the
  admin catalogue, and `prizes.create` accepts neither `menuId` nor
  `productId`, so nothing ever writes it. `menus.remove` is a bare delete with
  no cascade, so a prize could point at a deleted formule.

**Size: ~25 files, ~1 400–1 700 lines, 4–7 focused days.**

---

## 3 · The Clients / CRM page — #364

**Recommendation: build. It is the cheapest of the six and the most sold.**
Also already recorded as « Decided build on 5 Sep 2026 ».

### Measured

- `/dashboard/customers` is `<ComingSoon/>` in both apps.
- There is **no `customers` table** among the 76 — and it is not needed.
  `orders.customerInfo` carries `{ name, email?, phone? }` with `customerId`
  indexed `by_customerId`; `emailSubscribers.metadata` already maintains
  `totalOrders`, `totalSpent`, `lastOrderAt`, `averageOrderValue` and
  `favoriteProducts` incrementally on every order status change.
- **CSV export exists nowhere in the admin.** The only hit under
  `packages/admin/src` is `csv-import-dialog.tsx` — import, not export. The
  commercial site sells « Vous possédez vos clients (emails, data) », and
  ownership in the sense of portability has no mechanism.
- #363 removed the onboarding tour step that navigated to this page, so the
  product currently promises less than the site does.

### What is not a query

1. **A person entity.** Orders, `emailSubscribers`, `gamePlays` and
   `userProfiles` each hold a customer and none agrees on an identity. Pick the
   key — email, `customerId`, or a merge — before writing the page. This is the
   same question item 4 needs, so sequence them together.
2. **A deliberate non-link, at `orders.ts:1620-1621`.** `source: "order"`
   exists in the schema and nothing writes it, on purpose: *an order is a
   purchase, not consent to be marketed to.* A Clients page that READS orders
   is fine. One that creates subscribers is a consent decision, not a code one.
   Do not cross that line quietly.
3. **The gamification gap.** `gamePlay.claim` never writes an
   `emailSubscribers` row, so a won game's email lands in `gamePlays` only and
   can be neither campaigned to nor segmented — which makes the `/decouvrir`
   copy materially overstated today, independently of this page.

**Size: ~1 week. Depends on nothing.**

---

## 4 · The three sales metrics — #365

**Recommendation: build « plats populaires » and « heures de pointe »; put
« taux de retour » behind the identity decision in item 3.**

### Measured

- `find apps/themes packages -iname '*analytic*'` → **0 files**.
  `grep -riE 'topProduct|peakHour|returnRate|plats populaires'` → **0 hits.**
  All three are absent in every form.
- The server-side aggregate **has landed** (#370): `use-dashboard-stats.ts`
  reads `api.orders.dashboardStats` with a window argument, and
  `dashboardStats.ts` caps what one transaction reads. The unbounded
  `orders.list` on the admin home page is fixed. So the NEW-P justification the
  issue leaned on is already banked — this item is now the metrics alone.
- `analytics:read` / `analytics:view_all` are declared in `rbac.ts` and consumed
  nowhere; the dashboard nav entry carries no `requiredPermission` at all.
  Decide whether this screen should be gated while you are here.

  > **Still open, and deliberately left open (2026-09-09, #413).** That issue
  > listed these two under "genuinely dead, safe to delete", and they are indeed
  > consumed by nothing: `rbac.ts` grants `analytics:read` to `super_admin`,
  > `client_admin` and `manager`, and `analytics:view_all` to `super_admin`
  > alone, and no guard, screen, route or Convex function reads either. They are
  > also not a plain line-deletion — the literals are synthesised from
  > `Resource.ANALYTICS` × `Action`, so removing them means deciding the fate of
  > that enum member, and four `rbac.test.ts` cases assert them.
  >
  > They were **not** removed, because deleting them answers this question by
  > default. The dashboard exists and could be gated on `analytics:read`
  > tomorrow; the alternative — that analytics is genuinely absent (T-1: 0
  > files) and the permission should come back with the screen — is equally
  > defensible. That is the owner's call, not a sweep's.

### What each costs

- **Plats populaires** — a line-item rollup over the window the aggregate
  already takes. Small.
- **Heures de pointe** — time-of-day bucketing. Needs the store timezone, which
  `restaurant/src/services/store.ts` already resolves for `isStoreOpen`. Reuse
  it; assuming UTC puts a Paris dinner rush at 17:00.
- **Taux de retour** — needs a *definition* before it needs code. Repeat
  customers by `customerId`, or by email, over what window? Same question as
  item 3.

**Not in scope: plan gating.** The engine never learns which plan was bought and
#363 stopped the copy implying otherwise.

---

## 5 · The automations editor — #270

**Recommendation: build the editor. The engine underneath it already works,
and the settings screen is actively misleading without it.**

### Measured

- `packages/admin/src/pages/email/` ships six pages — campaigns, config,
  dashboard, segments, subscribers, templates. **None creates, edits or deletes
  an automation.**
- `create`, `update`, `remove`, `activate` and `pause` exist and are
  permission-guarded. **0 callers** anywhere in the product. An owner's only
  route to a first automation is a Convex API call.
- The dashboard card at `email-dashboard-page.tsx:227` reads `listActive`
  and therefore says « Aucune automation active » to every owner, permanently.
- Since #268 three triggers really do dispatch — `welcome`, `post_order`,
  `inactive`. So the settings screen now lies twice: the toggle saves, the
  engine dispatches, and no mail is sent, because the toggle enables a sequence
  that cannot exist.

### The API gap the editor will hit on day one

`inactiveAfterDays` is on the table (`emailMarketing.ts:484`) and read by the
win-back sweep (`emailAutomationActions.ts:337`). **Neither `create` nor
`update` accepts it** — confirmed: the only other references in the repo are
test fixtures. So no caller, UI or API, can set it, and every win-back
automation in existence is stuck on the 90-day default. Add it to both
mutations' args before the editor can expose it.

### One design rule worth writing down before the UI

**Delays are counted from the trigger, not from the previous step** — see
`delayForStep`. An editor that chains delays would drift and would not match the
« J+1 / J+3 » the admin presents elsewhere.

And offer only the triggers that can fire: `TRIGGER_READINESS` in
`automationDispatch.ts` carries the reason `birthday` and `abandoned_cart`
cannot, and should drive the picker. Letting an owner build a birthday sequence
that can never send is this same failure one level up.

---

## 6 · Platform connect / accept / reconcile — #274

**Recommendation: decide the OFFER first. This is the only one of the six where
"remove" means changing what is sold, and the sold claim is a count.**

### Measured

What works, both driven from the store detail screen: `uberEatsMenuSync.syncStore`,
`deliverooMenuSync.syncStore`, `uberEatsImport.importFromStore`,
`deliverooImport.importFromStore`. Credentials are pasted by hand through
`storeIntegrations.upsert`.

Product-side callers, counted across `apps/themes/app`,
`apps/themes/components` and `packages/admin/src`:

| Module | Callers |
|---|---|
| `uberEatsOAuth` (2 functions) | **0** |
| `uberEatsConnections` (2) | **0** |
| `uberEatsActions` (10) | **0** |
| `deliverooOrders` (3) | **0** |
| `orphanProducts` (5) | **0** |
| `externalProductMappings` (3) | **0** |

Three consequences, in the order they hurt a restaurant:

1. **No order handling.** `deliverooOrders.acceptOrder` / `rejectOrder` /
   `updatePrepStage` and `uberEatsActions.markOrderAsReady` have no caller. A
   Deliveroo order cannot be accepted or refused from the admin. Whatever
   `toggleAutoAccept` was meant to govern is unreachable too, so the fallback it
   implies cannot be configured either.

   > **Updated 2026-09-09 (#413).** Every function in the table above has been
   > removed from `apps/*/convex`, along with the rest of the callerless public
   > surface. Read that as a change of *registration*, not of capability: the
   > gap this section describes is exactly as wide as it was, and the
   > definitions still live in `@be-in-digital/convex-functions`, so wiring a
   > screen means restoring a six-line wrapper beside it. What changed is that a
   > client's deployment no longer publishes an endpoint for a feature it does
   > not have. The one survivor is `uberEatsActions.runValidation`, kept because
   > `apps/docs/guides/delivery-integrations.md` tells an operator to run it.
   >
   > Converting them to `internalAction`/`internalQuery` was tried first and is
   > wrong: all of them authorise from the CALLER's identity, and an internal
   > function reached from a cron, the Convex dashboard or `npx convex run` has
   > none — it would refuse every caller it could ever have.
   > `tests/convex/scheduled-paths.test.ts` caught the three Deliveroo actions
   > doing precisely that.
2. **No reconciliation.** `orphanProducts` exists *because* an import leaves
   items matching nothing in the catalogue. The screen that resolves them does
   not exist, so they accumulate invisibly.
3. **No connection state.** An owner cannot tell whether the integration is
   live, and cannot disconnect.

### Why this is the offer decision

`CLAUDE.md` lists « Third-Party Integrations (10) ». Menu sync and catalogue
import are real; the rest of that count is not reachable from the product. So
"remove" here does not mean deleting code — it means **saying ten is two**, on
the feature list and wherever a salesperson repeats it.

It is one issue rather than seven because the missing pieces are one screen: an
integrations page per store showing connection state, offering connect and
disconnect, listing unmatched products, and handling incoming orders.

---

## What was NOT deferred

The seven straight fixes in B10 are done and merged into this branch: #281,
#188, #212, #263, #41, #168, #37. Two things surfaced while measuring them and
are worth recording here rather than losing:

- **#168's saved-address residual was already fixed** on `main`.
  `address-manager.tsx` carries `latitude`/`longitude` through an edit and into
  the mutation, and drops them only when a field they describe is retyped. The
  issue's checkbox is stale, not the code.
- **#37's third point — the mobile placeholder — is honest and needs no
  action.** `apps/themes/.template/mobile/` is nine files behind an opt-in
  `pnpm add:mobile`, its README says plainly « the BeYours engine does not ship
  a mobile product yet », and the one screen says « placeholder ».

  The thing it gestures at, **#330 / NEW2-SOLD-1**, is already closed and the
  issue text is stale. `apps/site/convex/planAvailability.ts:31` marks
  `premium: "coming_soon"`, and `stripe.ts:193` refuses a closed plan inside
  `createCheckoutSession` ahead of every env-dependent check — so the gate is no
  longer UI-only and `/checkout?plan=premium` cannot take money. Recorded in
  `sales-readiness-backlog.md` → **LAUNCH-04 §1**, decided 5 September 2026:
  sell it as « à venir ». Nothing to decide here; the issue predates the fix.

  Two of #330's other bullets are in the same state and should be re-measured
  before anyone works them: NEW2-SOLD-2 (the 50 demos' reservation CTA) and
  NEW2-RECENT-2/-3 (annotations that were false the week they were written).
  This note did not measure those.
