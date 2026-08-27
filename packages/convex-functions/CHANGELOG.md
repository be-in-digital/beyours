# Changelog

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

### Patch Changes

- 9817b8d: Creating an establishment now makes its creator an administrator of it.

  `stores.create` is the one mutation the store-scoped seam cannot guard — there
  is no store yet to check membership against — and nothing added the new store to
  the creator's profile. A client admin who opened a second location was refused
  by the detail page and every edit, and `profileProvisioning` refused them their
  own profile too, so only a super admin could let them back in.

- Updated dependencies [285b579]
  - @be-in-digital/convex-schema@2.2.0

## 2.1.0

### Minor Changes

- 5eec48d: Maintenance & migration system: a per-deployment maintenance contract (derived status, update coverage keyed on release date), a release catalog synced from npm that locks published versions once the contract expires, site migration requests (controlled-transition workflow plus audit log), self-serve renewal through Stripe (the `bidProduct: maintenance` webhook creates a contract, never ownerEntitlements), and SES notifications when a request is opened. Adds a Maintenance tab to the admin System page.
- 83f6af9: Enforce the order status machine in `updateStatus`.

  The mutation wrote whatever status it was handed. Nothing stopped an order going from `pending` straight to `completed`, or a cancelled order being revived — the transition table existed but only the storefront services consulted it, as advice.

  Three layers each carried their own opinion and they had drifted. The admin UI offered "Envoyer en livraison" on a ready order while the services table forbade `ready -> out_for_delivery`. The table is now single and lives in `@be-in-digital/convex-schema` (`ORDER_STATUS_TRANSITIONS`, `canTransitionOrderStatus`, `getNextOrderStatuses`); the services and the mutation both read it, and `ready -> out_for_delivery` is allowed, matching the button that already existed.

  **Behaviour change:** `updateStatus` now throws `Invalid order status transition: <from> -> <to>` instead of writing. Replaying the current status is an idempotent no-op rather than an error, so webhook retries and double-clicked buttons stay harmless. `updateFromWebhook` is deliberately left unguarded — Uber Eats and Deliveroo are authoritative for the orders they own.

  The cancellation window stops at `confirmed`, matching what Deliveroo permits: an order already being prepared, ready, or with a rider can no longer be cancelled internally.

### Patch Changes

- Updated dependencies [5eec48d]
- Updated dependencies [83f6af9]
  - @be-in-digital/convex-schema@2.1.0

## 2.0.2

### Patch Changes

- 7f0122b: Republished from main. Fixes two problems with the 2.0.1 tarballs that broke consumers:
  - `@be-in-digital/core`: the `./auth/rbac` subpath pointed at `src/auth/rbac.ts` while the tarball only ships `dist/` → broken import for consumers (`convex-functions/auth` included). `files` now includes `src`.
  - The type fixes that were on main but never published (promotion-form/email-config in admin, Uber Eats signatures in integrations/convex-functions) go out with this patch — they had been committed without a changeset.

- Updated dependencies [7f0122b]
  - @be-in-digital/cms@2.0.2
  - @be-in-digital/convex-schema@2.0.2
  - @be-in-digital/core@2.0.2

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
- Updated dependencies [321adad]
- Updated dependencies [1a5ca27]
  - @be-in-digital/convex-schema@2.0.1
  - @be-in-digital/core@2.0.1
  - @be-in-digital/cms@2.0.1

## 2.0.1

### Patch Changes

- b8aaa34: Rename package scope from @beindigital-engine to @be-in-digital for GitHub Packages compatibility
- Updated dependencies [b8aaa34]
  - @be-in-digital/core@2.0.1
  - @be-in-digital/cms@2.0.1
  - @be-in-digital/convex-schema@2.0.1

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

### Patch Changes

- Updated dependencies [7c3d4da]
  - @be-in-digital/convex-schema@2.0.0
  - @be-in-digital/core@2.0.0
  - @be-in-digital/cms@2.0.0

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

### Patch Changes

- Updated dependencies [ad4d8d2]
  - @be-in-digital/convex-schema@1.0.0
  - @be-in-digital/core@1.0.0
  - @be-in-digital/cms@1.0.0

All notable changes to `@be-in-digital/convex-functions` will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2026-02-14

### Added

#### Core Functions

- **helpers.ts** - Utility functions
  - `generateOrderNumber()` - Generate unique order numbers
  - `generateSlug(text)` - Convert text to URL-friendly slugs
  - `now()` - Get current timestamp

#### Store Management (stores.ts)

- `list()` - Query all stores
- `getById(id)` - Get store by ID
- `getBySlug(slug)` - Get store by slug
- `create(...)` - Create new store with default hours
- `update(id, ...)` - Update store information
- `updateHours(id, hours)` - Update opening hours
- `updateBranding(id, branding)` - Update branding
- `updateSettings(id, settings)` - Update settings
- `remove(id)` - Delete store

#### Product Management (products.ts)

- `list(storeId)` - Query all products
- `getById(id)` - Get product by ID
- `getByCategory(storeId, categoryId)` - Get products by category
- `getBySlug(storeId, slug)` - Get product by slug
- `getFeatured(storeId)` - Get featured products
- `create(...)` - Create new product
- `update(id, ...)` - Update product
- `updateStock(id, quantity)` - Update stock quantity
- `toggleStatus(id)` - Toggle active status
- `remove(id)` - Delete product

#### Category Management (categories.ts)

- `list(storeId)` - Query all categories
- `getById(id)` - Get category by ID
- `create(...)` - Create new category
- `update(id, ...)` - Update category
- `reorder(ids)` - Reorder categories
- `remove(id)` - Delete category

#### Order Management (orders.ts)

- `list(storeId)` - Query all orders
- `getById(id)` - Get order by ID
- `getByCustomer(customerId)` - Get orders by customer
- `getByStatus(storeId, status)` - Get orders by status
- `create(...)` - Create new order (auto-calculates totals)
- `updateStatus(id, status, reason?)` - Update order status
- `remove(id)` - Delete order

#### Kitchen System (kitchenTickets.ts)

- `getByStore(storeId)` - Get all kitchen tickets
- `getByStatus(storeId, status)` - Get tickets by status
- `getByStation(storeId, station)` - Get tickets by station
- `getByOrder(orderId)` - Get tickets by order
- `create(...)` - Create new kitchen ticket
- `updateStatus(id, status)` - Update ticket status
- `assignStation(id, station)` - Assign to station
- `assignTo(id, userId)` - Assign to user
- `incrementPrintCount(id)` - Increment print count

#### Payment Processing (payments.ts)

- `getByOrder(orderId)` - Get payments by order
- `getByStore(storeId)` - Get all store payments
- `create(...)` - Create new payment
- `updateStatus(id, status, externalId?)` - Update payment status
- `refund(id, amount, reason?)` - Process refund

#### Team Management (teamMembers.ts)

- `list(storeId)` - Query all team members
- `getByUser(userId)` - Get memberships by user
- `getByRole(storeId, role)` - Get members by role
- `create(...)` - Add team member
- `update(id, ...)` - Update team member
- `toggleActive(id)` - Toggle active status
- `remove(id)` - Remove team member

#### Language Management (languages.ts)

- `list(storeId)` - Query all languages
- `create(...)` - Add new language
- `update(id, ...)` - Update language
- `toggleActive(id)` - Toggle active status
- `setDefault(storeId, languageId)` - Set as default language
- `remove(id)` - Delete language

#### Translation Management (translations.ts)

- `getForEntity(storeId, entityType, entityId)` - Get translations for entity
- `getByLanguage(storeId, languageCode)` - Get translations by language
- `upsert(...)` - Create or update translation
- `bulkUpsert(translations)` - Bulk upsert translations
- `remove(id)` - Delete translation

### Features

#### Automatic Calculations

- **Orders**: Auto-calculate subtotal, taxes, delivery fees, and total
- **Order Numbers**: Auto-generate unique order numbers (ORD-YYYY-XXXX format)
- **Timestamps**: Auto-manage createdAt, updatedAt, startedAt, completedAt, cancelledAt

#### Multi-tenant Support

- All queries filter by `storeId` for data isolation
- Guaranteed separation between different stores/restaurants

#### Smart Logic

- **Languages**: Auto-unset other default languages when setting new default
- **Translations**: Intelligent upsert (update if exists, create if not)
- **Kitchen Tickets**: Auto-set startedAt/completedAt based on status changes

#### Type Safety

- Full TypeScript support
- Convex validators on all arguments
- No `any` types (except payment metadata)

### Documentation

- README.md - Package overview and function list
- USAGE.md - Complete usage guide with examples
- SUMMARY.md - Technical summary
- CHANGELOG.md - Version history

### Scripts

- `copy-to-app.sh` - Script to copy functions to Next.js app
- `pnpm copy-to <app-name>` - Package script for easy copying

### Testing

- Vitest test setup
- Example tests for helper functions
- 13 passing tests with 100% coverage on helpers

### Payment Providers

- Stripe
- SumUp
- PayPal
- Square
- Cash

### Team Roles

- Owner
- Manager
- Staff
- Kitchen
- Delivery

### Statistics

- 1,582 lines of TypeScript code
- 60+ functions (24 queries + 36 mutations)
- 10 functional modules
- 3 utility helpers

[0.1.0]: https://github.com/be-in-digital/beindigital-engine/releases/tag/convex-functions-v0.1.0
