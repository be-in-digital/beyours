---
"@be-in-digital/convex-functions": minor
"@be-in-digital/admin": minor
---

Count only money that arrived, and stop a settled charge sitting at `pending`

Three defects on the money path, all of them a layer answering a question next
to the one it was asked.

**The dashboard counted orders nobody paid for.** `computeDashboardStats`
filtered on `status !== "cancelled"` — a test about orders being UNMADE,
standing in for one about orders being PAID — and `DashboardOrderRow` did not
carry `paymentStatus` at all, so the distinction was not available to be got
wrong; it was absent. An abandoned checkout, a declined card and a table whose
cash has not been rung up all counted in full. Measured on a probe store: the
card read 1 720,00 € against 20,00 € collected.

`revenue` is now money that arrived (`COLLECTED_PAYMENT_STATUSES`: `paid`,
`refund_pending`, `partially_refunded` — the states in which the till is
holding it). `orderCount` still means orders that happened, because that is
what an owner is asking when they look at « Commandes », and the difference is
reported as `uncollected` rather than left to be inferred. « Chiffre
d'affaires » now carries « dont X € en attente d'encaissement » when the two
disagree.

**A settled charge could sit at `pending` for ever.** `settlePayment` asked
whether a row for this charge EXISTED, not whether it was DONE, so a
`payment_intent.succeeded` landing on a placeholder row returned it untouched
while `settleByExternalReference` marked the ORDER paid. The result was « Payé »
over a `pending` payment row — which `planRefund` refuses permanently, and which
`collectionOnOrder` does not count, so a second collection was still allowed on
the same order. The row is now promoted in place (provider, amount and currency
taken from the settlement: a refund is issued against whatever `provider` says).
`LEDGERED_STATUSES` names the states that mean "already on the ledger" —
including `refunded`, so a replayed event cannot resurrect a refunded charge.

**A 100 % coupon produced an order no card could pay.**
`createCheckoutSession` sent `unit_amount: order.total` and asked nothing about
it; Stripe's EUR floor is 0,50 €, and the session create throws an SDK error
that Convex redacts to "Server Error" behind the checkout's generic retry
toast. The layers disagreed in both directions: `assertSettlesOrder` settles a
0 c order and `settlePayment` refuses to write a row for one.
`cardChargeFloor.ts` holds the rule — per-currency minimums, and `nothing_to_pay`
as its own refusal, because an order that owes nothing is not a small payment —
and the three card actions enforce it before calling a provider.
