---
"@be-in-digital/convex-functions": minor
"@be-in-digital/convex-schema": minor
---

Let every card provider be asked what became of a checkout.

Only Stripe could. A diner who paid with SumUp, or approved with PayPal, and
closed the tab before the redirect completed left the charge with the provider,
the order at `pending` and the kitchen blind — permanently, because no path in
the product ever asked again.

`orders.providerCheckoutRef` carries the reference and the provider it belongs
to; `listStrandedCheckouts` takes a `provider` and only ever returns a reference
to the provider that issued it, falling back to `stripeCheckoutSessionId` for
orders written before this existed.
