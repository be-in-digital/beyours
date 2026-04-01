# Environment Variables Reference

> Complete list of all environment variables used by BeInDigital Engine.

## Required Variables

### Convex

| Variable | Description | Example |
|----------|-------------|---------|
| `NEXT_PUBLIC_CONVEX_URL` | Convex deployment URL | `https://your-app.convex.cloud` |
| `CONVEX_DEPLOYMENT` | Convex deployment name | `your-app` |

### AWS

| Variable | Description | Example |
|----------|-------------|---------|
| `AWS_REGION` | AWS region | `eu-west-1` |
| `AWS_ACCESS_KEY_ID` | IAM access key | `AKIA...` |
| `AWS_SECRET_ACCESS_KEY` | IAM secret key | `wJa...` |
| `AWS_S3_BUCKET_NAME` | S3 bucket for uploads | `my-restaurant-assets` |
| `AWS_SES_FROM_EMAIL` | SES sender email | `noreply@restaurant.com` |

### GitHub Packages

| Variable | Description | Example |
|----------|-------------|---------|
| `GITHUB_TOKEN` | PAT with `read:packages` | `ghp_...` |

## Optional Variables

### Payments

| Variable | Description | Required For |
|----------|-------------|-------------|
| `STRIPE_SECRET_KEY` | Stripe secret key | Stripe payments |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signing secret | Stripe webhooks |
| `NEXT_PUBLIC_STRIPE_KEY` | Stripe publishable key | Stripe frontend |
| `SUMUP_API_KEY` | SumUp API key | SumUp payments |
| `PAYPAL_CLIENT_ID` | PayPal client ID | PayPal payments |
| `PAYPAL_CLIENT_SECRET` | PayPal secret | PayPal payments |
| `SQUARE_ACCESS_TOKEN` | Square access token | Square payments |

### Integrations

| Variable | Description | Required For |
|----------|-------------|-------------|
| `UBER_EATS_API_KEY` | Uber Eats API key | Uber Eats |
| `UBER_EATS_CLIENT_SECRET` | Uber Eats secret | Uber Eats webhooks |
| `DELIVEROO_API_KEY` | Deliveroo API key | Deliveroo |
| `DELIVEROO_WEBHOOK_SECRET` | Deliveroo secret | Deliveroo webhooks |
| `UBER_DIRECT_CUSTOMER_ID` | Uber Direct customer ID | Uber Direct delivery |
| `UBER_DIRECT_CLIENT_SECRET` | Uber Direct secret | Uber Direct |

### Translation

| Variable | Description | Required For |
|----------|-------------|-------------|
| `OPENAI_API_KEY` | OpenAI API key | GPT auto-translation |

## .env.local Template

```env
# === Required ===

# Convex
NEXT_PUBLIC_CONVEX_URL=
CONVEX_DEPLOYMENT=

# AWS
AWS_REGION=eu-west-1
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
AWS_S3_BUCKET_NAME=
AWS_SES_FROM_EMAIL=

# GitHub Packages
GITHUB_TOKEN=

# === Optional ===

# Payments
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
NEXT_PUBLIC_STRIPE_KEY=
SUMUP_API_KEY=
PAYPAL_CLIENT_ID=
PAYPAL_CLIENT_SECRET=
SQUARE_ACCESS_TOKEN=

# Integrations
UBER_EATS_API_KEY=
UBER_EATS_CLIENT_SECRET=
DELIVEROO_API_KEY=
DELIVEROO_WEBHOOK_SECRET=
UBER_DIRECT_CUSTOMER_ID=
UBER_DIRECT_CLIENT_SECRET=

# Translation
OPENAI_API_KEY=
```

## Security Notes

1. **Never commit `.env.local`** — It's in `.gitignore` by default
2. **Use environment-specific values** — Different keys for dev/staging/prod
3. **Rotate keys regularly** — Especially payment provider keys
4. **Use Vercel's env management** — `vercel env add` for production variables
5. **Restrict PAT scopes** — Use minimal permissions (`read:packages` only for consumers)
