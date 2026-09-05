# @be-in-digital/convex-functions

> 48 backend function modules covering auth, CRUD, kitchen, payments, gamification, i18n, email, CMS, integrations, and AI.

## Table of Contents

- [Installation](#installation)
- [Modules](#modules)
- [Usage](#usage)

## Installation

```bash
pnpm add @be-in-digital/convex-functions
```

## Modules

### Store Management

| Module | Description |
|--------|-------------|
| `stores` | Store CRUD, configuration, opening hours |
| `stores.status` | Open/closed status calculation |
| `stores.geolocation` | Nearest store lookup |

### Product Catalog

| Module | Description |
|--------|-------------|
| `products` | Product CRUD, search, filtering |
| `products.options` | Product option groups and variants |
| `products.stock` | Stock management and alerts |
| `categories` | Category CRUD and ordering |

### Orders

| Module | Description |
|--------|-------------|
| `orders` | Order creation and lifecycle |
| `orders.status` | Status transitions and validation |
| `orders.tracking` | Real-time order tracking |

### Kitchen

| Module | Description |
|--------|-------------|
| `kitchenTickets` | Ticket creation, browser printing, status |
| `kitchenTickets.stations` | Multi-station routing |

Print configuration lives on `stores.printConfig` (`stores.updatePrintConfig`).
There is no `printerSettings` function module.

### Payments

| Module | Description |
|--------|-------------|
| `payments.stripe` | Stripe payment intents |
| `payments.sumup` | SumUp terminal integration |
| `payments.refunds` | Refund processing |

### Gamification

| Module | Description |
|--------|-------------|
| `games` | Game CRUD, win ratio management |
| `gameQRCodes` | QR code generation and linking |
| `prizes` | Prize management and stock |
| `gamePlays` | Play recording and cooldown |
| `prizeRedemptions` | Prize redemption workflow |
| `requiredActions` | Social action verification |

### i18n

| Module | Description |
|--------|-------------|
| `languages` | Language management |
| `translations` | Translation CRUD |
| `autoTranslate` | GPT-powered auto-translation |
| `translationJobs` | Batch translation jobs |

### Email & Marketing

| Module | Description |
|--------|-------------|
| `emailCampaigns` | Campaign CRUD and sending |
| `emailSubscribers` | Subscriber management |
| `emailTemplates` | Template management |

### CMS

| Module | Description |
|--------|-------------|
| `cms` | CMS content management |
| `cms.pages` | Page CRUD |
| `cms.blocks` | Block management |

### AI

| Module | Description |
|--------|-------------|
| `imageToProduct` | Extract products from menu photos |

## Usage

### Client-Side (React)

```typescript
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";

function ProductList() {
  // Query
  const products = useQuery(api.products.list, { storeId });

  // Mutation
  const createProduct = useMutation(api.products.create);

  const handleCreate = async () => {
    await createProduct({
      storeId,
      name: "Margherita",
      price: 1299,
      category: "pizzas",
    });
  };

  return (/* ... */);
}
```

### Server-Side (Actions)

```typescript
import { action } from "./_generated/server";

export const syncMenu = action({
  args: { storeId: v.id("stores") },
  handler: async (ctx, { storeId }) => {
    // Call Uber Eats API to sync menu
    const products = await ctx.runQuery(api.products.listByStore, { storeId });
    // ... sync logic
  },
});
```

### Real-Time Subscriptions

Convex queries automatically subscribe to changes:

```typescript
// This re-renders whenever kitchen tickets change
const tickets = useQuery(api.kitchenTickets.listActive, { storeId });
```
