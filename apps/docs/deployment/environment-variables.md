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
| `SITE_URL` | `url` | Site origin for trusted origins |
| `ENCRYPTION_KEY` | `64-char hex` | AES-256-GCM encryption key |

### App URLs

| Variable | Validation | Description |
|----------|------------|-------------|
| `NEXT_PUBLIC_APP_URL` | `url` | Public app URL |
| `ADMIN_URL` | `url` | Admin redirect URL |

### AWS (Per-Restaurant)

| Variable | Validation | Description |
|----------|------------|-------------|
| `AWS_S3_BUCKET_NAME` | `string` | Restaurant's S3 bucket |
| `AWS_S3_PUBLIC_BASE_URL` | *not yet validated* | CDN origin serving the public S3 prefixes, no trailing slash. Required -- see [S3 Bucket Access Policy](./s3-bucket-policy.md) |
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
| `NEXT_PUBLIC_SENTRY_DSN` | `url` | Sentry DSN |
| `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` | `string` | Google Maps API key |

### Integrations (Site-Level)

| Variable | Validation | Description |
|----------|------------|-------------|
| `UBER_EATS_SANDBOX_MODE` | `'true' \| 'false'` | Sandbox mode flag |
| `DELIVEROO_BRAND_ID` | `string` | Restaurant's Deliveroo brand ID |
| `DELIVEROO_SITE_ID` | `string` | Restaurant's Deliveroo site ID |
| `DELIVEROO_IS_SANDBOX` | `'true' \| 'false'` | Sandbox mode flag |

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
