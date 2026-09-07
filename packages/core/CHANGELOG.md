# @be-in-digital/core

## 2.5.0

### Minor Changes

- 16521f2: Fix the diner's broken first-day moments

  Five defects a client meets on their first day of service (#376). Each was
  reproduced with a throwaway probe before being touched, and each leaves a
  permanent test behind in the package that owns the behaviour.

  **1. The storefront had no way to declare an allergy.** The whole pipeline
  existed except the input: `orders.create` takes `notes`, the order carries it,
  `releaseToKitchen` copies it onto the ticket, and the printed slip has a line
  for it. `grep -c notes checkout-form.tsx` answered 0, byte-identically in both
  apps, so the line was forever blank. The checkout now carries an
  « Allergies & instructions » field, capped by `FIELD_LIMITS.orderNote` — read
  from the server, so the input and the mutation cannot disagree. Two things the
  note reached only halfway are fixed with it: the printed slip announced it as
  « Instructions livraison: » even on a dine-in ticket, and the kitchen _screen_
  never showed it at all, so a kitchen working off the display — which is the
  display this product ships — could not see it.

  **2. Product creation dead-ended in silence when « Sélections max » was left
  empty.** `maxSelections` was the one number on the form not wrapped in the
  file's own `optionalNumber` guard, so `valueAsNumber` turned an empty box into
  NaN, zod refused it, react-hook-form blocked the submit of the whole product,
  and nothing on screen said which field was at fault. The schema moved into
  `product-form-schema.ts` so its guards can be parsed rather than only read, the
  field renders its own error, and a sweep asserts every optional number on the
  form survives NaN.

  A second defect sat underneath it: the placeholder promises « Illimité », the
  storefront renders an uncapped checkbox group, and both platform syncs publish
  `choices.length` — while `orderLine.ts` read an absent maximum as **one**, under
  a comment claiming to match the storefront. So a diner who ticked the two sauces
  the menu offered was refused at the moment of payment, by a sentence naming a
  maximum nobody had configured. Absent now means unlimited on all four surfaces.
  The test that blessed the old reading is rewritten and says so.

  **3. The promotion form sold two discount types no order could ever be given.**
  `resolvePromotionDiscount` threw `not_applicable` on `free_product` and `bogo`
  at order time and always had; `promotions.create` stored them happily. An owner
  built a campaign and printed flyers for it. Both are now refused at creation and
  at update, with a `ConvexError` naming what to use instead, and the form takes
  its options from `HONOURABLE_DISCOUNT_TYPES` — the resolver's own list — so
  implementing either type returns the option on the same commit. Rows stored
  before the guard stay listed, deletable, and honest: their value column reads
  « Aucune remise appliquée ». `promotions`' two duplicate-coupon-code refusals
  became `ConvexError`s in the same pass; as plain `Error`s the admin read
  "Server Error" where the French sentence should have been.

  **4. Two badges on French storefront screens spoke hardcoded English.**
  `OrderStatusBadge` and `StoreStatusBadge` held eleven English labels between
  them and took no label from outside, so a diner following their order read
  « Preparing » and « Out for Delivery » between French sentences. The vocabulary
  now lives once in `@be-in-digital/core/status-labels` — the source-language word
  and the catalogue key, per status — the badges take a `labels` override, and
  `useOrderStatusLabels` / `useStoreStatusLabels` in `@be-in-digital/restaurant`
  resolve it through `t()` for the locale being rendered. Two further copies of
  the same eight words are gone with it: a private map in the order page and
  `getOrderStatusLabel`'s English map. `order.delivered` was missing from the
  catalogues and is added in fr, en and es.

  **5. The card path could not be turned off.** `payments.cardProvider` was a
  `stripe | sumup` union with no third answer, and the checkout rendered the card
  tile unconditionally — so a cash-only food truck, one of the five verticals this
  engine is sold for, shipped with a pre-selected payment method it could not
  honour. `none` is now a stored value; `cardPaymentAvailability` answers `card`
  and `cardOffered` as two separate questions, because a provider that is merely
  unconfigured owes the diner a greyed tile saying so while an owner who does not
  take cards owes them no tile at all. Réglages → Paiements carries the switch,
  and warns when the last method is turned off.

  The guest dead-end behind it is closed too. Cash requires an account by recorded
  decision, so a cash-only establishment left every guest facing an empty grid
  under a disabled button reading « Choisissez un moyen de paiement ». The
  checkout now says which of the two situations it is and renders the sign-in
  where the diner is blocked. The test that asserted that button is rewritten.

  Closes #376.

## 2.4.0

### Minor Changes

- c9619e2: Report Convex backend errors to the client's Sentry project

  The Next.js half of a client site has reported to Sentry for a while. The Convex
  half reported nothing, and `apps/docs/deployment/sentry.md` said so: _"Backend
  functions run outside Next and report nothing here."_ Every Stripe, Deliveroo,
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

- bd7a656: Wire up dine-in table numbers, and make the four allergen surfaces agree

  Two product surfaces were designed, translated, and never connected.

  ## A dine-in order now carries the table it is served to

  "Sur place" was offered in the order-type selector and accepted by
  `orders.create`, and nothing anywhere carried a table number — zero occurrences
  in `tables/orders.ts`, `tables/kitchen.ts`, the storefront, the kitchen
  components or the order functions. The printed slip gave a cook the dish and
  the customer's name, so staff had a plate and nowhere to take it. One of the
  three advertised order types was unusable. The tell was `checkout.tableNumber`:
  shipped and translated into `fr`, `en` and `es`, and read by no code at all.

  `orders.tableNumber` and `kitchenTickets.tableNumber` are new
  `v.optional(v.string())` columns. `orders.create` accepts a table, normalises
  it, and `releaseToKitchen` copies it onto every ticket the order produces; the
  slip prints `TABLE <n>` at the same size as the order number, and the kitchen
  display card shows it beside the order number.

  It is a **label**, not a number — dining rooms use `A3` and `Terrasse 4` as
  readily as `12`, and parsing the field as an integer would reject half of them.

  It deliberately does **not** share a foreign key with `gameQRCodes.tableNumber`,
  which names the same real-world thing. There is no `tables` table, and adding
  one would make dine-in service depend on the gamification QR codes being
  configured — a restaurant can serve _sur place_ without ever running the wheel
  of fortune. The two share a representation instead:
  `@be-in-digital/core/dining` normalises and bounds a table label for both.

  Required at the storefront, optional on the server. Uber Eats and Deliveroo
  forward `dine_in` orders that carry no table of their own, and refusing those
  would lose the order outright. A table number on a `delivery` or `pickup` order
  is rejected, which catches the order whose type was switched after the table
  was typed.

  While wiring it, the checkout form turned out to carry its **own** two-option
  fulfilment toggle that knew nothing about the store's services: a cart set to
  `dine_in` showed "À emporter" selected, and one click silently rewrote the type
  to `pickup`. The customer sat at a table and the kitchen was told to bag the
  order. The toggle now offers the same three types the cart does, filtered by
  the same predicate the server validates against, and selects exactly.

  ## One allergen vocabulary instead of four

  The chain was broken at every link, and each surface had drifted because each
  carried its own idea of what an allergen was:
  - the printed kitchen ticket rendered `{allergens.join(", ")}` — whatever text
    was in the array is what a cook read before plating;
  - the admin product form had **no allergen control at all**, only a zod field
    and a `[]` default, so a restaurateur could not declare one through the
    normal product editor;
  - the only production writer was therefore the AI image-to-product flow, whose
    prompt is written in French, feeding an unvalidated comma-separated text box;
  - `uberEatsMenuSync` declared `allergens?: string[]` and never mapped it, so
    every dish synced to Uber Eats went out with no allergen declaration.

  For an EU food business under INCO 1169/2011 that is a regulatory surface.

  `@be-in-digital/core/allergens` is now the single source of truth: the
  fourteen Annex II allergens plus `shellfish` and the two dietary markers, the
  alias table that matches French and English spellings through accents,
  ligatures and punctuation, the localised labels, and the Uber Eats mapping.
  It is framework-free and exported as raw source, so the design system, both
  apps, the admin package and the Convex runtime can all consult it.

  The representation decision, made once and applied everywhere: **allergens stay
  free text** — refusing a name we do not know would push a real declaration off
  the menu — **but every surface resolves through this vocabulary, and a value it
  does not recognise is treated explicitly as unverified rather than passed off
  as checked.**

  So: the badge renders it as the owner typed it and announces it as the
  restaurant's own wording; the kitchen slip prints it under `MENTIONS À
VÉRIFIER :` rather than folded into the allergen line, because a cook has to
  treat it differently; the admin marks the chip `non vérifiée` and states the
  consequence; and Uber Eats is not sent it at all, since filing an unknown value
  as `OTHER` would show a diner a declaration that names nothing. Those are
  reported to the owner instead of dropped in silence.

  Dietary markers are no longer treated as allergens anywhere: `vegan` printed
  under `ALLERGÈNES :` told a cook it was one.

  `packages/admin` gains one allergen control, shared by the product form (a new
  `Allergènes` tab) and the AI review card, so the two cannot disagree again.

  ### Known limitation

  `UBER_EATS_ALLERGEN_TYPE` maps every canonical key to an Uber Eats enum member,
  but those spellings are **not verified against Uber's live menu schema** —
  `developer.uber.com` is unreachable from CI and Uber does not publish the enum
  outside the partner portal. The mapping is total and typed, so correcting it is
  a one-table change that every caller inherits. Confirm it during Uber Eats
  onboarding; see `tasks/uber-eats-go-live-runbook.md`.

### Patch Changes

- bd17a78: Stop the upload schema refusing five folders the type says are valid

  `S3_FOLDERS` declares eleven folders and is documented as "the single source of
  truth". `s3FolderSchema` restated six of them by hand, and `upload()` and
  `getPresignedUploadUrl()` both parse their options through it. So this compiled
  and threw:

  ```ts
  createS3Service(config, client).upload(file, { folder: 'categories' })
  ```

  Measured across the declared set: `categories`, `storefront`, `blogs`,
  `blog-auto` and `avatars` were refused by both methods — the five the earlier
  proxy fix was about. Their MIME and size tables had been extended to eleven, the
  `/api/files` allowlist derives from those tables, and `convex/storageUpload.ts`
  allows all eleven; only the Zod enum was left behind.

  Nothing shipped calls those methods today — the two live upload paths are the
  HTTP route and the Convex presigned flow, and neither goes through `S3Service`
  — so this was a trap rather than an outage. But `CLAUDE.md` and the MCP registry
  both present `createS3Service(...).upload()` as the way to upload, so a
  developer following the documented API for a category image got a runtime throw
  with a type that said it was fine.

  The enum now derives from `S3_FOLDERS`, which makes the drift unrepresentable,
  and a test asserts the two agree — it fails against the hand-written list.

  The HTTP route's five-folder allowlist is untouched: that one is a deliberate
  security boundary (the rest are written by the presigned flow under its own
  authorisation), documented as such at the narrowing site.

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
