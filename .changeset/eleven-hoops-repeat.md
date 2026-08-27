---
"@be-in-digital/convex-schema": minor
"@be-in-digital/convex-functions": minor
"@be-in-digital/admin": minor
---

Record establishment changes in the system audit log

`systemAuditLog` was only ever written by system operations, so a restaurant
could be created, renamed, moved, reconfigured or deleted and the journal stayed
empty. Every mutation in the stores module now appends an entry naming the
actor, the establishment, the operation, the timestamp and the before/after of
the fields the edit moved.

- `systemAuditLog` gains `store_created` / `store_updated` / `store_deleted`,
  an optional `targetStoreId`, and an index to read one establishment's history.
- The printer API key is redacted on both sides of a `printConfig` diff, and
  create/delete snapshots use a field allowlist so the legacy `integrations`
  blob never reaches the log.
- `system.getAuditLog` scopes establishment entries to the stores the reader has
  access to, and pages with Convex's own cursor instead of arithmetic that
  stalled after the second page.
