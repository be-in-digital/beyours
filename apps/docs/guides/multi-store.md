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

## Single Store Auto-Selection

When a restaurant owner has only **one store**, the UI adapts automatically:

- **StoreSelector**: Displays the store name as a label instead of a dropdown
- **StoreGuard**: Auto-selects the single store without prompting the user
- No manual selection needed -- the dashboard loads directly with the store context

## Store Creation Workflow (Draft to Open)

New stores follow a **draft-to-open** workflow:

1. **Create store**: Enters "draft" status automatically
2. **Toast notification**: Shows guidance after creation:
   > *"L'etablissement est en brouillon. Configurez ses parametres puis passez-le en 'Ouvert' pour l'activer."*
3. **Draft banner**: The store detail page shows an **amber warning banner** for draft stores, explaining:
   - Complete General info, Hours, and Settings
   - Change the status to "Open" in the General tab to activate
4. **Activate**: Set status to "Open" to make the store visible to customers

### Store Statuses

| Status | Description |
|--------|-------------|
| `draft` | New store, not yet configured. Not visible to customers. |
| `open` | Active and accepting orders |
| `closed` | Permanently closed |
| `temporarily_unavailable` | Temporarily closed (holiday, maintenance) |

## Store Detail Navigation

The store detail page includes a **back arrow** button to navigate back to the stores list. This improves navigation when configuring stores.

## Dynamic Branding from CMS

The CMS `storefront-layout` page has a **branding** block:

| Field | Type | Description |
|-------|------|-------------|
| `logo` | image | Restaurant logo (PNG/SVG, 200x60px recommended) |
| `favicon` | image | Browser favicon (32x32 or 64x64 PNG) |
| `brandName` | text | Fallback name if no logo is set |

### Where branding appears:

- **Storefront header**: Shows logo image or brand name text
- **Admin sidebar**: Shows logo thumbnail and brand name
- **Browser tab**: Dynamic favicon from CMS
- **Mobile menu**: Logo with white overlay for dark background

## Best Practices

1. **Always scope queries** -- Every database query must include `storeId`
2. **Use store context** -- The admin dashboard maintains a store context for all operations
3. **Independent settings** -- Each store can have different payment providers, delivery zones, etc.
4. **Shared catalog option** -- Optionally share products across stores, then override per-store
5. **Complete setup before opening** -- Use the draft workflow to ensure all settings are configured before going live
