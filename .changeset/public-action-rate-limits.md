---
"@be-in-digital/convex-functions": minor
---

Bound the public actions that call a paid third party.

Every public-by-design *mutation* was rate-limited and every public-by-design
**action** was not — not an oversight in one handler, a consequence of how the
limiter is built: `consumeRateLimit` reads and writes the `rateLimits` table,
deliberately in the same transaction as the write it protects, and an action
has no `ctx.db` at all. So the bound could not be written where those callers
are and was written nowhere.

Adds `paymentSessionPerOrder` and `deliveryQuotePerStore` to `RATE_LIMITS`.
The apps consume them through a new `rateLimits.consume` internal mutation.
