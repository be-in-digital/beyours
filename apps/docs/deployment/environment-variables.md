# Environment Variables Reference

> Complete list of all environment variables used by BeYours Engine with Zod-validated startup checks.

## Quick Setup

```bash
# Copy the example file
cp apps/reference/.env.example apps/reference/.env.local

# Fill in the values
```

## Two-Tier Architecture

BeYours uses a two-tier environment variable system:

| Tier | Description | Who Manages |
|------|-------------|-------------|
| **Package-level** | Shared across all restaurant deployments | BeYours platform team |
| **Site-level** | Unique per restaurant deployment | Restaurant owner / deployer |

Package-level values are identical on every client deployment, so they have one
source rather than one copy per client:
[`infisical.md`](./infisical.md). Site-level values stay in each client's own
`.env.local` / `.env.convex`.

## Startup Validation

All env vars are validated at app startup using Zod schemas. The validation runs in `instrumentation.ts`:

```typescript
import { validateAllEnv, formatEnvReport } from "@be-in-digital/core/env";

const { ok, missing } = validateAllEnv();
if (!ok) console.error(formatEnvReport(missing));
```

The formatted report shows:

```
╔══════════════════════════════════════════════════════════════╗
║         VARIABLES D'ENVIRONNEMENT MANQUANTES               ║
╚══════════════════════════════════════════════════════════════╝

  ── Package-level (BeYours Platform) ──
    ✗ AWS_REGION: Required
    ✗ OPENAI_API_KEY: Invalid input

  ── Site-level (Per Restaurant) ──
    ✗ NEXT_PUBLIC_CONVEX_URL: Invalid url

  Total: 3 variable(s) manquante(s) ou invalide(s)
  → Copiez .env.example vers .env.local et remplissez les valeurs.
```

- **Production**: Throws an error, preventing startup with missing vars
- **Development**: Logs warning, continues running

## Package-Level Variables (BeYours Platform)

| Variable | Required | Validation | Description |
|----------|----------|------------|-------------|
| `AWS_REGION` | Yes | `string.min(1)` | AWS region |
| `AWS_ACCESS_KEY_ID` | Yes | `string.min(1)` | IAM access key |
| `AWS_SECRET_ACCESS_KEY` | Yes | `string.min(1)` | IAM secret key |
| `OPENAI_API_KEY` | Yes | `startsWith('sk-')` | OpenAI API key for translations |
| `UBER_EATS_CLIENT_ID` | No | `string` | Uber Eats app partner credential |
| `UBER_EATS_CLIENT_SECRET` | No | `string` | Uber Eats secret |
| `UBER_EATS_WEBHOOK_SECRET` | No | `string` | Uber Eats webhook verification |
| `DELIVEROO_CLIENT_ID` | No | `string` | Deliveroo app partner credential |
| `DELIVEROO_CLIENT_SECRET` | No | `string` | Deliveroo secret |
| `DELIVEROO_WEBHOOK_SECRET` | No | `string` | Deliveroo webhook verification |

## Site-Level Variables (Per Restaurant)

### Convex

| Variable | Validation | Description |
|----------|------------|-------------|
| `CONVEX_DEPLOYMENT` | `string` | Convex deployment ID |
| `NEXT_PUBLIC_CONVEX_URL` | `url` | Public Convex URL |
| `CONVEX_SITE_URL` | `url` | Convex site URL |

### Authentication

| Variable | Validation | Description |
|----------|------------|-------------|
| `BETTER_AUTH_SECRET` | `string` | Auth secret |
| `BETTER_AUTH_URL` | `url` | Auth service URL |
| `SITE_URL` | `url` | Site origin for trusted origins, and where Convex posts transactional mail |
| `ENCRYPTION_KEY` | `64-char hex` | AES-256-GCM encryption key |
| `EMAIL_API_SECRET` | `string, ≥32` | Bearer token for `POST /api/email/send`. Set on **both** sides |
| `ADMIN_BOOTSTRAP_TOKEN` | `string` | Claims the first super-admin seat. Set on the **Convex** deployment |
| `AUTH_ALLOW_UNVERIFIED_EMAIL` | `'true' \| 'false'` | Relaxes email verification. Test deployments only |

**`SITE_URL`, `BETTER_AUTH_SECRET`/`EMAIL_API_SECRET` and `ADMIN_BOOTSTRAP_TOKEN`
live on the Convex deployment too**, not only in `.env.local`: a Convex function
does not read the Next.js environment. Without the first two, no verification or
password-reset mail can leave the deployment — sign-up mints a token and sends
nothing, and the account can never be signed in to. Without the third, no first
administrator can be appointed.

```bash
npx convex env set SITE_URL              https://<client-domain>
npx convex env set BETTER_AUTH_SECRET    "$(openssl rand -base64 32)"
npx convex env set ADMIN_BOOTSTRAP_TOKEN "$(openssl rand -base64 32)"
```

Full procedure: [`first-administrator.md`](./first-administrator.md).

### App URLs

| Variable | Validation | Description |
|----------|------------|-------------|
| `NEXT_PUBLIC_APP_URL` | `url` | Public app URL |
| `ADMIN_URL` | `url` | Admin redirect URL |

### AWS (Per-Restaurant)

| Variable | Validation | Description |
|----------|------------|-------------|
| `AWS_S3_BUCKET_NAME` | `string` | Restaurant's S3 bucket (private — see [S3 bucket policy](./s3-bucket-policy.md)) |
| `AWS_S3_PUBLIC_BASE_URL` | `url` | CDN fronting the bucket. Unset: media is served by `/api/files` |
| `AWS_SES_FROM_EMAIL` | `email` | Sender email |
| `AWS_SES_FROM_NAME` | `string` | Sender name |
| `AWS_SES_REPLY_TO_EMAIL` | `email` | Reply-to email |
| `AWS_SES_CONFIGURATION_SET` | `string` | SES configuration set |

### Payments

| Variable | Validation | Description |
|----------|------------|-------------|
| `STRIPE_SECRET_KEY` | `startsWith('sk_')` | Stripe secret key |
| `STRIPE_PUBLISHABLE_KEY` | `startsWith('pk_')` | Stripe publishable key |
| `STRIPE_WEBHOOK_SECRET` | `startsWith('whsec_')` | Stripe webhook secret |
| `PAYPAL_CLIENT_ID` | `string` | PayPal client ID |
| `PAYPAL_CLIENT_SECRET` | `string` | PayPal secret |
| `SUMUP_CLIENT_ID` | `string` | SumUp client ID |
| `SUMUP_CLIENT_SECRET` | `string` | SumUp secret |

### Monitoring & Maps

| Variable | Validation | Description |
|----------|------------|-------------|
| `NEXT_PUBLIC_SENTRY_DSN` | `url` | Sentry DSN — one project per client. Unset, Sentry never initialises |
| `NEXT_PUBLIC_SENTRY_ENVIRONMENT` | `string` | Environment override; falls back to `VERCEL_ENV`, then `NODE_ENV` |
| `NEXT_PUBLIC_SENTRY_RELEASE` | `string` | Release override; falls back to `VERCEL_GIT_COMMIT_SHA` |
| `NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE` | `0` to `1` | Defaults to 0.1 in production |
| `SENTRY_ORG` | `string` | Source-map upload — build time, all three or none |
| `SENTRY_PROJECT` | `string` | Source-map upload — build time |
| `SENTRY_AUTH_TOKEN` | `string` | Source-map upload — build-host secret |
| `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` | `string` | Google Maps API key — **must** be restricted by HTTP referrer |

`NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` ships in the browser bundle by design; what
keeps it from being reused elsewhere is the referrer restriction on Google's
side, not secrecy. Unrestricted, it bills the client's account for traffic they
never served. Procedure:
[`first-administrator.md`](./first-administrator.md#part-2--restrict-next_public_google_maps_api_key).

Full procedure for a new client: [`sentry.md`](./sentry.md).

### Integrations (Site-Level)

| Variable | Validation | Description |
|----------|------------|-------------|
| `UBER_EATS_SANDBOX_MODE` | `'true' \| 'false'` | Sandbox mode. Required once the Uber Eats credentials are set; unset resolves to sandbox, never production |
| `DELIVEROO_BRAND_ID` | `string` | Restaurant's Deliveroo brand ID |
| `DELIVEROO_SITE_ID` | `string` | Restaurant's Deliveroo site ID |
| `DELIVEROO_IS_SANDBOX` | `'true' \| 'false'` | Sandbox mode. Required once the Deliveroo credentials are set; unset resolves to sandbox, never production |

### GitHub Packages

| Variable | Description |
|----------|-------------|
| `GITHUB_TOKEN` | PAT with `read:packages` scope |

## Programmatic Access

```typescript
// Validated getters (lazy-loaded, memoized)
import { getPackageEnv, getSiteEnv } from "@be-in-digital/core/env";

const { AWS_REGION } = getPackageEnv();
const { STRIPE_SECRET_KEY } = getSiteEnv();

// Schemas for custom validation
import { packageEnvSchema, siteEnvSchema } from "@be-in-digital/core/env";
```

## Security Notes

1. **Never commit `.env.local`** -- It's in `.gitignore` by default
2. **Use `.env.example`** -- Template with all variables, no secrets
3. **Use environment-specific values** -- Different keys for dev/staging/prod
4. **Rotate keys regularly** -- Especially payment provider keys
5. **Use Vercel's env management** -- `vercel env add` for production variables
6. **Restrict PAT scopes** -- Use minimal permissions (`read:packages` only for consumers)
