# Environment variables - Architecture

## Overview

BeYours Engine environment variables are split into **two distinct levels**, mirroring the business model where BeYours sells a Next.js theme to each restaurant.

```
+-------------------------------------------------------------------+
|                    BeYours (Platform)                          |
|                                                                   |
|   AWS Account    OpenAI     Uber Eats Partner   Deliveroo Partner  |
|   (S3, SES)     (GPT-3.5)   (App Credentials)  (App Credentials)  |
|                                                                   |
|   11 "package" variables shared by all sites                       |
+-------------------------------------------------------------------+
        |                    |                    |
        v                    v                    v
+------------------+ +------------------+ +------------------+
|  Restaurant A    | |  Restaurant B    | |  Restaurant C    |
|                  | |                  | |                  |
|  Convex instance | |  Convex instance | |  Convex instance |
|  Auth secret     | |  Auth secret     | |  Auth secret     |
|  S3 bucket       | |  S3 bucket       | |  S3 bucket       |
|  SES domain      | |  SES domain      | |  SES domain      |
|  Stripe account  | |  PayPal account  | |  SumUp account   |
|  Sentry DSN      | |  Sentry DSN      | |  Sentry DSN      |
|  Google Maps key | |  Google Maps key | |  Google Maps key  |
|                  | |                  | |                  |
|  41 variables    | |  41 variables    | |  41 variables    |
|  "site"-specific | |  "site"-specific | |  "site"-specific |
+------------------+ +------------------+ +------------------+
```

---

## Package vs Site separation

### Package variables (BeYours infra - 11 vars)

These are the credentials BeYours manages, shared across every deployed restaurant.

| Variable | Required | Description |
|---|---|---|
| `AWS_REGION` | yes | AWS region of the BeYours account |
| `AWS_ACCESS_KEY_ID` | yes | BeYours IAM access key |
| `AWS_SECRET_ACCESS_KEY` | yes | BeYours IAM secret |
| `OPENAI_API_KEY` | yes | OpenAI API key (`sk-` prefix) for GPT translations |
| `UBER_EATS_CLIENT_ID` | no | Client ID of the Uber Eats partner app |
| `UBER_EATS_CLIENT_SECRET` | no | Uber Eats client secret |
| `UBER_EATS_WEBHOOK_SECRET` | no | Secret used to verify Uber Eats webhooks |
| `UBER_DIRECT_WEBHOOK_SECRET` | no | Secret used to verify Uber Direct courier webhooks. Falls back to `UBER_EATS_WEBHOOK_SECRET`, then to `UBER_EATS_CLIENT_SECRET`; with none of the three set the webhook answers 503 |
| `DELIVEROO_CLIENT_ID` | no | Client ID of the Deliveroo partner app |
| `DELIVEROO_CLIENT_SECRET` | no | Deliveroo client secret |
| `DELIVEROO_WEBHOOK_SECRET` | no | Secret used to verify Deliveroo webhooks |

> **Why are Uber Eats / Deliveroo "package" level?**
> BeYours is a **partner app** on these platforms. The API credentials are BeYours', not the restaurant's. The restaurant only supplies its own identifiers (brandId, siteId) to link its account.

### Site variables (per restaurant - 41 vars)

Each deployed restaurant supplies its own values. They fall into **three tiers**,
defined in `packages/core/src/env/schemas.ts`:

| Tier | Schema | Meaning |
|---|---|---|
| **required** | `siteEnvRequiredSchema` | The 7 variables a deployment cannot boot without. An **empty value no longer passes**: these are declared without the `opt()` helper, so `''` fails exactly like a missing key. A `.env` copied from the template and left unfilled now fails at startup instead of in front of the restaurant owner. |
| **optional** | `siteEnvOptionalSchema` | Unset (or empty) means the matching feature is off. Format is still checked when a value IS present. |
| **feature-gated** | `SITE_FEATURE_GROUPS` | All-or-nothing groups. Setting **one** variable of a group makes the whole group required. |

#### Required (7) - the deployment does not boot without them

Each of these used to be optional, and each one used to fail *silently* in
production rather than at deploy time.

| Category | Variable | Silent failure it used to cause |
|---|---|---|
| **Convex** | `NEXT_PUBLIC_CONVEX_URL` | No backend - every query hangs |
| | `CONVEX_SITE_URL` | Webhook and OAuth callback URLs point nowhere |
| **Auth** | `SITE_URL` | Password reset returns early, the mail is never sent |
| | `BETTER_AUTH_SECRET` | Same early return; sessions unsignable. **Now min 32 chars** (was min 1) |
| | `ENCRYPTION_KEY` | OAuth tokens cannot be stored at rest (64 hex chars) |
| **AWS S3** | `AWS_S3_BUCKET_NAME` | No upload target - the `/api/files` proxy reads from it too |
| **AWS SES** | `AWS_SES_FROM_EMAIL` | No transactional mail leaves the deployment |

> `AWS_S3_PUBLIC_BASE_URL` is **not** required, though the sales-readiness audit
> listed it. Since the private-bucket decision it names an optional CDN, and
> unset means media is served by the app's own `/api/files` proxy - a supported
> configuration. See `apps/docs/deployment/s3-bucket-policy.md`.

#### Feature-gated groups - all or nothing

Half a payment provider is worse than none: the admin offers the method, the
customer picks it, and the charge fails at the till. Once **any** variable in a
group is set, the whole group is required.

| Feature | Variables |
|---|---|
| Stripe (restaurant payments) | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` |
| PayPal (restaurant payments) | `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET` |
| SumUp (restaurant payments) | `SUMUP_CLIENT_ID`, `SUMUP_CLIENT_SECRET` |
| BeYours billing (maintenance renewal) | `STRIPE_BID_SECRET_KEY`, `STRIPE_BID_WEBHOOK_SECRET`, `BID_APP_URL` |

> `STRIPE_PUBLISHABLE_KEY` is deliberately **absent** from the Stripe group: no
> line of the product reads it today, so demanding it would gate a deploy on a
> value nothing consumes.

#### Optional (34)

| Category | Variable | Tier | Description |
|---|---|---|---|
| **Convex** | `CONVEX_DEPLOYMENT` | optional | Convex deployment ID |
| | `NEXT_PUBLIC_CONVEX_SITE_URL` | optional | Client-side twin of `CONVEX_SITE_URL`; must stay on the same subdomain |
| **Auth** | `BETTER_AUTH_URL` | optional | URL of the auth service |
| | `AUTH_ALLOW_UNVERIFIED_EMAIL` | optional | Relaxes email verification. **Fails closed**: only the exact value `"true"` relaxes anything. Test deployments only |
| | `EMAIL_API_SECRET` | optional | Dedicated credential for `POST /api/email/send`, min 32 chars. Set it on **both** the Next env and the Convex deployment. Unset, both sides fall back to `BETTER_AUTH_SECRET` |
| | `ADMIN_BOOTSTRAP_TOKEN` | optional | Claims the FIRST super-admin seat on a fresh deployment. **Fails closed**: unset refuses everyone. Set it on the Convex deployment |
| **App** | `NEXT_PUBLIC_APP_URL` | optional | Public URL of the app; fallback for team invitation links |
| | `NEXT_PUBLIC_SITE_URL` | optional | Canonical public URL for SEO metadata and the sitemap |
| | `ADMIN_URL` | optional | Admin redirect URL after OAuth (defaults to `http://localhost:3000`) |
| **AWS S3** | `AWS_S3_PUBLIC_BASE_URL` | optional | Origin of a CDN fronting the private bucket. Unset, media is served by the app's own `/api/files` proxy |
| **AWS SES** | `AWS_SES_FROM_NAME` | optional | Sender name |
| | `AWS_SES_REPLY_TO_EMAIL` | optional | Reply-to address |
| | `AWS_SES_CONFIGURATION_SET` | optional | SES Configuration Set |
| **Monitoring** | `NEXT_PUBLIC_SENTRY_DSN` | optional | Sentry DSN owned by the client |
| **Maps** | `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` | optional | Google Maps key owned by the client |
| **Stripe** | `STRIPE_SECRET_KEY` | feature | Secret key (`sk_` prefix) |
| | `STRIPE_PUBLISHABLE_KEY` | optional | Public key (`pk_` prefix); declared for the setup wizard, no runtime read yet |
| | `STRIPE_WEBHOOK_SECRET` | feature | Webhook secret (`whsec_` prefix) |
| **PayPal** | `PAYPAL_CLIENT_ID` | feature | Restaurant's PayPal client ID |
| | `PAYPAL_CLIENT_SECRET` | feature | PayPal client secret |
| | `PAYPAL_SANDBOX_MODE` | optional | **Unset defaults to PRODUCTION.** Keep `"true"` for sandbox |
| **SumUp** | `SUMUP_CLIENT_ID` | feature | Restaurant's SumUp client ID |
| | `SUMUP_CLIENT_SECRET` | feature | SumUp client secret |
| **Uber Eats** | `UBER_EATS_SANDBOX_MODE` | optional | Sandbox mode (`true`/`false`); unset defaults to PRODUCTION |
| **Deliveroo** | `DELIVEROO_BRAND_ID` | optional | Restaurant's Deliveroo brand ID (e2e fixture; a live deployment reads it from its stored connection) |
| | `DELIVEROO_SITE_ID` | optional | Restaurant's Deliveroo site ID (same) |
| | `DELIVEROO_IS_SANDBOX` | optional | Sandbox mode (`true`/`false`); unset defaults to PRODUCTION |
| **CMS media** | `UNSPLASH_ACCESS_KEY` | optional | Unsplash key for the CMS media picker |
| **BeYours billing** | `STRIPE_BID_SECRET_KEY` | feature | Stripe key of the BeYours account (not the restaurant's). Lives on the **Convex** deployment |
| | `STRIPE_BID_WEBHOOK_SECRET` | feature | Verifies the renewal webhook |
| | `STRIPE_BID_PRICE_MAINTENANCE` | optional | Price of the annual maintenance renewal. Unset, "Renouveler en ligne" is refused |
| | `BID_APP_URL` | feature | Absolute app URL for checkout redirects and customer-email links |
| | `BID_NOTIFY_EMAIL` | optional | Alerted via SES on a site migration request. Unset, the request reaches nobody - the one genuinely silent failure left |
| **Contact** | `CONTACT_EMAIL` | optional | Public contact address surfaced in the app |
| | `NEXT_PUBLIC_BID_SUPPORT_EMAIL` | optional | Mailto shown in the renewal CTA; unset shows a neutral message instead of a link |

---

## Technical architecture

### Validation schema (Zod)

The schemas are defined in `packages/core/src/env/schemas.ts` and exported via:
- `@be-in-digital/core` (main export)
- `@be-in-digital/core/env` (sub-path export, no Node.js dependencies)

```
packages/core/src/env/
  schemas.ts    -- packageEnvSchema
                   siteEnvRequiredSchema   (strict, boot only)
                   siteEnvOptionalSchema   (+ SITE_FEATURE_GROUPS refinement)
                   siteEnvSchema           (lenient reader, runtime)
  getters.ts    -- getPackageEnv() + getSiteEnv() (lazy, memoized)
                   validateAllEnv() + formatEnvReport()
  index.ts      -- barrel file
  __tests__/
    schemas.test.ts
    getters.test.ts
    validate-all-env.test.ts
```

### Two readers, on purpose

The same variables are checked by **two different schemas**, and the difference
is deliberate.

| | `validateAllEnv()` | `getSiteEnv()` |
|---|---|---|
| Schema | `siteEnvRequiredSchema` + `siteEnvOptionalSchema` + `packageEnvSchema` | `siteEnvSchema` (lenient) |
| When | Once, at startup (`instrumentation.ts`) | On every read, anywhere |
| Missing required var | Reported; production boot fails | Returns `undefined` |
| Throws | Never - returns `{ ok, missing }` | Only on a malformed value |

**Why the reader stays lenient.** `getSiteEnv()` parses the whole of
`process.env`, and it runs inside Convex actions, where the deployment holds its
own subset of the variables (`ENCRYPTION_KEY` yes,
`NEXT_PUBLIC_CONVEX_URL` no). Every validator in the reader is a way for an
unrelated code path - a Stripe charge, a kitchen ticket - to throw on a variable
it never reads. Throwing there would turn a boot-time configuration problem into
a failed customer order.

So **format is enforced once, at boot; the reader only asks "is there something
there"**. A handful of fields are relaxed in the reader beyond that (see
`READER_RELAXED` in `schemas.ts`): the ones this tier split newly declared, plus
`BETTER_AUTH_SECRET`, whose floor rose from 1 to 32. Nothing already deployed
sees a check tighten at runtime.

### Getters

```typescript
import { getPackageEnv, getSiteEnv } from '@be-in-digital/core/env'

// BeYours platform variables - strict, throws on a missing required var
const pkg = getPackageEnv()
pkg.AWS_REGION           // string (guaranteed)
pkg.UBER_EATS_CLIENT_ID  // string | undefined (optional)

// Restaurant-specific variables - lenient, every field possibly undefined
const site = getSiteEnv()
site.BETTER_AUTH_SECRET  // string | undefined
site.STRIPE_SECRET_KEY   // string | undefined
```

**Behavior:**
- First call: validates `process.env` against the Zod schema
- Later calls: return the cached result (memoized)
- `getPackageEnv()` throws `ZodError` if a required platform var is missing
- `getSiteEnv()` returns `undefined` for anything unset - whether the deployment
  was allowed to boot at all is decided by `validateAllEnv()`, not here
- `_resetEnvCache()` available for tests

### Startup validation

```typescript
import { validateAllEnv, formatEnvReport } from '@be-in-digital/core/env'

const { ok, missing } = validateAllEnv()
if (!ok) console.error(formatEnvReport(missing))
```

`validateAllEnv()` never throws. It returns every problem it found, each tagged
with an `EnvTier` - `'package'`, `'site'` or `'feature'` - and `formatEnvReport()`
groups them under those three headings for the boot log. A variable that is
absent reads as `non définie` rather than Zod's "expected string, received
undefined"; a value that IS set but malformed keeps its Zod message, so the
operator can tell the two apart.

### Validation flow

```
                           Startup
                             |
                             v
                   +---------------------+
                   | instrumentation.ts  |  <-- Next.js startup hook
                   |                     |
                   | validateAllEnv()    |  -- 11 package + 7 required
                   |                     |     + 34 optional + feature groups
                   +---------------------+
                             |
                    OK?      |     FAIL?
                   +----+    |    +----------------+
                   |    v    |    v                |
                   | Continue|  formatEnvReport()  |
                   |  app    |  dev: warn          |
                   |         |  prod: crash        |
                   +---------+---------------------+

        Runtime (Convex actions, API routes)
                             |
                             v
                   +---------------------+
                   | getPackageEnv()     |  -- strict, cached
                   | getSiteEnv()        |  -- LENIENT, cached
                   +---------------------+
                             |
                             v
                   Type-safe access; site fields possibly undefined
```

### apps/site validates itself, separately

`apps/site` (the commercial site, beyours.fr) depends on **none** of the engine
packages, so it does not use `@be-in-digital/core/env` at all. It has its own
dependency-free validator:

| | Engine apps | `apps/site` |
|---|---|---|
| Validator | `@be-in-digital/core/env` `validateAllEnv()` | `apps/site/lib/env.ts` `validateSiteEnv()` |
| Report | `formatEnvReport()` | `formatSiteEnvReport()` |
| Tiers | `'package' \| 'site' \| 'feature'` | `'required' \| 'format' \| 'feature'` |
| Dependencies | zod | none |
| Called from | `instrumentation.ts` | `apps/site/instrumentation.ts` |

It follows the same shape - required tier, format-checked-when-present tier,
all-or-nothing groups - over a different variable surface, and it can only see
the **Next.js** process env. The Stripe keys, the AWS credentials, the email
provider and the four maintenance Price IDs live on the **Convex** deployment,
which that code never runs in, so they are checked when present and never
demanded. Its two all-or-nothing groups are Stripe (`STRIPE_SECRET_KEY` +
`STRIPE_WEBHOOK_SECRET`) and the four `STRIPE_PRICE_*` maintenance prices -
`convex/stripe.ts` throws mid-checkout when one of those is missing, which
debits a customer who is then never provisioned.

---

## Imports depending on the Convex context

The Convex bundler distinguishes two runtimes:

| Runtime | Files affected | Import pattern |
|---|---|---|
| **"use node"** (Node.js) | `oauthConnect.ts`, `teamMembersEmail.ts`, `deliverooWebhook.ts`, `validateIntegration.ts`, imports, menu syncs, orders | `import { getPackageEnv, getSiteEnv } from "@be-in-digital/core/env"` |
| **V8 isolate** (httpAction, queries, mutations) | `uberEatsWebhook.ts`, `deliverooWebhookHandler.ts`, `oauthCallbackHandlers.ts`, `kitchenTickets.ts` | `const { getPackageEnv } = await import("@be-in-digital/core/env")` |
| **V8 isolate** (config module) | `auth.ts` | `process.env.SITE_URL` (keeps the direct pattern, no Zod) |

> **Why doesn't `auth.ts` migrate?**
> This file configures Better Auth at module level (not inside an async handler). It runs very early in the Convex lifecycle, and importing the core package could cause bundling problems in the V8 isolate.

### `NEXT_PUBLIC_*` variables (client-side)

Variables prefixed with `NEXT_PUBLIC_` are **inlined at build time** by Next.js. They cannot be validated server-side at runtime.

Files affected (deliberately not migrated):
- `app/providers.tsx`: `process.env.NEXT_PUBLIC_CONVEX_URL`
- `lib/convex.ts`: `process.env.NEXT_PUBLIC_CONVEX_URL`
- `app/(test)/address-test/page.tsx`: `process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`

---

## .env.example files

Six reference files for onboarding:

| File | Contents | For whom |
|---|---|---|
| `packages/core/.env.example` | 10 package variables | BeYours team — canonical list of the platform credentials |
| `apps/reference/.env.example` | Site vars + package vars | The engine's test bench |
| `apps/themes/.env.example` | Site vars + package vars | Deploying a restaurant — web side |
| `apps/themes/.env.convex.example` | Backend vars | Deploying a restaurant — Convex side (`pnpm convex:env`) |
| `apps/site/.env.example` | The commercial site's own surface | Local dev on `apps/site` |
| `apps/site/.env.production.example` | Documented prod values, no secret | Before any prod env change on `apps/site` |

> On every deployment, the `.env.local` file in `apps/reference/` or `apps/themes/` holds **every** variable (package + site), since the Node.js process needs both at runtime.

> `apps/site` does **not** follow the package/site split: it depends on none of the engine packages and has its own variable surface, validated by `apps/site/lib/env.ts` (see *apps/site validates itself, separately* above). `packages/core` is a library — nothing loads a `.env` there at runtime; the 11 platform variables are read from the host process env.

---

## Adding a new environment variable

1. **Pick the level**: package (BeYours infra) or site (per restaurant)
2. **Pick the tier**, and be strict about it:
   - `siteRequiredShape` — only if the deployment genuinely cannot serve a
     correct page without it. Declare it **without** the `opt()` helper, so an
     empty value fails too. Adding one here breaks the boot of every existing
     deployment that lacks it, which is the point — but check first.
   - `siteOptionalShape` — everything else. Wrap it in `opt()`.
   - `SITE_FEATURE_GROUPS` — if it only makes sense alongside others, and half
     the group configured would fail in front of a customer.
3. **Add it to the schema** in `packages/core/src/env/schemas.ts` with its Zod
   validations (`.url()`, `.email()`, `.startsWith()`, `.regex()`)
4. **Consider `READER_RELAXED`.** Any validator you add is one more way for an
   unrelated code path to throw at runtime, on a deployment that already exists
   and never reads this variable. Newly declared variables belong in that set
   unless you have a reason otherwise.
5. **Update the matching `.env.example`** — including
   `apps/themes/.env.convex.example` if the variable is read from a Convex
   action, which is easy to miss and is where the gaps have historically been
6. **Rebuild the package**: `pnpm --filter @be-in-digital/core build`
7. **Use the getter** in the consuming code:
   ```typescript
   const pkg = getPackageEnv()  // or getSiteEnv()
   const maVar = pkg.MA_NOUVELLE_VAR
   ```

> Variables consumed by `apps/site` go in `apps/site/lib/env.ts` instead — that
> app shares no schema with the engine.

---

## Generating an ENCRYPTION_KEY

```bash
openssl rand -hex 32
# Produces a 64-character hex string (32 bytes)
# Example: a1b2c3d4e5f6...
```

---

## Full flow diagram

```
+==========================================+
|          packages/core/src/env/          |
|                                          |
|  schemas.ts                              |
|  +------------------------------------+  |
|  | packageEnvSchema (Zod)             |  |
|  |   AWS_REGION          required     |  |
|  |   AWS_ACCESS_KEY_ID   required     |  |
|  |   AWS_SECRET_...      required     |  |
|  |   OPENAI_API_KEY      required     |  |
|  |   UBER_EATS_*         optional     |  |
|  |   DELIVEROO_*         optional     |  |
|  +------------------------------------+  |
|  +------------------------------------+  |
|  | siteEnvRequiredSchema  (BOOT ONLY) |  |
|  |   NEXT_PUBLIC_CONVEX_URL  required |  |
|  |   CONVEX_SITE_URL         required |  |
|  |   SITE_URL                required |  |
|  |   BETTER_AUTH_SECRET      required |  |
|  |   ENCRYPTION_KEY          required |  |
|  |   AWS_S3_BUCKET_NAME      required |  |
|  |   AWS_SES_FROM_EMAIL      required |  |
|  |   (no opt(): '' fails too)         |  |
|  +------------------------------------+  |
|  +------------------------------------+  |
|  | siteEnvOptionalSchema  (BOOT ONLY) |  |
|  |   STRIPE_* PAYPAL_* SUMUP_*        |  |
|  |   STRIPE_BID_* BID_*               |  |
|  |   ADMIN_BOOTSTRAP_TOKEN            |  |
|  |   AUTH_ALLOW_UNVERIFIED_EMAIL      |  |
|  |   SENTRY_DSN GOOGLE_MAPS_KEY ...   |  |
|  |   + SITE_FEATURE_GROUPS refinement |  |
|  |     (all-or-nothing per provider)  |  |
|  +------------------------------------+  |
|  +------------------------------------+  |
|  | siteEnvSchema  (RUNTIME READER)    |  |
|  |   every field optional, on purpose |  |
|  |   -> never throws on a var this    |  |
|  |      deployment does not hold      |  |
|  +------------------------------------+  |
|                                          |
|  getters.ts                              |
|  +------------------------------------+  |
|  | getPackageEnv() -> PackageEnv      |  |
|  | getSiteEnv()    -> SiteEnv         |  |
|  |   (lazy parse + memoize)           |  |
|  | validateAllEnv() -> { ok, missing }|  |
|  |   (boot; package|site|feature)     |  |
|  +------------------------------------+  |
+==========================================+
          |                    |
    export "."          export "./env"
    (with Node.js deps)  (Zod only)
          |                    |
          v                    v
+------------------+  +--------------------+
| Next.js App      |  | Convex Functions   |
|                  |  |                    |
| instrumentation  |  | "use node" files:  |
|   .ts            |  |   import from      |
|   (startup       |  |   core/env         |
|    validation)   |  |                    |
|                  |  | V8 httpAction:     |
| API routes:      |  |   await import()   |
|   import from    |  |   from core/env    |
|   core           |  |                    |
|                  |  | auth.ts:           |
| Client comps:    |  |   process.env      |
|   NEXT_PUBLIC_*  |  |   (direct, no Zod) |
|   (build inline) |  |                    |
+------------------+  +--------------------+
```

```
Data flow: where each variable is read
======================================================

process.env
    |
    +-- packageEnvSchema.parse() --> PackageEnv (cached)
    |       |
    |       +-- AWS_REGION ------------> SES adapter, teamMembersEmail
    |       +-- AWS_ACCESS_KEY_ID -----> SES adapter, teamMembersEmail
    |       +-- AWS_SECRET_ACCESS_KEY -> SES adapter, teamMembersEmail
    |       +-- OPENAI_API_KEY --------> GPT translation (via param)
    |       +-- UBER_EATS_CLIENT_ID ---> uberEatsWebhook, import, menuSync,
    |       |                            validate, kitchenTickets
    |       +-- UBER_EATS_CLIENT_SECRET> (same files)
    |       +-- UBER_EATS_WEBHOOK_SEC > uberEatsWebhook
    |       +-- UBER_DIRECT_WEBHOOK_SEC> uberDirectWebhook (falls back to
    |       |                            UBER_EATS_WEBHOOK_SECRET, then to
    |       |                            UBER_EATS_CLIENT_SECRET)
    |       +-- DELIVEROO_CLIENT_ID ---> deliverooWebhookHandler, webhook,
    |       |                            import, menuSync, orders, validate,
    |       |                            kitchenTickets
    |       +-- DELIVEROO_CLIENT_SECRET> (same files)
    |       +-- DELIVEROO_WEBHOOK_SEC -> deliverooWebhookHandler
    |
    +-- siteEnvSchema.parse() --> SiteEnv (cached, every field optional)
            |   (boot-time enforcement: siteEnvRequiredSchema
            |    + siteEnvOptionalSchema, via validateAllEnv)
            |
            +-- NEXT_PUBLIC_CONVEX_URL -> providers.tsx (build inline)
            +-- CONVEX_SITE_URL -------> oauthConnect, oauthCallbackHandlers,
            |                            uberEatsOAuth (throws when unset)
            +-- BETTER_AUTH_SECRET ----> auth.ts (direct process.env)
            +-- SITE_URL --------------> auth.ts, teamMembersEmail
            +-- ENCRYPTION_KEY -------> oauthConnect (encrypt)
            +-- AUTH_ALLOW_UNVERIFIED_> auth.ts (fails closed; test only)
            +-- ADMIN_BOOTSTRAP_TOKEN -> userProfiles.claimFirstAdmin
            |                            (fails closed; refuses everyone)
            +-- ADMIN_URL ------------> oauthCallbackHandlers, uberEatsOAuth
            +-- NEXT_PUBLIC_APP_URL ---> teamMembersEmail (invite links)
            +-- AWS_S3_BUCKET_NAME ----> S3 uploads (via config param)
            +-- AWS_S3_PUBLIC_BASE_URL> cmsMediaProcess, cmsSvgUpload,
            |                            cmsMediaConfirmUpload, imageToProduct,
            |                            blogAutoGenerate, blogImageGenerate
            +-- AWS_SES_FROM_EMAIL ----> SES adapter, teamMembersEmail
            +-- STRIPE_BID_* ---------> bidSubscription (throws when unset)
            +-- BID_APP_URL ----------> bidSubscription, maintenanceEmail,
            |                            gameEmail
            +-- BID_NOTIFY_EMAIL -----> maintenanceEmail (logs and moves on)
            +-- NEXT_PUBLIC_BID_SUPPORT> packages/admin constants (renewal CTA)
            +-- STRIPE_SECRET_KEY -----> oauthConnect, oauthCallbackHandlers
            +-- STRIPE_PUBLISHABLE_KEY> client-side (build inline)
            +-- STRIPE_WEBHOOK_SECRET -> webhook handler (future)
            +-- PAYPAL_* -------------> PayPal integration (future)
            +-- SUMUP_* --------------> oauthConnect
            +-- UBER_EATS_SANDBOX ----> all the Uber Eats files
            +-- DELIVEROO_BRAND_ID ----> DB (storeIntegrations)
            +-- DELIVEROO_SITE_ID -----> DB (storeIntegrations)
            +-- DELIVEROO_IS_SANDBOX --> all the Deliveroo files
            +-- SENTRY_DSN -----------> sentry config (via param)
            +-- GOOGLE_MAPS_KEY ------> address autocomplete (build inline)
```
