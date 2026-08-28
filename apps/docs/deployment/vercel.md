# Vercel Deployment

> Deploy your restaurant app to Vercel with private GitHub Packages support.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Setup](#setup)
- [Environment Variables](#environment-variables)
- [Build Configuration](#build-configuration)
- [Custom Domains](#custom-domains)

## Prerequisites

- Vercel account
- GitHub repository connected to Vercel
- `GITHUB_TOKEN` with `read:packages` scope

## Setup

### 1. Link Project

```bash
vercel link
```

### 2. Add GITHUB_TOKEN

Vercel needs access to GitHub Packages during the build:

```bash
vercel env add GITHUB_TOKEN
```

Enter your GitHub PAT with `read:packages` scope. Add it for all environments (Production, Preview, Development).

### 3. Configure .npmrc

Ensure your `.npmrc` is committed to the repo:

```ini
@be-in-digital:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=${GITHUB_TOKEN}
```

Vercel will substitute `${GITHUB_TOKEN}` with the environment variable during build.

## Environment Variables

Add all required variables via the Vercel dashboard or CLI:

```bash
# Core
vercel env add NEXT_PUBLIC_CONVEX_URL
vercel env add CONVEX_DEPLOYMENT

# AWS
vercel env add AWS_REGION
vercel env add AWS_ACCESS_KEY_ID
vercel env add AWS_SECRET_ACCESS_KEY
vercel env add AWS_S3_BUCKET_NAME
vercel env add AWS_SES_FROM_EMAIL

# Payments
vercel env add STRIPE_SECRET_KEY
vercel env add STRIPE_WEBHOOK_SECRET

# Translation
vercel env add OPENAI_API_KEY

# Monitoring — one Sentry project per client. NEXT_PUBLIC_ means it is baked in
# at build time: adding it after a deploy changes nothing until the next build.
vercel env add NEXT_PUBLIC_SENTRY_DSN
# Source maps, all three or none (see deployment/sentry.md)
vercel env add SENTRY_ORG
vercel env add SENTRY_PROJECT
vercel env add SENTRY_AUTH_TOKEN

# GitHub Packages
vercel env add GITHUB_TOKEN
```

## Build Configuration

### Vercel Settings

| Setting | Value |
|---------|-------|
| Framework | Next.js |
| Build Command | `pnpm build` |
| Output Directory | `.next` |
| Install Command | `pnpm install` |
| Node.js Version | 20.x |

### For Monorepo

If deploying from the monorepo, set the **Root Directory** to the app folder:

```
Root Directory: apps/themes
```

### Turborepo Integration

Vercel automatically detects Turborepo and enables:
- Remote caching
- Optimized builds (only rebuilds changed packages)
- Parallel task execution

## Custom Domains

```bash
# Add a domain
vercel domains add restaurant.com

# Add a subdomain
vercel domains add paris.restaurant.com
```

### Multi-Store Domains

Each store can have its own domain or subdomain:

| Store | Domain |
|-------|--------|
| Paris | paris.labella.com |
| Lyon | lyon.labella.com |
| Marseille | marseille.labella.com |

## Deployment Checklist

- [ ] All environment variables configured
- [ ] `GITHUB_TOKEN` added for package access
- [ ] `.npmrc` committed to repo
- [ ] Custom domain configured (optional)
- [ ] Stripe webhook URL updated to production domain
- [ ] Convex deployment pointing to production
- [ ] SSL certificate active
