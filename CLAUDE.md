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
│   ├── marketing/             # Email, Gamification
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
`pnpm engine:link <engine-clone>` for local symlinks.

> **BeYours is the product sold to restaurant owners. BeInDigital is the agency.**
> Two brands, two businesses — read the Naming section of `README.md` before any
> find-and-replace.

---

## 🗄️ Key Database Schemas

**Multi-tenant**: 1 schema per restaurant (Neon)

### Core Tables
- `users`, `sessions`, `stores`, `products`, `menus`, `orders`

### Kitchen System
- `kitchenTickets` (auto-print). `printerSettings` is registered but has **zero
  readers and zero writers** — it belongs to the unbuilt ESC/POS path, not to
  the printing that ships. Print config lives on `stores.printConfig`.

### Gamification
- `gameQRCodes`, `requiredActions`, `games` (win ratio), `prizes`, `gamePlays`, `prizeRedemptions`

### i18n
- `languages` (dynamic, unlimited), `translations`, `translationJobs` (GPT)

### Integrations
- Stores have `integrations.uberEats`, `integrations.deliveroo`
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
- Vitest unit tests (80%+ coverage)
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

```typescript
import { translateText, batchTranslate, estimateTranslationCost } from "@be-in-digital/core"

// Auto-translate one string — there is no `translateWithGPT`
await translateText(text, "en", "fr", "product name", httpClient, apiKey)

// Batch translate; httpClient and apiKey are required here, not optional
await batchTranslate(items, "en", "es", httpClient, apiKey)
```

`httpClient` is injected for the same reason the AWS services inject theirs: the
package must stay loadable from the Convex runtime. Note also that the engine's
own auto-translation pipeline is separate — it lives in
`@be-in-digital/convex-functions/autoTranslate`, deliberately off that package's
barrel, and the apps drive it from there.

**Cost**: ~$0.001 per product, $0.01 per page (`estimateTranslationCost`)

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

There is **no** `uploadToS3`, `sendEmail` or `sendTemplatedEmail` free function —
those three names were documented here for a long time and never existed. Both
services are **factories over an injected AWS client**: you build the SDK client,
they hold the policy. `packages/core` therefore has no `@aws-sdk/client-s3`
dependency at all; its one SDK dependency is `@aws-sdk/client-sesv2`, imported
only by the SES adapter that `createSESv2Operations` lives in.

Everything below comes from the package root, `@be-in-digital/core`; there is no
`./aws/s3` or `./aws/ses` subpath. The two `./aws/*` subpaths that do exist are
deliberately import-free so a Convex isolate can pull them in on their own:
`./aws/folders` (the folder allow-list) and `./aws/media-url`.

### S3 Storage
```typescript
import { createS3Service, S3_FOLDERS } from "@be-in-digital/core"

const s3 = createS3Service(config, client) // `client` is your S3Operations adapter
const { key, url } = await s3.upload(buffer, {
  folder: "products",       // must be one of S3_FOLDERS
  contentType: "image/webp",
})
// also: getPresignedUploadUrl, getPresignedDownloadUrl, delete, getPublicUrl,
//       exists, getMetadata
```
Folders are the allow-list in `@be-in-digital/core/aws/folders`: `products`,
`categories`, `cms`, `branding`, `stores`, `storefront`, `blogs`, `blog-auto`,
`email`, `avatars`, `users`. The bucket is private — reads go through the app's
`/api/files` proxy, and a folder missing from that list yields a URL that 404s.

### SES Email
```typescript
import { createSESService, createSESv2Operations, getSESService } from "@be-in-digital/core"

const ses = createSESService(config, createSESv2Operations(awsConfig))
// or, server-side, read the config from the environment:
const ses = getSESService()

await ses.sendEmail({ to, subject, html })   // the field is `html`, not `htmlBody`
await ses.sendTemplatedEmail({ to, templateName, templateData })
await ses.sendBulkEmail({ ... })   // rate-limited to the SES sandbox ceiling
```
`sendEmail` and `sendTemplatedEmail` are **methods on the service instance**, not
module-level functions.

**How transactional mail actually leaves the product.** Convex has no SES
credentials, so it POSTs to the app's own `/api/email/send`, which is
`createEmailRouteHandler({ secret, linkOrigin })` from `@be-in-digital/core` —
that handler calls `getSESService()`. The two halves share one secret
(`EMAIL_API_SECRET`, with `BETTER_AUTH_SECRET` as a transitional fallback) and
must present the same one. Bulk campaign sends are the exception: they run in
Convex Node actions that talk to `@aws-sdk/client-sesv2` directly.

---

## 🧪 Testing

### Unit Tests (Vitest)
```bash
pnpm test
pnpm test:coverage
pnpm test:ui
```

### E2E Tests (Playwright)
```bash
pnpm test:e2e
pnpm test:e2e:ui
pnpm test:e2e:debug
```

### CI/CD
GitHub Actions runs tests on every push/PR

---

## 🔐 Environment Variables

```bash
# Convex
NEXT_PUBLIC_CONVEX_URL=
CONVEX_DEPLOYMENT=

# AWS
AWS_REGION=eu-west-1
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
AWS_S3_BUCKET_NAME=
AWS_SES_FROM_EMAIL=

# OpenAI (Translation)
OPENAI_API_KEY=sk-...

# Payments — SumUp and PayPal are OAuth client pairs, not single API keys
STRIPE_SECRET_KEY=
SUMUP_CLIENT_ID=
SUMUP_CLIENT_SECRET=
PAYPAL_CLIENT_ID=
PAYPAL_CLIENT_SECRET=
# SQUARE_ACCESS_TOKEN — no code reads this yet; Square is unimplemented

# Integrations — also OAuth pairs, each with its own webhook secret
UBER_EATS_CLIENT_ID=
UBER_EATS_CLIENT_SECRET=
UBER_EATS_WEBHOOK_SECRET=
DELIVEROO_CLIENT_ID=
DELIVEROO_CLIENT_SECRET=
DELIVEROO_WEBHOOK_SECRET=
UBER_DIRECT_WEBHOOK_SECRET=
```

`SUMUP_API_KEY`, `UBER_EATS_API_KEY`, `DELIVEROO_API_KEY` and
`UBER_DIRECT_CUSTOMER_ID` were listed here for a long time and are read by **no
code at all** — an operator setting them configured nothing. The authoritative
list is `packages/core/src/env/schemas.ts`, which the apps enforce at startup.

---

## 📝 Notes for Claude Code

When working on tasks:

1. **Reference this file** for architecture decisions
2. **Use the tech stack** specified (Next.js 16, Convex, Zustand)
3. **Follow code standards** (TypeScript strict, no `any`, Zod validation)
4. **Create barrel files** (`index.ts`) in folders
5. **Write tests** (Vitest for unit, Playwright for e2e)
6. **Multi-store**: Always filter by `restaurant_id`
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

**For detailed implementation examples, see:**
- `ARCHITECTURE.md` - Complete architecture details
- `FEATURES.md` - Full feature specifications
- `TESTING.md` - Testing strategy and examples
- `DEPLOYMENT.md` - Deployment guide

---

**Version**: 2.0.0  
**Last Updated**: February 14, 2026  
**Maintained by**: BeInDigital Team