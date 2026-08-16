---
"@be-in-digital/convex-schema": minor
"@be-in-digital/convex-functions": minor
"@be-in-digital/restaurant": patch
"@be-in-digital/admin": patch
---

Enforce the order status machine in `updateStatus`.

The mutation wrote whatever status it was handed. Nothing stopped an order going from `pending` straight to `completed`, or a cancelled order being revived — the transition table existed but only the storefront services consulted it, as advice.

Three layers each carried their own opinion and they had drifted. The admin UI offered "Envoyer en livraison" on a ready order while the services table forbade `ready -> out_for_delivery`. The table is now single and lives in `@be-in-digital/convex-schema` (`ORDER_STATUS_TRANSITIONS`, `canTransitionOrderStatus`, `getNextOrderStatuses`); the services and the mutation both read it, and `ready -> out_for_delivery` is allowed, matching the button that already existed.

**Behaviour change:** `updateStatus` now throws `Invalid order status transition: <from> -> <to>` instead of writing. Replaying the current status is an idempotent no-op rather than an error, so webhook retries and double-clicked buttons stay harmless. `updateFromWebhook` is deliberately left unguarded — Uber Eats and Deliveroo are authoritative for the orders they own.

The cancellation window stops at `confirmed`, matching what Deliveroo permits: an order already being prepared, ready, or with a rider can no longer be cancelled internally.
