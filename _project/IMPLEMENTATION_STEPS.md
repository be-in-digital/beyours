# BeYours Engine - Step-by-Step Implementation Plan

## Phases covered: Phase 1 (MVP) + Phase 2 (Integrations)

**Date**: February 14, 2026
**Current state**: ~5% (Next.js 16 + Tailwind CSS boilerplate)

---

## Steps overview

```
Phase 1 - MVP
├── Step 1  : Monorepo Foundation & CI/CD
├── Step 2  : Convex Schema & Backend Functions
├── Step 3  : Core Package (Auth, i18n, AWS)
├── Step 4  : UI Package (shadcn/ui Components)
├── Step 5  : Restaurant Package (Business Logic)
├── Step 6  : Themes Package (1st complete theme)
├── Step 7  : Restaurant App - Storefront
├── Step 8  : Restaurant App - Admin Dashboard
├── Step 9  : Kitchen Display System (KDS)
├── Step 10 : Payment System
├── Step 11 : i18n + GPT Translation
└── Step 12 : 5 Remaining Themes

Phase 2 - Integrations
├── Step 13 : Integrations Package (Uber Eats)
├── Step 14 : Deliveroo Integration
├── Step 15 : Uber Direct (Delivery)
├── Step 16 : Email Marketing (Basic)
├── Step 17 : CMS (Static Pages)
├── Step 18 : Customer Management
└── Step 19 : BeYours Admin Dashboard App
```

---

## PHASE 1 - MVP

---

### Step 1: Monorepo Foundation & CI/CD

**Prerequisites**: None
**Deliverable**: Working Turborepo monorepo with CI/CD

#### 1.1 - Restructuring into a Turborepo monorepo

- [ ] Back up the current contents of `app/` and the configs
- [ ] Install Turborepo: `pnpm add -Dw turbo`
- [ ] Create `turbo.json` with pipelines (build, dev, test, lint)
- [ ] Create `tsconfig.base.json` (shared TypeScript config)
- [ ] Update `pnpm-workspace.yaml`:
  ```yaml
  packages:
    - "packages/*"
    - "apps/*"
  ```
- [ ] Update the root `package.json` (Turborepo scripts)

#### 1.2 - Creating the package structure

```
packages/
├── ui/                    # React components
├── core/                  # Auth, i18n, AWS, Payments
├── restaurant/            # Restaurant business logic
├── integrations/          # Uber Eats, Deliveroo, Uber Direct
├── marketing/             # Email, Gamification
├── cms/                   # Custom CMS
├── convex-schema/         # Shared DB schemas
├── convex-functions/      # Convex backend functions
└── themes/                # 6 predefined themes

apps/
├── restaurant-theme/      # Main app (Next.js 16)
├── admin-dashboard/       # BeYours dashboard
└── docs/                  # Documentation
```

For each package:
- [ ] `package.json` named `@be-in-digital/<nom>`
- [ ] `tsconfig.json` extending `tsconfig.base.json`
- [ ] `tsup.config.ts` for the build
- [ ] `src/index.ts` (barrel file)
- [ ] `vitest.config.ts`

#### 1.3 - GitHub Actions CI/CD configuration

- [ ] `.github/workflows/ci.yml`:
  - Lint (ESLint)
  - Type-check (tsc --noEmit)
  - Unit tests (Vitest)
  - Build (turbo build)
  - On push/PR to `main`
- [ ] `.github/workflows/e2e.yml`:
  - Playwright tests
  - On PR to `main` only
- [ ] Set up Husky + lint-staged for pre-commit

#### 1.4 - Development tooling

- [ ] Shared ESLint config (eslint-config-custom)
- [ ] Shared Prettier config
- [ ] Changesets for versioning (`@changesets/cli`)
- [ ] `.env.example` at the root

#### Step 1 validation tests
- [ ] `pnpm install` succeeds
- [ ] `pnpm build` compiles every package (empty)
- [ ] `pnpm lint` passes
- [ ] `pnpm test` passes (0 tests, 0 errors)
- [ ] GitHub Actions CI passes on push

---

### Step 2: Convex Schema & Backend Functions

**Prerequisites**: Step 1
**Deliverable**: Complete schema + basic CRUD functions

#### 2.1 - Convex setup

- [ ] Install Convex: `pnpm add convex --filter @be-in-digital/convex-schema`
- [ ] Initialize Convex inside the package
- [ ] Set up `convex/` with the generated files

#### 2.2 - Base schema (convex-schema package)

Core tables:
- [ ] `users` - User profiles (Better Auth extension)
- [ ] `sessions` - Sessions (Better Auth)
- [ ] `accounts` - OAuth accounts (Better Auth)
- [ ] `verifications` - Verification tokens

Restaurant tables:
- [ ] `stores` - Location configuration
  - name, address, geolocation, hours, status, phone, email
  - integrations (uberEats, deliveroo)
  - branding (colors, logo, favicon)
- [ ] `products` - Product catalog
  - name, description, price, images, category
  - options, variants, allergens, nutrition
  - stock, status, scheduling
  - externalIds (uberEatsId, deliverooId)
- [ ] `categories` - Product categories
- [ ] `menus` - Menus/set menus
- [ ] `orders` - Orders
  - items, total, status, type (delivery/pickup/dine-in)
  - clientId, storeId, payment, timestamps
- [ ] `orderItems` - Order line items

KDS tables:
- [ ] `kitchenTickets` - Kitchen tickets
  - orderId, storeId, station, status, priority
  - prepTime, assignedTo, timestamps
- [ ] `printerSettings` - Printer config
  - storeId, name, type (network/usb), ip, port
  - station, autoPrint, status

Team tables:
- [ ] `teamMembers` - Team members
  - userId, storeId, role, permissions
  - hours, status

Payment tables:
- [ ] `payments` - Transactions
  - orderId, amount, provider, status
  - externalId, metadata

#### 2.3 - Indexes for performance

- [ ] Index on `storeId` for every multi-store table
- [ ] Index on `status` for orders, kitchenTickets
- [ ] Index on `userId` for users, sessions, orders
- [ ] Index on `categoryId` for products
- [ ] Composite indexes (storeId + status, storeId + createdAt)

#### 2.4 - Backend functions (convex-functions package)

Store functions:
- [ ] `stores.create` / `stores.update` / `stores.get` / `stores.list`
- [ ] `stores.updateHours` / `stores.updateStatus`
- [ ] `stores.updateBranding`

Product functions:
- [ ] `products.create` / `products.update` / `products.delete`
- [ ] `products.list` (by storeId, with pagination)
- [ ] `products.getByCategory`
- [ ] `products.updateStock`
- [ ] `products.toggleStatus`

Order functions:
- [ ] `orders.create` / `orders.get` / `orders.list`
- [ ] `orders.updateStatus`
- [ ] `orders.getByStore` (with filters)
- [ ] `orders.getByCustomer`

Kitchen functions:
- [ ] `kitchenTickets.create` / `kitchenTickets.update`
- [ ] `kitchenTickets.getByStore` (real-time)
- [ ] `kitchenTickets.assignStation`
- [ ] `kitchenTickets.markComplete`

Team functions:
- [ ] `teamMembers.create` / `teamMembers.update` / `teamMembers.list`
- [ ] `teamMembers.getByStore`

#### 2.5 - Shared Zod validators

- [ ] `validators/store.ts` - Zod schema for stores
- [ ] `validators/product.ts` - Zod schema for products
- [ ] `validators/order.ts` - Zod schema for orders
- [ ] `validators/user.ts` - Zod schema for users

#### Step 2 validation tests
- [ ] Convex schema deployed to a dev project
- [ ] Every CRUD function covered by unit tests
- [ ] Zod validators cover every input
- [ ] Indexes perform well (no full scans)

---

### Step 3: Core Package (Auth, i18n, AWS)

**Prerequisites**: Step 2
**Deliverable**: Authentication, internationalization and AWS services

#### 3.1 - Better Auth authentication

- [ ] Install Better Auth: `pnpm add better-auth --filter @be-in-digital/core`
- [ ] Better Auth configuration with the Convex adapter
- [ ] Email/password auth with email verification
- [ ] OAuth providers: Google, Facebook, Apple
- [ ] Magic Link (passwordless)
- [ ] Session management (7 days, refresh after 1 day)
- [ ] 2FA plugin (TOTP, SMS, Email)
- [ ] Client auth hooks (`useAuth`, `useSession`)

#### 3.2 - RBAC (Role-Based Access Control)

- [ ] Define the 7 roles:
  - `super_admin` (full rights)
  - `client_admin` (everything on their own restaurant)
  - `manager` (operational management)
  - `kitchen` (KDS only)
  - `waiter` (orders)
  - `delivery` (deliveries)
  - `customer` (their own orders)
- [ ] Granular permission system (resource:action)
- [ ] `requirePermission()` check middleware
- [ ] `usePermission()` client hook

#### 3.3 - i18n (Internationalization)

- [ ] i18n system based on cookies (primary) + localStorage (fallback)
- [ ] Automatic browser language detection
- [ ] Dynamic translation structure (no static files)
- [ ] `useTranslation()` hook
- [ ] `<LanguageSwitcher />` component
- [ ] RTL support (Arabic, Hebrew)

#### 3.4 - AWS S3 service

- [ ] S3 client configured (region eu-west-1)
- [ ] File upload with presigned URLs
- [ ] Organized folders: `products/`, `branding/`, `stores/`, `cms/`
- [ ] File deletion
- [ ] MIME type + max size validation
- [ ] Public URL generation

#### 3.5 - AWS SES service

- [ ] SES client configured
- [ ] Plain email send (`sendEmail`)
- [ ] Templated email send (`sendTemplatedEmail`)
- [ ] Templates: order confirmation, password reset, welcome
- [ ] Bounce and complaint handling

#### Step 3 validation tests
- [ ] Email + OAuth login/register work
- [ ] 2FA enabled and verified
- [ ] RBAC blocks unauthorized access
- [ ] S3 upload and SES send work
- [ ] i18n switches language dynamically
- [ ] Unit tests cover auth + RBAC (>80%)

---

### Step 4: UI Package (shadcn/ui Components)

**Prerequisites**: Step 1
**Deliverable**: Reusable component library

#### 4.1 - shadcn/ui setup

- [ ] Set up shadcn/ui in the `ui` package
- [ ] `cn()` utility (clsx + tailwind-merge)
- [ ] Design token system (colors, spacing, typography)

#### 4.2 - Base components

Layout:
- [ ] `Container`, `Section`, `Grid`
- [ ] `Header`, `Footer`, `Sidebar`
- [ ] `PageHeader`, `PageTitle`

Navigation:
- [ ] `Navbar`, `MobileMenu`
- [ ] `Breadcrumb`
- [ ] `Tabs`, `TabPanel`

Forms:
- [ ] `Input`, `Textarea`, `Select`
- [ ] `Checkbox`, `Radio`, `Switch`
- [ ] `DatePicker`, `TimePicker`
- [ ] `FileUpload` (with preview)
- [ ] `Form` (React Hook Form wrapper)

Display:
- [ ] `Button` (variants: primary, secondary, danger, ghost)
- [ ] `Badge`, `Tag`
- [ ] `Card`, `CardHeader`, `CardContent`
- [ ] `Avatar`
- [ ] `Table`, `DataTable` (with sorting, filters, pagination)
- [ ] `Modal`, `Dialog`
- [ ] `Toast`, `Notification`
- [ ] `Skeleton`, `Spinner`
- [ ] `EmptyState`
- [ ] `Alert`

Restaurant-specific:
- [ ] `ProductCard` (image, name, price, add to cart)
- [ ] `CartItem` (product, quantity, price, remove)
- [ ] `OrderStatusBadge` (pending, preparing, ready, delivered)
- [ ] `StoreSelector` (map + list of locations)
- [ ] `QuantitySelector` (+/-)
- [ ] `PriceDisplay` (currency formatting)
- [ ] `AllergenBadge` (allergen icons)
- [ ] `SpiceLevelIndicator`

#### 4.3 - Admin components

- [ ] `AdminLayout` (sidebar + header + content)
- [ ] `StatCard` (icon, value, label, trend)
- [ ] `Chart` (wrapper for recharts or chart.js)
- [ ] `ActionBar` (grouped action buttons)
- [ ] `FilterBar` (inline filters)
- [ ] `StatusTimeline`

#### Step 4 validation tests
- [ ] Every component renders without errors
- [ ] Storybook (optional) or demo files
- [ ] Unit tests on the interactive components
- [ ] Responsive on mobile/tablet/desktop
- [ ] Accessibility (ARIA labels, focus, keyboard nav)

---

### Step 5: Restaurant Package (Business Logic)

**Prerequisites**: Steps 2, 3
**Deliverable**: Restaurant business logic, isolated

#### 5.1 - Store management

- [ ] `StoreService`: CRUD, opening hours, status
- [ ] `StoreSelector`: selection logic (geolocation, URL params)
- [ ] `useCurrentStore()` hook - active store in context
- [ ] `useStoreHours()` hook - open/closed status
- [ ] Zustand store: `useStoreStore`

#### 5.2 - Product management

- [ ] `ProductService`: CRUD, categories, options
- [ ] Price calculation with options and variants
- [ ] Stock management (decrement, alerts)
- [ ] Filters: by category, allergen, availability
- [ ] `useProducts(storeId)` hook
- [ ] `useProductsByCategory(storeId, categoryId)` hook

#### 5.3 - Cart

- [ ] Zustand store: `useCartStore`
  - `addItem(product, quantity, options)`
  - `removeItem(itemId)`
  - `updateQuantity(itemId, quantity)`
  - `clearCart()`
  - `getTotal()` / `getItemCount()`
- [ ] localStorage persistence
- [ ] Subtotal, tax, delivery and total calculation
- [ ] Stock validation before checkout

#### 5.4 - Orders

- [ ] `OrderService`: creation, status updates
- [ ] Status workflow:
  ```
  pending -> confirmed -> preparing -> ready -> completed
                                    -> out_for_delivery -> delivered
                    -> cancelled
  ```
- [ ] Unique order number generation
- [ ] Order summary calculation (items, options, total)
- [ ] `useOrders(storeId)` hook - real-time list
- [ ] `useOrderStatus(orderId)` hook - real-time tracking

#### 5.5 - Kitchen tickets

- [ ] `KitchenService`: create a ticket from an order
- [ ] Station assignment (starters, mains, desserts, drinks)
- [ ] Prep time estimate
- [ ] Priority (normal, urgent, VIP)
- [ ] `useKitchenTickets(storeId)` hook - real-time

#### Step 5 validation tests
- [ ] Cart: add, remove, update, correct total
- [ ] Orders: full status workflow
- [ ] Kitchen: ticket creation and management
- [ ] Store: selection, hours, status
- [ ] Unit tests >80% coverage

---

### Step 6: Themes Package (1st Complete Theme)

**Prerequisites**: Step 4
**Deliverable**: Theme system + complete Fast Food theme

#### 6.1 - Theme system architecture

- [ ] `ThemeConfig` interface:
  ```typescript
  interface ThemeConfig {
    id: string
    name: string
    colors: { primary, secondary, accent, background }
    typography: { heading, body }
    layout: { hero, productGrid, checkout }
    features: Record<string, boolean>
    components: Record<string, ComponentType>
  }
  ```
- [ ] `ThemeProvider`: React context for the active theme
- [ ] `useTheme()` hook
- [ ] Per-theme component resolution system
- [ ] Dynamically generated CSS variables

#### 6.2 - Fast Food theme (complete)

- [ ] Config: colors (red/yellow), type (Poppins/Inter)
- [ ] Hero: appetizing product video
- [ ] ProductCard: XXL images, quick add
- [ ] ProductGrid: dense grid, visuals dominate
- [ ] Checkout: single page (quick checkout)
- [ ] Features enabled: quickOrder, upselling, menuCombo
- [ ] Theme-specific components: `MenuCombo`, `QuickOrderButton`

#### 6.3 - Client customization

- [ ] Color override (primary, secondary, accent)
- [ ] Logo and favicon upload
- [ ] Font choice (heading, body)
- [ ] Hero image upload
- [ ] Real-time preview in the dashboard

#### Step 6 validation tests
- [ ] Fast Food theme renders completely
- [ ] Color changes applied in real time
- [ ] Custom logo and favicon
- [ ] Responsive mobile/tablet/desktop
- [ ] Graceful fallback when a theme component is missing

---

### Step 7: Restaurant App - Storefront

**Prerequisites**: Steps 2, 3, 4, 5, 6
**Deliverable**: Complete customer frontend (menu, cart, order)

#### 7.1 - Next.js 16 app setup

- [ ] Create `apps/restaurant-theme/` with Next.js 16 (App Router)
- [ ] Set up the Convex provider
- [ ] Set up the Better Auth provider
- [ ] Set up the theme provider
- [ ] Root layout with SEO metadata

#### 7.2 - Storefront routes `(storefront)/`

Public pages:
- [ ] `/` - Home page (hero + popular products + categories)
- [ ] `/menu` - Full menu (categories, filters, search)
- [ ] `/menu/[categorySlug]` - Specific category
- [ ] `/product/[productId]` - Product detail (options, allergens, add to cart)
- [ ] `/cart` - Cart (item list, edit quantities, total)
- [ ] `/checkout` - Checkout (delivery info, payment, confirmation)
- [ ] `/order/[orderId]` - Order tracking (real-time status)
- [ ] `/store-selector` - Location selection (map + list)

Auth pages:
- [ ] `/login` - Sign in (email, OAuth, magic link)
- [ ] `/register` - Sign up
- [ ] `/forgot-password` - Password reset
- [ ] `/account` - Customer profile (orders, addresses, preferences)

#### 7.3 - Storefront components

- [ ] `StoreHeader` - Logo, name, hours, store selection
- [ ] `CategoryNav` - Category navigation (horizontal scroll)
- [ ] `ProductGrid` - Product grid (theme-aware)
- [ ] `ProductDetail` - Detail with options, allergens, nutrition
- [ ] `Cart` - Side cart or full page
- [ ] `CheckoutForm` - Multi-step form
- [ ] `OrderTracker` - Real-time tracking (timeline)
- [ ] `StoreMap` - Map of locations (Leaflet or Google Maps)

#### 7.4 - Features

- [ ] Product search (debounced, fuzzy)
- [ ] Filters (allergens, price, availability)
- [ ] Add to cart with options
- [ ] Order type choice (delivery, click & collect, dine-in)
- [ ] Delivery address (manual entry + geolocation)
- [ ] Prep time estimate
- [ ] Order notifications (Convex subscriptions)

#### Step 7 validation tests
- [ ] Full journey: home -> menu -> cart -> checkout -> tracking
- [ ] Mobile-first responsive
- [ ] SEO: meta tags, og:image, structured data
- [ ] Performance: Lighthouse >90
- [ ] Playwright E2E: complete order journey

---

### Step 8: Restaurant App - Admin Dashboard

**Prerequisites**: Steps 2, 3, 4, 5
**Deliverable**: Admin dashboard for the restaurant owner

#### 8.1 - Admin layout

- [ ] `AdminLayout`: sidebar + topbar + content
- [ ] Sidebar navigation:
  - Dashboard (overview)
  - Commandes
  - Produits
  - Categories
  - Cuisine (KDS)
  - Clients
  - Equipe
  - Etablissements
  - Paiements
  - Design
  - Langues
  - Parametres

#### 8.2 - Main dashboard

- [ ] Real-time overview:
  - Today's orders (count, revenue)
  - Orders in progress
  - Best-selling products
  - Sales chart (day/week/month)
- [ ] Alerts: low stock, pending orders, printer offline

#### 8.3 - Order management

- [ ] Order list with filters (status, date, type, source)
- [ ] Order detail (items, customer, payment, timeline)
- [ ] Status change (action buttons)
- [ ] Sound notification for new orders
- [ ] Source badge (website, Uber Eats, Deliveroo)

#### 8.4 - Product management

- [ ] Product CRUD (full form)
- [ ] Image upload (multi-image, drag & drop)
- [ ] Category management (CRUD, reorder)
- [ ] Options and variants (size, extras)
- [ ] Allergen management (visual badges)
- [ ] Nutrition info
- [ ] Stock management
- [ ] Scheduling (availability by time slot)
- [ ] CSV import/export

#### 8.5 - Location management

- [ ] Location CRUD
- [ ] Opening hours (per day, exceptional periods)
- [ ] Address and geolocation
- [ ] Status (open, closed, temporarily unavailable)
- [ ] Per-location branding (optional)

#### 8.6 - Team management

- [ ] Team member CRUD
- [ ] Role assignment (RBAC)
- [ ] Location assignment
- [ ] Activity logs

#### 8.7 - Design / Customization

- [ ] Theme selection
- [ ] Color editor (real-time color picker)
- [ ] Logo / favicon upload
- [ ] Font selection
- [ ] Storefront preview

#### 8.8 - Settings

- [ ] Restaurant information
- [ ] Payment configuration (enable/disable providers)
- [ ] Delivery configuration
- [ ] Email configuration
- [ ] Printer management

#### Step 8 validation tests
- [ ] Full CRUD: products, categories, stores, team
- [ ] Real-time dashboard with live data
- [ ] RBAC: each role only sees its own pages
- [ ] Tablet responsive (primary use)
- [ ] E2E: create a product -> it shows up on the storefront

---

### Step 9: Kitchen Display System (KDS)

**Prerequisites**: Steps 2, 5, 8
**Deliverable**: Real-time kitchen display + ticket printing

#### 9.1 - KDS screen

- [ ] Grid view of active tickets
- [ ] Columns by status: En attente / En preparation / Pret
- [ ] Drag & drop between columns
- [ ] Per-ticket timer (elapsed time)
- [ ] Priority color coding (normal, urgent, VIP)
- [ ] Order source badge (website, Uber Eats, Deliveroo)
- [ ] Sound notification for new tickets

#### 9.2 - Multi-station

- [ ] Station configuration (starters, mains, desserts, drinks)
- [ ] Ticket filtering by station
- [ ] "tout" view for the chef

#### 9.3 - Ticket printing

- [ ] ESC/POS support for thermal printers
- [ ] Auto-print on order confirmation
- [ ] Manual printing (reprint button)
- [ ] Multi-printer (1 per station possible)
- [ ] Printer status monitoring
- [ ] Ticket format: order number, items, options, type, time

#### 9.4 - Kitchen analytics

- [ ] Average prep time per product
- [ ] Average total time per order
- [ ] On-time completion rate
- [ ] Peak activity by hour

#### Step 9 validation tests
- [ ] Tickets appear in real time
- [ ] Drag & drop works
- [ ] Printing works (mocked in dev)
- [ ] Multi-station filters correctly
- [ ] Notification sound

---

### Step 10: Payment System

**Prerequisites**: Steps 3, 7
**Deliverable**: Working multi-provider payments

#### 10.1 - Payments architecture

- [ ] Abstract `PaymentProcessor` interface
- [ ] `PaymentFactory.create(provider)` factory
- [ ] Shared types: `PaymentIntent`, `PaymentResult`, `RefundResult`

#### 10.2 - Stripe

- [ ] Install the `stripe` SDK
- [ ] `StripeProcessor` implementing `PaymentProcessor`
- [ ] Payment Intent (card, Apple Pay, Google Pay)
- [ ] 3D Secure / SCA
- [ ] Webhooks (payment_succeeded, payment_failed, refund)
- [ ] API route: `POST /api/payments/stripe/webhook`

#### 10.3 - SumUp

- [ ] `SumUpProcessor` implementing `PaymentProcessor`
- [ ] Checkout via the SumUp API
- [ ] Physical terminal support (POS)
- [ ] Webhooks

#### 10.4 - PayPal

- [ ] Install `@paypal/paypal-js`
- [ ] `PayPalProcessor` implementing `PaymentProcessor`
- [ ] Standard checkout
- [ ] Webhooks

#### 10.5 - Square

- [ ] `SquareProcessor` implementing `PaymentProcessor`
- [ ] Checkout via the Square API
- [ ] Square Reader support

#### 10.6 - Cash (cash payments)

- [ ] `CashProcessor` (no external transaction)
- [ ] Payment marked "pending" -> "received" by staff

#### 10.7 - Payments dashboard

- [ ] Transaction list with filters (provider, status, date)
- [ ] Transaction detail
- [ ] Refund (full/partial)
- [ ] CSV/PDF export

#### 10.8 - Storefront checkout

- [ ] Payment method selection (dynamic, based on config)
- [ ] Card form (Stripe Elements)
- [ ] PayPal button
- [ ] Payment confirmation + redirect
- [ ] Payment error page with retry

#### Step 10 validation tests
- [ ] Stripe: test-mode payment succeeds
- [ ] PayPal: sandbox checkout succeeds
- [ ] Refunds work
- [ ] Webhooks handled correctly
- [ ] Fallback when a provider is unavailable
- [ ] E2E: full checkout with Stripe test mode

---

### Step 11: i18n + GPT Translation

**Prerequisites**: Steps 3, 8
**Deliverable**: Multilingual system with automatic translation

#### 11.1 - Dynamic language management

- [ ] `languages` table: code, name, flag, active, RTL
- [ ] Language CRUD in the admin dashboard
- [ ] No limit on languages (the admin adds whatever they want)

#### 11.2 - Translation system

- [ ] `translations` table: sourceText, targetLang, translatedText, type
- [ ] Product translation (name, description)
- [ ] Category translation
- [ ] CMS page translation
- [ ] Admin UI translation (static files)

#### 11.3 - Automatic GPT-3.5-turbo translation

- [ ] API route: `POST /api/translate`
- [ ] `translateWithGPT(text, sourceLang, targetLang, context)`
- [ ] Batch translate: `batchTranslate(items, sourceLang, targetLang)`
- [ ] Estimated cost: ~$0.001/product, ~$0.01/page
- [ ] Queue for bulk translations
- [ ] `translationJobs` table: tracking in-progress translations

#### 11.4 - i18n dashboard

- [ ] List of active languages
- [ ] Add/remove languages
- [ ] Manual translation editor
- [ ] "Traduire tout" button (bulk)
- [ ] Translation progress per language
- [ ] Estimated cost before launching

#### 11.5 - Multilingual storefront

- [ ] `<LanguageSwitcher />` in the header
- [ ] Language switch without a reload
- [ ] Cookie + localStorage persistence
- [ ] RTL support (direction, alignment)
- [ ] Localized URLs (optional)

#### Step 11 validation tests
- [ ] Add a language and translate a product
- [ ] GPT translation returns a coherent result
- [ ] Batch translate works for 50+ products
- [ ] Instant language switch on the storefront
- [ ] RTL works for Arabic

---

### Step 12: 5 Remaining Themes

**Prerequisites**: Step 6
**Deliverable**: 6 complete, working themes

#### 12.1 - Pizzeria theme
- [ ] Colors: Italian red, basil green, cheese orange
- [ ] Layout: hero slider, masonry grid
- [ ] Features: pizza builder, visual size picker, half-and-half
- [ ] Components: `PizzaBuilder`, `SizeSelector`, `HalfAndHalf`

#### 12.2 - Chinese restaurant theme
- [ ] Colors: Chinese red, black, gold
- [ ] Layout: large ambience image, list with icons
- [ ] Features: chili indicator, A/B/C set menus, ingredient icons
- [ ] Components: `SpiceIndicator`, `MenuComboSelector`

#### 12.3 - Fine Dining theme
- [ ] Colors: deep black, subtle gold, off-white
- [ ] Layout: minimal and elegant, airy grid
- [ ] Features: detailed descriptions, chef's story, wine pairings
- [ ] Components: `ChefStory`, `WinePairing`

#### 12.4 - Cafe/Bakery theme
- [ ] Colors: coffee brown, golden sand, caramel
- [ ] Layout: carousel, dense grid
- [ ] Features: breakfast menu, daily specials, allergen badges
- [ ] Components: `DailySpecials`, `BreakfastMenu`

#### 12.5 - Sushi Bar theme
- [ ] Colors: black, Japanese red, pure white
- [ ] Layout: preparation video, horizontal scroll
- [ ] Features: order by the piece, plate system, visual roll
- [ ] Components: `PieceSelector`, `PlateSystem`, `WasabiLevel`

#### Step 12 validation tests
- [ ] Every theme renders completely without errors
- [ ] Dynamic theme switching
- [ ] Color customization works on every theme
- [ ] Mobile responsive for every theme
- [ ] Theme-specific components work (pizza builder, etc.)

---

## PHASE 2 - INTEGRATIONS

---

### Step 13: Uber Eats Integration

**Prerequisites**: Steps 2, 5, 8
**Deliverable**: Menu sync + Uber Eats order import

#### 13.1 - Uber Eats API setup

- [ ] API credentials configuration
- [ ] HTTP client with OAuth2 auth
- [ ] Token handling (automatic refresh)
- [ ] Rate limiting

#### 13.2 - Menu sync

- [ ] Export the menu to Uber Eats (categories, products, prices, images)
- [ ] `externalIds.uberEatsId` mapping
- [ ] Two-way sync (stock status)
- [ ] Scheduled automatic sync (cron)
- [ ] Manual sync from the dashboard

#### 13.3 - Order import

- [ ] Webhook receiving Uber Eats orders
- [ ] Convert external order -> internal order
- [ ] Automatic kitchen ticket creation
- [ ] "Uber Eats" badge on the KDS
- [ ] Auto-accept (configurable) or manual accept

#### 13.4 - Status updates

- [ ] Sync order status to Uber Eats
- [ ] Prep time estimate
- [ ] Cancellation

#### 13.5 - Integration dashboard

- [ ] Uber Eats configuration page
- [ ] Connection status
- [ ] Sync history
- [ ] Product mapping

#### Step 13 validation tests
- [ ] Menu synced with Uber Eats (sandbox)
- [ ] Order received and created automatically
- [ ] Kitchen ticket created with the Uber Eats badge
- [ ] Statuses synced both ways

---

### Step 14: Deliveroo Integration

**Prerequisites**: Step 13 (same pattern)
**Deliverable**: Menu sync + Deliveroo order import

#### 14.1 - Deliveroo API setup
- [ ] Credentials configuration
- [ ] HTTP client with auth
- [ ] Rate limiting

#### 14.2 - Menu sync
- [ ] Export the menu to Deliveroo
- [ ] `externalIds.deliverooId` mapping
- [ ] Two-way stock sync

#### 14.3 - Order import
- [ ] Webhook receiving orders
- [ ] Conversion + kitchen ticket creation
- [ ] "Deliveroo" badge on the KDS
- [ ] Auto/manual accept (configurable)

#### 14.4 - Integration dashboard
- [ ] Deliveroo configuration page
- [ ] Status + history

#### Step 14 validation tests
- [ ] Same criteria as Step 13, for Deliveroo

---

### Step 15: Uber Direct (Delivery)

**Prerequisites**: Step 7
**Deliverable**: Delivery via Uber Direct for orders placed on the site

#### 15.1 - Uber Direct API setup
- [ ] Credentials configuration (Customer ID)
- [ ] HTTP client

#### 15.2 - Delivery request
- [ ] Create a delivery request: pickup (store) -> dropoff (customer)
- [ ] Cost and time estimate
- [ ] Delivery zone validation

#### 15.3 - Real-time tracking
- [ ] Courier tracking (GPS position)
- [ ] Statuses: assignment, pickup, en route, delivered
- [ ] Customer notifications

#### 15.4 - Checkout integration
- [ ] "Livraison Uber Direct" option at checkout
- [ ] Delivery cost display
- [ ] Time estimate

#### Step 15 validation tests
- [ ] Delivery requested and tracked (sandbox)
- [ ] Real-time tracking works
- [ ] Cost shown at checkout

---

### Step 16: Email Marketing (Basic)

**Prerequisites**: Steps 3 (AWS SES), 8
**Deliverable**: Transactional email system + basic campaigns

#### 16.1 - Transactional emails

- [ ] Template: Order confirmation
- [ ] Template: Order ready (click & collect)
- [ ] Template: Order out for delivery
- [ ] Template: Order delivered
- [ ] Template: New customer welcome
- [ ] Template: Password reset
- [ ] Template: Invoice/Receipt

#### 16.2 - Basic email campaigns

- [ ] Campaign CRUD
- [ ] Simple email editor (WYSIWYG)
- [ ] Recipient selection (everyone, basic segment)
- [ ] Send scheduling
- [ ] Stats: sent, opened, clicked

#### 16.3 - Email dashboard

- [ ] Campaign list
- [ ] Per-campaign stats
- [ ] Saved templates

#### Step 16 validation tests
- [ ] Transactional emails sent automatically
- [ ] Campaign created and sent
- [ ] Stats tracked

---

### Step 17: CMS (Static Pages)

**Prerequisites**: Steps 3, 7
**Deliverable**: Static pages the restaurant owner can edit

#### 17.1 - Page system

- [ ] `cmsPages` table: title, slug, content, status, SEO
- [ ] Page CRUD in the dashboard
- [ ] Content editor (Markdown or simple blocks)
- [ ] Preview before publishing
- [ ] Draft / published handling

#### 17.2 - Default pages

- [ ] A propos
- [ ] Contact
- [ ] CGV (Conditions Generales de Vente)
- [ ] Mentions legales
- [ ] Politique de confidentialite

#### 17.3 - SEO

- [ ] Meta title, description, og:image per page
- [ ] Automatic Sitemap.xml
- [ ] Configurable Robots.txt
- [ ] Schema.org for restaurant (structured data)

#### 17.4 - Storefront

- [ ] Dynamic route `/page/[slug]`
- [ ] Footer with links to CMS pages
- [ ] Custom 404

#### Step 17 validation tests
- [ ] Page created in admin -> visible on the storefront
- [ ] Correct SEO meta tags
- [ ] Sitemap generated
- [ ] 404 for nonexistent slugs

---

### Step 18: Customer Management

**Prerequisites**: Steps 3, 7, 8
**Deliverable**: Customer profiles and history

#### 18.1 - Customer profiles

- [ ] `customers` table: name, email, phone, addresses, preferences
- [ ] Created automatically on the first order
- [ ] Linked to the Better Auth account

#### 18.2 - Customer area (storefront)

- [ ] `/account` - Profile (edit info)
- [ ] `/account/orders` - Order history
- [ ] `/account/addresses` - Saved addresses
- [ ] `/account/favorites` - Favorite products
- [ ] One-click reorder

#### 18.3 - Admin customer dashboard

- [ ] Customer list with search
- [ ] Customer record: info, orders, total revenue, last visit
- [ ] Basic segmentation (new, regular, VIP)
- [ ] CSV export

#### Step 18 validation tests
- [ ] Customer profile created automatically
- [ ] Order history visible on the customer side
- [ ] Complete customer record on the admin side
- [ ] One-click reorder

---

### Step 19: BeYours Admin Dashboard App

**Prerequisites**: All previous steps
**Deliverable**: Internal BeYours dashboard to manage clients

#### 19.1 - App setup

- [ ] `apps/admin-dashboard/` with Next.js 16
- [ ] super_admin auth only
- [ ] Fixed BeYours design (no theming)

#### 19.2 - Client management (restaurants)

- [ ] List of restaurant clients
- [ ] Client record: info, plan, maintenance, deployment
- [ ] Maintenance status (active, expired, grace)

#### 19.3 - Deployment

- [ ] Create the client repo from a template
- [ ] Automated initial configuration
- [ ] Vercel + Convex deployment

#### 19.4 - Maintenance

- [ ] Maintenance expiry notifications
- [ ] Renewal management
- [ ] Update history

#### Step 19 validation tests
- [ ] Restaurant client CRUD
- [ ] Automated (or semi-automated) deployment
- [ ] Maintenance alerts

---

## Dependencies between steps

```
Step 1 (Foundation)
├── Step 2 (Convex Schema)
│   ├── Step 3 (Core Auth/i18n)
│   │   ├── Step 7 (Storefront)
│   │   │   ├── Step 10 (Payments)
│   │   │   ├── Step 15 (Uber Direct)
│   │   │   ├── Step 17 (CMS)
│   │   │   └── Step 18 (Customers)
│   │   ├── Step 8 (Admin Dashboard)
│   │   │   ├── Step 9 (KDS)
│   │   │   ├── Step 11 (i18n GPT)
│   │   │   ├── Step 13 (Uber Eats)
│   │   │   ├── Step 14 (Deliveroo)
│   │   │   └── Step 16 (Email)
│   │   └── Step 5 (Restaurant Logic)
│   └── Step 5 (Restaurant Logic)
├── Step 4 (UI Components)
│   └── Step 6 (Fast Food Theme)
│       └── Step 12 (5 remaining themes)
└── Step 19 (BeYours Admin) [After everything]
```

### Possible parallelization

Some steps can be built in parallel:

- **Step 4** (UI) in parallel with **Step 2** (Schema) and **Step 3** (Core)
- **Step 6** (Theme) as soon as Step 4 is done
- **Step 12** (Remaining themes) in parallel with Steps 7-8
- **Step 13** (Uber Eats) and **Step 14** (Deliveroo) in parallel
- **Step 16** (Email) and **Step 17** (CMS) in parallel

---

## Decision Log

| # | Decision | Alternatives | Rationale |
|---|----------|-------------|--------|
| 1 | Full Turborepo monorepo | Single app, simplified monorepo | The theme-selling business model requires modular, publishable packages |
| 2 | AWS S3 + SES | Convex Storage + Resend | More control, cheaper at scale, consistent with CLAUDE.md |
| 3 | Tests from day one | Tests after the MVP | Quality and reliability, avoid technical debt |
| 4 | Better Auth + Convex | NextAuth, Clerk, Auth0 | Framework-agnostic, type-safe, modular plugins, works with Convex |
| 5 | One complete theme first | All themes in parallel | Validate the theme architecture before multiplying it |
| 6 | Phases 1+2 detailed | Full 5-phase plan | Focus on the priority deliverable, phases 3-5 later |
| 7 | GPT-3.5-turbo for translation | DeepL API, Google Translate | Very low cost ($0.001/product), good enough quality, already in the stack |

---

## Assumptions

1. **Convex** handles the expected volume (hundreds of products, thousands of orders/month)
2. **Better Auth** has a stable, maintained Convex adapter
3. The **Uber Eats and Deliveroo APIs** are accessible (requires a commercial partnership)
4. Client deployment will be on **Vercel** (Next.js 16 compatible)
5. The **AWS budget** is handled per client (each restaurant pays its own S3/SES costs)

---

## Identified risks

| Risk | Impact | Mitigation |
|--------|--------|-----------|
| Better Auth + Convex: unstable adapter | High | Test early, keep a plan B (custom auth) |
| Platform APIs (Uber Eats, Deliveroo): restricted access | Medium | Contact the partnership teams starting in Phase 1, mock in dev |
| Monorepo complexity | Medium | Solid setup in Step 1, strict CI |
| Convex performance with many tables | Low | Optimized indexes, systematic pagination |
| ESC/POS thermal printing | Medium | Existing library (escpos), test with real hardware |

---

**Version**: 1.0.0
**Date**: February 14, 2026
**Author**: BeYours Team
