# Multi-Store Guide

> Manage unlimited restaurant locations under a single owner account.

## Overview

BeInDigital supports a multi-store architecture where one restaurant owner can manage unlimited locations. Each store has independent:

- Products and menus
- Opening hours
- Delivery zones
- Payment methods
- Kitchen settings
- Staff and roles

## Data Model

```
Owner Account
├── Store A (Paris)
│   ├── Products
│   ├── Orders
│   ├── Kitchen Tickets
│   └── Staff
├── Store B (Lyon)
│   ├── Products
│   ├── Orders
│   └── ...
└── Store C (Marseille)
    └── ...
```

### Store Configuration

```typescript
import { storesTable } from "@be-in-digital/convex-schema/tables";

// Each store has:
{
  name: "La Bella - Paris",
  ownerId: "owner_123",
  address: { street: "...", city: "Paris", zip: "75001", country: "FR" },
  phone: "+33 1 23 45 67 89",
  location: { lat: 48.8566, lng: 2.3522 },
  openingHours: {
    monday: { open: "11:00", close: "22:00" },
    tuesday: { open: "11:00", close: "22:00" },
    // ...
  },
  status: "active", // active | paused | closed
  timezone: "Europe/Paris",
  currency: "EUR",
}
```

## Working with Stores

### Always Filter by Store

Every query must be scoped to a store:

```typescript
// Correct
const products = useQuery(api.products.listByStore, { storeId });

// Never do this (returns all stores' data)
// const products = useQuery(api.products.listAll);
```

### Store Selector

```typescript
import { useStoreConfigStore } from "@be-in-digital/restaurant/stores";

function StoreSwitcher() {
  const { store, setCurrentStore, availableStores } = useStoreConfigStore();

  return (
    <Select value={store._id} onValueChange={setCurrentStore}>
      {availableStores.map((s) => (
        <SelectItem key={s._id} value={s._id}>{s.name}</SelectItem>
      ))}
    </Select>
  );
}
```

### Nearest Store (Customer)

```typescript
import { useNearestStore } from "@be-in-digital/restaurant/hooks";

function StoreLocator() {
  const { nearestStore, distance, isLocating } = useNearestStore();

  if (isLocating) return <LoadingSpinner />;

  return (
    <div>
      <p>Your nearest location: {nearestStore.name}</p>
      <p>{distance} km away</p>
    </div>
  );
}
```

## Store-Level Features

### Opening Hours

```typescript
// Check if store is currently open
const { isOpen, nextOpenAt, nextCloseAt } = useStoreConfigStore();
```

### Store Status

| Status | Description |
|--------|-------------|
| `active` | Open for business |
| `paused` | Temporarily closed (holiday, maintenance) |
| `closed` | Permanently closed |

### Geolocation

Each store has coordinates for:
- Customer-facing store locator
- Delivery zone calculation
- Distance-based store selection

## Best Practices

1. **Always scope queries** — Every database query must include `storeId`
2. **Use store context** — The admin dashboard maintains a store context for all operations
3. **Independent settings** — Each store can have different payment providers, delivery zones, etc.
4. **Shared catalog option** — Optionally share products across stores, then override per-store
