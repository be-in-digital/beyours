# @be-in-digital/integrations

> Third-party integrations: Uber Eats and Deliveroo API clients, menu sync, order handling, webhook security.

## Table of Contents

- [Installation](#installation)
- [Shape of the Package](#shape-of-the-package)
- [Uber Eats](#uber-eats)
- [Deliveroo](#deliveroo)
- [Uber Direct](#uber-direct)
- [Webhook Security](#webhook-security)
- [Errors](#errors)
- [External IDs](#external-ids)

## Installation

```bash
pnpm add @be-in-digital/integrations
```

### Environment Variables

```env
UBER_EATS_CLIENT_ID=your_client_id
UBER_EATS_CLIENT_SECRET=your_secret
DELIVEROO_CLIENT_ID=your_client_id
DELIVEROO_CLIENT_SECRET=your_secret
DELIVEROO_WEBHOOK_SECRET=your_secret
# No UBER_DIRECT_CUSTOMER_ID: no code reads one. Uber Direct is an OAuth
# pair held in globalSettings, with this for its webhook.
UBER_DIRECT_WEBHOOK_SECRET=your_webhook_secret
# No UBER_DIRECT_CLIENT_ID / _CLIENT_SECRET either: the Uber Direct OAuth
# pair is held on `globalSettings.integrations.uberDirect`, entered through the
# admin, not in the environment.
```

## Shape of the Package

There is **one entry point** — `@be-in-digital/integrations` — and it exports
three namespaces plus the shared `common` module:

```typescript
import { uberEats, deliveroo, uberDirect } from "@be-in-digital/integrations";
```

Everything is reached through its namespace. Nothing is exported flat: there is
no top-level `verifyUberEatsWebhook`, no `client()` factory and no `orders`
sub-object on any of them. The functions are plain, stateless and take their
credentials as the first argument, which is what lets a Convex action call them
without holding a client instance between invocations.

Both platform clients take the same credential shape:

```typescript
interface UberEatsCredentials { clientId: string; clientSecret: string; sandboxMode?: boolean }
interface DeliverooCredentials { clientId: string; clientSecret: string; sandboxMode?: boolean }
```

`getAccessToken(credentials)` mints and caches an OAuth2 token per credential
set, deduplicating concurrent requests and refreshing five minutes before
expiry. You rarely call it directly — `fetchUberEats` / `fetchDeliveroo` do.

## Uber Eats

### Menu Sync

```typescript
import { uberEats } from "@be-in-digital/integrations";

// Read the current menu back from Uber Eats
const { categories, rawMenu } = await uberEats.pullMenu(credentials, storeId);

// Push the internal catalogue up
await uberEats.pushMenu(credentials, storeId, menuPayload); // UberEatsMenuPayload
```

### Orders

```typescript
const order = await uberEats.fetchOrder(credentials, orderId);
const unified = uberEats.mapUberEatsOrderToUnified(order);

await uberEats.acceptOrder(credentials, orderId);
await uberEats.denyOrder(credentials, orderId, reasonCode);
await uberEats.markOrderAsReady(credentials, orderId);
await uberEats.cancelOrder(credentials, orderId, payload);
```

There is no `parseOrder(req)`. A webhook handler verifies the signature, reads
the event, then fetches the order by id — the payload on the wire is an event,
not the order.

### Store Status

```typescript
await uberEats.updateStoreStatus(credentials, storeId, options);
const status = await uberEats.getStoreStatus(credentials, storeId);
// uberEats.DEFAULT_PAUSE_SECONDS === 30 * 60
```

Also available: `activateIntegration`, `getIntegrationDetails`,
`getStoresForUser`, `updateMenuItem`, `updateModifierGroup`, `createPromotion`,
`requestReport`, `resolveFulfillmentIssues`, the Authorization Code helpers
(`buildAuthorizeUrl`, `exchangeCodeForToken`, `refreshUserToken`) and the raw
escape hatch `fetchUberEats(credentials, path, options)`.

## Deliveroo

### Menu Sync

```typescript
import { deliveroo } from "@be-in-digital/integrations";

const menu = await deliveroo.pullMenu(credentials, /* … */);

// Menus are addressed by brand and menu id, not by store
await deliveroo.pushMenu(credentials, brandId, menuId, payload); // DeliverooV1MenuPayload
```

### Order Handling

```typescript
await deliveroo.acceptOrder(credentials, orderId);
await deliveroo.rejectOrder(credentials, orderId, "store_busy"); // reason defaults to store_busy
await deliveroo.confirmOrder(credentials, orderId);              // scheduled orders, after confirm_at
await deliveroo.updatePrepStage(credentials, orderId, stage);
await deliveroo.sendSyncStatus(credentials, orderId, /* … */);   // confirm items mapped to POS
const order = await deliveroo.getOrder(credentials, orderId);
```

There is no `deliveroo.orders.accept(...)` — the functions are on the namespace
itself, and each takes credentials first.

### Availability and Site Status

```typescript
await deliveroo.setItemAvailability(credentials, /* … */);
await deliveroo.setItemsUnavailable(credentials, /* … */);
await deliveroo.clearUnavailabilities(credentials, /* … */);
await deliveroo.setPLUMappings(credentials, /* … */);
await deliveroo.updateSiteStatus(credentials, /* … */);
```

## Uber Direct

On-demand delivery. **This namespace has no HTTP client.** It builds the request
payload and interprets the statuses that come back; the actual call lives in the
app's Convex action (`apps/reference/convex/uberDirect.ts`), which owns the
credentials and the retry policy.

```typescript
import { uberDirect } from "@be-in-digital/integrations";

// Build the body of POST /v1/eats/deliveries/orders
const body = uberDirect.buildCreateDeliveryRequest(order, { currency: "EUR" /* … */ });
```

It throws `UberDirectPayloadError` rather than sending a half-formed request —
`MISSING_DELIVERY_ADDRESS`, `MISSING_CUSTOMER_PHONE` and the rest. A delivery
created against a bad address costs a courier trip and a refund, so every
precondition Uber marks as required is checked before the call, not after it.

Status handling:

```typescript
uberDirect.isUberDirectStatus(value);              // type guard
uberDirect.isTerminalUberDirectStatus(status);     // no further updates coming
uberDirect.orderStatusForDeliveryStatus(status);   // → the engine's OrderStatus
uberDirect.requiresManualIntervention(status);     // needs a human
uberDirect.isQuoteUsable(quote);
uberDirect.UBER_DIRECT_STATUSES;
uberDirect.UBER_DIRECT_TERMINAL_STATUSES;
```

## Webhook Security

Every incoming webhook is verified, and each platform signs differently — there
is no single verifier and no `verifyDeliverooWebhook`. All three use the Web
Crypto API so they run unchanged inside a Convex isolate, and all three return
`false` rather than throwing.

```typescript
import { uberEats, deliveroo, uberDirect } from "@be-in-digital/integrations";

// Uber Eats — HMAC-SHA256 of the raw body, hex, in `x-uber-signature`
const ok = await uberEats.verifyUberEatsSignature(rawBody, signature, clientSecret);

// Uber Direct — same shape, its own signing secret
const okDirect = await uberDirect.verifyUberDirectSignature(rawBody, signature, signingSecret);
// header name: uberDirect.UBER_DIRECT_SIGNATURE_HEADER === "x-uber-signature"

// Deliveroo — the signed message is `sequenceGuid + " " + body`, and the body
// must be the RAW BYTES, exactly as received
const okDeliveroo = await deliveroo.verifyWebhookSignature(
  rawBodyBytes,   // ArrayBuffer | Uint8Array — not a string
  signature,      // X-Deliveroo-Hmac-Sha256
  sequenceGuid,   // X-Deliveroo-Sequence-Guid
  webhookSecret,
);
```

```typescript
export async function POST(req: Request) {
  const rawBody = await req.text();
  const signature = req.headers.get("x-uber-signature") ?? "";

  if (!(await uberEats.verifyUberEatsSignature(rawBody, signature, clientSecret))) {
    return new Response("Unauthorized", { status: 401 });
  }
  // Process webhook...
}
```

Two rules worth stating plainly, because both have already cost a production
incident:

- **Deliveroo's body must not be decoded and re-encoded.** Round-tripping a body
  through a string is usually lossless and occasionally is not; re-serializing
  parsed JSON never is. Either changes the bytes, the signature stops matching,
  and it surfaces as an unexplained 401 in production and nowhere else.
- **There is no fallback path.** An earlier version verified the body alone when
  the GUID-prefixed message failed. That accepted a signature computed with no
  GUID at all — nothing bound the payload to its delivery. One message shape, or
  401.

Deliveroo's legacy POS webhook (`new_order` / `cancel_order`) signs with a
different separator and is deliberately **not** supported: nothing subscribes to
it, and accepting both separators from one function is how a verifier ends up
accepting a message it should have refused.

## Errors

Failures throw `IntegrationError` from `common`:

```typescript
import { IntegrationError } from "@be-in-digital/integrations";

catch (error) {
  if (error instanceof IntegrationError) {
    error.message;        // safe to show a user
    error.statusCode;     // HTTP status from the platform
    error.platform;       // "uberEats" | "deliveroo"
    error.internalDetail; // raw response — logging only, never shown to end users
  }
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
