---
"@be-in-digital/convex-functions": patch
---

Stop a public coupon lookup publishing the campaign's budget

`promotions.getByCouponCode` and `promotions.listActiveAuto` are public by design
— a coupon is applied before the diner has an account — and they returned the
**whole promotion row**. So a guessed code did not merely say "this exists": it
said `usageCount` against `maxTotalUsage`, which is how much of the campaign's
budget is left, plus the per-customer cap and the withdrawn BOGO product ids.
`listActiveAuto` needed no code at all and handed over every automatic campaign
the same way.

Both now return the RULE — what the storefront needs to preview the discount the
server will charge — and the budget collapsed to one boolean, `exhausted`. The
resolver reads that flag when it is present and the real counters when it is not,
so the server keeps the exact check and the storefront can still say « ce code
promo a atteint sa limite » without being told how big the campaign was.

`promotions.list`, the owner's own screen, is guarded with `marketing:read` and
still carries everything — it is their campaign.

**What this does not fix**, stated rather than implied: a public lookup is still
an existence oracle, so codes remain guessable one request at a time. A Convex
query cannot write and therefore cannot be rate-limited; closing that needs the
lookup to become a mutation or an action, which is a larger change than narrowing
a payload.
