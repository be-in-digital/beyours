---
"@be-in-digital/integrations": patch
"@be-in-digital/convex-schema": patch
"@be-in-digital/convex-functions": patch
---

Production-readiness audit fixes for delivery integrations:

- **integrations**: the Uber Eats order mapper now keeps money in integer **cents**
  instead of dividing by 100. Previously Uber order totals were stored 100× too
  small while Deliveroo and website orders used cents. `UnifiedOrder` money fields
  are documented as cents.
- **convex-schema**: add the `oauthStates` table (single-use CSRF `state` for OAuth
  connect flows) and add `uberEatsConnections` to the package's composed reference
  schema so it no longer drifts from the app schema.
- **convex-functions**: `createFromWebhook` now returns `{ orderId, created }` so
  webhook handlers can skip duplicate kitchen-ticket creation and double
  auto-accept when Uber/Deliveroo retry a delivery (idempotent order import).
