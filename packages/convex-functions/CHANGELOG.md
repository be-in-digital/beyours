# Changelog

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
