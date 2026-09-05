# @be-in-digital/convex-schema

> 50+ table definitions, 40+ Zod validators, and 100+ TypeScript types for the Convex database.

## Table of Contents

- [Installation](#installation)
- [Tables](#tables)
- [Types](#types)
- [Enums](#enums)
- [Usage with Convex](#usage-with-convex)

## Installation

```bash
pnpm add @be-in-digital/convex-schema
```

### Dependencies

- `convex` — Convex runtime
- `zod` — Schema validation

## Tables

Import table definitions to compose your Convex schema:

```typescript
// convex/schema.ts
import { defineSchema } from "convex/server";
import {
  storesTable,
  productsTable,
  ordersTable,
  categoriesTable,
  kitchenTicketsTable,
  gamesTable,
  languagesTable,
  translationsTable,
} from "@be-in-digital/convex-schema/tables";

export default defineSchema({
  stores: storesTable,
  products: productsTable,
  orders: ordersTable,
  categories: categoriesTable,
  kitchenTickets: kitchenTicketsTable,
  games: gamesTable,
  languages: languagesTable,
  translations: translationsTable,
  // ...add more as needed
});
```

### Core Tables

| Table | Description | Key Fields |
|-------|-------------|------------|
| `storesTable` | Store configuration | name, address, hours, location, status |
| `productsTable` | Product catalog | name, price, options, stock, scheduling |
| `ordersTable` | Customer orders | items, status, payment, customer |
| `categoriesTable` | Product categories | name, slug, position |

### Kitchen System

| Table | Description |
|-------|-------------|
| `kitchenTicketsTable` | Real-time kitchen tickets |

### Gamification

| Table | Description |
|-------|-------------|
| `gameQRCodesTable` | QR codes linked to tables |
| `requiredActionsTable` | Social actions (Google review, Instagram follow) |
| `gamesTable` | Game definitions with win ratio |
| `prizesTable` | Available prizes |
| `gamePlaysTable` | Game play records |
| `prizeRedemptionsTable` | Prize redemption tracking |

### i18n

| Table | Description |
|-------|-------------|
| `languagesTable` | Available languages |
| `translationsTable` | Translation key-value pairs |
| `translationJobsTable` | GPT translation job queue |

## Types

TypeScript types for every document:

```typescript
import type {
  StoreDoc,
  ProductDoc,
  OrderDoc,
} from "@be-in-digital/convex-schema";

function displayOrder(order: OrderDoc) {
  console.log(order.status, order.total, order.items.length);
}
```

| Type | Description |
|------|-------------|
| `StoreDoc` | Store document with all fields |
| `ProductDoc` | Product with options, pricing, stock |
| `OrderDoc` | Order with items, status, payment |
| `CategoryDoc` | Category with name and position |
| `KitchenTicketDoc` | Kitchen ticket with items and status |
| `GameDoc` | Game with type and win ratio |
| `PrizeDoc` | Prize with name and stock |

## Enums

```typescript
import { OrderStatus, GameType } from "@be-in-digital/convex-schema";

// Order lifecycle
OrderStatus.PENDING      // Customer placed order
OrderStatus.CONFIRMED    // Restaurant accepted
OrderStatus.PREPARING    // Kitchen is preparing
OrderStatus.READY        // Ready for pickup/delivery
OrderStatus.DELIVERED    // Delivered to customer
OrderStatus.COMPLETED    // Finished

// Game types
GameType.WHEEL_OF_FORTUNE
GameType.SCRATCH_CARD
```

## Usage with Convex

### In Mutations

```typescript
// convex/orders.ts
import { mutation } from "./_generated/server";
import { ordersTable } from "@be-in-digital/convex-schema/tables";

export const create = mutation({
  args: {
    storeId: v.id("stores"),
    items: v.array(v.object({
      productId: v.id("products"),
      quantity: v.number(),
    })),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("orders", {
      ...args,
      status: "pending",
      createdAt: Date.now(),
    });
  },
});
```

### In Queries

```typescript
// convex/products.ts
import { query } from "./_generated/server";

export const listByStore = query({
  args: { storeId: v.id("stores") },
  handler: async (ctx, { storeId }) => {
    return await ctx.db
      .query("products")
      .filter((q) => q.eq(q.field("storeId"), storeId))
      .collect();
  },
});
```
