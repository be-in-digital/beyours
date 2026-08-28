# @be-in-digital/mcp-server

## 1.0.3

### Patch Changes

- e13cd4e: Sentry is wired, and every client site reports to its own project.

  `NEXT_PUBLIC_SENTRY_DSN` was in the schema and in both `.env.example` files.
  `@sentry/nextjs` was in no `package.json`, `packages/core` exported a
  `createSentryConfig()` nothing called, and no app had an error boundary. An
  operator filled the DSN in, saw no error, and believed monitoring was live — so
  a Saturday-night checkout failure was seen by nobody. Shipping the variable
  without the integration buys the confidence without the coverage.

  New `@be-in-digital/core/sentry` resolves the `Sentry.init` options for the
  three runtimes:
  - `resolveSentryOptions(runtime, env?)` returns `null` when the DSN is unset,
    empty, or is not a DSN — a project-page URL pasted instead of the client key
    passes the schema's `.url()` and is refused here, with a warning naming the
    variable. Every call site skips `Sentry.init` on `null`, so a deployment
    without a Sentry project pays nothing: no transport, no breadcrumb buffer.
  - `environment` resolves `NEXT_PUBLIC_SENTRY_ENVIRONMENT` → `VERCEL_ENV` →
    `NODE_ENV`, which keeps a client's preview deploys out of its production
    issues with no configuration on Vercel.
  - `tracesSampleRate` defaults to **0.1 in production**, 1.0 elsewhere. At 1.0 a
    busy restaurant spends its free-tier quota on traces and Sentry drops the
    overflow, so a 100% rate records _less_ than 10%. Override per client with
    `NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE`.
  - `sendDefaultPii` is `false` and not configurable. That flag is not enough on
    its own: verified against a live SDK, a server event still carried
    `cookie: session=…` and `authorization: Bearer …` in `request.headers`, since
    the flag governs IP and user attribution rather than headers. So
    `scrubSentryEvent` runs as both `beforeSend` and `beforeSendTransaction` —
    headers filtered to an allowlist, `request.cookies` emptied, and sensitive
    query values redacted out of `request.url` and `request.query_string`
    (`/reset-password?token=…` is a live password reset; `/order/<id>?token=…`
    opens one customer's order).
  - Events carry a `site` tag (the host of `NEXT_PUBLIC_SITE_URL`) and a
    `runtime` tag, so two deployments sharing a DSN by accident stay
    distinguishable instead of merging.

  The module has no imports — not even `@sentry/nextjs` — so the browser bundle,
  the edge runtime and Convex actions can all read it, and it is unit-tested
  without a process environment. It replaces the unused `createSentryConfig`,
  `defaultSentryConfig` and `SentryConfig` exports, which had no call site
  anywhere in the workspace.

  Four variables are newly declared, and `SENTRY_ORG` / `SENTRY_PROJECT` /
  `SENTRY_AUTH_TOKEN` become a `SITE_FEATURE_GROUPS` entry: half a source-map
  upload uploads nothing and leaves every production stack trace minified. The
  DSN is deliberately **not** in that group — a DSN on its own is a complete,
  working configuration.

## 1.0.2

### Patch Changes

- 3a25d85: The environment fail-fast now validates what a deployment cannot run without.

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

## 1.0.1

### Patch Changes

- 7f0122b: Republished from main. Fixes two problems with the 2.0.1 tarballs that broke consumers:
  - `@be-in-digital/core`: the `./auth/rbac` subpath pointed at `src/auth/rbac.ts` while the tarball only ships `dist/` → broken import for consumers (`convex-functions/auth` included). `files` now includes `src`.
  - The type fixes that were on main but never published (promotion-form/email-config in admin, Uber Eats signatures in integrations/convex-functions) go out with this patch — they had been committed without a changeset.
