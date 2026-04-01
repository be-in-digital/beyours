# Introduction

**BeInDigital Engine** is a modular, production-ready platform for building restaurant e-commerce applications. It provides everything you need — from UI components and payment processing to kitchen display systems and gamification.

## What is BeInDigital Engine?

BeInDigital Engine is a collection of 10+ TypeScript packages that work together to power a complete restaurant management platform:

- **Storefront** — Menu display, cart, checkout, order tracking
- **Admin Dashboard** — Product management, orders, kitchen, analytics
- **Kitchen Display System** — Real-time order tickets with thermal printing
- **Gamification** — QR-based games (Wheel of Fortune, Scratch Cards) to drive engagement
- **Multi-language** — Automatic translation via GPT-3.5-turbo
- **Multi-store** — One owner, unlimited locations
- **Delivery** — Uber Eats, Deliveroo, Uber Direct integration
- **Payments** — Stripe, SumUp, PayPal, Square

## Business Model

| Aspect | Detail |
|--------|--------|
| Product | Next.js restaurant theme (sold once) |
| Multi-store | 1 restaurant owner = unlimited locations |
| Pricing | Per store |
| Maintenance | 1 year included, then annual renewal |

## How Packages Work Together

Each package is independently published on GitHub Packages under the `@be-in-digital` scope. You install only what you need:

```bash
# Core essentials
pnpm add @be-in-digital/ui @be-in-digital/core

# Business logic
pnpm add @be-in-digital/restaurant @be-in-digital/admin

# Backend
pnpm add @be-in-digital/convex-schema @be-in-digital/convex-functions

# Optional features
pnpm add @be-in-digital/integrations  # Uber Eats, Deliveroo
pnpm add @be-in-digital/marketing     # Email campaigns
pnpm add @be-in-digital/cms           # Content management
pnpm add @be-in-digital/themes        # Pre-built themes
```

## Prerequisites

- **Node.js** 20+
- **pnpm** 9+
- **Convex** account (for backend)
- **GitHub** account with access to be-in-digital organization
- **AWS** account (for S3 storage and SES email)

## Next Steps

- [Installation](./installation.md) — Set up your development environment
- [Quick Start](./quick-start.md) — Build your first restaurant app in 10 minutes
- [Project Structure](./project-structure.md) — Understand the monorepo layout
