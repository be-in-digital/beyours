---
"@be-in-digital/core": minor
"@be-in-digital/mcp-server": patch
---

The environment fail-fast now validates what a deployment cannot run without.

Every one of the 28 `siteEnvSchema` fields was optional, and `opt()` mapped `''`
to `undefined` — so a `.env.example` copied and left unfilled validated clean.
The site booted printing "All environment variables validated successfully" and
then failed at the restaurant one feature at a time: Stripe not configured, no
encryption key, no S3 bucket, password reset silently returning early.

`siteEnvSchema` splits into three:

- `siteEnvRequiredSchema` — the seven a deployment cannot boot without
  (`NEXT_PUBLIC_CONVEX_URL`, `CONVEX_SITE_URL`, `SITE_URL`, `BETTER_AUTH_SECRET`
  now at least 32 characters, `ENCRYPTION_KEY`, `AWS_S3_BUCKET_NAME`,
  `AWS_SES_FROM_EMAIL`). Declared without `opt()`, so
  an empty value fails exactly like a missing one.
- `siteEnvOptionalSchema` — the rest, refined by `SITE_FEATURE_GROUPS`:
  set one variable of Stripe, PayPal, SumUp or BeYours billing and the whole
  group becomes required. Half a payment provider fails at the till, not at boot.
- `siteEnvSchema` — a deliberately lenient reader, unchanged in behaviour, and
  still what `getSiteEnv()` parses. It runs inside Convex actions holding only a
  subset of the variables, so tightening it would turn a configuration problem
  into a failed customer order.

Thirteen variables the runtime reads were absent from every schema and are now
declared, `ADMIN_BOOTSTRAP_TOKEN`, `NEXT_PUBLIC_SITE_URL` and `BID_APP_URL`
among them.

`validateAllEnv()` reports each problem under `'package' | 'site' | 'feature'`
and names an unset variable as unset rather than as a type error.
