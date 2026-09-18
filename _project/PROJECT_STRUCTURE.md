# BeYours Engine - Project Structure

## 📁 Monorepo Structure

```
beindigital/
├── packages/                           # Shared packages
│   ├── ui/                            # React UI components
│   │   ├── src/
│   │   │   ├── components/
│   │   │   │   └── Button.tsx        # ✅ Base button component
│   │   │   ├── utils/
│   │   │   │   └── cn.ts             # ✅ Tailwind merge utility
│   │   │   └── index.ts              # ✅ Package exports
│   │   ├── package.json              # ✅ Package config
│   │   ├── tsconfig.json             # ✅ TypeScript config
│   │   └── tsup.config.ts            # ✅ Build config
│   │
│   ├── core/                          # Core utilities
│   │   ├── src/
│   │   │   ├── auth/
│   │   │   │   ├── config.ts         # ✅ Better Auth setup
│   │   │   │   ├── rbac.ts           # ✅ Role-based access control
│   │   │   │   └── index.ts          # ✅ Auth exports
│   │   │   ├── payments/
│   │   │   │   └── index.ts          # ✅ Multi-provider payment system
│   │   │   ├── i18n/
│   │   │   │   └── index.ts          # ✅ Internationalization
│   │   │   └── index.ts              # ✅ Core exports
│   │   └── package.json              # ✅ Package config
│   │
│   ├── themes/                        # Predefined themes
│   │   ├── fast-food/
│   │   │   ├── config/
│   │   │   │   └── theme.config.ts   # ✅ Fast Food theme configuration
│   │   │   ├── components/           # 🔲 Theme-specific components
│   │   │   └── styles/               # 🔲 Theme styles
│   │   ├── pizzeria/                 # 🔲 To be created
│   │   ├── chinese/                  # 🔲 To be created
│   │   ├── fine-dining/              # 🔲 To be created
│   │   ├── cafe-bakery/              # 🔲 To be created
│   │   └── sushi-bar/                # 🔲 To be created
│   │
│   ├── restaurant/                    # 🔲 Restaurant business logic
│   ├── integrations/                  # 🔲 Third-party integrations
│   ├── marketing/                     # 🔲 Marketing tools
│   ├── cms/                           # 🔲 Custom CMS
│   ├── convex-schema/                 # 🔲 Convex database schemas
│   └── convex-functions/              # 🔲 Convex backend functions
│
├── apps/                              # Applications
│   ├── reference/                         # 🔲 Engine test bench
│   ├── admin-dashboard/               # 🔲 BeYours admin dashboard
│   └── docs/                          # 🔲 Documentation site
│
├── .gitignore                         # ✅ Git ignore rules
├── package.json                       # ✅ Root package.json
├── pnpm-workspace.yaml                # ✅ pnpm workspace config
├── tsconfig.base.json                 # ✅ Base TypeScript config
├── turbo.json                         # ✅ Turborepo configuration
└── README.md                          # ✅ Project README
```

## ✅ Completed Items

### Root Configuration
- ✅ `package.json` - Monorepo root configuration with Turborepo
- ✅ `pnpm-workspace.yaml` - pnpm workspace configuration
- ✅ `turbo.json` - Turborepo pipeline configuration
- ✅ `tsconfig.base.json` - Base TypeScript configuration
- ✅ `.gitignore` - Git ignore rules
- ✅ `README.md` - Project documentation

### @be-yours/ui Package
- ✅ Package configuration
- ✅ TypeScript configuration
- ✅ Build configuration (tsup)
- ✅ Base Button component with variants
- ✅ Utility functions (cn for Tailwind merge)
- ✅ Package exports

**Dependencies installed:**
- `react`, `react-dom`
- `class-variance-authority` - Component variants
- `clsx` - Class name utilities
- `tailwind-merge` - Tailwind class merging
- `lucide-react` - Icon library

### @be-yours/core Package
- ✅ Package configuration
- ✅ Better Auth integration
  - Configuration with Convex adapter
  - Email/password authentication
  - OAuth (Google, Facebook, Apple)
  - Session management
- ✅ RBAC (Role-Based Access Control)
  - 7 roles: super_admin, client_admin, manager, kitchen, waiter, delivery, customer
  - Permission system with wildcards
  - Permission checking functions
- ✅ Multi-provider payment system
  - Abstract PaymentProcessor class
  - Payment factory pattern
  - Support for: Stripe, SumUp, PayPal, Square, Cash
  - Payment intent and result types
- ✅ i18n (Internationalization)
  - Support for 5 languages: fr, en, es, de, it
  - Language detection
  - Language persistence

**Dependencies installed:**
- `better-auth` - Authentication framework
- `i18next`, `react-i18next` - Internationalization
- `zod` - Schema validation

### @be-yours/themes Package
- ✅ Fast Food theme configuration
  - Colors (red, yellow, green)
  - Typography (Poppins, Inter)
  - Layout settings (video hero, large images, single-page checkout)
  - Features (quick order, upselling, menu combo)
  - Component mapping

## 🔲 Next Steps

### High Priority

1. **@be-yours/convex-schema**
   - Create base schema for Better Auth
   - Define restaurant tables (stores, products, orders, etc.)
   - Add indexes for performance

2. **@be-yours/convex-functions**
   - Auth functions (getUser, updateProfile, etc.)
   - Order management functions
   - Product management functions

3. **@be-yours/restaurant**
   - Order calculator
   - Kitchen ticket generator
   - Store selector utilities
   - Multi-store logic

4. **apps/reference**
   - Next.js 14 setup with App Router
   - Convex integration
   - Better Auth setup
   - Basic storefront layout
   - Admin dashboard layout

### Medium Priority

5. **@be-yours/integrations**
   - Stripe payment processor
   - SumUp payment processor
   - PayPal payment processor
   - Square payment processor
   - Uber Eats integration
   - Deliveroo integration
   - Uber Direct integration

6. **Complete all 6 themes**
   - Pizzeria theme (with pizza builder)
   - Chinese restaurant theme
   - Fine dining theme
   - Café/Bakery theme
   - Sushi Bar theme

7. **@be-yours/cms**
   - Block-based editor
   - Page management
   - SEO utilities

8. **@be-yours/marketing**
   - Email campaign builder
   - Gamification system
   - Loyalty program

### Low Priority

9. **apps/admin-dashboard**
   - Client management
   - Update deployment
   - Analytics dashboard

10. **apps/docs**
    - Documentation site (Nextra or similar)
    - API reference
    - Theme customization guide

## 🚀 Commands

### Development
```bash
# Install dependencies
pnpm install

# Start development mode
pnpm dev

# Build all packages and apps
pnpm build

# Run tests
pnpm test

# Lint code
pnpm lint

# Format code
pnpm format
```

### Package Management
```bash
# Add dependency to specific package
pnpm add <package> --filter @be-yours/ui

# Add dev dependency to workspace root
pnpm add -Dw <package>

# Create new package
cd packages
mkdir new-package
pnpm init
```

### Versioning
```bash
# Create a changeset
pnpm changeset

# Version packages
pnpm version-packages

# Publish packages
pnpm release
```

## 📦 Package Dependencies

### @be-yours/ui
- `react`, `react-dom` (peer dependencies)
- `class-variance-authority` - Component variants
- `clsx` - Conditional classes
- `tailwind-merge` - Merge Tailwind classes
- `lucide-react` - Icons

### @be-yours/core
- `better-auth` - Authentication
- `i18next`, `react-i18next` - i18n
- `zod` - Validation

### Future Dependencies

**@be-yours/restaurant:**
- Date utilities (date-fns)
- Currency formatting
- Timezone handling

**@be-yours/integrations:**
- `stripe` - Stripe SDK
- Uber Eats SDK
- Deliveroo SDK
- PayPal SDK

**apps/reference:**
- `next` - Framework
- `convex` - Backend
- `better-auth` - Auth
- `tailwindcss` - Styling
- `react-hook-form` - Forms
- All `@be-yours/*` packages

## 🔐 Environment Variables Template

```env
# Convex
NEXT_PUBLIC_CONVEX_URL=
CONVEX_DEPLOYMENT=

# Better Auth
BETTER_AUTH_SECRET=
# No GOOGLE_/FACEBOOK_/APPLE_ variables. Social sign-in is described in
# `packages/core/src/auth/README.md` and is not wired: no code in any package
# or app reads one of those eight names.

# Payments
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=

# SumUp is an OAuth pair. The merchant code comes back from the OAuth exchange
# and is stored on the connection, so there is no SUMUP_MERCHANT_CODE to set.
SUMUP_CLIENT_ID=
SUMUP_CLIENT_SECRET=

# PAYPAL_SECRET was listed here and is read by nothing; the name is
# PAYPAL_CLIENT_SECRET.
PAYPAL_CLIENT_ID=
PAYPAL_CLIENT_SECRET=
PAYPAL_SANDBOX_MODE=

# No SQUARE_* variables: Square is announced and not implemented, and
# `refundPolicy.ts` refuses it by name. Nothing reads SQUARE_ACCESS_TOKEN or
# SQUARE_LOCATION_ID.

# Integrations
UBER_EATS_CLIENT_ID=
UBER_EATS_CLIENT_SECRET=
DELIVEROO_CLIENT_ID=
DELIVEROO_CLIENT_SECRET=
UBER_DIRECT_WEBHOOK_SECRET=

# Email
RESEND_API_KEY=
```

## 📊 Progress Tracker

- [x] Monorepo setup (Turborepo + pnpm)
- [x] Base package: @be-yours/ui
- [x] Base package: @be-yours/core
- [x] Theme configuration: Fast Food
- [ ] Convex schema package
- [ ] Convex functions package
- [ ] Restaurant package
- [ ] Integrations package
- [ ] Complete all 6 themes
- [ ] Restaurant theme app
- [ ] Admin dashboard app
- [ ] Documentation site

**Current Completion**: ~15% of MVP

---

**Last Updated**: February 14, 2026  
**Version**: 1.0.0-alpha
