# Runbook — Routing card payments to the restaurant's Stripe account

> **Status: NOT DONE. The connect flow onboards, and the charge path ignores it.**
>
> `generateOAuthUrl` creates a Stripe **Standard** connected account and walks
> the owner through onboarding. `stripeCallback` then records the account id.
> Nothing after that point uses it: `apps/*/convex/stripe.ts:41-43` builds the
> Stripe client from the **platform** secret key with no `stripeAccount`, no
> `on_behalf_of` and no `transfer_data`, and never reads `paymentConnections`.
> **Every euro a customer pays by card lands in the platform's balance.**
>
> This file is the work that closes that. It contains **no credential**.

## What was already fixed, and what it changed for the owner

The connect flow used to write `status: "connected"` and toast
"stripe connecté avec succès" the moment Stripe reported `charges_enabled`.
That was the admin telling a restaurant owner their takings were arriving in
their own account while every one of them went elsewhere.

`stripeCallback` now writes **`"onboarding_complete"`** on a successful
onboarding and redirects with an explanation instead of a success toast. The
settings screen renders an amber "Vérifié, pas encore actif", which is true.

Two things to know before you read the rest:

- **The status union carries a dedicated literal.** It is
  `connected | onboarding_complete | disconnected | error`, fixed in
  `packages/convex-schema/src/tables/paymentConnections.ts:75-80`, mirrored in
  `packages/convex-functions/src/paymentConnections.ts` and
  `packages/admin/src/lib/types.ts`, and rendered from one exhaustive map in
  `packages/admin/src/lib/vocabulary.ts`. It means Stripe verified the account
  and takings are still **not** routed to it. "Déconnecter" is gated on a row
  existing rather than on its status, so such a row can always be cleared.
- **A charge on a `connected` row is now refused.** `resolveStripeCharge`
  (`packages/convex-functions/src/stripeChargeRouting.ts`) throws when a Stripe
  connection claims `connected` while the charge path is still on the platform
  key, and both money paths — `createCheckoutSession` and `internalRefund` —
  call it before they read `STRIPE_SECRET_KEY`. It is a tripwire, not a
  behaviour change: nothing writes `connected` for Stripe today. Every other
  status, and no row at all, proceeds on the platform key exactly as before.

**When the charge path below is wired, flip the status to `"connected"` in the
same commit** — `apps/*/convex/oauthCallbackHandlers.ts`, the `upsert` call in
`stripeCallback`. Until routing is real that flip takes card payments down, by
design: that is what the tripwire is for.

---

## 1. DECISION — Standard or Express

This is a product and liability decision, not a configuration one. Make it
before writing any code; it changes who the restaurant's Stripe relationship is
with, and it cannot be swapped afterwards without re-onboarding every client.

| | **Standard** (what the code creates today) | **Express** |
|---|---|---|
| Stripe account owner | the restaurant, in full | the restaurant, but BeYours-mediated |
| Dashboard | the restaurant's own, complete | a cut-down Express dashboard |
| Who handles disputes and refunds | the restaurant | **BeYours**, in practice |
| Who Stripe holds liable for negative balances | the restaurant | **BeYours** |
| Stripe fees | billed to the restaurant | billed to the platform, rebilled by you |
| Onboarding | Stripe-hosted, restaurant completes it | Stripe-hosted, shorter |
| Support burden on BeYours | low | high — you become tier 1 |

`apps/*/convex/oauthConnect.ts` sends `type=standard`. **If Express is chosen,
that line changes and every already-onboarded account has to be redone.**

> Standard is the lower-liability default and matches "we sell a theme, the
> restaurant runs its own business". Express is only worth its support cost if
> BeYours wants to take a per-transaction cut and control payouts. Decide, write
> the decision here, then continue.

## 2. DECISION — direct or destination charges

Both route money to the connected account; they differ in who Stripe considers
the merchant of record. The field each one needs is different, and picking the
wrong one is a silent misconfiguration — money still moves, the fee and
liability land somewhere you did not intend.

**Direct charges** — the charge is created *on* the connected account. Stripe
fees come off the restaurant's balance; the platform takes its cut with
`application_fee_amount`.

- Requires the `Stripe-Account` header. With the SDK, pass it per call:
  `stripe.checkout.sessions.create({...}, { stripeAccount: acct })`.
- The `acct_` id comes from `paymentConnections.merchantId` —
  `apps/*/convex/paymentConnections.ts:36` (`internalGetByProvider`) already
  reads that row for SumUp; Stripe needs the same lookup.
- Refunds, disputes and the Stripe dashboard all belong to the restaurant.

**Destination charges** — the charge is created on the **platform** account and
transferred. The platform is merchant of record and carries dispute liability.

- Requires `transfer_data: { destination: acct }` in the session, and
  usually `on_behalf_of: acct` so the charge settles in the restaurant's
  country and currency and its statement descriptor is used.
- No `Stripe-Account` header.

> With **Standard** accounts, direct charges are the natural pairing: the
> restaurant already owns the account, so it should own the charge, the refund
> and the dispute. Choose destination charges only if BeYours deliberately wants
> to be merchant of record.

**Whichever is chosen, `apps/*/convex/stripe.ts` must route the charge to the
connected account and must never silently fall back to the platform key.**
Falling back is what caused this whole file to exist. Mirror
`apps/*/convex/sumup.ts:47`, which already refuses when the connection is not
usable.

Today `stripe.ts` reads the connection only through `resolveStripeCharge`, which
refuses a `connected` row and otherwise returns `{ mode: "platform" }`. Wiring
the routing means giving that function a `connected` branch that yields the
`acct_` id, then honouring it in `createCheckoutSession`, `verifyCheckoutSession`
(`sessions.retrieve` must be scoped to the same account or the session is not
found) and `internalRefund` (a refund against a direct charge must be issued on
the connected account). Change all three together: a refund that ignores the
routing while checkout honours it sends money back from the wrong balance.

## 3. Register the second webhook endpoint — `connect: true`

A Connect endpoint is a **separate registration** from the one already in place,
with **its own signing secret**. Events about connected accounts do not arrive
on the platform endpoint.

Existing endpoint, unchanged: `CONVEX_SITE_URL/webhooks/stripe`
(`apps/*/convex/http.ts:57-62`), secret read at
`apps/*/convex/stripeWebhookVerify.ts:21` from `STRIPE_WEBHOOK_SECRET`.

In the Stripe dashboard → Developers → Webhooks → **Add endpoint**:

1. URL: `CONVEX_SITE_URL/webhooks/stripe/connect` (a new route in `http.ts`,
   with its own handler — do not reuse the platform one; the secrets differ, so
   a shared handler would verify against the wrong key).
2. Tick **"Listen to events on Connected accounts"** — this is the `connect: true`
   flag. An endpoint without it silently receives nothing for connected accounts.
3. Events to select, at minimum:
   - `account.updated` — capabilities changing, `charges_enabled` flipping,
     `requirements.currently_due` appearing. **This is how you learn a
     restaurant has been suspended**, and nothing in the product handles it
     today.
   - `account.application.deauthorized` — the restaurant disconnected you.
     Must mark the connection unusable, or checkout will keep trying.
   - `payment_intent.succeeded` / `charge.refunded` on the connected account, if
     direct charges were chosen — the platform endpoint will not see them.
4. Copy the signing secret (`whsec_…`).

### Where that secret goes — the Convex deployment, not Vercel

```
cd apps/reference   # a client instance: cd apps/themes
npx convex env set STRIPE_CONNECT_WEBHOOK_SECRET whsec_…
```

Convex functions read env from the **deployment**, not from `.env` and not from
Vercel. `STRIPE_WEBHOOK_SECRET`, `STRIPE_SECRET_KEY` and the BID pair are
already there for the same reason — see
`packages/core/src/env/schemas.ts:222-223`, where they sit among the values
annotated as living on the Convex deployment.

### `STRIPE_CONNECT_WEBHOOK_SECRET` does not exist yet

`packages/core/src/env/schemas.ts:194-198` declares `STRIPE_SECRET_KEY`,
`STRIPE_PUBLISHABLE_KEY` and `STRIPE_WEBHOOK_SECRET` and **no Connect secret**.
It has to be added there, as `opt(z.string().startsWith('whsec_'))`.

It also has to join the feature group. `SITE_FEATURE_GROUPS` at
`packages/core/src/env/schemas.ts:252-254` declares Stripe as exactly two
variables:

```ts
feature: 'Stripe (restaurant payments)',
vars: ['STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET'],
```

Adding Connect means **extending that group to three**, so that a deployment
carrying a Connect charge path but no Connect webhook secret fails validation
instead of running half-configured. That is exactly what the group exists for:
the comment above it says charging without verifying the webhook loses order
confirmations — a Connect charge whose `account.updated` events go nowhere loses
the ability to notice a suspended restaurant.

## 4. Per-client KYC

Each restaurant onboards its own account. None of this is skippable and none of
it can be done by BeYours on the restaurant's behalf.

1. Enable **Connect** on the BeYours platform account (Stripe dashboard →
   Connect → Get started). One-time, and required before any `/v1/accounts` call
   succeeds in live mode.
2. Complete the **platform profile** — business details, the statement
   descriptor customers will see, the support contact. Stripe blocks live
   Connect until this is filled in.
3. Per restaurant, the owner completes Stripe-hosted onboarding: legal entity,
   SIRET, an ID document for each beneficial owner, and the **IBAN for payouts**.
   Expect the ID document to be the step that stalls.
4. Watch `charges_enabled` and `payouts_enabled` on `account.updated`. Both must
   be true. `details_submitted: true` with `charges_enabled: false` means Stripe
   is still reviewing, or has asked for something more — read
   `requirements.currently_due` and surface it in the admin.
5. Note the **onboarding link expires**, and so does our CSRF state. See the
   caveat below.

> **The state TTL is now per provider.** `oauthState.ts` keeps
> `DEFAULT_STATE_TTL_MS = 10 min` for the Uber Eats and SumUp consent screens,
> which are one click, and gives Stripe `STRIPE_STATE_TTL_MS = 45 min` — enough
> for a KYC form with a document upload and a pause to find a bank statement.
> The TTL is selected server-side from the provider; a caller cannot pass its
> own. Before that, an owner who took longer than ten minutes was bounced with
> "Invalid or expired OAuth state" and had to restart from the admin, minting a
> **new** connected account and orphaning the previous one. If onboarding still
> times out in practice, raise `STRIPE_STATE_TTL_MS`, not the default.

## 5. Verification checklist

Do this in **live mode**, on a real account. Test mode will not catch a
platform-key fallback, because the platform key works there too.

- [ ] `npx convex env list` on the target deployment shows
      `STRIPE_CONNECT_WEBHOOK_SECRET`, and it is **not** the same value as
      `STRIPE_WEBHOOK_SECRET`. Identical values means the endpoint was created
      without `connect: true` and you are looking at the wrong one.
- [ ] Onboard one real restaurant end to end. `paymentConnections` holds its
      `acct_` id, and the admin shows it connected.
- [ ] **Take a 1 € live charge on that restaurant's storefront. Then confirm the
      euro is in the CONNECTED account's balance, not the platform's.** Open the
      connected account in the Stripe dashboard (Connect → Accounts → the
      account → Payments) and find the payment there. Finding it only under the
      platform's own Payments is the failure this whole runbook is about — the
      charge fell back to the platform key.
- [ ] The charge's `application_fee_amount` (direct) or `transfer_data`
      (destination) matches the agreed commercial terms. Zero fee where a fee
      was intended is silent revenue loss.
- [ ] Refund that 1 €. It comes off the **connected** account's balance.
- [ ] Trigger `account.updated` (toggle something in the connected account) and
      confirm the Connect endpoint received it — Stripe dashboard → Webhooks →
      the Connect endpoint → recent deliveries, 200.
- [ ] Deauthorize the platform from the connected account's dashboard. Confirm
      `account.application.deauthorized` arrives and the storefront **stops
      offering card payment** rather than charging the platform.
- [ ] With `paymentConnections` empty, checkout **refuses** card payment. If it
      still charges, the platform-key fallback is still in place and every step
      above proved nothing.
- [ ] Payout lands in the restaurant's IBAN on the expected schedule.

## What is deliberately not in this file

The charge-path rewiring itself. It depends on decisions 1 and 2, it touches
`apps/*/convex/stripe.ts`, `stripeWebhook*.ts` and `payments.ts`, and none of it
can be verified without a live Stripe account with Connect enabled — there is
none in this repo's environment. Writing it blind and marking it done is how the
"connected" badge got there in the first place.

## Reference

- Connect account types: <https://docs.stripe.com/connect/accounts>
- Direct vs destination charges: <https://docs.stripe.com/connect/charges>
- Connect webhooks: <https://docs.stripe.com/connect/webhooks>
- Account Links: <https://docs.stripe.com/api/account_links>
