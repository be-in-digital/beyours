# @be-in-digital/mcp-server

## 1.0.4

### Patch Changes

- ebdda7e: AWS is a site variable now: every client owns its AWS account.

  `AWS_REGION`, `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY` were package-level
  — one fleet-wide key, shipped to every deployment. `apps/themes/scripts/env.mjs`
  copies them into each client's Convex deployment, so any one client's backend
  could read and write every other client's media, and a departed client kept
  working credentials that nothing rotated.

  It also made a promise the product already sells undeliverable. The admin
  console tells the restaurant its site belongs to it and can be migrated to the
  team of its choice, and `maintenance.ts` accepts the scopes `assets` and
  `emails` — but the media sat in a bucket BeYours owned and the mail left an SES
  identity BeYours owned. The backup export says so outright: it carries
  references and URLs, not the objects.

  The three move into `siteEnvRequiredSchema`, still declared without `opt()`.
  The tier changed, not whether a deployment can boot without them: an empty value
  fails at startup exactly as before, and `validateAllEnv()` now reports a missing
  `AWS_REGION` under `'site'` rather than `'package'` — which is where an operator
  should go looking, since it is their own account.

  `getSESConfig()` reads them off `getSiteEnv()` instead of `getPackageEnv()`. The
  site reader is deliberately lenient and never throws, so the three arrive as
  `string | undefined`; the adapter names whichever is missing rather than handing
  `undefined` to the SDK, which would fail later with a signature error that says
  nothing about the cause.

  **Type change:** `PackageEnv` no longer carries the three AWS properties, and
  `packageEnvSchema` no longer requires them. Nothing in the workspace read AWS
  off `getPackageEnv()` except the SES adapter, but code outside it that does will
  stop compiling — read them off `getSiteEnv()`.

  `setup-aws.sh` (both copies) takes `SITE_SLUG` and `DOMAIN` and names the bucket,
  the IAM user, the policy and the SES configuration set for that client. With no
  `SITE_SLUG` it keeps the fleet-wide names unchanged, because those designate
  resources that already exist in the shared account and renaming them here renames
  nothing in AWS. Its preflight now prints the account it is about to provision
  into and refuses on an `EXPECTED_ACCOUNT_ID` mismatch — with per-client accounts,
  running against the wrong one is the new way to get this wrong.

  Two things this does not do: clients already on the shared bucket still have to
  be migrated, and SES production access is granted per AWS account, so each new
  client needs its own request. Start it early in onboarding — until it is granted,
  that restaurant sends no order confirmation and no password reset.

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
