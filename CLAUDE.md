# CLAUDE.md - BeInDigital Engine

## 🎯 Project Overview

**BeInDigital Engine** is a premium Next.js e-commerce platform for restaurants with Convex backend. We sell specialized themes by restaurant type that owners can purchase and customize.

### Business Model
- **Product**: Next.js theme sold once per restaurant
- **Multi-store**: 1 restaurant owner = 1-∞ locations (illimité)
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
- **Payments**: Stripe, SumUp, PayPal, Square
- **Delivery**: Uber Direct
- **Platforms**: Uber Eats, Deliveroo
- **Translation**: GPT-3.5-turbo

---

## 📁 Repository Structure

```
beindigital-engine/
├── packages/
│   ├── ui/                    # React Components
│   ├── core/                  # Auth, i18n, Payments, AWS
│   ├── restaurant/            # Business Logic, Zustand stores
│   ├── integrations/          # Uber Eats, Deliveroo, Uber Direct
│   ├── marketing/             # Email, Gamification
│   ├── cms/                   # Custom CMS
│   ├── convex-schema/         # DB Schemas
│   ├── convex-functions/      # Backend Functions
│   └── themes/                # 6 Predefined Themes
│
├── apps/
│   ├── restaurant-theme/      # Main App
│   │   ├── app/
│   │   │   ├── (storefront)/  # Menu, Cart, Checkout
│   │   │   ├── (admin)/       # Dashboard, Products, Kitchen, Games, Languages
│   │   │   ├── game/[qrCodeId]/ # Gamification Flow
│   │   │   └── api/           # Webhooks, Upload, Print, Emails
│   │   ├── components/        # UI, Storefront, Admin, Game
│   │   ├── lib/               # Stores, Utils, AWS, Printing, Translation
│   │   ├── convex/            # Schema, Functions
│   │   ├── e2e/               # Playwright tests
│   │   └── __tests__/         # Vitest tests
│   │
│   ├── admin-dashboard/       # BeInDigital Admin
│   └── docs/                  # Documentation
│
├── .github/workflows/         # CI/CD (tests, lint, deploy)
├── turbo.json
└── package.json
```

---

## 🗄️ Key Database Schemas

**Multi-tenant**: 1 schema per restaurant (Neon)

### Core Tables
- `users`, `sessions`, `stores`, `products`, `menus`, `orders`

### Kitchen System
- `kitchenTickets`, `printerSettings` (auto-print)

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

### Kitchen Display System (12)
Real-time display, auto-print tickets, multi-station, prize scanner

### Payments (8)
Stripe, SumUp, PayPal, Square, Cash, tracking, refunds

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
6 themes (Fast Food, Pizzeria, Chinese, Fine Dining, Café, Sushi)

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
// Auto-translate
await translateWithGPT(text, "en", "fr", "product name")

// Batch translate
await batchTranslate([items], "en", "es")
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

**Auto-print tickets** when order confirmed

```typescript
// ESC/POS thermal printers
// Network or USB
// Multi-station support
// Reprint button for staff
```

---

## ☁️ AWS Services

### S3 Storage
```typescript
await uploadToS3(file, key, "products")
// Folders: products/, branding/, stores/, cms/
```

### SES Email
```typescript
await sendEmail({ to, subject, htmlBody })
await sendTemplatedEmail({ to, templateName, templateData })
```

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

# Payments
STRIPE_SECRET_KEY=
SUMUP_API_KEY=
PAYPAL_CLIENT_ID=
SQUARE_ACCESS_TOKEN=

# Integrations
UBER_EATS_API_KEY=
DELIVEROO_API_KEY=
UBER_DIRECT_CUSTOMER_ID=
```

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
10. **Ne JAMAIS mentionner "Claude Code"** dans les messages de commit (pas de `Co-Authored-By: Claude`, ni aucune référence à Claude)

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