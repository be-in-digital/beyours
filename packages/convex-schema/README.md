# @be-in-digital/convex-schema

Shared Convex database schema definitions for BeYours Engine.

## Structure

```
src/
├── tables/              # Individual table definitions
│   ├── userProfiles.ts
│   ├── stores.ts
│   ├── teamMembers.ts
│   ├── catalog.ts       # categories, products, menus
│   ├── orders.ts
│   ├── kitchen.ts       # kitchenTickets, printerSettings
│   ├── payments.ts
│   ├── i18n.ts          # languages, translations, translationJobs
│   ├── gamification.ts  # gameQRCodes, requiredActions, games, prizes, gamePlays, prizeRedemptions
│   └── index.ts         # Barrel export
├── schema.ts            # Composed schema (reference)
├── validators.ts        # Zod validators
├── types.ts             # TypeScript types
└── index.ts             # Main package export
```

## Usage

### Import Individual Tables

```typescript
import { defineSchema } from "convex/server"
import {
  storesTable,
  productsTable,
  ordersTable
} from "@be-in-digital/convex-schema/tables"

export default defineSchema({
  stores: storesTable,
  products: productsTable,
  orders: ordersTable,
  // Add your custom tables here...
})
```

### Import All Tables

```typescript
import { defineSchema } from "convex/server"
import {
  userProfilesTable,
  storesTable,
  teamMembersTable,
  categoriesTable,
  productsTable,
  menusTable,
  ordersTable,
  kitchenTicketsTable,
  printerSettingsTable,
  paymentsTable,
  languagesTable,
  translationsTable,
  translationJobsTable,
  gameQRCodesTable,
  requiredActionsTable,
  gamesTable,
  prizesTable,
  gamePlaysTable,
  prizeRedemptionsTable,
} from "@be-in-digital/convex-schema/tables"

export default defineSchema({
  userProfiles: userProfilesTable,
  stores: storesTable,
  teamMembers: teamMembersTable,
  categories: categoriesTable,
  products: productsTable,
  menus: menusTable,
  orders: ordersTable,
  kitchenTickets: kitchenTicketsTable,
  printerSettings: printerSettingsTable,
  payments: paymentsTable,
  languages: languagesTable,
  translations: translationsTable,
  translationJobs: translationJobsTable,
  gameQRCodes: gameQRCodesTable,
  requiredActions: requiredActionsTable,
  games: gamesTable,
  prizes: prizesTable,
  gamePlays: gamePlaysTable,
  prizeRedemptions: prizeRedemptionsTable,
})
```

### Import Reference Schema

```typescript
import { schema } from "@be-in-digital/convex-schema"

// Use as reference or extend
export default schema
```

### Import Validators

```typescript
import {
  createStoreSchema,
  createProductSchema,
  createOrderSchema,
  // etc.
} from "@be-in-digital/convex-schema/validators"

// Validation
const result = createStoreSchema.parse(data)
```

### Import Types

```typescript
import type { Store, Product, Order } from "@be-in-digital/convex-schema/types"

// Use for type safety
const store: Store = { ... }
```

## Exports

### Main Package

```typescript
// Import from package root
import {
  // All table definitions
  storesTable,
  productsTable,
  // ...

  // Validators
  createStoreSchema,
  // ...

  // Types
  type Store,
  type Product,
  // ...
} from "@be-in-digital/convex-schema"
```

### Subpath Exports

- `@be-in-digital/convex-schema/tables` - All table definitions
- `@be-in-digital/convex-schema/validators` - Zod validators
- `@be-in-digital/convex-schema/types` - TypeScript types

## Important Notes

### Auth Tables

Auth tables (`user`, `session`, `account`, `verification`, `jwks`) are **NOT** included in this package. They are managed by the Better Auth component.

### User References

All `userId` fields use `v.string()` (not `v.id("user")`) to reference Better Auth users.

### Source of Truth

The app schema at `apps/reference/convex/schema.ts` is the **source of truth** for all table definitions. This package exports those definitions for reuse.

## Available Tables

### Core Tables
- `userProfilesTable` - User profiles with roles and permissions
- `storesTable` - Restaurant stores/locations
- `teamMembersTable` - Team members linked to stores

### Catalog Tables
- `categoriesTable` - Hierarchical product categories
- `productsTable` - Products with options, allergens, scheduling, platform integration
- `menusTable` - Meal deals and combo offers

### Order Tables
- `ordersTable` - Complete order lifecycle with multi-source support
- `kitchenTicketsTable` - Kitchen display with station routing
- `printerSettingsTable` - Registered but **unused** (zero readers, zero writers): it belongs to an ESC/POS path that was never built. Live print config is `stores.printConfig`
- `paymentsTable` - Multi-provider payment tracking

### i18n Tables
- `languagesTable` - Dynamic language management (unlimited)
- `translationsTable` - Translated content for all entities
- `translationJobsTable` - GPT-3.5 batch translation jobs

### Gamification Tables
- `gameQRCodesTable` - QR codes placed on restaurant tables
- `requiredActionsTable` - Social actions customers must complete
- `gamesTable` - Game configuration with admin-controlled win ratio
- `prizesTable` - Rewards that customers can win
- `gamePlaysTable` - Game plays with 24h cooldown
- `prizeRedemptionsTable` - Prize redemption tracking

## Database Schema Details

### Multi-tenant Architecture
- **1 Convex instance per restaurant client**
- Filter by `storeId` for data separation
- Support for unlimited physical locations per restaurant

### Data Types

#### Prices
All prices are stored in **cents** (integer) to avoid precision issues.

```typescript
// Correct
price: 1250 // 12.50 EUR

// Incorrect
price: 12.50 // Imprecise float
```

#### Timestamps
All timestamps are in **milliseconds** (Date.now())

```typescript
createdAt: Date.now()
updatedAt: Date.now()
```

#### Hours
Format **HH:mm** (24h)

```typescript
open: "09:00"
close: "22:00"
```

#### Country Codes
Format **ISO 3166-1 alpha-2** (2 uppercase letters)

```typescript
country: "FR"
country: "ES"
```

#### Language Codes
Format **ISO 639-1** (2-5 lowercase letters)

```typescript
languageCode: "fr"
languageCode: "en"
languageCode: "zh-CN"
```

### Business Rules

#### Multi-store
- 1 owner = unlimited restaurants
- Each store has its own `storeId`
- Users can have access to multiple stores

#### Gamification
- **Admin-controlled win ratio** (0-100%)
- **24h cooldown** between plays
- Social actions required before playing
- Prizes have validity period

#### Translation
- **GPT-3.5-turbo** for automatic translation
- Cost: ~$0.001 per product
- Unlimited language support
- Manual translation available

#### Kitchen
- **Auto-print** tickets on payment, through the browser (`window.print()` from
  the kitchen screen, with Chrome in `--kiosk-printing` mode)
- Multi-station support (starters, mains, desserts, etc.)
- No ESC/POS bytes, no network or USB transport. The thermal path will be cloud
  printing (Star CloudPRNT / Epson Server Direct Print)

## Development

```bash
# Type check
pnpm type-check

# Lint
pnpm lint

# Test
pnpm test
pnpm test:watch

# Clean
pnpm clean
```

## Version

Current version: **0.2.0**

## License

Private package - BeYours Team
