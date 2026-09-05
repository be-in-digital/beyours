# Installation

This guide walks you through setting up a project that uses `@be-in-digital` packages.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Configure GitHub Packages](#configure-github-packages)
- [Install Packages](#install-packages)
- [Configure Convex](#configure-convex)
- [Configure AWS](#configure-aws)
- [Environment Variables](#environment-variables)
- [Troubleshooting](#troubleshooting)

## Prerequisites

| Tool | Version | Check |
|------|---------|-------|
| Node.js | 20+ | `node --version` |
| pnpm | 9+ | `pnpm --version` |
| Git | 2.x | `git --version` |

## Configure GitHub Packages

All `@be-in-digital` packages are hosted privately on **GitHub Packages**. You need a Personal Access Token (PAT) to install them.

### 1. Create a GitHub PAT

1. Go to [GitHub Settings > Developer settings > Personal access tokens > Tokens (classic)](https://github.com/settings/tokens)
2. Click **Generate new token (classic)**
3. Select the `read:packages` scope
4. Copy the generated token

### 2. Configure .npmrc

Create or update `.npmrc` at the root of your project:

```ini
@be-in-digital:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=${GITHUB_TOKEN}
```

### 3. Set the Environment Variable

```bash
# macOS / Linux — add to ~/.zshrc or ~/.bashrc
export GITHUB_TOKEN=ghp_your_token_here

# Or create a .env file (DO NOT commit this)
echo "GITHUB_TOKEN=ghp_your_token_here" >> .env
```

> **Security**: Never commit your `.npmrc` with a hardcoded token. Always use environment variables.

## Install Packages

### New Project

```bash
# Create a new Next.js project
pnpx create-next-app@latest my-restaurant --typescript --tailwind --app

cd my-restaurant

# Install core packages
pnpm add @be-in-digital/ui @be-in-digital/core @be-in-digital/restaurant

# Install backend packages
pnpm add @be-in-digital/convex-schema @be-in-digital/convex-functions

# Optional: Install admin dashboard
pnpm add @be-in-digital/admin
```

### Existing Project

```bash
# Add the .npmrc first (see above), then:
pnpm add @be-in-digital/ui
```

## Configure Convex

BeYours uses [Convex](https://convex.dev) as its backend.

```bash
# Install Convex
pnpm add convex

# Initialize Convex in your project
pnpx convex dev
```

Set the Convex environment variables:

```env
NEXT_PUBLIC_CONVEX_URL=https://your-deployment.convex.cloud
CONVEX_DEPLOYMENT=your-deployment-name
```

## Configure AWS

For file uploads (S3) and transactional emails (SES):

```env
AWS_REGION=eu-west-1
AWS_ACCESS_KEY_ID=AKIA...
AWS_SECRET_ACCESS_KEY=...
AWS_S3_BUCKET_NAME=your-bucket
AWS_SES_FROM_EMAIL=noreply@yourdomain.com
```

## Environment Variables

Create a `.env.local` file with all required variables:

```env
# Convex
NEXT_PUBLIC_CONVEX_URL=
CONVEX_DEPLOYMENT=

# AWS
AWS_REGION=eu-west-1
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
AWS_S3_BUCKET_NAME=
AWS_SES_FROM_EMAIL=

# Payments (add the ones you use)
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
SUMUP_API_KEY=
PAYPAL_CLIENT_ID=
PAYPAL_CLIENT_SECRET=
# No SQUARE_* variable: Square has no implementation to configure.

# Translation
OPENAI_API_KEY=

# Integrations (optional)
UBER_EATS_API_KEY=
DELIVEROO_API_KEY=
UBER_DIRECT_CUSTOMER_ID=
```

## Tailwind CSS Configuration

If using `@be-in-digital/ui`, update your `tailwind.config.ts`:

```typescript
import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}",
    // Scan @be-in-digital/ui components
    "./node_modules/@be-in-digital/ui/**/*.{js,ts,jsx,tsx}",
  ],
  // ...
};

export default config;
```

## Troubleshooting

### `401 Unauthorized` when installing packages

Your `GITHUB_TOKEN` is missing or invalid. Verify:

```bash
echo $GITHUB_TOKEN  # Should output your token
npm whoami --registry=https://npm.pkg.github.com  # Should show your GitHub username
```

### `404 Not Found` for a package

Ensure you have access to the `be-in-digital` GitHub organization and the package exists.

### Peer dependency warnings

Install the required peer dependencies:

```bash
pnpm add react@^19 react-dom@^19 react-hook-form@^7 @hookform/resolvers@^3
```

## Next Steps

- [Quick Start](./quick-start.md) — Build your first restaurant app
- [Project Structure](./project-structure.md) — Understand the layout
