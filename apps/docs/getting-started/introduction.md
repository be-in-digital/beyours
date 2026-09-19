# Introduction

**BeYours Engine** is a modular, production-ready platform for building restaurant e-commerce applications. It provides everything you need — from UI components and payment processing to kitchen display systems and gamification.

## What is BeYours Engine?

BeYours Engine is a collection of 10+ TypeScript packages that work together to power a complete restaurant management platform:

- **Storefront** — Menu display, cart, checkout, order tracking
- **Admin Dashboard** — Product management, orders, kitchen, sales overview (revenue, orders, average basket, last 7 days)
- **Kitchen Display System** — Real-time order tickets with browser printing
- **Gamification** — QR-based games (Wheel of Fortune, Scratch Cards) to drive engagement
- **Multi-language** — Automatic translation via GPT-3.5-turbo
- **Multi-store** — One owner, unlimited locations
- **Delivery** — Uber Eats, Deliveroo, Uber Direct integration
- **Payments** — Stripe, SumUp, PayPal, cash (Square announced, not implemented)

## Business Model

| Aspect | Detail |
|--------|--------|
| Product | Next.js restaurant theme (sold once) |
| Multi-store | 1 restaurant owner = unlimited locations |
| Pricing | Per store |
| Maintenance | 1 year included, then annual renewal |

## How Packages Work Together

Each package is independently published on GitHub Packages under the `@be-yours` scope. You install only what you need:

```bash
# Core essentials
pnpm add @be-yours/ui @be-yours/core

# Business logic
pnpm add @be-yours/restaurant @be-yours/admin

# Backend
pnpm add @be-yours/convex-schema @be-yours/convex-functions

# Optional features
pnpm add @be-yours/integrations  # Uber Eats, Deliveroo
pnpm add @be-yours/marketing     # Email campaigns
pnpm add @be-yours/cms           # Content management
```

## Prerequisites

- **Node.js** 20+
- **pnpm** 9+
- **Convex** account (for backend)
- **GitHub** account with access to be-yours organization
- **AWS** account (for S3 storage and SES email)

## Next Steps

- [Installation](./installation.md) — Set up your development environment
- [Quick Start](./quick-start.md) — Build your first restaurant app in 10 minutes
- [Project Structure](./project-structure.md) — Understand the monorepo layout
