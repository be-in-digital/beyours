---
"@be-in-digital/convex-functions": minor
"@be-in-digital/convex-schema": minor
"@be-in-digital/admin": patch
---

Close the second double-collection vector, and stop a correct refusal 500-looping

#378 closed cash-then-card: `assertSettlesOrder` refuses a card settlement on an
order the counter has already collected, because the order records WHICH method
it is on and the two differ. Two card sessions differ in nothing it can see.

A diner who opens checkout twice — a stale tab, a back-navigation, a retry —
left two live Stripe Checkout Sessions against one order. Both referenced that
order, that currency and that total, so the guard passed both; both were `card`,
so #378's method check did not separate them; and `settlePayment` deduplicated
on `externalId`, which two payment intents never share. Measured on the code as
it stood:

```
[PROBE] order total: 120000  collected: 240000
[PROBE] succeeded rows: 2
[PROBE] second session refused: false
```

A 1 200 € order collected 2 400 €, in two `succeeded` rows, each independently
refundable, with the order untouched and nothing anywhere saying so (#411).

**The ledger is where the rule now lives — for every writer, not four of them.**
`settlePayment`'s order-level check carried `p.provider !== args.provider`,
which read two Stripe charges as one collection. That clause is gone, and it
cannot come back: execution only reaches the check when `by_externalId` found no
row for THIS charge on THIS order, so every row still standing there belongs to
another charge, whoever minted it. Stating it inside `settlePayment` was not
enough either — the claim was that this made the invariant "a property of the
ledger rather than of five call sites remembering to ask a guard", and two other
writers reached the same table without asking anything: `orders.markCashPaid`
inserts a `succeeded` row directly, and `payments.create` + `payments.updateStatus`
is a public pair under `payments:write` that writes one in two steps. All three
now read `collectionOnOrder` from the new `paymentLedger` module.

`assertSettlesOrder` is unchanged and stays the fast pre-check: it is given one
claim and one order and no charges, so it cannot tell a redelivery from a second
session, and the two tests that describe it waving one through now say so.

**A refusal is not a failure, and the two need opposite answers.** The Stripe
webhook answered 500 to every throw. A settlement refusal is permanent —
retrying delivers the same answer — so Stripe retried for three days, each
attempt re-ran the guard to the same refusal, the delivery stayed
`processed: false` and was re-admitted as `in_flight` every time, and nobody was
told. It now answers 2xx, retires the delivery and RECORDS it: refusing the row
keeps the ledger honest but does not make the diner whole, because a provider
does not report a charge it did not take. `payment_collection_refused` is a new
`systemAuditLog` action, rendered in Dashboard → Système, naming the order, the
charge and the reason — the only place a human learns a refund is owed. It takes
its ids as strings on purpose: Convex validates arguments before a handler runs,
so a `v.id()` there would throw out of the very catch block whose contract is
"this can never fail its caller", straight back into the retry loop.

`deliberateSettlementRefusal` tells the two apart, and reads the error's `data`
rather than its class: Convex rebuilds a `ConvexError` across the mutation
boundary, so `instanceof` is false at exactly the call site that matters and
fails closed into the loop. Its code list is a `Record` over both reason unions,
so a ninth reason does not compile rather than silently reading as a failure.

The settlement is also written BEFORE the order status now. They are two
transactions, and writing the status first committed it where a refusal could
still follow — leaving an order reading « Payé » with no payment row against it.
That was survivable while every refusal answered 500 and the endpoint showed red
in Stripe's dashboard; a 200 makes it final and silent.

**And the second charge is no longer taken at all.** `createCheckoutSession`
overwrote the order's stored session id and told Stripe nothing about the old
one, which stays payable for about twenty-four hours. It now expires the
previous session before the replacement becomes payable, and READS the outcome:
Stripe reports "already paid" and "already expired" with the same error, and one
of those means the previous session has been completed with its settlement still
in flight — the order reads `pending`, so no status gate can see it, and a
replacement would collect the same meal twice. All three provider checkouts also
refuse outright to open a payment on an order already collected, reading both
the order's status (which counts `refunded`, so they agree with
`markCashPaid`: a refunded order is closed business) and the ledger (which
catches the window between a payment row being written and the status catching
up). The refusal is a `ConvexError` — `order_already_paid` — so the diner reads
« Cette commande a déjà été réglée » rather than being told to retry a payment
they have already made.

What this does NOT close, and the ledger is why it does not have to: an action
is four round trips with no transaction around them, so two checkouts genuinely
in flight at once can still open two sessions. They settle through
`settlePayment`, which is serializable — one succeeded row, the second refused
and recorded.

**A Stripe key the API rejects no longer arms the card tile.**
`cardPaymentAvailability` checked `STRIPE_SECRET_KEY.startsWith("sk_")`, which
is a check on the shape of a string: a key that is revoked, rolled or from
another account all passed it, so the tile was pre-selected and the
`StripeAuthenticationError` thrown by `sessions.create` reached the diner as the
redacted "Server Error" #374 was written to remove. Only Stripe can answer
whether a key works and a query cannot ask it, so the verdict is recorded when
it is learnt — in the new `cardProviderHealth` table, written by the hourly
`stripe.verifyStripeKey` and by every checkout that succeeds or is refused — and
read back by the availability query.

Its own table for two reasons, both learnt the hard way from putting it on
`globalSettings` first: that document is read by a PUBLIC query before any
sign-in, and a provider's refusal message names the key's mode and last four
characters; and it is created by exactly one thing, the owner pressing
Enregistrer, so a deployment whose owner has never opened that screen — a fresh
one, which is what #374 is about — had nothing to write a verdict onto and the
fix was inert. The row is written only when the verdict moves, because it is
read on the order path and Convex conflicts a write with every concurrent
transaction that read it. Hourly rather than nightly because the cron is the
only writer that can bring the tile BACK: once a verdict disarms it, no diner
can reach the checkout that would report the key working again.

A credentials refusal, and only that: a declined card, a rate limit or an outage
say nothing about the key, and disarming the tile over one would take card
payments away from a working establishment.
