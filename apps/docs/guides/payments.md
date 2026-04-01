# Payments Guide

> Accept payments via Stripe, SumUp, PayPal, and Square.

## Table of Contents

- [Overview](#overview)
- [Stripe](#stripe)
- [SumUp](#sumup)
- [PayPal](#paypal)
- [Square](#square)
- [Cash Payments](#cash-payments)
- [Refunds](#refunds)

## Overview

BeInDigital supports multiple payment providers. Each restaurant can enable the providers they need.

| Provider | Online | In-Person | Subscriptions |
|----------|--------|-----------|---------------|
| Stripe | Yes | No | Yes |
| SumUp | No | Yes | No |
| PayPal | Yes | No | No |
| Square | Yes | Yes | No |
| Cash | No | Yes | No |

## Stripe

### Setup

```env
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
```

### Create Payment

```typescript
import { createStripePayment } from "@be-in-digital/core";

const paymentIntent = await createStripePayment({
  amount: 2499, // cents
  currency: "eur",
  metadata: {
    orderId: order._id,
    storeId: store._id,
  },
});

// Return client secret to frontend
return { clientSecret: paymentIntent.client_secret };
```

### Frontend Checkout

```tsx
import { loadStripe } from "@stripe/stripe-js";
import { Elements, PaymentElement, useStripe } from "@stripe/react-stripe-js";

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_KEY!);

function CheckoutForm({ clientSecret }) {
  return (
    <Elements stripe={stripePromise} options={{ clientSecret }}>
      <PaymentForm />
    </Elements>
  );
}
```

### Webhook Handler

```typescript
// app/api/webhooks/stripe/route.ts
import { handleStripeWebhook } from "@be-in-digital/core";

export async function POST(req: Request) {
  return handleStripeWebhook(req, {
    onPaymentSuccess: async (event) => {
      const { orderId } = event.data.object.metadata;
      await updateOrderStatus(orderId, "confirmed");
    },
    onPaymentFailed: async (event) => {
      const { orderId } = event.data.object.metadata;
      await updateOrderStatus(orderId, "payment_failed");
    },
  });
}
```

## SumUp

For in-person card terminal payments.

```typescript
import { createSumUpCheckout } from "@be-in-digital/core";

const checkout = await createSumUpCheckout({
  amount: 24.99,
  currency: "EUR",
  description: "Order #123",
});
```

## PayPal

```typescript
import { createPayPalOrder, capturePayPalPayment } from "@be-in-digital/core";

// Create order
const paypalOrder = await createPayPalOrder({
  amount: "24.99",
  currency: "EUR",
});

// After customer approves
await capturePayPalPayment(paypalOrder.id);
```

## Square

```typescript
import { createSquarePayment } from "@be-in-digital/core";

const payment = await createSquarePayment({
  amount: 2499, // cents
  currency: "EUR",
  sourceId: nonce, // from Square Web SDK
});
```

## Cash Payments

Cash payments are tracked in the system without external processing:

```typescript
await createOrder({
  ...orderData,
  paymentMethod: "cash",
  paymentStatus: "pending", // Marked "paid" when cash is collected
});
```

## Refunds

```typescript
import { processRefund } from "@be-in-digital/core";

await processRefund({
  orderId: "order_123",
  amount: 1299, // Partial refund in cents (optional, full if omitted)
  reason: "customer_request",
});
```

## Best Practices

1. **Always validate amounts server-side** — Never trust client-sent amounts
2. **Use webhooks** — Don't rely on client-side payment confirmation
3. **Store payment metadata** — Link payments to orders via metadata
4. **Handle idempotency** — Use idempotency keys for payment creation
5. **Test with test keys** — Use Stripe test mode during development
