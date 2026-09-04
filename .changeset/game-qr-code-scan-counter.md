---
"@be-in-digital/convex-functions": patch
---

Let a game QR code be created at all

`gameQRCodes.create` spread the caller's arguments over `createdAt`/`updatedAt`
and never stamped `scannedCount`, which the schema declares as a required
`v.number()`. Convex rejected every insert with "Missing required field
`scannedCount`", so no QR code could be created — and since the QR code is the
entry point of the whole gamification flow, nobody could ever play. True in both
apps, the test bench included.

Nothing caught it for four rounds. The only two assertions on this mutation are
negative RBAC cases, where the guard throws before the handler runs and the
validator never speaks; the unit suite calls the handlers past a hand-rolled
mock `db` that validates nothing. Every consumer of the field tolerates a
missing one — `recordScan` and both admin readers use `?? 0` — so the schema was
the only thing that ever objected.

There is now a positive-path suite in both apps
(`tests/convex/game-qr-codes.test.ts`) that goes through the real function, the
real validator and the real schema, and asserts the counter a scan then
increments.
