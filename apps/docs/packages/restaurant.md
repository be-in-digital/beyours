# @be-in-digital/restaurant

> Business logic, Zustand stores, and React hooks for restaurant storefront features.

## Table of Contents

- [Installation](#installation)
- [Zustand Stores](#zustand-stores)
- [React Hooks](#react-hooks)
- [Services](#services)
- [Types](#types)

> This package contains **no React components**. `ProductCard`, `CartItem` and
> the rest of the storefront UI live in `@be-in-digital/ui/restaurant`.

## Installation

```bash
pnpm add @be-in-digital/restaurant
```

## Zustand Stores

All client-side state is managed with Zustand. Each store is standalone and can be used independently.

`@be-in-digital/restaurant/stores` exports exactly four stores plus one helper:

| Export | What it holds |
|--------|---------------|
| `useCartStore` | The basket — persisted to localStorage |
| `useAdminStoreSelection` | Which establishment is being administered |
| `useStorefrontStoreSelection` | Which establishment is being browsed |
| `useUIStore` | Ephemeral UI flags (menus, drawers, modals) |
| `useLanguageStore` + `buildTranslator` | Active locale and the `t()` cascade |

There is **no `useOrderStore` and no `useStoreConfigStore`.** Orders are written
straight through Convex mutations, and store configuration is read from Convex —
see [Store Selection](#store-selection) for why.

### useCartStore

Manages shopping cart state.

```typescript
import { useCartStore } from "@be-in-digital/restaurant/stores";

function CartButton() {
  const items = useCartStore((s) => s.items);
  const clearCart = useCartStore((s) => s.clearCart);
  const getSummary = useCartStore((s) => s.getSummary);
  const { total, itemCount } = getSummary(taxRate, deliveryFee);

  return (
    <div>
      <span>{itemCount} items - {formatPrice(total)}</span>
      <Button onClick={clearCart}>Clear</Button>
    </div>
  );
}
```

**State:**

| Field | Type | Description |
|-------|------|-------------|
| `items` | `CartItem[]` | Cart lines |
| `orderType` | `OrderType` | `delivery` \| `pickup` \| `dine_in` |
| `storeId` | `string \| null` | The establishment this basket belongs to |

**Actions:**

| Method | Type | Description |
|--------|------|-------------|
| `addItem(item)` | `(NewCartItem) => void` | Add a line; the store assigns its `lineId` |
| `removeItem(lineId)` | `(string) => void` | Remove a line — **takes a line id, not a product id** |
| `updateQuantity(lineId, qty)` | `(string, number) => void` | Update a line's quantity |
| `clearCart()` | `() => void` | Empty the cart |
| `setOrderType(type)` | `(OrderType) => void` | Delivery / pickup / dine-in |
| `setStoreId(id)` | `(string) => void` | Bind the basket to an establishment |
| `getSubtotal()` | `() => number` | Cents |
| `getTax(rate)` | `(number) => number` | Cents |
| `getDeliveryFee(fee)` | `(number) => number` | Cents |
| `getTotal(taxRate, fee)` | `(number, number) => number` | Cents |
| `getItemCount()` | `() => number` | |
| `getSummary(taxRate, fee)` | `(number, number) => CartSummary` | All of the above at once |

Two things to hold on to. **Totals are getters, not fields** — there is no
`total` or `itemCount` on the state, because the tax rate and the delivery fee
are not the cart's to know; select `getSummary` and pass them in. And
**everything acts on a line**: one pizza with extra cheese and one plain are two
lines of the same product, so a bin keyed on `productId` would empty both.

### Store Selection

Only the **id** of the selected establishment is persisted. The document itself
is read from Convex by whoever needs it, which is what makes a rename or a
change of opening hours show up on the next render instead of staying frozen in
localStorage.

There are two selections, deliberately, under two storage keys
(`ADMIN_SELECTION_KEY`, `STOREFRONT_SELECTION_KEY`): an owner administering Lyon
in one tab and a visitor browsing Paris in another are answering different
questions, and under a single key they overwrote each other — a visitor's
geolocation could silently move the dashboard.

```typescript
import {
  useAdminStoreSelection,
  useStorefrontStoreSelection,
} from "@be-in-digital/restaurant/stores";

function AdminStoreSwitcher() {
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

Each store exposes `{ storeId, setStoreId }` — nothing else. There is no
`store`, no `availableStores`, no `isOpen`. For opening hours, call
`isStoreOpen(hours, now, timeZone)` from `@be-in-digital/restaurant/services`,
which returns a `StoreHoursStatus` (`{ isOpen, nextChange, currentPeriod? }`)
and correctly reads the previous day's row so an 18:00–02:00 service is still
open at 01:00.

### useUIStore and useLanguageStore

`useUIStore` holds `isMobileMenuOpen`, `isCartOpen`, `isSidebarOpen` and
`activeModal`, with `toggleMobileMenu`, `toggleCart`, `toggleSidebar`,
`openModal(id)` and `closeModal()`. It is not persisted.

`useLanguageStore` holds the active locale, the available languages, the CMS
overrides and the static string catalogues; `buildTranslator(state)` turns those
four fields into the `t()` the storefront renders through.

## React Hooks

### useNearestStore

Sort a list of stores by distance from the visitor. It does **not** fetch the
stores — you pass them in, already loaded from Convex.

```typescript
import { useNearestStore } from "@be-in-digital/restaurant/hooks";

function StoreLocator({ stores }: { stores: StoreDoc[] }) {
  const { nearestStore, storesWithDistance, isLocating, locationError, requestLocation } =
    useNearestStore(stores, { autoLocate: true });

  if (isLocating) return <LoadingSpinner />;
  if (locationError) return <Button onClick={requestLocation}>Enable location</Button>;

  return <p>Nearest: {nearestStore?.name} ({storesWithDistance[0]?.distance} km away)</p>;
}
```

Geolocation **does not run by default**, and that is on purpose: asking prompts
the visitor, and on a single-location restaurant the answer cannot change
anything. Two options opt in — `autoLocate` prompts on mount (reserved for a UI
whose whole point is distance), and `useGrantedLocation` uses the position only
if permission was already granted, never prompting. Otherwise call
`requestLocation()` from a click.

Each entry of `storesWithDistance` is a `StoreWithDistance`: the store document
plus `distance: number | null` in km, `null` when the store has no coordinates
or the visitor's position is unknown. Those sort last.

### useOrderStatus

Display information for an order status. This is a **pure formatter over a
status value** — not a subscription, and it does not take an order id. Real-time
tracking is `useQuery` against Convex; this turns the status it returns into
something renderable.

```typescript
import { useOrderStatus } from "@be-in-digital/restaurant/hooks";

function OrderTracker({ status }: { status: OrderStatus }) {
  const { label, color, isActive, nextStatuses } = useOrderStatus(status);

  return (
    <div>
      <Badge style={{ backgroundColor: color }}>{label}</Badge>
      {isActive && <p>Next: {nextStatuses.join(", ")}</p>}
    </div>
  );
}
```

### useProductFilters

Hold a `ProductFilters` object and the setters that narrow it. It holds the
**criteria**, not the results: it does not receive products and does not return
`filteredProducts`. Apply the filters with the product service, or in the Convex
query.

```typescript
import { useProductFilters } from "@be-in-digital/restaurant/hooks";

function MenuPage({ products }: { products: ProductDoc[] }) {
  const {
    filters,
    setCategory,
    setSearch,
    toggleAllergen,
    setPriceRange,
    setAvailableOnly,
    clearFilters,
  } = useProductFilters({ availableOnly: true });

  return (
    <>
      <SearchInput value={filters.search ?? ""} onChange={setSearch} />
      <Tabs value={filters.categoryId} onValueChange={setCategory}>
        {categories.map((cat) => (
          <TabsTrigger key={cat._id} value={cat._id}>{cat.name}</TabsTrigger>
        ))}
      </Tabs>
      <Button onClick={clearFilters}>Reset</Button>
    </>
  );
}
```

`ProductFilters` is `{ categoryId?, search?, allergens?, minPrice?, maxPrice?, availableOnly? }`
— prices in cents, and `allergens` lists what to **exclude**.

### Cart hooks

Two, exported from the same subpath: `useCart()` and `useCartHydrated()`.

There used to be five more — `useCartItems`, `useCartSummary`,
`useCartItemCount`, `useCartOrderType`, `useCartStoreId` — thin selector
wrappers that this page documented and that nothing, in either app or any
package, ever called. Select off the store instead, which is what the storefront
does: `useCartStore((s) => s.items)`, `useCartStore((s) => s.getItemCount())`,
and `getSummary` as above.

`useCartHydrated()` is the one to reach for first. The cart is persisted, and
persistence is not instant: on the first render after a page load the store is
empty and fills a tick later. Any guard reading `items.length` before that sees
an empty basket and acts on it — which is how a customer arriving at `/checkout`
with a full cart was sent back to `/cart`.

### useTranslation

`useTranslation()` returns the storefront's `t()`, built from `useLanguageStore`.
`useLocalizedDocument(doc)` and `useLocalizedDocuments(docs)` swap a document's
translatable fields for the active locale's values.

## Services

`@be-in-digital/restaurant/services` holds the pure functions the hooks and the
backend share — no React, no Convex client:

| Module | Notable exports |
|--------|-----------------|
| `store` | `isStoreOpen`, `resolveStoreHours`, `getNextOpenTime`, `getStoreDistance`, `sortStoresByDistance`, `formatStoreAddress`, `formatWeeklyHours` |
| `product` | `filterProducts`, `sortProducts`, `isProductAvailable`, `isProductScheduledNow`, `calculateProductPrice`, `getProductAllergens` |
| `cart` | `cartLineId`, `isSameItem`, `mergeCartItems`, `validateCartItem`, `calculateCartTotals`, `canCheckout` |
| `order` | `getOrderStatusLabel`, `getOrderStatusColor`, `isOrderActive`, `getNextStatus`, `canTransitionTo`, `estimatePreparationTime` |
| `checkout-attempt` | `cartSignature`, `resolveCheckoutAttempt`, `load`/`save`/`clearCheckoutAttempt` |
| `kitchen` | `createTicketFromOrder`, `assignStation`, `getPriorityLevel`, `isOverdue`, `calculateElapsedTime` |

## Types

### CartItem

```typescript
interface CartItem {
  /** Identity of a *line*, not of a product — assigned by the store. */
  lineId: string;
  productId: string;
  name: string;
  price: number;       // in cents, tax included
  quantity: number;
  options: CartSelectedOption[];
  imageUrl?: string;
  /** The product's own VAT rate, e.g. 10. Absent on older persisted lines. */
  taxRate?: number;
  /** Carried so a category-scoped promotion resolves on the client too. */
  categoryId?: string;
}

/** What a caller hands to `addItem` — the line id is the store's to assign. */
type NewCartItem = Omit<CartItem, "lineId">;

interface CartSelectedOption {
  name: string;
  choice: string;
  priceModifier: number; // in cents
}
```

`taxRate` and `categoryId` are carried per line rather than looked up: a basket
mixing food at 10 % and alcohol at 20 % has no single rate, and a page that
guessed one would print a figure the order contradicts.

### CartSummary

Returned by `getSummary(taxRate, deliveryFee)`.

```typescript
interface CartSummary {
  subtotal: number;    // in cents
  tax: number;
  deliveryFee: number;
  total: number;
  itemCount: number;
}
```

### StoreHoursStatus

Returned by `isStoreOpen(hours, now?, timeZone?)`.

```typescript
interface StoreHoursStatus {
  isOpen: boolean;
  nextChange: Date | null;
  currentPeriod?: { open: string; close: string };
}
```
