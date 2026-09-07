---
"@be-in-digital/convex-functions": minor
---

Stop one order being collected twice, in cash and by card

**A live Stripe session settled an order the counter had already taken in cash
(#378).** Reproduced end to end, not read: the diner submits with card, presses
Back and confirms « Espèces » on the same checkout attempt — since #374 the
reused order is re-methoded to cash, which is the point of that fix — staff take
the notes, and the Stripe session left behind the tab stays payable for ~24 h.
Completing it collected the same meal a second time:

```
PROBE payments: [
 { "provider": "cash",   "amount": 1200, "status": "succeeded" },
 { "provider": "stripe", "amount": 1200, "status": "succeeded" }
]
PROBE order total: 1200 collected: 2400
```

Nothing refused it and nothing flagged it. Each piece was right on its own.
`assertSettlesOrder` binds identity, currency and amount — and all three match,
because it genuinely is this order at this total. `paymentStatusAfterSettlement`
answers `null` for an order already paid, so the order looked untouched.
`settlePayment` deduplicates on `externalId`, and a cash row carries none, so
the two could never collide. The order read « Payé » while both rows sat there
independently refundable.

**The guard grows a fourth check.** `OrderToSettle` now carries the order's
`paymentMethod` and `paymentStatus`, and `assertSettlesOrder` refuses a
settlement whose provider is not the method the order was collected through —
new reason `method_mismatch`. It is deliberately about the method in force at
settlement time, not about ordering: the check needs money to have *already*
moved, so a card payment arriving first settles exactly as it always did, a
replayed webhook on the order it itself paid still passes (throwing there is a
500 answered with three days of Stripe retries), and an order carrying no method
— every Uber Eats and Deliveroo order — is waved through rather than refused on
evidence the guard does not have.

**And the ledger states the same rule where it cannot be stepped around.**
`settlePayment` refuses to insert a second `succeeded` row for an order another
provider already holds money for. Five call sites remember to ask the guard; the
sixth written next year would not have to.

**The real fix is that the second charge is never taken.** A refusal happens
after the diner's card has been debited. So the session is expired at the moment
the order stops being a card order: `abandonedCheckoutSession` hands the id to
`orders.create`'s wrapper, which schedules `stripe.expireCheckoutSession`. The
id stays *on* the order deliberately — it is the only pointer
`reconcilePendingCheckouts` has, and the one case where the expiry fails is a
session Stripe refuses to expire because it has already been paid, which is
exactly when that pointer is what recovers the money.

Probes, each proven red against the code it fixes: the cash-then-card replay
ends with one `succeeded` row and the second refused; the guard-skipped call
into `settlePayment` is refused too. Four companion probes prove the guard
cannot be satisfied by refusing everything — a card payment arriving first, a
replayed Stripe delivery, either card provider on a card order, and a
cash-labelled order nothing has collected yet all still settle. 16 new cases
across `paymentSettlement.test.ts` and both apps' `payment-dedup.test.ts`.

Closes #378.
