---
"@be-in-digital/convex-functions": minor
"@be-in-digital/restaurant": minor
---

Let a diner change their mind about how to pay, and stop offering them a card nobody can charge

**A failed card attempt retried as cash stranded the order for good (#374).**
`orders.create`'s idempotent branch reused the existing order on the same
attempt key and ignored that the retry carried a different `paymentMethod`.
Measured end state on a live bench, after the exact journey a fresh deployment
invites — card pre-selected, no card provider configured, retry as Espèces:

```
paymentMethod:"card" | paymentStatus:"pending" | status:"confirmed" | tableNumber:"12"
kitchenTickets: empty
```

Every unit suite was green the whole time. Each piece was correct in
isolation: idempotence refused a duplicate order (#161), `releaseToKitchen`
refused an unpaid card order (anti-abandon, #136), and « Encaisser en
espèces » only shows for cash orders. Composed, they made a confirmed,
accepted order that no button anywhere could settle or cook, while the diner
sat at table 12.

The idempotent hit now patches the reused order's method when the retry
differs AND the payment is still `pending` — the diner's last confirmed
choice is the truth — and `createWithTicket`'s release call re-applies the
method-dependent release rule, so the switched-to-cash order reaches the pass
the way a cash-first order always did. Two boundaries hold it, both demanded
by adversarial review: an order whose payment has progressed past pending is
never re-methoded (the stored method describes what actually happened), and
neither is an order the kitchen has already been fed — a stale tab retrying a
released cash order as card would have rebuilt the same strand in the other
direction. Idempotence itself is untouched — one order, ever.

**Defence in depth: the checkout no longer pre-selects a tile the deployment
cannot serve.** `payments.cardProvider` declares WHICH provider, never
WHETHER it works, and the signal that decides — the Stripe platform key, the
SumUp connection row — never reached the storefront. So `useState("card")`
landed every diner on the dead tile, and a second inline fallback resolved to
card too. Both rules moved into one pure `resolvePaymentMethod`
(`@be-in-digital/restaurant`), fed by a new `paymentAvailability.get` query
(def in `@be-in-digital/convex-functions/globalSettings`, mounted by both
apps) that answers a single boolean and mirrors exactly the checks the
charge-starting actions make — including `getSiteEnv()`'s `sk_` validation,
so a pasted publishable key reads as unavailable instead of arming a tile in
front of a redacted crash. Card unavailable: the tile renders disabled with
« Indisponible pour le moment », the diner lands on the first servable tile,
and a deployment that can serve nothing disables submit instead of sending a
doomed attempt.

**And when a card attempt still fails because nothing is configured, the
diner is told that.** The provider actions threw plain `Error`s
("STRIPE_SECRET_KEY is not configured", "SumUp is not connected"), which
production redacts to "Server Error" — so the checkout showed its generic
retry toast for a payment that could never work, on the very tile it had
pre-selected. New `CardPaymentUnavailableError` in
`@be-in-digital/convex-functions/refusal` joins the `RefusalError` family:
« Le paiement par carte est indisponible pour le moment. Choisissez un autre
moyen de paiement. » crosses the wire like every other checkout refusal. The
staff-facing paths (verify, refund, reconcile) keep their plain errors — their
reader is a log, not a diner.

Held by tests that cross the seam the green suites never did:
`orders.test.ts` replays the card-then-cash retry against
`createWithTicket` and pins the never-past-pending guard;
`order-lifecycle.test.ts` in both apps drives the full journey through the
real schema to `markCashPaid` and exactly one ticket;
`checkout-refusals.test.ts` in both apps proves the refusal reaches the
browser readable; `payment-method-selection.test.ts` pins the no-preselect
rule; and `checkout-payment-preselect.test.tsx` in both apps mounts the real
form and pins the wiring.
