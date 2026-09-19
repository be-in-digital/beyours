# Owner decisions — the standing register

Started 7 September 2026 as the six build-vs-remove calls left over from batch
B10 (whose seven straight fixes — #281, #188, #212, #263, #41, #168, #37 — all
landed). **Re-measured in full on 9 September 2026 at `038eb9d`**, and widened
to every open item that ends in a decision or a console rather than in a commit.

**The three that were still open were decided on 9 September 2026.** The other
seven were never open — they had been decided already, or were owner *actions*
misfiled as decisions. The list had been circulating as though all ten were open:

| Item | State |
|---|---|
| #330 · the dead `cms*` tables | **held**, 9 Sep — blocked on a client-data check, not on the call |
| #270 · the automations editor | decided **build**, 9 Sep |
| #274 · platform connect / reconcile | decided **build the screen**, 9 Sep — *not* a repositioning of the offer |
| #352 · menus / formules | decided **build**, 5 Sep — two money questions still owed |
| #364 · the Clients page | decided **build**, 5 Sep — the identity key still owed |
| #365 · the three sales metrics | decided **build**, 5 Sep — one definition still owed |
| #172 · the Deliveroo secret | posture decided in **#337**, 4 Sep — two owner *actions* remain |
| #173 · Stripe coupon + 4 Prices | not a decision — the repo half is complete, nine console objects remain |
| #181 · licence keys → `strict` | one product decision (*when*), after console work |
| #95–#112 · the audit umbrellas | not a decision — issue hygiene, and half of it is unsafe |

**How to read it.** Every number below was measured by execution at `038eb9d`,
not quoted from the issue that raised it. Where a measurement disagrees with an
issue, with a backlog card, or with the 7 September version of this file, the
measurement is given and the disagreement is said out loud — including where the
7 September text was simply wrong, which it was in five places. Each item ends
with a recommendation, which is a recommendation and not a decision.

**What is left after 9 September.** Two builds are authorised and unstarted
(#270, #274) and one item is held on a measurement nobody has taken yet (#330 —
whether any live client deployment holds rows in the sixteen dead tables). The
three decided **build** on 5 September (#352, #364, #365) each still owe one
specific answer before their PR can start, and those answers are product
decisions rather than engineering ones: how VAT splits across a mixed-rate
*formule*, whether a category promotion reaches a dish bought inside one, what
key identifies a customer across `orders` / `emailSubscribers` / `gamePlays` /
`userProfiles`, and what « taux de retour » means over what window. #364 and
#365 share the identity question, so sequence them together.

**What changed under the six between 7 and 9 September.** Nine commits landed
(#404, #406, #400, #402, #407, #415, #416, #417, #418), and two of them moved
this file's own evidence: **#404** created
`packages/convex-functions/src/backupTables.ts`, which names all sixteen dead
`cms*` tables explicitly and so ended the "zero references" finding in §1;
**#418** rewrote `menus.remove`, closing one of §2's three loose ends. Neither
changes a recommendation. Both change what a removal costs.

---

## 1 · The 16 dead `cms*` tables — #330 / NEW2-DATA-5

> **Decision, 9 September 2026: HELD, pending a client-data check.** Not a
> refusal of the recommendation below — a refusal to act before one question is
> answered, because **a removal is not reversible against live data**: Convex
> drops a table's documents when the table leaves the schema. These tables
> predate the block editor, so any backend that was *migrated* rather than
> freshly cloned may hold rows.
>
> **What unblocks it**, and it is the only thing that does: for every live client
> deployment, confirm each of the sixteen is empty. `system.exportBackup` already
> walks `BACKUP_TABLES`, which names all sixteen, so an export per deployment
> answers it without new code. A single non-empty table changes the decision from
> "remove" to "migrate, then remove". Until that check is done, nothing here
> should be deleted.

**Recommendation, once the data check clears: remove twelve, hold four, and treat
the held four as a separate finding — they are not really about tables at all.**
(Stated as "remove eleven, keep three" on 7 September, on a count of thirteen.
The count is sixteen.)

### Measured — 9 Sep 2026, and this section's own count was wrong

The package schema registers **78** tables; the schema a client actually runs
registers **79** (the apps add `schemaValidation`). **Nineteen** are `cms*`, not
seventeen — the 7 September count silently dropped the bare `cms` parent and
`cms404`. Three are live; **sixteen are dead**:

```
$ awk '/^export default defineSchema\(\{/,/^\}\)/' packages/convex-schema/src/schema.ts \
    | grep -oE '^\s+cms[A-Za-z0-9_]*:' | tr -d ' :'
cmsPages cmsBlocks cmsMedia cms cmsHome cmsMenu cmsAbout cmsContact cmsBlogPosts
cmsCart cmsCheckout cmsTracking cmsSignin cmsSignup cmsPrivacy cmsTerms cms404
cmsMaintenance cmsAccount                                    → 19, of which 3 live
```

**So #330's "16 dead `cms*` tables" was right and this file's "13" was the
undercount.** The bare `cms` parent is as dead as the rest: no `db.query("cms")`
and no `db.insert("cms")` exists anywhere in the tree. Its references are the
`cmsId: v.id("cms")` foreign keys each dead child declares in `tables/cms.ts`,
plus the backup list added by #404 (`backupTables.ts:112` and a
`backup-coverage.test.ts` line in each app) — which is generic plumbing, not a
reader. `backupTables.ts:107` independently calls them "the sixteen CMS
singletons".

Dead share of a client's registered schema: **20.3 %** (16 of 79), not 17 %.

**The "zero references" finding is over.** #404 created
`packages/convex-functions/src/backupTables.ts`, which names all sixteen
explicitly, with a `backup-coverage.test.ts` in each app asserting the list. So
every dead table now has **3 references** where it had 0, and the three live ones
*lost* five each (`cmsMedia` 60→55, `cmsBlocks` 38→33, `cmsPages` 20→15) because
four hard-coded backup lists collapsed into one shared import. `cmsHome` went
4→9.

**How these were counted**, because the numbers are method-dependent and the
7 September table never said: occurrences of the quoted table name across
`apps/` and `packages/`, `*.ts` and `*.tsx`, excluding `node_modules` and every
`schema.ts`. That method reproduces the original 60 / 38 / 20 / 4 exactly at the
commit the original table was written on, which is why it is the one used here.
A file-count or word-boundary variant gives different absolute numbers for the
live tables; quote the method with the number or the two cannot be compared.

No *feature* reads or writes a row in any of the sixteen — the finding is
unchanged. One caveat worth stating precisely: `BACKUP_TABLES` is walked
dynamically by `apps/*/convex/system.ts`, so a backup export does query all
sixteen and `systemInternal.importTable` could in principle insert into them.
That is plumbing over an empty table, not a reader, but "nothing touches them"
is looser than it sounds.

What changed is the price of removal: it is now a three-file edit per table
(schema, `backupTables.ts`, and the coverage test in both apps), and six files
for `cmsHome`.

### What they actually are

Not an unbuilt feature — a **superseded design**. They are a
document-per-page CMS (`cms` parent, `cmsId` foreign key, `localizedText`
fields), and the CMS that ships is block-based: `cmsPages` + `cmsBlocks` +
`cmsMedia`, driving **20 page definitions** in `apps/*/cms/pages/`.

Line the two up and ten of the sixteen — plus `cmsHome` — are the same
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
away from anybody. (`cmsHome` needs one extra step — see below.) **The bare `cms`
parent goes with them, making twelve** — it is the root of exactly this
superseded document-per-page design, and outside the backup list it has no trace
in the tree but the `cmsId: v.id("cms")` foreign key each dead child declares.

### The four that are not superseded, and the finding underneath them

The other four — `cmsPrivacy`, `cmsTerms`, `cmsMaintenance` and `cms404` — have
**no live block page**. None of the 20 page definitions in `apps/*/cms/pages/`
covers them. That is not a tidiness question:

- `apps/*/app/(storefront)/` has **no privacy route, no terms route, no
  mentions légales route.** The only `privacy` directory in either app is the
  admin's RGPD screen.
- A French establishment selling online owes CGV and mentions légales. The
  engine answers the four RGPD obligations properly (`privacy.ts`, the
  operator runbook, the consent record) and then ships a storefront with
  nowhere to publish the notice.

So the honest reading of `cmsPrivacy` and `cmsTerms` is not "dead table" but
"the only trace of a legal page nobody built". **Deleting them would erase the
last evidence of the gap.** Whatever is decided about the other twelve, this
needs its own issue.

`cmsMaintenance` and `cms404` are a third thing again — a maintenance-mode page
and a 404 page, each a product decision nobody has taken. Neither is urgent;
neither should be swept away as tidiness.

### `cmsHome` and the erasure report

`cmsHome` is named twice in `packages/convex-functions/src/privacy.ts` (`:106`,
`:976`) and rendered in the admin as « Témoignages sur la page d'accueil »
(`privacy-report.tsx:55`). So the RGPD erasure and export **scope over a table
that nothing can ever write**. The operator is shown a sweep of a table that is
structurally empty. Nothing is lost — but the report says something untrue, and
that is the one part of this item with a compliance edge.

(This also narrows #330's "distorting backup/erasure scoping": exactly one of
the sixteen distorts it, and it is `cmsHome`. Removing it therefore means
removing those two `privacy.ts` entries and the `privacy-report.tsx` label in
the same commit — which is a correction to the erasure report either way, since
today it claims to have swept something it cannot have. Since #404 it also means
`backupTables.ts:113` and a `backup-coverage.test.ts` line in each app: six
files, not three.)

### If removed

`defineTable` with no documents costs nothing at runtime, so the case is not
performance. It is that **20.3 %** of a client's registered schema (16 of 79)
describes a CMS that does not exist, which every future reader has to rule out.
523 lines of `packages/convex-schema/src/tables/cms.ts` (of 926) go with the
dead page tables, 599 if the `cms` parent goes too.

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
  « Menus / Formules » tab, a 475-line list and a 761-line section builder.
- **Customer half: absent.** `api.menus` has **0** call sites across
  `apps/themes/app` and `apps/themes/components`.
- **The seven customer-facing strings are already translated into three
  languages** (`lib/i18n/locales/{fr,en,es}.json:79-85` — `menu.combo`,
  `menu.selectOption`, `menu.included`, `menu.addComboToCart`, `menu.sections`,
  `menu.fixedItem`, `menu.pickFrom`) and referenced **0** times outside those
  files. Someone translated « Ajouter la formule au panier » before anyone built
  the button.
- **The order refuses one.** `orders.ts` throws `line_without_product`
  (declared `:108`, thrown `:916`); a `CartItem` is flat, with no `menuId` and
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
  `productId`, so nothing ever writes it. **Half-closed since #418**:
  `menus.remove` is no longer a bare delete — it refuses with `menu_in_prize`
  when a prize names the formule, and cascades the menu's `translations` in
  batches through `internal.menus.purgeTranslations` (`menus.ts` grew 278 → 371
  lines; the refusal reaches the screen via `menus-tab.tsx:167`). But the new
  guard reads a field **no production code can write**, because `prizes.create`
  and `prizes.update` still accept no `menuId`. So `menu_in_prize` cannot fire
  outside tests: the orphan was closed on paper before it was ever openable.
  Adding `menuId` to those two mutations is what makes both the prize type and
  the guard real.

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
2. **A deliberate non-link, at `orders.ts:1652-1659`.** `source: "order"`
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
  reads `api.orders.dashboardStats` with a window argument, and the read is
  capped at `DASHBOARD_ORDER_SCAN_LIMIT = 5_000` in
  `packages/convex-functions/src/orders.ts:344`. (The 7 September text credited
  the cap to `dashboardStats.ts`; that file is pure and caps only the *bucket*
  count, `MAX_DAY_BUCKETS = 31` at `:109`.) The unbounded
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

> **Decision, 9 September 2026: BUILD the editor.** Two things are part of the
> build, not follow-ups, because the editor is wrong without them: add
> `inactiveAfterDays` to the `create` and `update` args — nothing, UI or API, can
> set it today, so every win-back automation is stuck on the 90-day default — and
> drive the trigger picker from `TRIGGER_READINESS`, so no owner can build a
> `birthday` or `abandoned_cart` sequence that can never send.

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

> **Decision, 9 September 2026: BUILD the integrations screen. The offer stands.**
> « Third-Party Integrations (10) » stays as it is in `CLAUDE.md` — the
> integrations function end to end, and the 7 September case for "say ten is two"
> rested on four measurements that were wrong. The one sales claim still owed a
> correction is Uber Direct driver assignment (UD3), which
> `tasks/feature-audit-2026-09-07.md` marks absent; that is a copy fix, not part
> of this build.

**Recommendation: build the integrations screen. Do not reposition the offer.**
(Reversed on 9 September. The 7 September recommendation — "decide the OFFER
first… the sold claim is a count" — rested on four measurements that were wrong,
corrected below. The integrations function end to end; what is missing is the
admin's manual control over them.)

### Measured

> **Four claims in this section were wrong on 7 September and are corrected
> below.** They all overstated the gap in the same direction, and together they
> produced a recommendation ("say ten is two") that the evidence does not
> support. Re-measured 2026-09-09.

What works from the store detail screen (`packages/admin/src/pages/stores/use-store-detail.ts:701-704`):
`uberEatsMenuSync.syncStore`, `deliverooMenuSync.syncStore`,
`uberEatsImport.importFromStore`, `deliverooImport.importFromStore`.

**And what works without any screen at all**, which is the part the 7 September
text missed: platform orders arrive and update through signed webhooks.

```
apps/themes/convex/deliverooWebhook.ts:393  internal.orders.createFromWebhook
apps/themes/convex/deliverooWebhook.ts:595  internal.orders.updateFromWebhook
apps/themes/convex/uberEatsWebhook.ts:201   internal.orders.createFromWebhook
apps/themes/convex/uberEatsWebhook.ts:314   internal.orders.updateFromWebhook
```

What is typed by hand through `storeIntegrations.upsert` is **identifiers** —
`platformStoreId`, `brandId` — not credentials. The API secrets come from the
environment (`DELIVEROO_CLIENT_ID` / `_SECRET`, read via `getPackageEnv` in
`deliverooOrders.ts:7`). The 7 September text said "credentials are pasted by
hand"; nobody pastes a secret into that form.

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

1. **No *manual* order handling.** `deliverooOrders.acceptOrder` / `rejectOrder` /
   `updatePrepStage` and `uberEatsActions.markOrderAsReady` have no caller, so an
   individual Deliveroo order cannot be accepted or refused by hand.
   **Correction:** the 7 September text added that "whatever `toggleAutoAccept`
   was meant to govern is unreachable too, so the fallback it implies cannot be
   configured either". That is false. Only the *mutation* is unreachable — the
   field it governs is configurable from two screens and honoured at runtime:
   « Acceptation automatique des commandes » at `store-deliveroo-card.tsx:287`,
   saved through `use-store-detail.ts:650`; the store-global `orderMode` from the
   kitchen page (`kitchen-page.tsx:75`); and `deliverooWebhook.ts:468` resolves
   *platform override > store global > legacy `autoAccept` > manual*.
> **Updated 2026-09-09 (#413).** Every function in the table above has been
> removed from `apps/*/convex`, along with the rest of the callerless public
> surface — `toggleAutoAccept` among them, which is consistent with the
> correction just made: the mutation was the unreachable half, and the field it
> would have written stays configurable from the two screens named above. Read
> this as a change of *registration*, not of capability: the gaps this section
> describes are exactly as wide as they were, and the definitions still live in
> `@be-in-digital/convex-functions`, so wiring a screen means restoring a
> six-line wrapper beside it. What changed is that a client's deployment no
> longer publishes an endpoint for a feature it does not have.
>
> Three of the listed functions survive, annotated `@kept-callerless`, because a
> runbook names them: `uberEatsActions.runValidation`,
> `uberEatsOAuth.generateAuthorizeUrl` and `activateAndListStores`. The first
> deletion of `generateAuthorizeUrl` was a real break — it is the only writer of
> the `oauthStates` row the live `uberEatsConnectCallback` HTTP route validates,
> so removing it would have made Uber Eats unconnectable on every client.
>
> Converting them to `internalAction`/`internalQuery` was tried first and is
> wrong: they all authorise from the CALLER's identity, and an internal function
> reached from a cron, the Convex dashboard or `npx convex run` has none — it
> would refuse every caller it could ever have.
> `tests/convex/scheduled-paths.test.ts` caught the three Deliveroo actions
> doing precisely that.

2. **No reconciliation.** `orphanProducts` exists *because* an import leaves
   items matching nothing in the catalogue. The screen that resolves them does
   not exist, so they accumulate invisibly. **This one is intact** — 0 UI callers,
   and no `integrations` route in either app.
3. **No OAuth connection state.** `uberEatsConnections.getStatus` and
   `.disconnect` have 0 callers, so the *token* connection is invisible.
   **Correction:** the 7 September text said an owner "cannot tell whether the
   integration is live, and cannot disconnect". Both halves ship for the
   integration record: a menu-sync status badge at `store-uber-eats-card.tsx:88-106`
   (« Synchronisé » / « Erreur de sync » / « Synchronisation... ») and
   « Supprimer l'intégration » at `:143`, wired to `storeIntegrations.remove`.

### Why this is *not* the offer decision it was written as

The 7 September text concluded that "remove" here means **saying ten is two**,
on the feature list and wherever a salesperson repeats it. Two things say
otherwise.

First, a document written the *same day* contradicts it:
`tasks/feature-audit-2026-09-07.md:133` reads **"Third-Party Integrations — 10
ship, 1 absent"**, and lists Uber Eats order import, status updates and auto
accept as shipping, with `deliverooWebhook.ts:468-484` as the evidence for the
Deliveroo half. Two files in `tasks/`, one day, opposite conclusions, never
reconciled.

Second, the code sides with the audit. The integrations do work end to end —
menu out, catalogue in, **orders in, statuses both ways, auto-accept honoured**.
What "two" was counting is *admin-reachable actions*; what "ten" counts is
*features that function*. Both numbers are true of different questions, and
`CLAUDE.md`'s « Third-Party Integrations (10) » is defensible on the second.

**So the decision is smaller than a repositioning.** What is genuinely missing is
manual control and visibility: accepting or refusing an individual order by hand,
resolving orphan products after an import, and seeing or ending the OAuth
connection. That is one screen — an integrations page per store — not a
correction to what is sold. The one claim that would still need softening is
`UD3` (Uber Direct driver assignment), which the same audit marks **absent**.

It is one issue rather than seven because those missing pieces are one screen's
worth of work.

---

## 7 · The Deliveroo secret — #172

**Nothing to decide about the scan. Two owner actions remain, and one of them
gets more expensive every week.**

### The posture was settled on 4 September, in #337

PR #337 was authored and merged by the account owner. Its reasoning is the
decision: accept the four known findings *by fingerprint* — commit, file, rule
and line — so that a **fifth** leak is visible instead of arriving as one more
line in a permanently red list. It says in its own body that "Nothing in this PR
makes it safe", and names the removal condition (Part B).

Three documents were never updated and asserted the superseded posture until
2026-09-09: `tasks/sales-readiness-backlog.md` LAUNCH-01,
`tasks/battle-plan.md` #172, and `tasks/secret-rotation-runbook.md`'s
detection-status paragraph — the last of which also contradicted itself twice
over, saying at `:44-46` that the findings are fingerprint-scoped, at `:57-59`
that the secret is "undetected by the scanner", and at `:335-341` that the job
"will now FAIL". All three are corrected.

The sequence, on a full clone (a shallow one attributes both texts to its own
boundary commit and proves nothing):

```
b7fae997  2026-09-04 03:19  #315  adds "Do not silence it in `.gitleaksignore`"
294e40bc  2026-09-04 21:38  #337  adds the four fingerprints that silence it
```

### What is actually outstanding

**A.1 — rotate the credential** in the Deliveroo Developer Portal, then
propagate, re-verify, revoke. Console action, account owner.

**Part B — rewrite the history.** Still the only thing that removes the value.
Measured 2026-09-09 on a full clone:

| | Recorded 4 Sep | Measured 9 Sep |
|---|---|---|
| commits on `main` | 393 | **472** |
| remote branches | 8 | **72** |
| remote tags | 59 of 60 | **75** (63 are `@be-in-digital/*` release anchors) |
| open PRs blocking | 0 | **2** (#420, #421 — drafts, 9 Sep) |

The queue is nearly clear rather than clear — a draft PR's SHAs are invalidated by a
rewrite exactly like a ready one — and the cost grows weekly.

Two figures worth having exactly right, because urgency rests on them:
`7cf4d41` **is** an ancestor of `origin/main`, and **41 commits on `origin/main`**
carry the token — 41 through `scripts/deliveroo-menu-scenarios.sh`, 9 through
`apps/restaurant-theme/e2e/deliveroo/test-config.ts`. The leak is published. The
working tree, by contrast, is clean: a sweep of every tracked file for a bare
52-character base36 token returns nothing.

Incidental: `c0f09cb`, which carries two of the *JWT* fingerprints, does not
exist in `origin` at all, so those two lines are inert against any fresh clone.

**Recommendation: rotate now — it is cheap, reversible and independent of Part B.
Take the Part B decision separately and soon, because waiting is the only option
that costs money.**

---

## 8 · Stripe founders coupon + the four maintenance Prices — #173

**Not a decision. The repo half is complete; nine objects and seven variables
live in a console.**

### Repo half — done, and it fails closed

Three independent layers refuse a checkout before an order row exists:
`stripeMode.ts:60-65` (no secret key and no explicit test flag),
`stripe.ts:53-72` called at `:256-258` (any of the four `STRIPE_PRICE_*`
missing), and `foundersOffer.ts:73-106` called at `stripe.ts:319-325` (coupon or
creation product missing on a live deployment). There is no fallback price and
no fail-open. `stripePriceAudit.ts` derives the expected Prices from
`planPrices.ts` so the checkout and the audit cannot read different lists, and
`scripts/wizards/stripe-founders-launch.sh` runs the whole check.

### Outstanding, all console

Confirm the live Stripe account; Stripe Tax on with the French registration;
two creation Products with no default price; one coupon (`percent_off: 100`,
`max_redemptions: 10`, `duration: once`, `applies_to` the Essentielle creation
Product); one or two *separate* maintenance Products carrying four recurring
Prices (100 €/mo, 1 000 €/yr, 200 €/mo, 2 000 €/yr, `eur`, `tax_behavior:
exclusive`); then seven `convex env set … --prod` on **`famous-wildcat-229`**,
and `stripe-founders-launch.sh --prod` at exit 0.

Two blanks the runbook correctly refuses to guess: which live Stripe account is
real, and what to name the maintenance Products.

### Corrections landed 2026-09-09

The founders hold window is **30 minutes** (`foundersOffer.ts:43`,
`FOUNDERS_HOLD_MS`), not 24 h — wrong in the runbook twice and in the wizard
once, and wrong in the direction that makes a test checkout look 48× more
expensive than it is. `stripeAudit:run` does not audit the coupon but the wizard
does (`:392-427`), which the runbook's §7 denied while its own §6 head asserted.
*(Superseded 2026-09-19: `stripeAudit:run` audits the coupon too, and the
wizard now reads that answer instead of reaching for the Stripe CLI. The
sentence above is kept as the record of what was true on 2026-09-09.)*
And LAUNCH-02's instruction to strip six `STRIPE_BID_PRICE_*` variables "that no
code reads" was inverted — all six are read through
`packages/convex-functions/src/bidSubscription.ts:36-51`; acting on it would have
broken a live subscription path.

---

## 9 · Licence keys, then `strict` — #181

**One product decision — *when* — and it comes after console work that only the
owner can do.**

### What flipping actually changes

Exactly one branch. `resolveLicenseEnforcement` (`maintenance.ts:94-98`) reads
`BEYOURS_LICENSE_ENFORCEMENT`, and only the exact string `strict` closes the
gate — a typo forgives on purpose (`:73-77`), because the worst case of a
fumbled flag must be an open gate, not a paying client whose updates are
bricked. `resolveUnknownKey` (`:183-189`) then answers `entitled: false` instead
of `true` **for sites holding no key or an invented one, and for nothing else**.
A registered key's verdict is unaffected under either policy.

### What must be registered first — two things, not one

A **key** per delivered site, which must actually reach the client's own
repository; and the **order link** (`saDeployments.orderId`), without which
entitlement falls back to every subscription under the customer's email and
keeps the most favourable (`maintenance.ts:281-300`). A two-restaurant owner is
therefore never refused on the one they stopped paying for. `saFleet.unlicensed`
and the `/admin/flotte` banner report both lists.

### Understand what is being bought

Not a lock. The sentinel lives in the client's repository and is one edit from
disabled; `maintenance.mjs:52` skips the check if `licenseKey` is absent. The
real lock is access to the private boilerplate repo and the `@be-in-digital/*`
registry. Reverting is `convex env unset`, immediate, no deploy.

### Repo-side residue worth carding separately

- **No server guard against two deployments sharing one `orderId`.**
  `saFleet.update:375-414` patches it blind; the duplicate prevention is a
  `disabled` attribute on an `<option>`. `saClients.paidOrders` already computes
  `linkedDeployment` — the mutation just never consults it.
- **`BEYOURS_LICENSE_ENFORCEMENT` is undiscoverable** from the env surface: in
  no `.env.example`, not in `apps/site/lib/env.ts`'s optional list, not in the
  site README. `STRIPE_TAX_ENABLED` is equally Convex-side and *is* listed.

### Corrections landed 2026-09-09

The runbook's verification step told operators to run `pnpm update:engine
--check`, which returns at `update-engine.mjs:91` — **before** the licence gate
at `:93-95` — and exits 1 when the registry is unreachable. It verified nothing.
Its `curl` fallback named the client's deployment rather than
`famous-wildcat-229`. And its `convex env set` omitted `--prod`, which would
have left the gate open while the operator believed it closed.

---

## 10 · The audit umbrellas — #95–#112

**Not a decision, and only half of it is safe to do.**

All twenty of #94–#113 were opened **27 August 2026** (not 18 August), and
**#94 and #113 are already closed** (PR #246, PR #250). The open umbrellas are
#95–#112.

**"Convert to point at their live children" is a reconstruction, not a
conversion.** `get_sub_issues` returns empty for all twenty, and no umbrella body
lists its children in any form. The parentage exists only as a `**Parent:** #NN`
line inside each of the 59 `audit-2026-08` children, and in
`tasks/sales-readiness-backlog.md` — which is therefore the only map. Attaching
real sub-issues would make the hierarchy queryable for the first time, and that
half is worth doing.

**"Then close" is not.** Twelve umbrellas — #95, #97, #100, #102, #103, #104,
#105, #106, #107, #108, #111, #112 — have every child issue closed and would
close on a mechanical pass, while their audit scope is demonstrably live under
successors that name no parent:

| Umbrella | Scope asks for | Still open as |
|---|---|---|
| #97 | dead schema tables | #330 |
| #105 | storefront formula consumption | #352 |
| #103 | delivery integrations | #274, #414 |
| #102 | tests and CI | #321, #389, #392 |

Two must stay open on their own children: **#96** (child #168 open, twelve
unticked boxes) and **#109** (all seven child issues closed, but backlog card
**TECH-07b**, `sales-readiness-backlog.md:2058`, has no GitHub issue at all).

Four have no children anywhere — **#98, #99, #101, #110** — so nothing can be
concluded from their children. #101's body is stale (it calls `updateBranding`
nonexistent; it is at `packages/convex-functions/src/stores.ts:653`), but #99's
core finding looks intact and nothing tracks it.

And three demand outcomes the project has since decided **against**: #100 wants
ESC/POS thermal printing, #106 wants Square, #108 wants free-product/BOGO. All
three are refused by design and recorded in `CLAUDE.md`. Closing them silently
would bury those decisions.

**Recommendation: attach the sub-issues from this backlog; close only #94-style
umbrellas whose scope is genuinely discharged; and for the three above, comment
the decision on the issue before closing it, so the refusal is on the record
where someone will look for it.**

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
