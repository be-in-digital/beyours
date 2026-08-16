---
"@be-in-digital/convex-schema": minor
"@be-in-digital/convex-functions": minor
"@be-in-digital/admin": minor
---

Maintenance & migration system: a per-deployment maintenance contract (derived status, update coverage keyed on release date), a release catalog synced from npm that locks published versions once the contract expires, site migration requests (controlled-transition workflow plus audit log), self-serve renewal through Stripe (the `bidProduct: maintenance` webhook creates a contract, never ownerEntitlements), and SES notifications when a request is opened. Adds a Maintenance tab to the admin System page.
