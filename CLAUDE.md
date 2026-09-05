# CLAUDE.md - BeInDigital Engine

## 🎯 Project Overview

**BeInDigital Engine** is a premium Next.js e-commerce platform for restaurants with Convex backend. We sell specialized themes by restaurant type that owners can purchase and customize.

### Business Model
- **Product**: Next.js theme sold once per restaurant
- **Multi-store**: 1 restaurant owner = 1-∞ locations (unlimited)
- **Pricing**: Per store
- **Maintenance**: 1 year included, then annual renewal

---

## 🔧 Tech Stack

### Frontend
- **Framework**: Next.js 16 (App Router)
- **Styling**: Tailwind CSS
- **UI**: shadcn/ui
- **State**: Zustand (client) + Convex Hooks (server)
- **Forms**: React Hook Form + Zod
- **i18n**: Cookies/localStorage
- **Testing**: Vitest (unit) + Playwright (e2e)

### Backend
- **BaaS**: Convex (1 instance per client)
- **Auth**: Better Auth + Convex
- **Storage**: AWS S3
- **Email**: AWS SES
- **Real-time**: Convex Subscriptions

### Package Management
- **Manager**: pnpm
- **Monorepo**: Turborepo
- **Registry**: GitHub Packages (private)

### Integrations
- **Payments**: Stripe, SumUp, PayPal, Cash — Square is announced, not built
- **Delivery**: Uber Direct
- **Platforms**: Uber Eats, Deliveroo
- **Translation**: GPT-3.5-turbo

---

## 📁 Repository Structure

```
beindigital/
├── packages/
│   ├── ui/                    # React Components
│   ├── core/                  # Auth, i18n, Payments, AWS
│   ├── restaurant/            # Business Logic, Zustand stores
│   ├── integrations/          # Uber Eats, Deliveroo, Uber Direct
│   ├── marketing/             # Email campaigns, segments, subscribers
│   ├── cms/                   # Custom CMS
│   ├── convex-schema/         # DB Schemas
│   ├── convex-functions/      # Backend Functions
│   ├── admin/                 # Admin Pages, Stores, Hooks
│   └── mcp-server/            # MCP Package Registry
│
├── apps/
│   ├── site/                  # @beyours/site — commercial site → beyours.fr
│   │   ├── app/               # Marketing, template catalogue, Stripe checkout,
│   │   │                      # affiliate portal, internal ops console
│   │   └── convex/            # Its OWN Convex backend (separate from the engine)
│   │
│   ├── reference/             # @beyours/reference — the engine's test bench
│   │   ├── app/               # Storefront, admin, CMS, kitchen display, QR games
│   │   ├── components/        # UI, Storefront, Admin, Game
│   │   ├── lib/               # Stores, Utils, AWS, Printing, Translation
│   │   ├── convex/            # Schema, Functions (thin wrappers over the packages)
│   │   ├── e2e/               # Playwright tests — the CI e2e target
│   │   └── __tests__/         # Vitest tests
│   │
│   ├── themes/                # @beyours/themes — the client template (cloned per client)
│   │   ├── templates/         # Vertical designs (pizzeria, fast-food, food-truck…)
│   │   ├── demos/             # 50 sales demos
│   │   ├── site/              # CLIENT zone — per-site customization
│   │   └── convex/            # Same wrappers as reference
│   │
│   └── docs/                  # Documentation (no package.json)
│
├── .github/workflows/         # CI/CD (tests, lint, deploy)
├── turbo.json
└── package.json
```

**Three applications, three audiences.** `apps/site` is the commercial site and
depends on **none** of the engine packages — it is a website, not an instance of the
product. `apps/reference` is where an engine feature is built and proven; it is sold
to nobody. `apps/themes` is the shippable counterpart, cloned into one repo and one
Convex backend per client.

**Two scopes, deliberately.** The three apps use `@beyours/*`; the ten engine packages
under `packages/` use `@be-in-digital/*` (private GitHub Packages). Installing them
needs a `read:packages` PAT in `NODE_AUTH_TOKEN`; without one, use
`pnpm engine:link <engine-clone>` from inside `apps/themes` for local symlinks
(the script lives there, not at the root).

> **BeYours is the product sold to restaurant owners. BeInDigital is the agency.**
> Two brands, two businesses — read the Naming section of `README.md` before any
> find-and-replace.

---

## 🗄️ Key Database Schemas

**Multi-tenant**: one **Convex deployment** per client — isolation is a whole
backend, not a schema inside a shared database. No SQL database is involved;
neither Neon nor Postgres appears anywhere in the codebase.

### Core Tables
- `stores`, `products`, `menus`, `orders`, `userProfiles`
- Auth tables (`user`, `session`, `account`, `verification`, `jwks`) are owned by
  the Better Auth component and are **not** declared in
  `packages/convex-schema/src/schema.ts` — see its comment at `:80-87`. There is
  no `users` or `sessions` table to query.

### Kitchen System
- `kitchenTickets` (auto-print). Print config lives on `stores.printConfig`.
  There is no `printerSettings` table: it was declared for the unbuilt ESC/POS
  path, never gained a reader or a writer, and has been removed. The thermal
  path when it comes is cloud printing, whose shape `stores.printConfig`
  already carries.

### Gamification
- `gameQRCodes`, `requiredActions`, `games` (win ratio), `prizes`, `gamePlays`, `prizeRedemptions`

### i18n
- `languages` (dynamic, unlimited), `translations`, `translationJobs` (GPT)

### Integrations
- Platform links live in the `storeIntegrations` table, keyed by `storeId` +
  `platform`. `stores.integrations` is still declared as `v.optional(v.any())`
  because old documents hold it, but **nothing reads or writes it**
  (`packages/convex-schema/src/tables/stores.ts:149-154`).
- Products have `externalIds.uberEatsId`, `externalIds.deliverooId`

---

## 🎯 Key Features (181+)

### Multi-Store (5)
Store config, hours, geolocation, status

### Products & Menu (9)
Catalog, categories, options, pricing, stock, scheduling

### Orders (8)
Creation, tracking, statuses, types (delivery/pickup/dine-in)

### Kitchen Display System
Real-time display, auto-print tickets (browser), multi-station, prize scanner

### Payments
Stripe, SumUp, PayPal, Cash, tracking, refunds. **Square is not
implemented** — `refundPolicy.ts` refuses it by name. It is presented as
forthcoming in the admin and in the guided tour; do not describe it as available.

### Third-Party Integrations (10)
Uber Eats, Deliveroo (menu sync, orders), Uber Direct (delivery)

### Gamification (16)
- QR codes on tables → social actions → game (Wheel/Scratch)
- **Admin controls win ratio** (0-100%)
- Prize management, 24h cooldown

### i18n (10)
- **Admin adds ANY language**
- **GPT-3.5-turbo auto-translation** ($0.001/product)
- Manual translation option
- Bulk translator

### Design (14)
Design system in `packages/ui`, theming per store via CMS branding settings.
(Note: no predefined-theme package exists — `packages/themes` was an empty stub and has been removed.)

### Testing
- Vitest unit tests. **Coverage is measured on demand, not gated** —
  `pnpm test:coverage` reports it, no config sets a threshold and no workflow
  runs it. This file claimed "80%+ coverage" for months while nothing produced
  that figure; a run on 5 Sep 2026 had two of the nine engine packages clearing
  80% of statements and the lowest at 4%. Measure before you quote a number,
  and read `TESTING.md` before adding a threshold.
- Playwright E2E tests (critical flows)

---

## 🛠️ Development Guidelines

### Code Standards
- TypeScript strict mode
- No `any` types
- Zod validation for all inputs
- Error handling with try/catch
- JSDoc for complex logic
- Barrel files (`index.ts`)

### File Naming
- Components: PascalCase (`ProductCard.tsx`)
- Utils: camelCase (`formatPrice.ts`)
- Tests: `*.test.ts` or `*.spec.ts`

### State Management
```typescript
// Client state → Zustand
import { create } from 'zustand'
export const useCartStore = create((set) => ({...}))

// Server state → Convex
import { useQuery } from "convex/react"
const products = useQuery(api.products.list)
```

### Testing Requirements
- Write unit tests for utils, stores, validations
- Write E2E tests for critical flows
- Run `pnpm test && pnpm test:e2e` before commit

---

## 🌍 i18n with GPT-3.5

**Admin adds languages dynamically** (unlimited)

Both live in `packages/core/src/i18n/gpt-translation.ts`. There is no
`translateWithGPT` — the function is `translateText`, and `batchTranslate`
requires the HTTP client and the API key, they are not optional.

```typescript
import { translateText, batchTranslate } from "@be-in-digital/core"

// One string. `context` steers the model; the rest have defaults.
await translateText(text, "en", "fr", "product name", httpClient, apiKey)

// Many strings. httpClient and apiKey are REQUIRED here.
await batchTranslate(items, "en", "es", httpClient, apiKey)
```

**Cost**: ~$0.001 per product, $0.01 per page

---

## 🎮 Gamification Flow

1. Customer scans QR code on table
2. Completes social actions (Google review, Instagram follow, etc.)
3. Plays game (Wheel of Fortune, Scratch Card)
4. **Admin controls win ratio** (e.g., 30% win, 70% lose)
5. If win: fills form → receives QR code by email → redeems at restaurant
6. 24h cooldown before next play

---

## 🖨️ Kitchen Printing

**Auto-print tickets** when an order is paid — through the browser, which is the
only transport that ships.

```
Browser print — the kitchen screen prints to the station's own printer
  KitchenPrintTrigger renders the ticket into a hidden iframe and calls
  print(); apps/*/scripts/kiosk-print.sh runs Chrome with --kiosk-printing so
  no dialog appears. A thermal printer set as the OS default gives a thermal
  ticket — via the OS driver, not via ESC/POS bytes we emit.
Multi-station routing  — stores.stationMapping
Reprint button         — kitchenTickets.requestReprint
Claim lock + retries   — one tablet wins a ticket; failures retry (#164)
```

**Not implemented, and not to be described as if it were:** ESC/POS byte
generation, network (port 9100) or USB transport, printer status polling. A
browser cannot open a raw socket and Convex cannot reach a restaurant's LAN, so
the thermal path will be **cloud printing** (Star CloudPRNT / Epson Server Direct
Print — the printer polls an HTTP endpoint), not a local print agent. The three
cloud providers already exist in `packages/admin/src/lib/kitchen-print.ts` as
`available: false`. Decision recorded in `tasks/sales-readiness-backlog.md`
(LAUNCH-04).

---

## ☁️ AWS Services

### S3 Storage
There is no `uploadToS3`. Build the service and call `upload` on it; the
client is injected, which is what makes it testable.

```typescript
import { createS3Service } from "@be-in-digital/core"

const s3 = createS3Service(config, client)
const { key, url } = await s3.upload(file, { folder: "products" })
```

Folders are a closed set — `products`, `branding`, `stores`, `cms`, `email`,
`users` (`packages/core/src/aws/s3/validation.ts:27`). The bucket is private:
`getPublicUrl` returns the CDN or the app's `/api/files` proxy, never a direct
S3 URL.

### SES Email
`sendEmail` and `sendTemplatedEmail` are methods on the SES service
(`packages/core/src/aws/ses/client.ts:38,45`), not top-level exports.

```typescript
import { getSESService } from "@be-in-digital/core"

const ses = getSESService()
await ses.sendEmail({ to, subject, htmlBody })
await ses.sendTemplatedEmail({ to, templateName, templateData })
```

---

## 🧪 Testing

### Unit Tests (Vitest)
```bash
pnpm test              # turbo run test, every workspace
pnpm test:coverage     # turbo run test:coverage; writes coverage/ per package
pnpm test:ui           # Vitest UI for apps/reference, the engine's test bench
```

`test` and `test:coverage` fan out across the monorepo. `test:ui` cannot: a
Vitest UI is one server per project, so the root script opens the bench. For
any other workspace, name it — `pnpm --filter @be-in-digital/core test:coverage`.

### E2E Tests (Playwright)
```bash
pnpm test:e2e          # turbo run test:e2e
pnpm test:e2e:ui       # Playwright UI mode, apps/reference
pnpm test:e2e:debug    # Playwright inspector, apps/reference
```

The last two delegate to `apps/reference` for the same reason: an interactive
runner needs one target. `apps/themes` defines both as well, so
`pnpm --filter @beyours/themes test:e2e:debug` works on the template.

### CI/CD
GitHub Actions runs the suite on pushes to `main`, on pull requests targeting
`main`, and in the merge queue (`.github/workflows/ci.yml:3-19`). A push to a
feature branch with no open pull request runs nothing — open the PR to get CI.

---

## 🔐 Environment Variables

`packages/core/src/env/schemas.ts` is the source of truth, and
`instrumentation.ts` enforces it at boot. The names below are the ones code
actually reads — several that used to be listed here (`SUMUP_API_KEY`,
`UBER_EATS_API_KEY`, `DELIVEROO_API_KEY`, `UBER_DIRECT_CUSTOMER_ID`) are read
by nothing and never were.

**Required — a deployment refuses to start without these** (`schemas.ts:69-105`):

```bash
NEXT_PUBLIC_CONVEX_URL=       # the backend itself
CONVEX_SITE_URL=              # webhook and OAuth callback URLs
SITE_URL=                     # password reset links
BETTER_AUTH_SECRET=           # >= 32 chars: openssl rand -base64 32
ENCRYPTION_KEY=               # 64 hex chars: openssl rand -hex 32
AWS_REGION=eu-west-1
AWS_ACCESS_KEY_ID=            # the CLIENT's own AWS account, not a fleet key
AWS_SECRET_ACCESS_KEY=
AWS_S3_BUCKET_NAME=
AWS_SES_FROM_EMAIL=
OPENAI_API_KEY=sk-...
```

**Optional — each one gates a feature that stays off until it is set:**

```bash
CONVEX_DEPLOYMENT=

# Payments
STRIPE_SECRET_KEY=            # sk_...
STRIPE_WEBHOOK_SECRET=        # whsec_...
SUMUP_CLIENT_ID=
SUMUP_CLIENT_SECRET=
PAYPAL_CLIENT_ID=
PAYPAL_CLIENT_SECRET=
PAYPAL_SANDBOX_MODE=          # "true" | "false"
# SQUARE_ACCESS_TOKEN — no code reads this; Square is unimplemented

# Delivery platforms
UBER_EATS_CLIENT_ID=
UBER_EATS_CLIENT_SECRET=
UBER_EATS_WEBHOOK_SECRET=
UBER_DIRECT_WEBHOOK_SECRET=   # falls back to the Uber Eats one when unset
DELIVEROO_CLIENT_ID=
DELIVEROO_CLIENT_SECRET=
DELIVEROO_WEBHOOK_SECRET=
```

`turbo.json` declares no `env` for most tasks, so a non-`NEXT_PUBLIC_` variable
that is not listed in a task's `env`/`passThroughEnv` never reaches it. Adding a
variable means adding it there too.

---

## 📝 Notes for Claude Code

When working on tasks:

1. **Reference this file** for architecture decisions
2. **Use the tech stack** specified (Next.js 16, Convex, Zustand)
3. **Follow code standards** (TypeScript strict, no `any`, Zod validation)
4. **Create barrel files** (`index.ts`) in folders
5. **Write tests** (Vitest for unit, Playwright for e2e)
6. **Multi-store**: always filter by `storeId` (`v.id("stores")`). There is no
   `restaurant_id` field anywhere in the codebase.
7. **i18n**: Use cookies (primary) or localStorage (fallback)
8. **State**: Zustand for client, Convex for server
9. **Run tests** before commit: `pnpm test && pnpm test:e2e`
10. **NEVER mention "Claude Code"** in commit messages (no `Co-Authored-By: Claude`, and no reference to Claude at all)
11. **English only on GitHub and Git** — see below

---

## 🌐 Language rule — English on GitHub, French for customers

**Everything that lands on GitHub or in Git is written in English.** No exceptions
by default:

- commit messages and branch names
- issue titles **and** issue bodies, labels, milestones
- pull request titles, descriptions, and review comments
- repository documentation (`README`, `CLAUDE.md`, `docs/`, `tasks/`, ADRs)
- code comments, test names, error strings thrown by engine code

**Why:** the repository is a shared engineering artefact. It is read by tooling, by
contributors who may not read French, and by anyone we later hand a client repo to.
The code itself is already English — the prose around it should not be the exception.

**The exception — French stays French when it is the product.** Do not translate:

- customer-facing copy: storefront strings, CMS content, email templates, the
  commercial site, `apps/site` marketing copy
- legal and contractual text: CGV, mentions légales, RGPD notices, contracts,
  invoices — French is a legal requirement here, not a habit
- French domain terms quoted inside an English sentence, when translating them
  would lose precision: *établissement*, *apporteur d'affaires*, *fondateurs*,
  *régime de TVA*, *Prêt Boost*, SIRET. Quote them, don't invent an English word.
- fixtures, seeds and test data that mimic real French restaurant content

**Outside the repo, French is the default:** conversation with the team, ClickUp
tasks and comments, and internal notes.

Never rewrite history on `main` to apply this rule — commits already merged stay as
they are.

---

## 📚 Additional Documentation

These four are written from the code, and each says plainly where the product
falls short of what this file claims. `pnpm check:claude-md` fails the build if
one of them stops existing, or if a command named above stops running.

- `ARCHITECTURE.md` — the three apps, the ten engine packages, how a client
  site is cloned and updated, and the real shape of the shared services
- `FEATURES.md` — every feature marked shipped, partial or not built, measured
  against `apps/themes` rather than against the sales page
- `TESTING.md` — what the suites cover, what CI actually runs, how to measure
  coverage and why no threshold is enforced
- `DEPLOYMENT.md` — Vercel and Convex per client, the env tiers a deployment
  refuses to boot without, and the rollback path

Alongside them: `README.md` for orientation, `apps/docs/` for per-feature
guides and deployment detail, and `tasks/sales-readiness-backlog.md` for the
authoritative sold-vs-built ledger.

---

**Version**: 2.1.0  
**Last Updated**: September 5, 2026  
**Maintained by**: BeInDigital Team