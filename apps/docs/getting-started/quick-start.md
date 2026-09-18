# Quick Start

Build a basic restaurant storefront in under 10 minutes.

## Table of Contents

- [1. Create Project](#1-create-project)
- [2. Install Packages](#2-install-packages)
- [3. Set Up Convex](#3-set-up-convex)
- [4. Create the Menu Page](#4-create-the-menu-page)
- [5. Add Cart Functionality](#5-add-cart-functionality)
- [6. Run the App](#6-run-the-app)

## 1. Create Project

```bash
pnpx create-next-app@latest my-restaurant --typescript --tailwind --app
cd my-restaurant
```

## 2. Install Packages

First, create `.npmrc` at the project root:

```ini
@be-yours:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=${GITHUB_TOKEN}
```

Then install:

```bash
pnpm add @be-yours/ui @be-yours/core @be-yours/restaurant
pnpm add @be-yours/convex-schema @be-yours/convex-functions
pnpm add convex
```

## 3. Set Up Convex

```bash
pnpx convex dev
```

Create `convex/schema.ts`:

```typescript
import { defineSchema } from "convex/server";
import {
  storesTable,
  productsTable,
  ordersTable,
  categoriesTable,
} from "@be-yours/convex-schema/tables";

export default defineSchema({
  stores: storesTable,
  products: productsTable,
  orders: ordersTable,
  categories: categoriesTable,
});
```

## 4. Create the Menu Page

Create `app/(storefront)/menu/page.tsx`:

`ProductCard` is a **UI** component, not a restaurant one: it lives in
`packages/ui/src/components/restaurant/` and ships from the
`@be-yours/ui/restaurant` subpath (the root barrel re-exports it too).
`@be-yours/restaurant` has no React components at all — it is stores,
services, hooks and types.

Its props are flat values, not a product document: `name`, `description`,
`price`, `image`, `badge`, `onAddToCart`, `disabled`.

```tsx
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Container, Section, PageHeader } from "@be-yours/ui";
import { ProductCard } from "@be-yours/ui/restaurant";
import { useCartStore } from "@be-yours/restaurant/stores";
import { formatPrice } from "@be-yours/admin/lib";

export default function MenuPage() {
  const products = useQuery(api.products.list);
  const addItem = useCartStore((s) => s.addItem);

  return (
    <Container>
      <PageHeader
        title="Our Menu"
        description="Fresh ingredients, made with love"
      />
      <Section>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {products?.map((product) => (
            <ProductCard
              key={product._id}
              name={product.name}
              description={product.description}
              price={formatPrice(product.price)}
              image={product.imageUrl}
              onAddToCart={() =>
                addItem({
                  productId: product._id,
                  name: product.name,
                  price: product.price, // cents, tax included
                  quantity: 1,
                  options: [],
                  imageUrl: product.imageUrl,
                })
              }
            />
          ))}
        </div>
      </Section>
    </Container>
  );
}
```

`addItem` takes a `NewCartItem` — the cart's own line shape — not a product
document. It assigns the `lineId` itself, because one pizza with extra cheese
and one plain are two lines of the same product and a caller that invented the
identity could merge them.

## 5. Add Cart Functionality

Create `app/(storefront)/cart/page.tsx`:

Two things the cart store does *not* have: a `total` field and an `item.id`.
Totals are **getters** that take the tax rate and delivery fee as arguments
(`getSubtotal`, `getTotal`, `getItemCount`, `getSummary`), because a basket
mixing food at 10 % and alcohol at 20 % has no single stored total. And every
action names a **line**, not a product — `item.lineId`.

The cart is persisted, so guard on `useCartHydrated()` before reading
`items.length`: on the first render after a page load the store is still empty,
and a redirect that acts on that sends a customer with a full basket back to
`/cart`.

```tsx
"use client";

import { Container, Section, Button, Badge } from "@be-yours/ui";
import { useCartStore } from "@be-yours/restaurant/stores";
import { useCartHydrated } from "@be-yours/restaurant/hooks";
import { formatPrice } from "@be-yours/admin/lib";

const TAX_RATE = 10;
const DELIVERY_FEE = 0;

export default function CartPage() {
  const hydrated = useCartHydrated();
  const items = useCartStore((s) => s.items);
  const removeItem = useCartStore((s) => s.removeItem);
  const getSummary = useCartStore((s) => s.getSummary);
  const summary = getSummary(TAX_RATE, DELIVERY_FEE);

  if (!hydrated) return null;

  return (
    <Container>
      <Section>
        <h1 className="text-2xl font-bold mb-6">Your Cart</h1>
        {items.length === 0 ? (
          <p className="text-muted-foreground">Your cart is empty.</p>
        ) : (
          <>
            {items.map((item) => (
              <div key={item.lineId} className="flex justify-between py-4 border-b">
                <div>
                  <p className="font-medium">{item.name}</p>
                  <Badge variant="secondary">x{item.quantity}</Badge>
                </div>
                <div className="flex items-center gap-4">
                  <span>{formatPrice(item.price * item.quantity)}</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeItem(item.lineId)}
                  >
                    Remove
                  </Button>
                </div>
              </div>
            ))}
            <div className="flex justify-between mt-6 text-lg font-bold">
              <span>Total</span>
              <span>{formatPrice(summary.total)}</span>
            </div>
            <Button className="w-full mt-4" size="lg">
              Proceed to Checkout
            </Button>
          </>
        )}
      </Section>
    </Container>
  );
}
```

`formatPrice` takes **cents** and renders them in `fr-FR`, defaulting to EUR —
every price in the engine is an integer number of cents.

## 6. Run the App

```bash
# Terminal 1: Start Convex
pnpx convex dev

# Terminal 2: Start Next.js
pnpm dev
```

Visit `http://localhost:3000/menu` to see your restaurant menu.

## What's Next?

- [Authentication Guide](../guides/authentication.md) — Add login/signup
- [Payments Guide](../guides/payments.md) — Accept payments
- [Kitchen Display](../guides/kitchen-display.md) — Real-time order management
- [Gamification](../guides/gamification.md) — QR-based customer engagement
