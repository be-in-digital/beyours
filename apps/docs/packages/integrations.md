# @be-in-digital/integrations

> Third-party integrations: Uber Eats and Deliveroo API clients, menu sync, order handling, webhook security.

## Table of Contents

- [Installation](#installation)
- [Uber Eats](#uber-eats)
- [Deliveroo](#deliveroo)
- [Uber Direct](#uber-direct)
- [Webhook Security](#webhook-security)

## Installation

```bash
pnpm add @be-in-digital/integrations
```

### Environment Variables

```env
UBER_EATS_API_KEY=your_api_key
UBER_EATS_CLIENT_SECRET=your_secret
DELIVEROO_API_KEY=your_api_key
DELIVEROO_WEBHOOK_SECRET=your_secret
UBER_DIRECT_CUSTOMER_ID=your_customer_id
UBER_DIRECT_CLIENT_SECRET=your_secret
```

## Uber Eats

### API Client

```typescript
import { uberEats } from "@be-in-digital/integrations";

// Initialize client
const client = uberEats.client({
  apiKey: process.env.UBER_EATS_API_KEY!,
  clientSecret: process.env.UBER_EATS_CLIENT_SECRET!,
});
```

### Menu Sync

Synchronize your local menu with Uber Eats:

```typescript
import { uberEats } from "@be-in-digital/integrations";

// Push local menu to Uber Eats
await uberEats.menuSync({
  storeId: "store_123",
  products: localProducts,
  categories: localCategories,
});
```

### Order Handling

```typescript
// Handle incoming Uber Eats orders
app.post("/api/webhooks/uber-eats", async (req) => {
  const order = await uberEats.parseOrder(req);

  // Create local order from Uber Eats order
  await createOrder({
    source: "uber-eats",
    externalId: order.id,
    items: order.items,
    customer: order.customer,
  });
});
```

## Deliveroo

### API Client

```typescript
import { deliveroo } from "@be-in-digital/integrations";

const client = deliveroo.client({
  apiKey: process.env.DELIVEROO_API_KEY!,
});
```

### Menu Sync

```typescript
await deliveroo.menuSync({
  storeId: "store_123",
  products: localProducts,
});
```

### Order Handling

```typescript
// Handle Deliveroo orders
await deliveroo.orders.accept(orderId);
await deliveroo.orders.reject(orderId, "out_of_stock");
await deliveroo.orders.markReady(orderId);
```

## Uber Direct

On-demand delivery service.

```typescript
import { uberDirect } from "@be-in-digital/integrations";

// Create a delivery
const delivery = await uberDirect.createDelivery({
  pickup: {
    address: store.address,
    name: store.name,
  },
  dropoff: {
    address: customer.address,
    name: customer.name,
    phone: customer.phone,
  },
  items: order.items.map((item) => ({
    name: item.name,
    quantity: item.quantity,
  })),
});

// Track delivery
const status = await uberDirect.getDeliveryStatus(delivery.id);
```

## Webhook Security

All incoming webhooks are verified:

```typescript
import { verifyUberEatsWebhook, verifyDeliverooWebhook } from "@be-in-digital/integrations";

// In your webhook handler
export async function POST(req: Request) {
  const isValid = await verifyUberEatsWebhook(req, process.env.UBER_EATS_CLIENT_SECRET!);
  if (!isValid) {
    return new Response("Unauthorized", { status: 401 });
  }
  // Process webhook...
}
```

## External IDs

Products store external platform IDs for mapping:

```typescript
// Product schema includes:
{
  externalIds: {
    uberEatsId: "ue_prod_123",
    deliverooId: "del_prod_456",
  }
}
```
