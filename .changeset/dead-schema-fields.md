---
"@be-in-digital/convex-schema": patch
---

Say which order and referral fields nothing writes

Four schema fields carried comments describing what they would hold —
"Human-readable display ID from platform", `delivery` / `collection` / `dine_in`,
"Flag for remake orders", a referrer's name — and each has **zero writers** across
`packages/convex-functions/src` and both apps' `convex`.

A descriptive comment on a field nothing populates reads as a shipped capability
to anybody auditing the schema, which is how the audit found them.

- `orders.externalDisplayId` — the number a kitchen matches against the tablet on
  the wall. Worth having; `createFromWebhook` extracts it from neither platform's
  payload, so it is `undefined` on every order.
- `orders.deliveryType` — duplicates `orders.type`, which is written and read.
  Two fields for one fact, one always empty and spelled differently
  (`collection` vs `pickup`).
- `orders.isRemake` — for Deliveroo's remake flow, which is not implemented.
- `gameReferrals.referrerName` — no path collects it and no screen asks for one.

They stay declared and optional: Convex validates a document against the schema on
the next write to it, so a stored field absent from the schema fails that write,
and nothing here can say whether an older deployment holds one. Same treatment as
`stores.integrations` — the field stays, and the comment says who reads it.
