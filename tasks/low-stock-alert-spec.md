# Low-stock alerts — the four decisions, costed

For #496. Low stock is **visible** and has been since the inventory screen was
built; nothing **reaches** an owner who is not looking at it. A dish runs out
during service and the first anybody hears of it is a diner refused at checkout,
which `verifyOrderLine` does correctly and too late.

#496 says what has to be decided before this can be built. This file answers each
of the four with a recommendation and the measurement behind it, so the decision
is a yes or a no rather than a design session. **Nothing here is built.** Measured
on `main` at `c1511fd`, 17 September 2026.

---

## The short version

| # | Question | Recommended answer | Why it is not a coin toss |
|---|---|---|---|
| 1 | To whom | The three roles holding `products:write` | The rule already exists in `rbac.ts`; a new list would be a second source of truth |
| 2 | On what channel | E-mail, through `convex/emailTransport.ts` | It is the only channel that exists. `notificationPreferences` is a diner's setting, not an owner's |
| 3 | Immediately or digest | **Digest**, at close of service | Forty tracked dishes on a Friday is forty e-mails; the clock to send one already exists |
| 4 | Does a second crossing count twice | Once per dish per digest window | Falls out of the digest; an immediate alert is what would have needed the marker |

Decisions 3 and 4 are the same decision. Answering 3 with *digest* answers 4 for
free, which is the main reason to prefer it.

---

## 1 · To whom

**Recommended: every user whose role holds `products:write`** — `super_admin`,
`client_admin`, `manager`. Measured in `packages/core/src/auth/rbac.ts`:

| Role | `products:read` | `products:write` |
|---|---|---|
| `super_admin` | ✅ | ✅ |
| `client_admin` | ✅ | ✅ |
| `manager` | ✅ | ✅ |
| `waiter` | ✅ | — |
| `kitchen`, `delivery` | — | — |
| `customer` | ✅ | — |

#496 asks whether the `manager` should be included and observes that a `waiter`
"would not thank anybody for this". The permission set answers both without a new
list: a low-stock alert is a prompt to *change a number*, and `products:write` is
exactly who may. A `waiter` holds `products:read` and cannot act on it; a
`customer` holds `products:read` too, which is the sharper reason not to build the
audience from that permission.

**Do not add a per-user opt-out in the first version.** It is the kind of thing
that looks free and is not: an opt-out needs a screen, a permission, a default,
and a story for the owner who silences the alert and then asks why nobody told
them. If it turns out to be wanted, it is additive.

---

## 2 · On what channel

**Recommended: e-mail, through the seam the order confirmation already uses.**

`convex/emailTransport.ts` is the single seam in the engine — `sendEmail`,
`sendFromDeployment`, `emailSender`, `emailProviderName` — and it is held there by
`email-provider-switch.test.ts`. It carries SES and Resend equally, so this
inherits the transport decision instead of reopening it.

**`userProfiles.notificationPreferences` is not the hook, and this is the trap in
#496 worth stating plainly.** It is two booleans:

```ts
notificationPreferences: v.optional(v.object({ email: v.boolean(), sms: v.boolean() }))
```

Measured writers and readers: written by
`apps/*/app/(storefront)/account/page.tsx` — **the diner's own account screen on
the storefront** — through `userProfiles.updateProfile`. Read by nothing that
sends anything. So it is not an unwired owner preference waiting for a sender; it
is a *diner's* preference, on the wrong side of the product. Hanging a staff
alert on it would mean a diner's checkbox governing whether a manager hears that
the pizza dough is out.

**SMS is not a near-miss, it is absent.** The `sms` boolean above has no provider,
no credential in `packages/core/src/env/schemas.ts`, no sender and no template.
Costing it honestly means costing an SMS integration, which is its own project.

---

## 3 · Immediately, or as a digest

**Recommended: a digest, once at close of service.**

#496 calls this the decision that decides whether the feature is usable, and the
arithmetic is why: an establishment tracking forty dishes on a busy Friday would
receive forty separate e-mails, each announcing a fact the owner can do nothing
about until service ends. The same information in one message at close is a thing
an owner reads. It is also the difference between a feature and a filter rule in
somebody's inbox.

**The clock already exists**, which removes the objection #496 raises against the
digest (that it "needs a schedule, and the establishment's own timezone is what
decides when close of service is"):

- `globalSettings.timezone` — a string, e.g. `"Europe/Paris"`, one row per
  deployment. It is live rather than declared-and-ignored: `blogAutoSchedule`,
  `numbering.fiscalYear` and `promotionDiscount` all read it.
- `getLocalParts(at, timezone)` in `packages/convex-functions/src/blogAutoSchedule.ts:38`
  already turns an instant into local parts, and is exported.
- `convex/crons.ts` runs fourteen jobs, several of them daily `crons.cron(...)`.

**One limitation to accept deliberately:** `timezone` is per **deployment**, not
per store. A client with locations in two timezones would get one digest boundary
for both. Every establishment on this engine is French, so this is correct today
and wrong the first time it is not — record it rather than pre-solving it.

**What "close of service" means** is the one input the code cannot supply.
`stores.hours` holds it per store (`tables/stores.ts:41`, with `resolveStoreHours`
and `followsGlobalHours` in `convex-schema/src/openingHours.ts` settling the
per-store-versus-global question already). The honest first version is simpler
still: one fixed hour per deployment, in `globalSettings`, defaulting to 23:00
local. Deriving it from the latest closing time across stores is a refinement, not
a prerequisite — and `resolveStoreHours` is what it would be built on.

---

## 4 · Does crossing the threshold twice count twice

**Recommended: once per dish per digest window — which is what the digest gives
you for nothing.**

This question is sharp for an immediate alert: a dish that dips to the threshold,
is restocked, and dips again during one service is one problem or two depending on
the answer, and either way needs a claim marker to stop the duplicate. #496 points
at the right shape for it — `confirmationEmailAt` and `readyEmailAt` on `orders`,
where `planOrderReady` decides and claims in the mutation and renders and sends in
the action, so two racing callers cannot both send.

A digest does not need it. The window is the marker: the job reads the state at
close of service and reports each dish once, whatever it did in between. A dish
that dipped and was restocked is **not** in the digest, and correctly so — it was
handled.

**What the digest should read.** The status is already computed —
`quantity <= lowStockThreshold`, at `packages/admin/src/pages/inventory/inventory-page.tsx:71`
and again on the catalogue list. So the digest is a query over current state, not
new bookkeeping.

`stockMovements` (since #491) is then the *body* of the message rather than its
trigger — it records `sale`, `restock`, `adjustment`, `tracking_on`,
`tracking_off`, so the digest can say what drained a dish and not only that it is
low. One case to handle explicitly: `tracking_off` means the number has stopped
meaning anything, so a dish whose tracking was turned off during service must not
appear as low.

**The claim marker is still needed once**, at the job level rather than the dish
level: a cron that runs twice, or is retried after a partial failure, must not
send two digests for the same window. The same plan/claim/send split applies, with
the window key where `readyEmailAt` sits.

---

## What building it looks like, once the four are answered

Small, and in the order that keeps each step provable:

1. `globalSettings` gains the digest hour and an on/off switch. Off by default —
   an establishment that has never tracked stock should not start receiving mail
   because it upgraded.
2. A query returning the low dishes per store, with their last movements. This is
   testable with no mail involved, and it is where `tracking_off` is excluded.
3. The plan/claim half in a mutation, keyed on the window, following
   `planOrderReady`.
4. The render-and-send half in a Node action, through `emailTransport`.
5. A cron reading `globalSettings.timezone` and the configured hour.

Steps 1–3 are a pull request on their own and carry the whole of the logic; 4 and
5 are the transport. Nothing in the product currently claims this exists, so there
is no false promise to correct in the meantime — which is why #496 is a feature
request and not a bug.

## What is still the owner's to say

1. The digest hour, and whether one hour per deployment is acceptable to start.
2. Whether `manager` is in the audience — the recommendation says yes, on the
   permission it already holds.
3. Whether an establishment that tracks no stock at all should ever be opted in.

Everything else above is measurable from the code and is measured.
