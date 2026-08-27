# Changelog - @be-in-digital/convex-schema

## 2.2.0

### Minor Changes

- 285b579: Record establishment changes in the system audit log

  `systemAuditLog` was only ever written by system operations, so a restaurant
  could be created, renamed, moved, reconfigured or deleted and the journal stayed
  empty. Every mutation in the stores module now appends an entry naming the
  actor, the establishment, the operation, the timestamp and the before/after of
  the fields the edit moved.
  - `systemAuditLog` gains `store_created` / `store_updated` / `store_deleted`,
    an optional `targetStoreId`, and an index to read one establishment's history.
  - The printer API key is redacted on both sides of a `printConfig` diff, and
    create/delete snapshots use a field allowlist so the legacy `integrations`
    blob never reaches the log.
  - `system.getAuditLog` scopes establishment entries to the stores the reader has
    access to, and pages with Convex's own cursor instead of arithmetic that
    stalled after the second page.

## 2.1.0

### Minor Changes

- 5eec48d: Maintenance & migration system: a per-deployment maintenance contract (derived status, update coverage keyed on release date), a release catalog synced from npm that locks published versions once the contract expires, site migration requests (controlled-transition workflow plus audit log), self-serve renewal through Stripe (the `bidProduct: maintenance` webhook creates a contract, never ownerEntitlements), and SES notifications when a request is opened. Adds a Maintenance tab to the admin System page.
- 83f6af9: Enforce the order status machine in `updateStatus`.

  The mutation wrote whatever status it was handed. Nothing stopped an order going from `pending` straight to `completed`, or a cancelled order being revived — the transition table existed but only the storefront services consulted it, as advice.

  Three layers each carried their own opinion and they had drifted. The admin UI offered "Envoyer en livraison" on a ready order while the services table forbade `ready -> out_for_delivery`. The table is now single and lives in `@be-in-digital/convex-schema` (`ORDER_STATUS_TRANSITIONS`, `canTransitionOrderStatus`, `getNextOrderStatuses`); the services and the mutation both read it, and `ready -> out_for_delivery` is allowed, matching the button that already existed.

  **Behaviour change:** `updateStatus` now throws `Invalid order status transition: <from> -> <to>` instead of writing. Replaying the current status is an idempotent no-op rather than an error, so webhook retries and double-clicked buttons stay harmless. `updateFromWebhook` is deliberately left unguarded — Uber Eats and Deliveroo are authoritative for the orders they own.

  The cancellation window stops at `confirmed`, matching what Deliveroo permits: an order already being prepared, ready, or with a rider can no longer be cancelled internally.

## 2.0.2

### Patch Changes

- 7f0122b: Republished from main. Fixes two problems with the 2.0.1 tarballs that broke consumers:
  - `@be-in-digital/core`: the `./auth/rbac` subpath pointed at `src/auth/rbac.ts` while the tarball only ships `dist/` → broken import for consumers (`convex-functions/auth` included). `files` now includes `src`.
  - The type fixes that were on main but never published (promotion-form/email-config in admin, Uber Eats signatures in integrations/convex-functions) go out with this patch — they had been committed without a changeset.

## 2.0.1

### Patch Changes

- 321adad: Production-readiness audit fixes for delivery integrations:
  - **integrations**: the Uber Eats order mapper now keeps money in integer **cents**
    instead of dividing by 100. Previously Uber order totals were stored 100× too
    small while Deliveroo and website orders used cents. `UnifiedOrder` money fields
    are documented as cents.
  - **convex-schema**: add the `oauthStates` table (single-use CSRF `state` for OAuth
    connect flows) and add `uberEatsConnections` to the package's composed reference
    schema so it no longer drifts from the app schema.
  - **convex-functions**: `createFromWebhook` now returns `{ orderId, created }` so
    webhook handlers can skip duplicate kitchen-ticket creation and double
    auto-accept when Uber/Deliveroo retry a delivery (idempotent order import).

- 1a5ca27: Rename package scope from @beindigital-engine to @be-in-digital for GitHub Packages compatibility

## 2.0.0

### Major Changes

- 7c3d4da: Configure private npm publishing for all @beindigital-engine packages

  ### What changed
  - Packages are now publishable to npm as private (restricted) packages under the `@beindigital-engine` scope.
  - Removed `"private": true` flag from all packages and replaced with `"publishConfig": { "access": "restricted" }`.
  - Added `"files"` field to control published contents.

  ### Why

  First official release of all packages on the npm private registry for distribution.

  ### How to install

  ```bash
  npm login --scope=@beindigital-engine
  pnpm add @be-in-digital/core @be-in-digital/ui @be-in-digital/restaurant
  ```

## 1.0.0

### Major Changes

- ad4d8d2: Configure private npm publishing for all @beindigital-engine packages

  ### What changed
  - Packages are now publishable to npm as private (restricted) packages under the `@beindigital-engine` scope.
  - Removed `"private": true` flag from all packages and replaced with `"publishConfig": { "access": "restricted" }`.
  - Added `"files"` field to control published contents.

  ### Why

  First official release of all packages on the npm private registry for distribution.

  ### How to install

  ```bash
  npm login --scope=@beindigital-engine
  pnpm add @be-in-digital/core @be-in-digital/ui @be-in-digital/restaurant
  ```

All notable changes to this package will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/fr/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/lang/fr/).

## [0.1.0] - 2026-02-14

### Added

#### Complete Convex database schema

**Better Auth tables**

- `user` - Users with authentication
- `session` - Session management
- `account` - OAuth accounts and passwords
- `verification` - Email verifications and tokens

**BeYours extensions**

- `userProfiles` - Extended user profiles with roles and permissions
- `stores` - Multi-store management (unlimited per owner)
- `teamMembers` - Team members with specific roles

**Catalog**

- `categories` - Product categories (hierarchical)
- `products` - Full products with options, allergens, schedules, stock
- `menus` - Set menus and combos

**Orders**

- `orders` - Full orders (delivery, pickup, dine-in)
- `kitchenTickets` - Kitchen tickets with stations
- `printerSettings` - ESC/POS printer configuration
- `payments` - Multi-provider payments (Stripe, SumUp, PayPal, Square, Cash)

**Internationalization**

- `languages` - Dynamic languages (unlimited)
- `translations` - Translations per entity and field
- `translationJobs` - GPT-3.5 auto-translation jobs

**Gamification**

- `gameQRCodes` - QR codes on restaurant tables
- `requiredActions` - Required social actions (Google review, Instagram follow, etc.)
- `games` - Games (Wheel of Fortune, Scratch Card) with a controllable win rate
- `prizes` - Winnable prizes with types and validity
- `gamePlays` - Play history with a 24h cooldown
- `prizeRedemptions` - Prize redemptions with QR codes

#### Complete Zod validators

**50+ validators** for every CRUD operation:

- Stores (create, update, status)
- Categories (create, update)
- Products (create, update, stock)
- Menus (create, update)
- Orders (create, update status, update payment)
- Kitchen (create ticket, update status)
- Printers (create, update)
- Payments (create, refund)
- Languages (create, update)
- Translations (create, batch translate)
- Team (create, update)
- Gamification (QR codes, actions, games, prizes, play, redeem)
- User Profiles (create, update)

**Validator features:**

- Error messages in French
- Strict format validation (emails, URLs, country codes, schedules)
- Automatic transformations (uppercase, lowercase, normalization)
- Sensible defaults
- Business constraints (prices in cents, win ratio 0-100%, etc.)

#### TypeScript types

**90+ exported types** including:

- Input types (CreateXInput, UpdateXInput)
- Document types (XDoc with \_id and \_creationTime)
- Enum types (OrderStatus, PaymentStatus, UserRole, etc.)
- Complex types (ProductOption, OrderItem, etc.)
- Utility types (BaseEntity, PaginationParams, etc.)

#### Full documentation

- `README.md` - Package overview
- `EXAMPLES.md` - Concrete usage examples (7+ scenarios)
- `CHANGELOG.md` - Change history

#### Unit tests

- 23 Vitest tests covering all the main validators
- Positive and negative validation tests
- Edge case tests
- Coverage of the automatic transformations

#### Optimized indexes

**35+ indexes** for fast queries:

- Simple indexes (`by_storeId`, `by_email`, etc.)
- Composite indexes (`by_storeId_status`, `by_storeId_categoryId`, etc.)
- Sort indexes (`by_storeId_createdAt`, `by_storeId_sortOrder`, etc.)

### Configuration

- TypeScript strict mode support
- ESLint configuration
- Vitest configuration for unit tests
- Build configuration with tsconfig.json
- Private package for the monorepo

### Dependencies

- `convex` ^1.18.0 - BaaS backend
- `zod` ^3.24.0 - Schema validation

### Technical notes

- **Multi-tenant**: 1 Convex instance per restaurant
- **Prices**: Stored in cents (integer) to avoid precision problems
- **Timestamps**: In milliseconds (Date.now())
- **Country codes**: ISO 3166-1 alpha-2 format (2 letters)
- **Language codes**: ISO 639-1 format (2-5 letters)
- **Schedules**: HH:mm format (24h)

### Architecture

- Centralized schema, reusable across every app
- Shared validators for consistent validation
- TypeScript types inferred automatically from Zod
- Barrel exports for ease of use

---

## [Unreleased]

### Coming up

- Validators for webhooks (Stripe, Uber Eats, Deliveroo)
- Types for real-time events
- Helpers for price calculations
- Utilities for slug generation
- Migration scripts
- Performance benchmarks
- Auto-generated API documentation

---

[0.1.0]: https://github.com/be-in-digital/beindigital-engine/releases/tag/convex-schema-v0.1.0
