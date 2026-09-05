---
"@beyours/site": patch
---

Run the checkout referral tests on a plan that is open for sale

`main` was red. CI's `Test` job failed on one task, `@beyours/site#test`, and had
since #350 — so every branch cut from `main` inherited a failing check.

#350 closed the Premium plan for sale, and `createCheckoutSession` refuses a
closed plan **before** any referral logic runs. `checkoutReferralIntegrity.test.ts`
pinned its fixture to Premium, so all 31 cases failed on the plan refusal rather
than on the discount arithmetic they exist to cover:

```
Error: L'offre Premium n'est pas encore ouverte à la vente…
Tests  25 failed | 6 passed (31)
```

The fixture now names the plan once and derives every amount from it.

**The founders offer had to be dealt with too, and it is why a fixture swap
alone did not fix this.** It zeroes the creation line for the first ten
Essentielle builds, and only when no referral applies — which is exactly the
state each "billed at list price" case is in, since the code under test was
refused. Those cases came back at the maintenance line alone, `100000` against
an expected `450000`. Asserting the founders figure would have been worse than
the failure: the case would still be handed a number, but it would be reading
the freebie rather than the absence of a discount. `sellOutFoundersSlots` sells
the ten slots out first, so list price means list price. It writes the rows
directly rather than through `orders.create`, which is rate-limited precisely to
stop ten cheap calls consuming the offer.

Verified the cases still discriminate rather than merely pass: with the
self-referral guard removed from `stripe.ts`, seven of them fail. The behaviour
under test is unchanged — only the plan the fixture buys.
