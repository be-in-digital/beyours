# Delivery Integrations Guide

> Connect with Uber Eats, Deliveroo, and Uber Direct for online ordering and delivery.

## Table of Contents

- [Overview](#overview)
- [Uber Eats Integration](#uber-eats-integration)
- [Deliveroo Integration](#deliveroo-integration)
- [Uber Direct (Delivery-as-a-Service)](#uber-direct)
- [Menu Sync Strategy](#menu-sync-strategy)
- [Order Flow](#order-flow)

## Overview

BeInDigital integrates with major food delivery platforms:

| Platform | Menu Sync | Order Intake | Delivery |
|----------|-----------|-------------|----------|
| Uber Eats | Yes | Yes | Via Uber Eats |
| Deliveroo | Yes | Yes | Via Deliveroo |
| Uber Direct | No | No | Own delivery fleet |

## Uber Eats Integration

### Setup

```env
UBER_EATS_API_KEY=your_api_key
UBER_EATS_CLIENT_SECRET=your_secret
UBER_EATS_STORE_ID=your_store_id
```

### Menu Sync

Push your local menu to Uber Eats:

```typescript
import { uberEats } from "@be-in-digital/integrations";

// Full sync — replaces entire Uber Eats menu
await uberEats.menuSync({
  storeId: "store_123",
  products: await getProducts(storeId),
  categories: await getCategories(storeId),
});
```

Products are mapped using `externalIds.uberEatsId`:

```typescript
// Product schema
{
  name: "Margherita",
  price: 1299,
  externalIds: {
    uberEatsId: "ue_prod_abc",  // Uber Eats product ID
    deliverooId: "del_prod_xyz", // Deliveroo product ID
  }
}
```

### Receiving Orders

```typescript
// app/api/webhooks/uber-eats/route.ts
import { uberEats, verifyUberEatsWebhook } from "@be-in-digital/integrations";

export async function POST(req: Request) {
  // Verify webhook signature
  if (!await verifyUberEatsWebhook(req, process.env.UBER_EATS_CLIENT_SECRET!)) {
    return new Response("Unauthorized", { status: 401 });
  }

  const event = await req.json();

  if (event.type === "order.created") {
    const order = uberEats.parseOrder(event.data);
    await createLocalOrder({
      source: "uber-eats",
      externalId: order.id,
      items: order.items,
      customer: order.customer,
      deliveryAddress: order.deliveryAddress,
    });
  }

  return new Response("OK");
}
```

## Deliveroo Integration

### Setup

```env
DELIVEROO_API_KEY=your_api_key
DELIVEROO_WEBHOOK_SECRET=your_secret
```

### Menu Sync

```typescript
import { deliveroo } from "@be-in-digital/integrations";

await deliveroo.menuSync({
  storeId: "store_123",
  products: localProducts,
});
```

### Order Management

```typescript
import { deliveroo } from "@be-in-digital/integrations";

// Accept an order
await deliveroo.orders.accept(orderId);

// Reject an order
await deliveroo.orders.reject(orderId, "out_of_stock");

// Mark as ready for pickup
await deliveroo.orders.markReady(orderId);
```

## Uber Direct

Uber Direct provides delivery-as-a-service for your own orders (not marketplace orders).

### Setup

```env
UBER_DIRECT_CUSTOMER_ID=your_customer_id
UBER_DIRECT_CLIENT_SECRET=your_secret
```

### Create a Delivery

```typescript
import { uberDirect } from "@be-in-digital/integrations";

const delivery = await uberDirect.createDelivery({
  pickup: {
    address: store.address,
    name: store.name,
    phone: store.phone,
  },
  dropoff: {
    address: customer.address,
    name: customer.name,
    phone: customer.phone,
  },
  items: order.items.map((item) => ({
    name: item.name,
    quantity: item.quantity,
    price: item.price,
  })),
});
```

### Track Delivery

```typescript
const status = await uberDirect.getDeliveryStatus(delivery.id);
// { status: "en_route", eta: "15 min", driver: { name: "...", phone: "..." } }
```

## Menu Sync Strategy

### When to Sync

- After product creation/update/deletion
- After category changes
- After price updates
- After stock changes (out of stock)

### Sync Scheduling

```typescript
// Recommended: Sync on product changes
async function onProductUpdate(product) {
  if (store.integrations.uberEats) {
    await uberEats.menuSync({ storeId, products, categories });
  }
  if (store.integrations.deliveroo) {
    await deliveroo.menuSync({ storeId, products });
  }
}
```

## Order Flow

```
Platform → Webhook → Local Order → Kitchen Ticket → Preparation → Ready
    ↓                                                               ↓
Status sync ←──────────────────────────────────────────── Status update
```

All platform orders appear alongside direct orders in:
- The admin Orders page
- The Kitchen Display System
- Order analytics
