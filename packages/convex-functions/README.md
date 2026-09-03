# @be-in-digital/convex-functions

Reusable Convex function definitions for BeYours Engine.

## Overview

This package exports plain `{ args, handler }` objects that can be wrapped by Convex's `query()` and `mutation()` in consuming applications. This approach allows:

- **No dependency on generated code**: Package doesn't import from `_generated/server`
- **Type safety at runtime**: Convex validators provide runtime validation
- **Reusability**: Functions can be shared across multiple apps
- **Single source of truth**: All business logic lives in one place

## Architecture

```
packages/convex-functions/src/
├── categories.ts      # Category CRUD operations
├── stores.ts          # Store management
├── products.ts        # Product catalog
├── orders.ts          # Order processing
├── kitchenTickets.ts  # Kitchen display system
├── payments.ts        # Payment processing
├── teamMembers.ts     # Team member management
├── languages.ts       # Multi-language support
├── translations.ts    # Translation management
├── helpers.ts         # Pure utility functions
└── index.ts           # Package exports
```

Ten of the 74 files in `src/`, shown for shape. `index.ts` is the barrel that
exports them all; `src/` is the list.

## Usage

### In Convex Functions (App)

```typescript
// apps/reference/convex/categories.ts
import { query, mutation } from "./_generated/server"
import * as categoriesFns from "@be-in-digital/convex-functions/categories"

// Wrap the exported definitions with Convex query/mutation
export const list = query(categoriesFns.list)
export const getById = query(categoriesFns.getById)
export const create = mutation(categoriesFns.create)
export const update = mutation(categoriesFns.update)
export const remove = mutation(categoriesFns.remove)
```

### Using Helpers

```typescript
import { generateOrderNumber, generateSlug } from "@be-in-digital/convex-functions"

const orderNumber = generateOrderNumber() // "ORD-2026-ABC123"
const slug = generateSlug("Product Name") // "product-name"
```

## Function Modules

### Categories
- `list` - List all categories for a store
- `getById` - Get category by ID
- `create` - Create new category
- `update` - Update category
- `reorder` - Reorder categories
- `remove` - Delete category

### Stores
- `list` - List all stores
- `getById` - Get store by ID
- `getBySlug` - Get store by slug
- `create` - Create new store
- `update` - Update store info
- `updateHours` - Update opening hours
- `updateBranding` - Update branding
- `updateSettings` - Update settings
- `remove` - Delete store

### Products
- `list` - List all products
- `getById` - Get product by ID
- `getByCategory` - Get products by category
- `getBySlug` - Get product by slug
- `getFeatured` - Get featured products
- `create` - Create new product
- `update` - Update product
- `updateStock` - Update stock quantity
- `toggleStatus` - Toggle active status
- `remove` - Delete product

### Orders
- `list` - List orders for a store
- `getById` - Get order by ID
- `getByCustomer` - Get customer's orders
- `getByStatus` - Get orders by status
- `create` - Create new order
- `updateStatus` - Update order status
- `remove` - Delete order

### Kitchen Tickets
- `getByStore` - Get all tickets for a store
- `getByStatus` - Get tickets by status
- `getByStation` - Get tickets by station
- `getByOrder` - Get tickets for an order
- `create` - Create new ticket
- `updateStatus` - Update ticket status
- `assignStation` - Assign to station
- `assignTo` - Assign to user
- `incrementPrintCount` - Increment print count

### Payments
- `getByOrder` - Get payments for an order
- `getByStore` - Get all payments for a store
- `create` - Create new payment
- `updateStatus` - Update payment status
- `refund` - Refund a payment

### Team Members
- `list` - List team members
- `getByUser` - Get by user ID
- `getByRole` - Get by role
- `create` - Create team member
- `update` - Update team member
- `toggleActive` - Toggle active status
- `remove` - Delete team member

### Languages
- `list` - List languages for a store
- `create` - Create new language
- `update` - Update language
- `toggleActive` - Toggle active status
- `setDefault` - Set as default language
- `remove` - Delete language

### Translations
- `getForEntity` - Get translations for entity
- `getByLanguage` - Get translations by language
- `upsert` - Create or update translation
- `bulkUpsert` - Bulk create/update translations
- `remove` - Delete translation

## TypeScript Support

All functions use `any` types for `ctx` and `args` parameters since:
- Convex validators provide runtime type checking
- The actual types come from the app's generated schema
- This keeps the package independent of any specific schema

## Development

```bash
# Type check
pnpm type-check

# Lint
pnpm lint

# Run tests
pnpm test
```

## Version History

- **0.2.0** - Refactored to export `{ args, handler }` objects
- **0.1.0** - Initial version with full query/mutation exports
