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
|   10 "package" variables shared by all sites                       |
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
|  25+ variables   | |  25+ variables   | |  25+ variables   |
|  "site"-specific | |  "site"-specific | |  "site"-specific |
+------------------+ +------------------+ +------------------+
```

---

## Package vs Site separation

### Package variables (BeYours infra - 10 vars)

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
| `DELIVEROO_CLIENT_ID` | no | Client ID of the Deliveroo partner app |
| `DELIVEROO_CLIENT_SECRET` | no | Deliveroo client secret |
| `DELIVEROO_WEBHOOK_SECRET` | no | Secret used to verify Deliveroo webhooks |

> **Why are Uber Eats / Deliveroo "package" level?**
> BeYours is a **partner app** on these platforms. The API credentials are BeYours', not the restaurant's. The restaurant only supplies its own identifiers (brandId, siteId) to link its account.

### Site variables (per restaurant - 25+ vars)

Each deployed restaurant supplies its own values.

| Category | Variable | Required | Description |
|---|---|---|---|
| **Convex** | `CONVEX_DEPLOYMENT` | no | Convex deployment ID |
| | `NEXT_PUBLIC_CONVEX_URL` | yes | Public URL of the Convex instance |
| | `CONVEX_SITE_URL` | no | Convex site URL (for webhooks) |
| **Auth** | `BETTER_AUTH_SECRET` | yes | Unique secret for authentication |
| | `BETTER_AUTH_URL` | no | URL of the auth service |
| | `SITE_URL` | no | Site URL (trusted origins) |
| | `ENCRYPTION_KEY` | no | AES-256-GCM key (64 hex chars) |
| **App** | `NEXT_PUBLIC_APP_URL` | no | Public URL of the app |
| | `ADMIN_URL` | no | Admin redirect URL |
| **AWS S3** | `AWS_S3_BUCKET_NAME` | no | S3 bucket owned by the restaurant |
| **AWS SES** | `AWS_SES_FROM_EMAIL` | no | Restaurant sender email |
| | `AWS_SES_FROM_NAME` | no | Sender name |
| | `AWS_SES_REPLY_TO_EMAIL` | no | Reply-to address |
| | `AWS_SES_CONFIGURATION_SET` | no | SES Configuration Set |
| **Monitoring** | `NEXT_PUBLIC_SENTRY_DSN` | no | Sentry DSN owned by the client |
| **Maps** | `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` | no | Google Maps key owned by the client |
| **Stripe** | `STRIPE_SECRET_KEY` | no | Secret key (`sk_` prefix) |
| | `STRIPE_PUBLISHABLE_KEY` | no | Public key (`pk_` prefix) |
| | `STRIPE_WEBHOOK_SECRET` | no | Webhook secret (`whsec_` prefix) |
| **PayPal** | `PAYPAL_CLIENT_ID` | no | Restaurant's PayPal client ID |
| | `PAYPAL_CLIENT_SECRET` | no | PayPal client secret |
| **SumUp** | `SUMUP_CLIENT_ID` | no | Restaurant's SumUp client ID |
| | `SUMUP_CLIENT_SECRET` | no | SumUp client secret |
| **Uber Eats** | `UBER_EATS_SANDBOX_MODE` | no | Sandbox mode (`true`/`false`) |
| **Deliveroo** | `DELIVEROO_BRAND_ID` | no | Restaurant's Deliveroo brand ID |
| | `DELIVEROO_SITE_ID` | no | Restaurant's Deliveroo site ID |
| | `DELIVEROO_IS_SANDBOX` | no | Sandbox mode (`true`/`false`) |

---

## Technical architecture

### Validation schema (Zod)

The schemas are defined in `packages/core/src/env/schemas.ts` and exported via:
- `@be-in-digital/core` (main export)
- `@be-in-digital/core/env` (sub-path export, no Node.js dependencies)

```
packages/core/src/env/
  schemas.ts    -- packageEnvSchema + siteEnvSchema (Zod)
  getters.ts    -- getPackageEnv() + getSiteEnv() (lazy, memoized)
  index.ts      -- barrel file
  __tests__/
    schemas.test.ts
    getters.test.ts
```

### Getters

```typescript
import { getPackageEnv, getSiteEnv } from '@be-in-digital/core/env'

// BeYours platform variables
const pkg = getPackageEnv()
pkg.AWS_REGION           // string (guaranteed)
pkg.UBER_EATS_CLIENT_ID // string | undefined (optional)

// Restaurant-specific variables
const site = getSiteEnv()
site.BETTER_AUTH_SECRET  // string (guaranteed)
site.STRIPE_SECRET_KEY   // string | undefined (optional)
```

**Behavior:**
- First call: validates `process.env` against the Zod schema
- Later calls: return the cached result (memoized)
- Throws `ZodError` if a required variable is missing or invalid
- `_resetEnvCache()` available for tests

### Validation flow

```
                           Startup
                             |
                             v
                   +-------------------+
                   | instrumentation.ts |  <-- Next.js startup hook
                   |                   |
                   | getPackageEnv()   |  -- Validates the 10 package vars
                   | getSiteEnv()     |  -- Validates the 25+ site vars
                   +-------------------+
                             |
                    OK?      |     FAIL?
                   +----+    |    +----+
                   |    v    |    v    |
                   | Continue|  dev: warn |
                   |  app   |  prod: crash|
                   +--------+-----------+

        Runtime (Convex actions, API routes)
                             |
                             v
                   +-------------------+
                   | getPackageEnv()   |  -- Cache hit (already validated)
                   | getSiteEnv()     |  -- Cache hit (already validated)
                   +-------------------+
                             |
                             v
                   Type-safe access to variables
```

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

> `apps/site` does **not** follow the package/site split: it depends on none of the engine packages and has its own variable surface. `packages/core` is a library — nothing loads a `.env` there at runtime; the 10 platform variables are read from the host process env.

---

## Adding a new environment variable

1. **Pick the level**: package (BeYours infra) or site (per restaurant)
2. **Add it to the schema** in `packages/core/src/env/schemas.ts`
   - Use `.optional()` if the variable is not required for every deployment
   - Add Zod validations (`.url()`, `.email()`, `.startsWith()`, `.regex()`)
3. **Update the matching `.env.example`**
4. **Rebuild the package**: `pnpm --filter @be-in-digital/core build`
5. **Use the getter** in the consuming code:
   ```typescript
   const pkg = getPackageEnv()  // or getSiteEnv()
   const maVar = pkg.MA_NOUVELLE_VAR
   ```

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
|  | siteEnvSchema (Zod)                |  |
|  |   NEXT_PUBLIC_CONVEX  required     |  |
|  |   BETTER_AUTH_SECRET  required     |  |
|  |   ENCRYPTION_KEY      optional     |  |
|  |   STRIPE_*            optional     |  |
|  |   PAYPAL_*            optional     |  |
|  |   SUMUP_*             optional     |  |
|  |   AWS_S3_BUCKET_NAME  optional     |  |
|  |   AWS_SES_FROM_*      optional     |  |
|  |   SENTRY_DSN          optional     |  |
|  |   GOOGLE_MAPS_KEY     optional     |  |
|  |   DELIVEROO_BRAND_ID  optional     |  |
|  |   UBER_EATS_SANDBOX   optional     |  |
|  +------------------------------------+  |
|                                          |
|  getters.ts                              |
|  +------------------------------------+  |
|  | getPackageEnv() -> PackageEnv      |  |
|  | getSiteEnv()    -> SiteEnv         |  |
|  |   (lazy parse + memoize)           |  |
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
    |       +-- DELIVEROO_CLIENT_ID ---> deliverooWebhookHandler, webhook,
    |       |                            import, menuSync, orders, validate,
    |       |                            kitchenTickets
    |       +-- DELIVEROO_CLIENT_SECRET> (same files)
    |       +-- DELIVEROO_WEBHOOK_SEC -> deliverooWebhookHandler
    |
    +-- siteEnvSchema.parse() --> SiteEnv (cached)
            |
            +-- NEXT_PUBLIC_CONVEX_URL -> providers.tsx (build inline)
            +-- CONVEX_SITE_URL -------> oauthConnect, oauthCallbackHandlers
            +-- BETTER_AUTH_SECRET ----> auth.ts (direct process.env)
            +-- SITE_URL --------------> auth.ts, teamMembersEmail
            +-- ENCRYPTION_KEY -------> oauthConnect (encrypt)
            +-- ADMIN_URL ------------> oauthCallbackHandlers
            +-- AWS_S3_BUCKET_NAME ----> S3 uploads (via config param)
            +-- AWS_SES_FROM_EMAIL ----> SES adapter, teamMembersEmail
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
