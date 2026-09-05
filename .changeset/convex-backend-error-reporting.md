---
"@be-in-digital/core": minor
---

Report Convex backend errors to the client's Sentry project

The Next.js half of a client site has reported to Sentry for a while. The Convex
half reported nothing, and `apps/docs/deployment/sentry.md` said so: *"Backend
functions run outside Next and report nothing here."* Every Stripe, Deliveroo,
Uber Eats and SES webhook runs there, along with every order mutation and the
whole kitchen path, and the only trace of a failure in any of them was one of
112 `console.error` calls landing in the dashboard of ONE client's deployment.
With one deployment per client, a Saturday-night order that failed inside Convex
was seen by nobody, and finding it meant opening each client's console in turn —
while the maintenance contract sells support.

`@be-in-digital/core/sentry` gains the pieces a Convex module needs to report
without an SDK: `parseSentryDsn`, `buildSentryErrorEvent`, `buildSentryEnvelope`,
`describeUnknownError`, `redactSentryExtra` and a `'convex'` member on
`SentryRuntime`, which reads `SENTRY_DSN` from the Convex environment store
(falling back to `NEXT_PUBLIC_SENTRY_DSN`). The envelope is written out by hand
because a Convex module is not a Node program — the default runtime is a V8
isolate with `fetch` and no Node API, and moving the reporting into a
`"use node"` action would put it behind a boundary no `httpAction` can cross,
which is every webhook.

Two behaviours change for existing consumers:

- `isSentryDsn` is now defined as "`parseSentryDsn` can read it" rather than as a
  separate regex. The two disagreed while they were written apart:
  `https://:pass@host/4505` passed the gate and failed the parser, so the browser
  SDK would have initialised on a DSN the backend could not use.
- `scrubSentryEvent` is unchanged, but context objects now go through
  `redactSentryExtra`, which matches its own key list — `code` and `key` are
  credentials in a query string and ordinary words in an object, so
  `statusCode` and `idempotencyKey` are no longer filtered while
  `stripe_signature_header` and `x-api-key` now are.
