# Payments Guide

> Accept payments via Stripe, SumUp, PayPal and cash.

> [!IMPORTANT]
> **Payments are not in `@be-in-digital/core`.** That package holds `auth/`,
> `aws/`, `env/`, `i18n/` and `sentry/` — there is no `payments/` directory and
> never was. The engine's payment code is a set of Convex functions:
> `packages/convex-functions/src/` (`payments.ts`, `paymentSettlement.ts`,
> `refundPolicy.ts`, `stripeChargeRouting.ts`) plus the provider actions each app
> keeps in its own `convex/` folder. This guide describes those.

## Table of Contents

- [Overview](#overview)
- [How a payment is wired](#how-a-payment-is-wired)
- [Stripe](#stripe)
- [SumUp](#sumup)
- [PayPal](#paypal)
- [Square](#square)
- [Cash Payments](#cash-payments)
- [Refunds](#refunds)

## Overview

BeYours supports multiple payment providers. Each restaurant can enable the providers they need.

| Provider | Online | In-Person | Subscriptions | Notes |
|----------|--------|-----------|---------------|-------|
| Stripe | Yes | No | Yes | |
| SumUp | No | Yes | No | OAuth-connected, not an API key |
| PayPal | Yes | No | No | |
| Square | — | — | — | *(announced, not implemented)* |
| Cash | No | Yes | No | |

## How a payment is wired

Three layers, and the split matters:

| Layer | Where | What it is |
|-------|-------|------------|
| Decisions | `packages/convex-functions/src/` | Pure functions and plain `{ args, handler }` objects — no SDK, no network |
| Provider calls | each app's `convex/stripe.ts`, `convex/sumup.ts`, `convex/paypal.ts` | `"use node"` Convex actions that talk to the provider |
| Wrappers | each app's `convex/payments.ts` | Wraps the package definitions in `storeQuery` / `storeMutation` / `internalMutation` with a permission |

The package exports **definitions**, not Convex functions — a `{ args, handler }`
object cannot be called from a client. The app decides the permission and the
visibility:

```typescript
// convex/payments.ts (in the app)
import * as defs from "@be-in-digital/convex-functions/payments";

export const getByOrder = storeQuery({
  permission: "payments:read",
  args: defs.getByOrder.args,
  handler: (ctx, args) => defs.getByOrder.handler(ctx, args),
});

// The settlement path is internal: only actions and webhooks may call it.
export const internalSettle = internalMutation(defs.settlePayment);
```

Available definitions in `@be-in-digital/convex-functions/payments`:
`getByOrder`, `getByStore`, `getById`, `create`, `settlePayment`, `updateStatus`,
`reserveRefund`, `confirmRefund`, `releaseRefund`, `attachCheckoutSession`,
`listStrandedCheckouts`, `settleFromChargeEvent`, `recordProviderRefund`.

### Settlement is deduplicated, not created twice

Never insert a payment row directly from a provider callback. Use
`settlePayment` (exposed as `internalSettle`): it looks the charge up by the
single-field `by_externalId` index, returns the existing row if the charge
already settled this order, and refuses the charge outright if it settled a
*different* order. Two writers race for every Stripe charge — the return page and
the webhook — and before this existed both inserted, leaving one 48 € charge with
two `succeeded` rows and 96 € refundable.

The amount is bound to the order before anything is marked paid:

```typescript
import { assertSettlesOrder } from "@be-in-digital/convex-functions/paymentSettlement";
```

## Stripe

### Setup

```env
STRIPE_SECRET_KEY=sk_live_...
STRIPE_PUBLISHABLE_KEY=pk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
```

All three or none — they are one feature group in `siteEnvSchema`, read through
`getSiteEnv()` from `@be-in-digital/core/env`.

### Create a Checkout Session

Stripe's **hosted** Checkout page, not Payment Elements. The action reads the
amount from the order server-side; the caller only names the order.

```typescript
// convex/stripe.ts — a "use node" action
export const createCheckoutSession = action({
  args: {
    orderId: v.id("orders"),
    successUrl: v.string(),
    cancelUrl: v.string(),
  },
  handler: async (ctx, args): Promise<{ sessionUrl: string; sessionId: string }> => {
    // ...creates the session, then remembers it against the order:
    await ctx.runMutation(internal.payments.internalAttachCheckoutSession, {
      orderId: args.orderId,
      checkoutSessionId: session.id,
    });
  },
});
```

The session id is stored on purpose: a customer who paid and closed the tab used
to leave a paid Stripe charge, an order at `paymentStatus: "pending"` and no way
to ask Stripe what happened. `reconcilePendingCheckouts` reads it back.

### Frontend Checkout

The storefront calls the action and redirects — there is no Stripe SDK on the
client:

```tsx
import { useAction } from "convex/react";
import { api } from "@/convex/_generated/api";

const createStripeSession = useAction(api.stripe.createCheckoutSession);

const { sessionUrl } = await createStripeSession({
  orderId,
  successUrl: `${origin}/order/confirmation`,
  cancelUrl: `${origin}/checkout`,
});
window.location.href = sessionUrl;
```

On return, the confirmation page calls `api.stripe.verifyCheckoutSession` with
the `session_id` Stripe appended. That path settles the payment if the webhook
has not already.

### Webhook Handler

The webhook is a **Convex HTTP action**, not a Next.js route. Point the Stripe
dashboard at `CONVEX_SITE_URL/webhooks/stripe`; the old
`/api/webhooks/*` tombstones were removed on 2026-07-18.

```typescript
// convex/http.ts
import { handleWebhook as stripePaymentWebhook } from "./stripeWebhook";

http.route({
  path: "/webhooks/stripe",
  method: "POST",
  handler: stripePaymentWebhook,
});
```

`stripeWebhook.handleWebhook` handles five event types. Only
`checkout.session.completed` carries our `metadata.orderId`; the other four
resolve through `payments.externalId`, the payment intent stored when the charge
was first settled. Signature verification is delegated to a Node action
(`stripeWebhookVerify`) because an `httpAction` cannot use `"use node"`.

## SumUp

For in-person card terminal payments. SumUp is connected over **OAuth**
(`SUMUP_CLIENT_ID` / `SUMUP_CLIENT_SECRET`, callback at
`CONVEX_SITE_URL/connect/sumup/callback`) — there is no `SUMUP_API_KEY`.

```tsx
const createSumUpCheckout = useAction(api.sumup.createCheckout);

const checkout = await createSumUpCheckout({
  orderId,
  redirectUrl: `${origin}/order/confirmation`,
});
// then, after the widget completes:
await verifyCheckout({ checkoutId: checkout.checkoutId, orderId });
```

## PayPal

`PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`, and `PAYPAL_SANDBOX_MODE` — which is
required at boot as soon as PayPal is configured, and resolves to **sandbox**
when unset, never to production.

```tsx
const createPayPalOrder = useAction(api.paypal.createPayPalOrder);

const { approvalUrl } = await createPayPalOrder({
  orderId,
  returnUrl: `${origin}/order/confirmation`,
  cancelUrl: `${origin}/checkout`,
});

// After the customer approves, on the return page:
await capturePayPalOrder({ paypalOrderId, orderId });
```

## Square

**Not implemented.** There is no Square integration: no SDK, no credential is
read anywhere, no checkout and no webhook. The only executable code that names
Square is the one that refuses it —
`packages/convex-functions/src/refundPolicy.ts` returns
`{ kind: "unsupported", provider: "square" }`, and `RefundRoute`'s `api` variant
excludes it at the type level.

Square is presented as forthcoming in the admin (Paramètres → Paiements) and in
the guided tour. Do not describe it as available, and do not add a
`SQUARE_ACCESS_TOKEN` to any environment: nothing reads it.

## Cash Payments

Cash payments are tracked in the system without external processing:

```typescript
await createOrder({
  ...orderData,
  paymentMethod: "cash",
  paymentStatus: "pending", // Marked "paid" when cash is collected
});
```

## Refunds

There is no `processRefund` free function. A refund is an **action** —
`api.payments.refundPayment` — because it has to authorise, call a provider and
record the outcome, in that order.

```tsx
const refundPayment = useAction(api.payments.refundPayment);

const { refundedAmount, isFullRefund } = await refundPayment({
  id: paymentId,
  amount: 1299,           // cents; partial refunds allowed
  reason: "customer_request",
});
```

The decisions behind it are pure and live in
`@be-in-digital/convex-functions/refundPolicy`:

```typescript
import {
  planRefund,
  routeRefund,
  RefundRejectedError,
  type RefundPlan,
  type RefundRoute,
} from "@be-in-digital/convex-functions/refundPolicy";
```

- **`planRefund({ payment, amount })`** validates and returns the state the
  refund should leave behind. It throws `RefundRejectedError` with a `reason` of
  `not_settled`, `amount_not_positive` or `exceeds_balance` — a refused refund is
  an event the operator must see, not a silent no-op. Only `succeeded` and
  `partially_refunded` payments are refundable.
- **`routeRefund(payment)`** decides *how*: `{ kind: "api" }` for Stripe, SumUp
  and PayPal with a stored `externalId`; `{ kind: "manual" }` for cash, handed
  back at the counter; `{ kind: "unsupported" }` for Square or for a payment with
  no transaction reference. `unsupported` must surface its `reason` and record
  nothing.

The action's order is deliberate: **reserve, then call the provider, then
confirm**. `reserveRefund` commits the amount inside a Convex transaction, which
is the serialisation point — the second of two concurrent refunds reads the
first's committed amount and is refused before any money leaves. If the provider
then refuses, `releaseRefund` gives the amount back, so the restaurant can retry
instead of seeing a balance that claims the money already went out.
`confirmRefund` attaches the provider's reference to *that* refund entry, so a
second partial refund cannot erase the proof of the first.

Refunds and chargebacks issued from a provider's own dashboard arrive by webhook
and go through `recordProviderRefund`, so the refundable balance the admin shows
matches the money actually left.

## Best Practices

1. **Always validate amounts server-side** — the actions read the total from the
   order; never accept an amount from the caller
2. **Use webhooks** — don't rely on client-side payment confirmation
3. **Settle through `settlePayment`** — never insert a payment row directly, or
   the return page and the webhook will each write one
4. **Never record a refund the provider did not confirm** — that is the entire
   point of `refundPolicy.ts`
5. **Test with test keys** — use Stripe test mode, and PayPal sandbox, during
   development
