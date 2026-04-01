# @be-in-digital/restaurant

> Business logic, Zustand stores, and React hooks for restaurant storefront features.

## Table of Contents

- [Installation](#installation)
- [Zustand Stores](#zustand-stores)
- [React Hooks](#react-hooks)
- [Types](#types)

## Installation

```bash
pnpm add @be-in-digital/restaurant
```

## Zustand Stores

All client-side state is managed with Zustand. Each store is standalone and can be used independently.

### useCartStore

Manages shopping cart state.

```typescript
import { useCartStore } from "@be-in-digital/restaurant/stores";

function CartButton() {
  const { items, total, itemCount, addItem, removeItem, updateQuantity, clearCart } = useCartStore();

  return (
    <div>
      <span>{itemCount} items - {formatPrice(total)}</span>
      <Button onClick={clearCart}>Clear</Button>
    </div>
  );
}
```

**API:**

| Method | Type | Description |
|--------|------|-------------|
| `items` | `CartItem[]` | Cart items array |
| `total` | `number` | Total price in cents |
| `itemCount` | `number` | Number of items |
| `addItem(product)` | `(Product) => void` | Add product to cart |
| `removeItem(id)` | `(string) => void` | Remove item |
| `updateQuantity(id, qty)` | `(string, number) => void` | Update quantity |
| `clearCart()` | `() => void` | Empty the cart |

### useOrderStore

Manages order creation and tracking.

```typescript
import { useOrderStore } from "@be-in-digital/restaurant/stores";

function CheckoutButton() {
  const { createOrder, currentOrder, isSubmitting } = useOrderStore();

  const handleCheckout = async () => {
    const order = await createOrder({
      items: cartItems,
      type: "delivery",
      address: customerAddress,
      paymentMethod: "stripe",
    });
  };

  return (
    <Button onClick={handleCheckout} disabled={isSubmitting}>
      {isSubmitting ? "Processing..." : "Place Order"}
    </Button>
  );
}
```

### useStoreConfigStore

Current store configuration.

```typescript
import { useStoreConfigStore } from "@be-in-digital/restaurant/stores";

function StoreInfo() {
  const { store, isOpen, openingHours } = useStoreConfigStore();

  return (
    <div>
      <h1>{store.name}</h1>
      <Badge variant={isOpen ? "success" : "destructive"}>
        {isOpen ? "Open" : "Closed"}
      </Badge>
    </div>
  );
}
```

## React Hooks

### useNearestStore

Find the nearest store by geolocation.

```typescript
import { useNearestStore } from "@be-in-digital/restaurant/hooks";

function StoreSelector() {
  const { nearestStore, distance, isLocating, error } = useNearestStore();

  if (isLocating) return <LoadingSpinner />;
  if (error) return <p>Enable location services</p>;

  return (
    <p>
      Nearest: {nearestStore.name} ({distance}km away)
    </p>
  );
}
```

### useOrderStatus

Track an order in real-time via Convex subscription.

```typescript
import { useOrderStatus } from "@be-in-digital/restaurant/hooks";

function OrderTracker({ orderId }: { orderId: string }) {
  const { status, estimatedTime, updatedAt } = useOrderStatus(orderId);

  return (
    <div>
      <Badge>{status}</Badge>
      {estimatedTime && <p>Ready in ~{estimatedTime} min</p>}
    </div>
  );
}
```

### useProductFilters

Filter and sort products.

```typescript
import { useProductFilters } from "@be-in-digital/restaurant/hooks";

function MenuPage() {
  const {
    filteredProducts,
    categories,
    activeCategory,
    setCategory,
    sortBy,
    setSortBy,
    searchQuery,
    setSearchQuery,
  } = useProductFilters(products);

  return (
    <>
      <SearchInput value={searchQuery} onChange={setSearchQuery} />
      <Tabs value={activeCategory} onValueChange={setCategory}>
        {categories.map((cat) => (
          <TabsTrigger key={cat.id} value={cat.id}>{cat.name}</TabsTrigger>
        ))}
      </Tabs>
      <ProductGrid products={filteredProducts} />
    </>
  );
}
```

## Types

### CartItem

```typescript
interface CartItem {
  id: string;
  productId: string;
  name: string;
  price: number;       // in cents
  quantity: number;
  options?: SelectedOption[];
  image?: string;
}
```

### CartSummary

```typescript
interface CartSummary {
  subtotal: number;    // in cents
  tax: number;
  deliveryFee: number;
  total: number;
  itemCount: number;
}
```
