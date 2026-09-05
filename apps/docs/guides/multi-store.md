# Multi-Store Guide

> Manage unlimited restaurant locations under a single owner account.

## Overview

BeYours supports a multi-store architecture where one restaurant owner can manage unlimited locations. Each store can differ on:

- Products and menus
- Opening hours (`useGlobalHours: false` + its own `hours`)
- Delivery zones and fees (`overrides.deliveryRadius`, `overrides.deliveryFee`)
- Services offered (`overrides.services`)
- Kitchen settings and station routing
- Staff and roles

The model is **inherit-then-override**, not independence: currency, timezone,
tax rate, default services and default hours live once on `globalSettings`, and
a store states only what it does differently. That is what lets an owner change
the hours in one place and have every location that follows them move with it,
with no migration.

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
  slug: "la-bella-paris",
  address: {
    street: "12 rue de Rivoli",
    city: "Paris",
    postalCode: "75001",   // not `zip`
    country: "FR",         // ISO 3166-1 alpha-2, uppercase
    latitude: 48.8566,     // coordinates live inside `address`
    longitude: 2.3522,
  },
  phone: "+33 1 23 45 67 89",
  useGlobalHours: false,
  hours: [                 // an array of days, not a keyed object
    { day: 1, open: "11:00", close: "22:00", isClosed: false },
    { day: 2, open: "11:00", close: "22:00", isClosed: false },
    // 0 = Sunday … 6 = Saturday
  ],
  status: "open",          // draft | open | closed | temporarily_unavailable
  overrides: { /* only what this store does differently */ },
}
```

Three fields people expect and will not find here: **`ownerId`, `timezone` and
`currency` are not on a store.** Currency, timezone, tax rate, default services
and the default hours all live on `globalSettings`, and every store inherits
them; a store departs from that default only through `overrides` (services,
`minimumOrderAmount`, `deliveryRadius`, `deliveryFee`, `deliveryFreeAbove`) or by
setting `useGlobalHours: false` and carrying its own `hours`.

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

There is no `useStoreConfigStore`. The selection stores hold **only the id** —
the document is read from Convex by whoever needs it, which is what makes a
rename or a change of opening hours appear on the next render instead of staying
frozen in localStorage until the browser is cleared.

There are two of them, under two storage keys, because the admin and the
storefront are answering different questions. An owner administering Lyon in one
tab and a visitor browsing Paris in another used to overwrite each other's
answer, so a visitor's geolocation could silently move the dashboard.

```typescript
import { useAdminStoreSelection } from "@be-in-digital/restaurant/stores";
// storefront side: useStorefrontStoreSelection, same shape

function StoreSwitcher() {
  const storeId = useAdminStoreSelection((s) => s.storeId);
  const setStoreId = useAdminStoreSelection((s) => s.setStoreId);
  const stores = useQuery(api.stores.list);

  return (
    <Select value={storeId ?? undefined} onValueChange={setStoreId}>
      {stores?.map((s) => (
        <SelectItem key={s._id} value={s._id}>{s.name}</SelectItem>
      ))}
    </Select>
  );
}
```

Each exposes `{ storeId, setStoreId }` and nothing else — no `store`, no
`availableStores`, no `isOpen`.

### Nearest Store (Customer)

`useNearestStore` sorts a list you pass in; it does not fetch the stores itself.

```typescript
import { useNearestStore } from "@be-in-digital/restaurant/hooks";

function StoreLocator({ stores }: { stores: StoreDoc[] }) {
  const { nearestStore, storesWithDistance, isLocating, locationError, requestLocation } =
    useNearestStore(stores, { autoLocate: true });

  if (isLocating) return <LoadingSpinner />;
  if (locationError) return <Button onClick={requestLocation}>Enable location</Button>;

  return (
    <div>
      <p>Your nearest location: {nearestStore?.name}</p>
      <p>{storesWithDistance[0]?.distance} km away</p>
    </div>
  );
}
```

Geolocation is **off by default** — it prompts, and on a single-location
restaurant the answer cannot change anything. `autoLocate` prompts on mount;
`useGrantedLocation` honours a permission already given without ever asking.
`distance` is `null` for a store with no coordinates, and those sort last.

## Store-Level Features

### Opening Hours

Opening hours are answered by a pure function in the services barrel, not by a
store:

```typescript
import { isStoreOpen, resolveStoreHours } from "@be-in-digital/restaurant/services";

// A store may follow the global hours instead of carrying its own
const hours = resolveStoreHours(store, globalSettings);

const { isOpen, nextChange, currentPeriod } = isStoreOpen(
  hours,
  new Date(),
  globalSettings.timezone, // the restaurant's clock; a store carries no timezone of its own
);
```

Pass the establishment's timezone — it is the restaurant's clock that decides,
not the visitor's. `isStoreOpen` also reads the **previous day's** row,
because a service declared on Friday as 18:00–02:00 is still serving at 01:00 on
Saturday. `getNextOpenTime(hours, now, timeZone)` answers when a closed store
reopens.

### Store Status

The real union is `StoreStatus` in `@be-in-digital/convex-schema`. See
[Store Statuses](#store-statuses) below for the four values — `active` and
`paused` are not among them.

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
