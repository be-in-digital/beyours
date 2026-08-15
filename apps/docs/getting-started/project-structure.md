# Project Structure

The BeYours Engine is organized as a **pnpm monorepo** with Turborepo orchestration.

## Repository Layout

```
beindigital/
├── packages/                    # Publishable npm packages
│   ├── ui/                      # React components (Radix + Tailwind)
│   ├── core/                    # Auth, i18n, payments, AWS
│   ├── restaurant/              # Business logic, stores, hooks
│   ├── admin/                   # Admin dashboard
│   ├── convex-schema/           # Database schema definitions
│   ├── convex-functions/        # Backend functions
│   ├── cms/                     # Content management system
│   ├── integrations/            # Uber Eats, Deliveroo, Uber Direct
│   ├── marketing/               # Email marketing
│   └── mcp-server/              # MCP server for AI assistants
│
├── apps/
│   ├── restaurant-theme/        # Main Next.js application
│   │   ├── app/
│   │   │   ├── (storefront)/    # Public pages (menu, cart, checkout)
│   │   │   ├── (admin)/         # Admin pages (dashboard, products, kitchen)
│   │   │   ├── game/[qrCodeId]/ # Gamification flow
│   │   │   └── api/             # Webhooks, uploads, printing
│   │   ├── components/          # App-specific components
│   │   ├── convex/              # Convex schema & functions
│   │   └── lib/                 # Utilities, stores, configs
│   │
│   ├── admin-dashboard/         # BeYours admin panel
│   └── docs/                    # This documentation
│
├── .github/workflows/           # CI/CD pipelines
├── turbo.json                   # Turborepo configuration
├── pnpm-workspace.yaml          # Workspace definitions
└── package.json                 # Root package.json
```

## Package Categories

### Frontend

| Package | Purpose |
|---------|---------|
| `@be-in-digital/ui` | Reusable React components |
| `@be-in-digital/restaurant` | Restaurant-specific logic |
| `@be-in-digital/admin` | Admin dashboard pages |

### Backend

| Package | Purpose |
|---------|---------|
| `@be-in-digital/convex-functions` | Server-side functions |
| `@be-in-digital/integrations` | Third-party API clients |

### Shared

| Package | Purpose |
|---------|---------|
| `@be-in-digital/core` | Auth, payments, i18n, AWS |
| `@be-in-digital/convex-schema` | Schema definitions and types |
| `@be-in-digital/cms` | CMS block registry |
| `@be-in-digital/marketing` | Email template rendering |

### Tooling

| Package | Purpose |
|---------|---------|
| `@be-in-digital/mcp-server` | AI assistant integration |

## Dependency Graph

```
admin ──▶ ui, core, restaurant
restaurant ──▶ core, convex-schema
core ──▶ convex-schema
convex-functions ──▶ convex-schema
marketing ──▶ (standalone)
integrations ──▶ (standalone)
cms ──▶ (standalone)
mcp-server ──▶ (standalone)
```

## Key Configuration Files

| File | Purpose |
|------|---------|
| `turbo.json` | Task pipeline (build, test, lint) |
| `pnpm-workspace.yaml` | Workspace package discovery |
| `.npmrc` | GitHub Packages registry config |
| `.changeset/config.json` | Changesets versioning config |
| `.github/workflows/release.yml` | Automated publishing pipeline |

## Conventions

- **TypeScript strict mode** in all packages
- **Zod** for runtime validation at boundaries
- **Barrel files** (`index.ts`) in each package for clean exports
- **PascalCase** for components, **camelCase** for utilities
- **Zustand** for client state, **Convex** for server state
