---
"@be-in-digital/convex-functions": patch
---

Cap the rate-limit subject where no caller can forget it

`FIELD_LIMITS.subject` was declared at 200 and nothing on this path applied it.
`rateLimits.consume` is an internal mutation reached from public actions, and
`stripe.createCheckoutSession` passes `args.sessionId` straight through —
caller-controlled, reachable with no session at all. A 200 000-character subject
was accepted and became a `rateLimits.key` on the `by_key` **index**, which is
the same shape as the `fingerprint` hole the cap was written for. Bounded by the
daily purge, so a day's growth per attacker rather than unbounded.

The cap goes in `consumeRateLimit` rather than in the two app wrappers. Both
would work today; only one holds for the wrapper nobody has written yet, and a
limiter whose bound depends on every future caller remembering is the failure
this defect already is.

The refusal is `FieldTooLongError`, which every caller on this path already
surfaces.

`FIELD_LIMITS.subject` is now pinned by a test that writes **200** out rather
than importing the constant. Every existing length test is relative to it, so
raising it to 200 000 left all of them green — which is precisely how the
constant landed while the call site did not.
