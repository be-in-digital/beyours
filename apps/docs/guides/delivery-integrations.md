# Delivery Integrations Guide (Uber Eats & Deliveroo)

> How BeYours connects restaurants to Uber Eats and Deliveroo: setup,
> environment variables, sandbox vs production, webhooks, the Uber Eats OAuth
> provisioning flow, menu sync, order import, secret rotation and a production
> checklist.

## Table of Contents

- [Architecture & credential model](#architecture--credential-model)
- [Environment variables](#environment-variables)
- [Sandbox vs production](#sandbox-vs-production)
- [Uber Eats](#uber-eats)
  - [OAuth provisioning (connect a merchant)](#oauth-provisioning-connect-a-merchant)
  - [Webhooks & signature verification](#uber-eats-webhooks)
  - [Production validation](#production-validation)
- [Deliveroo](#deliveroo)
  - [Webhooks & signature verification](#deliveroo-webhooks)
  - [Menu sync & sandbox scenarios](#menu-sync--sandbox-scenarios)
- [Order flow, mapping & idempotence](#order-flow-mapping--idempotence)
- [Restaurant onboarding checklist](#restaurant-onboarding-checklist)
- [Secret rotation](#secret-rotation)
- [Production readiness checklist](#production-readiness-checklist)

---

## Architecture & credential model

Delivery integrations are split across the monorepo so the base stays reusable:

| Layer | Package / path | Responsibility |
|-------|----------------|----------------|
| API clients + mappers | `packages/integrations/src/{uber-eats,deliveroo}` | Pure HTTP clients, OAuth helpers, signature verification, order/menu mappers. No Convex, no app imports. |
| Shared tables | `packages/convex-schema/src/tables` | `orders`, `storeIntegrations`, `externalProductMappings`, `uberEatsConnections`, `oauthStates`, … |
| Reusable handlers | `packages/convex-functions/src/orders.ts` | `createFromWebhook` (idempotent), `updateFromWebhook`. |
| App wiring | `apps/reference/convex/{http,uberEats*,deliveroo*}.ts` | HTTP webhook routes, OAuth callback, auto-accept logic, kitchen tickets. |

**Credentials are platform-level, not per-restaurant.** BeYours is the partner
app registered with Uber and Deliveroo, so `*_CLIENT_ID` / `*_CLIENT_SECRET` /
`*_WEBHOOK_SECRET` are **the same for every deployment** and live in the platform
secret store. A restaurant supplies only:

- **Uber Eats**: nothing up front — the merchant grants consent through the OAuth
  flow, which stores a per-deployment merchant token (encrypted).
- **Deliveroo**: its `DELIVEROO_BRAND_ID` and `DELIVEROO_SITE_ID`.

> Never hardcode any secret in source, scripts, docs, `.context`, Playwright auth
> state, or commit messages. Secrets come from `.env.local` (local dev) and GitHub
> / Convex / Vercel secret stores (CI & production). See `.env.example`.

---

## Environment variables

Validated by Zod in `packages/core/src/env/schemas.ts`. Copy the template and fill
real values — never commit `.env.local`:

```bash
cp apps/reference/.env.example apps/reference/.env.local
```

### Platform-level (BeYours partner apps — `packageEnvSchema`)

| Variable | Required | Notes |
|----------|----------|-------|
| `UBER_EATS_CLIENT_ID` | for Uber Eats | Uber app client id |
| `UBER_EATS_CLIENT_SECRET` | for Uber Eats | Uber app client secret (also the default webhook signing key) |
| `UBER_EATS_WEBHOOK_SECRET` | optional | Dedicated webhook signing secret; if unset, the client secret is used |
| `DELIVEROO_CLIENT_ID` | for Deliveroo | Deliveroo app client id |
| `DELIVEROO_CLIENT_SECRET` | for Deliveroo | Deliveroo app client secret |
| `DELIVEROO_WEBHOOK_SECRET` | for Deliveroo | Webhook signing secret (required to accept webhooks) |

### Site-level (per restaurant — `siteEnvSchema`)

| Variable | Notes |
|----------|-------|
| `CONVEX_SITE_URL` | Convex HTTP origin; hosts webhook + OAuth callback endpoints |
| `ADMIN_URL` | Admin app origin used for OAuth post-callback redirect |
| `UBER_EATS_SANDBOX_MODE` | `"true"` or `"false"`. **Required** once the Uber Eats credentials are set (see below) |
| `DELIVEROO_BRAND_ID` / `DELIVEROO_SITE_ID` | The restaurant's Deliveroo identifiers |
| `DELIVEROO_IS_SANDBOX` | `"true"` or `"false"`. **Required** once the Deliveroo credentials are set |
| `ENCRYPTION_KEY` | 64 hex chars (32 bytes). Encrypts stored OAuth tokens at rest. `openssl rand -hex 32` |

---

## Sandbox vs production

These flags used to be read inline as `=== "true"`, which made an unset, empty or
mistyped value (`"True"`, `"1"`) mean **production**. They now go through
`isSandbox(platform)` from `@be-in-digital/core/env`, which inverts that:

- `"false"` → production. It is the only value that opens the live host.
- `"true"` → sandbox.
- unset, empty or anything else → **sandbox**, with one warning per flag in the log.

Being explicit is still required, not merely advised. `validateAllEnv()` refuses to
boot a deployment that has set an integration's credentials without declaring its
mode, so the omission surfaces at startup rather than on a live order. The fail-safe
default covers the one place that check cannot reach: the **Convex deployment**, which
carries its own environment store and runs no boot validation of its own. Set the flag
on both — `.env.local` for Next.js, `npx convex env set` for Convex.

> The `.env.example` and `.env.convex.example` templates ship them as `true`.

Base URLs are selected automatically per mode in
`packages/integrations/src/uber-eats/types.ts` (`UBER_EATS_URLS`) and
`packages/integrations/src/deliveroo/types.ts` (`DELIVEROO_URLS`):

| Mode | Uber Eats | Deliveroo |
|------|-----------|-----------|
| sandbox | `sandbox-login.uber.com` / `test-api.uber.com` | `auth-sandbox` / `api-sandbox.developers.deliveroo.com` |
| production | `login.uber.com` / `api.uber.com` | `auth` / `api.developers.deliveroo.com` |

---

## Uber Eats

### OAuth provisioning (connect a merchant)

Uber Eats uses an Authorization-Code flow (`eats.pos_provisioning`). Code:
`apps/reference/convex/uberEatsOAuth.ts` + `uberEatsOAuthHttp.ts`.

1. **Register the redirect URI** in the Uber developer portal (exactly):
   `${CONVEX_SITE_URL}/connect/uber-eats/callback`
2. Admin clicks "Connect Uber Eats" → `uberEatsOAuth.generateAuthorizeUrl`
   (admin-authenticated) builds the consent URL and stores a single-use,
   10-minute **CSRF `state`** in the `oauthStates` table.
3. The merchant consents at Uber and is redirected to the callback.
4. The callback (`uberEatsOAuthHttp.uberEatsConnectCallback`) **validates the
   `state`** (rejects missing/expired/forged before any token exchange), exchanges
   the code, and stores the **AES-256-GCM-encrypted** token in `uberEatsConnections`.

One merchant connection per deployment (multi-tenant model: one Convex instance
per restaurant).

### Uber Eats webhooks

- **Endpoint:** registered on the Convex HTTP router (`apps/reference/convex/http.ts`)
  → `uberEatsWebhook.handleWebhook`.
- **Signature:** header `x-uber-signature`, `HMAC-SHA256(signingSecret, rawBody)`
  hex, where `signingSecret = UBER_EATS_WEBHOOK_SECRET || UBER_EATS_CLIENT_SECRET`.
  Verified on the **raw** body before parsing. **Fail-closed**: an invalid
  signature returns `401` and the event is dropped.
- **Events handled:** `orders.notification` (new order), `orders.scheduled`,
  `eats.order.status_update`, `orders.cancel`, `eats.store.status_update`.
- Thin webhooks: the full order is fetched from the API, mapped, and saved.

### Production validation

Uber requires evidence that every required endpoint works. Two runners hit the
sandbox test client + test store and print method/path/status:

```bash
# Node CLI (reads .env)
node --env-file=.env --import tsx scripts/uber-eats-validation.ts
```

Or the Convex action `uberEatsActions.runValidation` for production-like execution.

**Destructive endpoints (Deny / Cancel order) are SKIPPED by default.** Enable
only deliberately, against a disposable test order:

```bash
UBER_EATS_TEST_ORDER_ID=... UBER_EATS_RUN_DESTRUCTIVE=true \
  node --env-file=.env --import tsx scripts/uber-eats-validation.ts
```

---

## Deliveroo

### Deliveroo webhooks

- **Endpoint:** Convex HTTP router → `deliverooWebhookHandler.handleWebhook`.
- **Signature:** headers `x-deliveroo-hmac-sha256` + `x-deliveroo-sequence-guid`;
  `HMAC-SHA256(secret, sequence_guid + " " + raw_body_bytes)` verified on raw
  bytes via `crypto.subtle.verify`, where
  `secret = DELIVEROO_WEBHOOK_SECRET || DELIVEROO_CLIENT_SECRET`.
- **Fail-closed in all environments** (including sandbox): an invalid/missing
  signature returns `401`. Deliveroo signs sandbox webhooks too, so a correct
  `DELIVEROO_WEBHOOK_SECRET` must be configured. If no secret is set the endpoint
  returns `503` (never processes unverified events).
- **Events handled:** `order.new`, `order.status_update`, and `menu.*`
  (upload_completed / upload_failed / validation_error).
- ASAP vs scheduled order handling and `sync_status` reporting follow Deliveroo's
  docs (`apps/reference/convex/deliverooWebhook.ts`).

### Menu sync & sandbox scenarios

The Deliveroo Menu API sandbox scenarios are exercised by
`scripts/deliveroo-menu-scenarios.sh`. It requires credentials **from the
environment** (no hardcoded defaults):

```bash
export DELIVEROO_CLIENT_ID=...        # Deliveroo sandbox app
export DELIVEROO_CLIENT_SECRET=...
export DELIVEROO_SITE_ID=...          # from the Developer Portal
./scripts/deliveroo-menu-scenarios.sh 1     # fetch brand id
./scripts/deliveroo-menu-scenarios.sh all   # run all scenarios
```

Menu upload (`PUT`) is naturally idempotent (full replace). Item availability and
the V3 async upload + webhook flows are covered by scenarios 8–17.

---

## Order flow, mapping & idempotence

```
Platform → Convex webhook (verify signature)
        → createFromWebhook (dedupe by externalOrderId + source)
        → [if new] kitchen ticket + order-mode handling
        → KDS / Orders page / analytics
Status updates ← updateFromWebhook ← platform status webhooks
```

- **Money is always integer cents** across the system (`orders` table, native
  orders, `formatPrice`, and the platform mappers). The Uber Eats and Deliveroo
  mappers must not convert to euros.
- **Idempotence:** `createFromWebhook` dedupes on `(externalOrderId, source)` and
  returns `{ orderId, created }`. On a retry (`created === false`) the webhook
  handlers **skip** kitchen-ticket creation and auto-accept/reject, so duplicate
  deliveries never create duplicate tickets or double-accept.
- **Order modes** (`storeIntegrations.orderMode`, default `manual`):
  - `manual` — order stays pending; staff accept in the KDS.
  - `auto_accept` — accepted automatically.
  - `auto_reject` — **destructive**: cancels the order and triggers a customer
    refund. Off by default; enable only intentionally.
- **Product mapping** uses `externalProductMappings` (PLU ↔ internal product).
  Unmatched/missing PLUs are logged and, for Deliveroo, reported via `sync_status`.

---

## Restaurant onboarding checklist

1. Provide platform credentials in the secret store (once per platform).
2. Set `CONVEX_SITE_URL`, `ADMIN_URL`, `ENCRYPTION_KEY`, and the sandbox flags.
3. **Uber Eats:** register the redirect URI, then run the OAuth connect flow from
   admin settings → Integrations. Verify `uberEatsConnections.status = connected`.
4. **Deliveroo:** set `DELIVEROO_BRAND_ID` / `DELIVEROO_SITE_ID`; register the
   webhook URL and `DELIVEROO_WEBHOOK_SECRET` in the Developer Portal.
5. Map products (`externalProductMappings`) and push the menu.
6. Place a sandbox test order; confirm it appears in Orders + KDS with correct
   totals (cents) and that a retry does not duplicate it.
7. Choose the order mode per store (start with `manual`).

---

## Secret rotation

Rotate on a schedule and immediately after any suspected exposure (e.g. a secret
committed to git — removing the file does **not** purge history).

1. Generate a new secret in the provider portal (Uber / Deliveroo / Stripe / AWS).
2. Update the value in every environment: GitHub Secrets, Convex env, Vercel env,
   and developers' `.env.local`. Never commit it.
3. Re-register webhook signing secrets where applicable and re-verify a signed
   test webhook returns `200`.
4. For Uber Eats, re-run the OAuth connect flow if the client secret changed.
5. Revoke the old secret once traffic is confirmed healthy.
6. Rotate `ENCRYPTION_KEY` only with a re-encryption migration of stored tokens.

---

## Production readiness checklist

- [ ] All secrets in the secret store; none in source, scripts, docs, or git history.
- [ ] `UBER_EATS_SANDBOX_MODE` / `DELIVEROO_IS_SANDBOX` set explicitly (`false` for prod),
      on the Next.js env **and** on the Convex deployment (`npx convex env list`).
- [ ] Webhook URLs + signing secrets registered; a signed test webhook returns `200`,
      an unsigned/forged one returns `401`.
- [ ] Uber Eats redirect URI registered; OAuth connect succeeds and stores an
      encrypted token; `state` mismatch is rejected.
- [ ] A duplicate (retried) order webhook does not create a second ticket or
      double-accept.
- [ ] Order totals render correctly (integer cents) for Uber, Deliveroo, and website.
- [ ] Order mode reviewed per store (`auto_reject` understood to refund customers).
- [ ] Uber production validation run captured (deny/cancel left disabled unless intended).
- [ ] Secret rotation owner + schedule defined.
```
