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
@be-in-digital:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=${GITHUB_TOKEN}
```

Then install:

```bash
pnpm add @be-in-digital/ui @be-in-digital/core @be-in-digital/restaurant
pnpm add @be-in-digital/convex-schema @be-in-digital/convex-functions
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
} from "@be-in-digital/convex-schema/tables";

export default defineSchema({
  stores: storesTable,
  products: productsTable,
  orders: ordersTable,
  categories: categoriesTable,
});
```

## 4. Create the Menu Page

Create `app/(storefront)/menu/page.tsx`:

```tsx
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Container, Section, PageHeader } from "@be-in-digital/ui";
import { ProductCard } from "@be-in-digital/restaurant";
import { useCartStore } from "@be-in-digital/restaurant/stores";

export default function MenuPage() {
  const products = useQuery(api.products.list);
  const addToCart = useCartStore((s) => s.addItem);

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
              product={product}
              onAddToCart={() => addToCart(product)}
            />
          ))}
        </div>
      </Section>
    </Container>
  );
}
```

## 5. Add Cart Functionality

Create `app/(storefront)/cart/page.tsx`:

```tsx
"use client";

import { Container, Section, Button, Badge } from "@be-in-digital/ui";
import { useCartStore } from "@be-in-digital/restaurant/stores";
import { formatPrice } from "@be-in-digital/admin/lib";

export default function CartPage() {
  const { items, total, removeItem, clearCart } = useCartStore();

  return (
    <Container>
      <Section>
        <h1 className="text-2xl font-bold mb-6">Your Cart</h1>
        {items.length === 0 ? (
          <p className="text-muted-foreground">Your cart is empty.</p>
        ) : (
          <>
            {items.map((item) => (
              <div key={item.id} className="flex justify-between py-4 border-b">
                <div>
                  <p className="font-medium">{item.name}</p>
                  <Badge variant="secondary">x{item.quantity}</Badge>
                </div>
                <div className="flex items-center gap-4">
                  <span>{formatPrice(item.price * item.quantity)}</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeItem(item.id)}
                  >
                    Remove
                  </Button>
                </div>
              </div>
            ))}
            <div className="flex justify-between mt-6 text-lg font-bold">
              <span>Total</span>
              <span>{formatPrice(total)}</span>
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
