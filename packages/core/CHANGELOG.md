# @be-in-digital/core

## 2.3.0

### Minor Changes

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

## 2.2.0

### Minor Changes

- 3178b2d: Harden `POST /api/email/send` so the body cannot choose where a link points.

  This route sends from the restaurant's SES-verified domain, so anything it will
  put in front of a recipient is signed by the client's own brand. Three things
  were wrong with that:
  - **Links came from the request body, unchecked.** `resetLink` and
    `dashboardLink` were validated by `z.string().url()`, which is as happy with
    `https://evil.example/harvest` as with the real thing. Verified against the
    pre-fix handler: it returned 200 and the attacker's host was in the rendered
    "Reset my password" button. Both links are now required to share an origin
    with `linkOrigin` (normally `SITE_URL`), falling back to the request's own
    origin when the config omits it.
  - **An unusable secret weakened the route instead of closing it.**
    `timingSafeEqual` over two EMPTY buffers returns `true`, so a secret of `''`
    matched an empty token. A secret under `MIN_EMAIL_API_SECRET_BYTES` (32) now
    disables the route: every request gets 503 and a log naming what to set,
    rather than an authentication check that can be satisfied by nothing. The
    comparison also digests both operands first, so it no longer returns early on
    a length mismatch — which leaked the secret's length.
  - **The mail relay shared the session-signing key.** `EMAIL_API_SECRET` is now
    read and declared, with `BETTER_AUTH_SECRET` kept as a transitional fallback
    on both the route and the caller so existing deployments keep sending. Set it
    on the Next env _and_ the Convex deployment — they are two halves of one
    handshake.

  `EmailRouteConfig` gains an optional `linkOrigin`. Callers that pass nothing
  keep working and get the request-origin behaviour.

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

## 2.1.0

### Minor Changes

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

- 7e727ff: Serve every folder the product uploads to

  The bucket is private and `/api/files` is the only read path, so the proxy's
  allowlist decides whether an uploaded object is reachable at all. That allowlist
  derived from `ALLOWED_MIME_TYPES` (6 folders) while `convex/storageUpload.ts`
  accepted 10. Uploads to `categories`, `blogs`, `blog-auto`, `storefront` and
  `avatars` therefore succeeded, stored a `/api/files/<key>` URL, and that URL
  returned 404 — the object was written and then unreachable. Category images in
  the admin were the visible case.
  - New `@be-in-digital/core/aws/folders` holds `S3_FOLDERS` and
    `isKnownS3Folder`. Like `aws/media-url`, it has no imports, so Convex actions
    can use it without pulling the package into their bundle.
  - `S3Folder` now covers all eleven folders, and `ALLOWED_MIME_TYPES` and
    `MAX_FILE_SIZES` describe each one. `/api/files` picks the additions up
    automatically, since it derives `SERVABLE_FOLDERS` from that table.
  - `convex/storageUpload.ts` and `/api/upload` derive their allowlists from the
    shared list instead of restating it, so the three cannot drift apart again.
    `/api/upload` previously rejected `email` and `categories` outright.

## 2.0.2

### Patch Changes

- 7f0122b: Republished from main. Fixes two problems with the 2.0.1 tarballs that broke consumers:
  - `@be-in-digital/core`: the `./auth/rbac` subpath pointed at `src/auth/rbac.ts` while the tarball only ships `dist/` → broken import for consumers (`convex-functions/auth` included). `files` now includes `src`.
  - The type fixes that were on main but never published (promotion-form/email-config in admin, Uber Eats signatures in integrations/convex-functions) go out with this patch — they had been committed without a changeset.

## 2.0.1

### Patch Changes

- 1a5ca27: Rename package scope from @beindigital-engine to @be-in-digital for GitHub Packages compatibility

## 2.0.0

### Major Changes

- 7c3d4da: Configure private npm publishing for all @beindigital-engine packages

  ### What changed
  - Packages are now publishable to npm as private (restricted) packages under the `@beindigital-engine` scope.
  - Removed `"private": true` flag from all packages and replaced with `"publishConfig": { "access": "restricted" }`.
  - Added `"files"` field to control published contents.

  ### Why

  First official release of all packages on the npm private registry for distribution.

  ### How to install

  ```bash
  npm login --scope=@beindigital-engine
  pnpm add @be-in-digital/core @be-in-digital/ui @be-in-digital/restaurant
  ```

## 1.0.0

### Major Changes

- ad4d8d2: Configure private npm publishing for all @beindigital-engine packages

  ### What changed
  - Packages are now publishable to npm as private (restricted) packages under the `@beindigital-engine` scope.
  - Removed `"private": true` flag from all packages and replaced with `"publishConfig": { "access": "restricted" }`.
  - Added `"files"` field to control published contents.

  ### Why

  First official release of all packages on the npm private registry for distribution.

  ### How to install

  ```bash
  npm login --scope=@beindigital-engine
  pnpm add @be-in-digital/core @be-in-digital/ui @be-in-digital/restaurant
  ```
