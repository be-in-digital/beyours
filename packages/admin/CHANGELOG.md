# @be-in-digital/admin

## 6.0.0

### Patch Changes

- Updated dependencies [3178b2d]
- Updated dependencies [e13cd4e]
  - @be-in-digital/core@2.2.0
  - @be-in-digital/convex-functions@2.2.2

## 5.0.0

### Patch Changes

- Updated dependencies [3a25d85]
- Updated dependencies [7e727ff]
  - @be-in-digital/core@2.1.0
  - @be-in-digital/convex-functions@2.2.1

## 4.0.0

### Minor Changes

- 285b579: Record establishment changes in the system audit log

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

### Patch Changes

- Updated dependencies [285b579]
- Updated dependencies [9817b8d]
  - @be-in-digital/convex-schema@2.2.0
  - @be-in-digital/convex-functions@2.2.0

## 3.0.0

### Minor Changes

- 5eec48d: Maintenance & migration system: a per-deployment maintenance contract (derived status, update coverage keyed on release date), a release catalog synced from npm that locks published versions once the contract expires, site migration requests (controlled-transition workflow plus audit log), self-serve renewal through Stripe (the `bidProduct: maintenance` webhook creates a contract, never ownerEntitlements), and SES notifications when a request is opened. Adds a Maintenance tab to the admin System page.

### Patch Changes

- 83f6af9: Enforce the order status machine in `updateStatus`.

  The mutation wrote whatever status it was handed. Nothing stopped an order going from `pending` straight to `completed`, or a cancelled order being revived — the transition table existed but only the storefront services consulted it, as advice.

  Three layers each carried their own opinion and they had drifted. The admin UI offered "Envoyer en livraison" on a ready order while the services table forbade `ready -> out_for_delivery`. The table is now single and lives in `@be-in-digital/convex-schema` (`ORDER_STATUS_TRANSITIONS`, `canTransitionOrderStatus`, `getNextOrderStatuses`); the services and the mutation both read it, and `ready -> out_for_delivery` is allowed, matching the button that already existed.

  **Behaviour change:** `updateStatus` now throws `Invalid order status transition: <from> -> <to>` instead of writing. Replaying the current status is an idempotent no-op rather than an error, so webhook retries and double-clicked buttons stay harmless. `updateFromWebhook` is deliberately left unguarded — Uber Eats and Deliveroo are authoritative for the orders they own.

  The cancellation window stops at `confirmed`, matching what Deliveroo permits: an order already being prepared, ready, or with a rider can no longer be cancelled internally.

- Updated dependencies [5eec48d]
- Updated dependencies [83f6af9]
- Updated dependencies [c1af162]
  - @be-in-digital/convex-schema@2.1.0
  - @be-in-digital/convex-functions@2.1.0
  - @be-in-digital/restaurant@2.0.3

## 2.0.2

### Patch Changes

- 7f0122b: Republished from main. Fixes two problems with the 2.0.1 tarballs that broke consumers:
  - `@be-in-digital/core`: the `./auth/rbac` subpath pointed at `src/auth/rbac.ts` while the tarball only ships `dist/` → broken import for consumers (`convex-functions/auth` included). `files` now includes `src`.
  - The type fixes that were on main but never published (promotion-form/email-config in admin, Uber Eats signatures in integrations/convex-functions) go out with this patch — they had been committed without a changeset.

- Updated dependencies [7f0122b]
  - @be-in-digital/convex-functions@2.0.2
  - @be-in-digital/convex-schema@2.0.2
  - @be-in-digital/core@2.0.2
  - @be-in-digital/marketing@2.0.2
  - @be-in-digital/restaurant@2.0.2
  - @be-in-digital/ui@2.0.2

## 2.0.1

### Patch Changes

- 1a5ca27: Rename package scope from @beindigital-engine to @be-in-digital for GitHub Packages compatibility
- Updated dependencies [321adad]
- Updated dependencies [1a5ca27]
  - @be-in-digital/convex-schema@2.0.1
  - @be-in-digital/convex-functions@2.0.1
  - @be-in-digital/ui@2.0.1
  - @be-in-digital/core@2.0.1
  - @be-in-digital/restaurant@2.0.1
  - @be-in-digital/marketing@2.0.1

## 2.0.0

### Major Changes

- 7c3d4da: Configure private npm publishing for all @beindigital-engine packages

  ### What changed
  - Packages are now publishable to npm as private (restricted) packages under the `@beindigital-engine` scope.
  - Removed `"private": true` flag from all packages and replaced with `"publishConfig": { "access": "restricted" }`.
  - Added `"files"` field to control published contents.

  ### Why

  First official release of all packages on the npm private registry for distribution.

  ### How to install

  ```bash
  npm login --scope=@beindigital-engine
  pnpm add @be-in-digital/core @be-in-digital/ui @be-in-digital/restaurant
  ```

### Patch Changes

- Updated dependencies [7c3d4da]
  - @be-in-digital/convex-functions@2.0.0
  - @be-in-digital/convex-schema@2.0.0
  - @be-in-digital/restaurant@2.0.0
  - @be-in-digital/marketing@2.0.0
  - @be-in-digital/core@2.0.0
  - @be-in-digital/ui@2.0.0

## 1.0.0

### Major Changes

- ad4d8d2: Configure private npm publishing for all @beindigital-engine packages

  ### What changed
  - Packages are now publishable to npm as private (restricted) packages under the `@beindigital-engine` scope.
  - Removed `"private": true` flag from all packages and replaced with `"publishConfig": { "access": "restricted" }`.
  - Added `"files"` field to control published contents.

  ### Why

  First official release of all packages on the npm private registry for distribution.

  ### How to install

  ```bash
  npm login --scope=@beindigital-engine
  pnpm add @be-in-digital/core @be-in-digital/ui @be-in-digital/restaurant
  ```

### Patch Changes

- Updated dependencies [ad4d8d2]
  - @be-in-digital/convex-functions@1.0.0
  - @be-in-digital/convex-schema@1.0.0
  - @be-in-digital/restaurant@1.0.0
  - @be-in-digital/marketing@1.0.0
  - @be-in-digital/core@1.0.0
  - @be-in-digital/ui@1.0.0
