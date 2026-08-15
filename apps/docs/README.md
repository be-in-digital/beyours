# @be-in-digital Documentation

Welcome to the official documentation for the **BeInDigital Engine** — a premium Next.js e-commerce platform for restaurants.

## Quick Links

| Section | Description |
|---------|-------------|
| [Getting Started](./getting-started/introduction.md) | Introduction, installation, and first steps |
| [Packages](./packages/) | Detailed docs for each of the 10 packages |
| [Guides](./guides/) | Feature-specific implementation guides |
| [Deployment](./deployment/) | GitHub Packages, Vercel, and environment setup |
| [API Reference](./api-reference/) | Convex API and REST endpoint documentation |

## Packages Overview

| Package | Description | Category |
|---------|-------------|----------|
| [@be-in-digital/ui](./packages/ui.md) | 45+ React components (Radix UI + Tailwind) | Frontend |
| [@be-in-digital/core](./packages/core.md) | Auth, i18n, payments, AWS services | Shared |
| [@be-in-digital/restaurant](./packages/restaurant.md) | Business logic, Zustand stores, hooks | Frontend |
| [@be-in-digital/admin](./packages/admin.md) | Admin dashboard pages and components | Frontend |
| [@be-in-digital/convex-schema](./packages/convex-schema.md) | 50+ table definitions, validators, types | Shared |
| [@be-in-digital/convex-functions](./packages/convex-functions.md) | 48 backend function modules | Backend |
| [@be-in-digital/cms](./packages/cms.md) | Custom CMS with block registry | Shared |
| [@be-in-digital/integrations](./packages/integrations.md) | Uber Eats, Deliveroo API clients | Backend |
| [@be-in-digital/marketing](./packages/marketing.md) | Email marketing with 28 block types | Shared |
| [@be-in-digital/mcp-server](./packages/mcp-server.md) | MCP server for AI assistants | Tooling |

## Architecture

```
┌─────────────────────────────────────────────────┐
│                  Next.js App                     │
│    ┌──────────┐  ┌──────────┐  ┌──────────┐     │
│    │  Themes  │  │   Admin  │  │Restaurant│     │
│    └────┬─────┘  └────┬─────┘  └────┬─────┘     │
│         │              │              │           │
│    ┌────┴──────────────┴──────────────┴────┐     │
│    │              @be-in-digital/ui        │     │
│    └──────────────────┬───────────────────┘     │
│                        │                         │
│    ┌──────────────────┴───────────────────┐     │
│    │           @be-in-digital/core        │     │
│    │    (Auth, i18n, Payments, AWS)       │     │
│    └──────────────────┬───────────────────┘     │
└────────────────────────┼─────────────────────────┘
                         │
┌────────────────────────┼─────────────────────────┐
│              Convex Backend                       │
│    ┌──────────────────┴───────────────────┐     │
│    │     @be-in-digital/convex-functions   │     │
│    │     @be-in-digital/convex-schema      │     │
│    └──────────────────────────────────────┘     │
└──────────────────────────────────────────────────┘
```

## Tech Stack

- **Framework**: Next.js 16 (App Router)
- **Backend**: Convex (real-time BaaS)
- **Styling**: Tailwind CSS + shadcn/ui
- **State**: Zustand (client) + Convex (server)
- **Auth**: Better Auth + Convex
- **Payments**: Stripe, SumUp, PayPal, Square
- **Storage**: AWS S3
- **Email**: AWS SES
- **i18n**: GPT-3.5-turbo auto-translation
- **Monorepo**: pnpm + Turborepo
- **Registry**: GitHub Packages (private)

## License

Private — All rights reserved. BeInDigital Team.
