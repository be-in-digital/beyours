# Changelog

## 3.0.0

### Major Changes

- 7ae8072: `convex` moves from a hard dependency to a peer dependency.

  **Breaking: consumers must declare `convex` themselves**, at `^1.44.0`. Every
  consumer already does — both apps and the boilerplate are on 1.44.0 — so nothing
  in the fleet has to change today. It is still a change to the contract, hence
  the major.

  Both packages ship raw TypeScript (`main: ./src/index.ts`, `files: ["src"]`, no
  build step), so the consumer's compiler reads their source, which imports
  `convex/server` and `convex/values`. That is the definition of a peer: the
  consumer supplies the copy, and there must be exactly one. As a hard dependency
  at an exact version it was the opposite — the package brought its own.

  Measured on the real tarball rather than argued, with a consumer on convex
  1.42.0:

  |                                                       | Result                                                                                                                                  |
  | ----------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
  | **Before** — `dependencies: { convex: "1.44.0" }`     | installs quietly, **two copies**: the consumer's `convex@1.42.0` and a nested `@be-in-digital/convex-schema/node_modules/convex@1.44.0` |
  | **After** — `peerDependencies: { convex: "^1.44.0" }` | npm **refuses**: `npm error peer convex@"^1.44.0" from @be-in-digital/convex-schema@2.2.0`                                              |
  | **After**, consumer on 1.44.0                         | installs, exactly one copy                                                                                                              |

  Two copies of `convex/values` means two sets of validators, which is the same
  class of failure as the two React contexts that once crashed the admin — quieter,
  because there is no provider to notice the mismatch.

  One limit worth stating: inside this monorepo the change has no effect. Workspace
  links resolve `convex` from each package's own `devDependencies`, so
  `packages/convex-schema` keeps using its local copy whatever a sibling declares.
  The guard is real where the packages are installed from the registry, which is
  every client site.

### Minor Changes

- a561c61: One `convex` version across the monorepo: 1.44.0.

  Six manifests declared three different things — `1.31.7` exact in the engine,
  the template and three packages, `^1.34.0` floating in `apps/site`, and a
  `>=1.0.0` peer in `packages/admin`. pnpm installed **two copies**, and
  `apps/site` was the only workspace on the newer one.

  The 1.31.7 pin was not a compatibility constraint. It was an incident fix: the
  unconstrained peer in `packages/admin` let pnpm resolve `convex` to the highest
  version in the repo while the app provided context from the lower one, so
  `useQuery` found no provider and the admin crashed on render for every user.
  Pinning `convex` as an explicit devDependency of `packages/admin` out-voted the
  resolution. Declaring the same exact version everywhere removes it instead —
  there is no second copy left to pick.

  `convex-schema` and `convex-functions` carry `convex` as a real dependency, so
  consumers inherit this bump.

  Nothing in the 1.31.7 → 1.44.0 range is breaking: no removed runtime API, no
  change to `ctx.auth`, and the same `node >= 18` floor. Two consequences did
  need handling. Convex 1.35.0 flipped codegen for components from static
  expansion to a `ComponentApi` reference, which is why `_generated/api.d.ts` in
  the engine and the template loses ~1980 lines each; `components.betterAuth` is
  still exported under the same name, now typed by better-auth's own package. And
  `_generated/server.d.ts` gains a typed `env` for `CONVEX_CLOUD_URL` and
  `CONVEX_SITE_URL`. The new default was accepted rather than opted out of with
  `legacyComponentApi`.

  The remaining hazard is untouched and deliberate: `packages/admin` still peers
  on `convex: ">=1.0.0"`. A permissive peer is right for a library, and with every
  manifest agreeing it cannot mis-resolve — but it is what made the original
  incident possible, and it will again if the versions ever diverge.

- 213eb1d: Restoring a backup no longer detaches the whole database from its stores.

  `importTable` deletes a table and re-inserts its rows without their `_id` —
  Convex will not let an insert choose one. So `stores` came back under **new**
  ids while the products, menus, CMS pages and promotions restored after them came
  back carrying the **old** `storeId`. Nothing objected: `v.id("stores")`
  validates how an id is encoded, not that it resolves, so the inserts succeeded
  and the deployment came up with every catalogue detached from its establishment.
  `userProfiles.storeIds` still named stores that no longer existed, so the owner
  who ran the restore was locked out of every screen. Silently, and irreversibly.

  The import now records `old id → new id` for every row it inserts and carries
  that map forward table by table, rewriting every id it recognises — including
  inside arrays and nested objects, so `targetProductIds` and a CMS block's
  embedded ids are reached as readily as a top-level `storeId`. The existing
  dependency order is what makes it work: a reference can only be rewritten once
  its target has been inserted.

  `userProfiles` is not in the backup — it holds identities, not restaurant data —
  so its `storeIds` are rewritten in place afterwards. Ids the map does not know
  are dropped, because after the import those establishments do not exist, and
  keeping them would put back the dangling reference this removes.

  The restore reports what it remapped, and says plainly that orders, payments,
  kitchen tickets and team members are neither exported nor imported, so their
  references are not repaired. It does **not** try to count them: telling a
  reference from an ordinary string needs a way to recognise a Convex id, and
  there is none that holds across deployments. A count that reports zero for
  exactly the case it exists to catch is worse than a plain statement of what a
  backup carries.

- aa2880f: Four multi-store defects, all of them settings written by the dashboard and
  read by nobody — or data written and never cleaned up.

  **Deleting an establishment takes its data with it.** `stores.remove` deleted
  the store row alone. Forty-two `storeId` columns across twenty tables were left
  pointing at a document that no longer existed, and the id stayed in
  `userProfiles.storeIds`. Nothing complained: `v.id("stores")` validates how an
  id is encoded, not that it resolves. The sweep is batched and resumable — one
  mutation is one transaction, and an established restaurant has more orders than
  a transaction may touch — so `remove` clears one batch and the app wrapper
  schedules `purgeStoreData` until there is nothing left. `favorites` gained a
  `by_storeId` index: both of its compound indexes start with `userId`, so it was
  the one table that could not be swept by store.

  **"Horaires globaux" governs the storefront.** `useGlobalHours` was written by
  the dashboard and read by nothing — `use-store-status` took `store.hours`
  unconditionally, so an owner who edited the global week and left every location
  on the flag changed nothing a visitor could see. `resolveStoreHours` resolves it
  on read rather than copying on write, so editing the global hours reaches every
  location that follows them without a migration.

  **Opening hours are the restaurant's, not the visitor's.**
  `globalSettings.timezone` was written and never read: open/closed came from
  `now.getDay()` and `now.getHours()`, the browser's clock. A customer abroad got
  the wrong answer, and anyone could change it by changing their system clock.
  `isStoreOpen` and `getNextOpenTime` take an optional IANA zone; without one they
  behave exactly as before, and an unknown zone name falls back to the visitor's
  clock rather than throwing.

  **Saving the Integrations tab keeps the Uber Direct credentials.** The settings
  form read `globalSettings.get` — the public storefront query, which strips
  `customerId`, `clientId` and `clientSecret` — so the fields came up empty and
  saving patched the empty values over the stored ones. It reads `getAdmin` now,
  the query behind the same `settings:read` the Paramètres page already requires.
  `upsert` also merges `integrations` platform by platform, so a tab saving its
  own section no longer takes out the others; each platform is still replaced
  whole, so disconnecting one remains possible.

  The three integration switches gained an id and an `aria-label`. They had
  neither, so a screen reader announced three anonymous check boxes.

- 629e88e: An order is refused when the restaurant is not taking any, and when it is not
  the kind the restaurant runs.

  **"Fermé" and "Indisponible" now mean it.** `orders.create` checked
  `isPublishedStore` alone, and both statuses are _published_ — that is what keeps
  a paused restaurant listed with a readable menu. The storefront greyed out every
  button on them and nothing else did, so a tab left open, a cart restored from
  localStorage or a direct call took the order anyway. `isOrderableStore` is the
  narrower rule, next to `isPublishedStore` where the wider one already lived.

  This reverses a decision the suite documented — _"a closed restaurant is
  published: it takes orders for later, and the storefront is what decides whether
  to offer that."_ It does not hold: `closed` and `temporarily_unavailable` are set
  by hand from the dashboard, and the two screens that offer ordering already
  refuse on them. Pre-orders for a named later date are a feature nobody has built;
  until someone does, the status means what the owner meant.

  **The four service switches are enforced.** `globalSettings.services` was written
  by the settings page and read nowhere that mattered. The storefront took
  `store.overrides.services` — `undefined` on every establishment that has not
  customised it — and the selector read `undefined` as "offer everything", so a
  restaurant that does not deliver still showed Livraison. `orders.create` never
  looked at `args.type` at all.

  `resolveStoreServices` puts the store override first, the global switches next,
  and everything-on last, so a deployment whose settings row has never been saved
  keeps working. `ORDER_TYPE_SERVICE` is the one map the selector filters on and
  the mutation validates against — the button a customer can press and the order
  the server accepts can no longer disagree. `clickAndCollect` is deliberately
  unmapped: three order types, four switches, and folding it into `takeaway` would
  make that switch mean two things.

- 74de4e9: `orderConfirmation` and `displayConfig` are gone; `soundConfig` stays.

  The audit listed three store settings as dead — "mutations and audit entries
  wired, with no reader or writer". Two of the three were, and the reason they
  looked wired is worth recording: the only screens that wrote them lived in
  `apps/themes/components/admin/settings/`, a folder no route renders. Both apps
  route `/dashboard/settings` and `/dashboard/stores/[id]` to `@be-in-digital/admin`,
  so those six components had been orphaned and left behind. The folder is deleted.

  `orderConfirmation` was the worse of the two. `"manual"` promised that staff
  would validate an order before the kitchen saw it, and nothing implemented it:
  `createWithTicket` sends every order straight through. A setting nobody reads is
  dead code; a setting that promises a workflow the product does not have is a
  false promise to the restaurant owner. It is withdrawn rather than left offered.

  The two fields stay declared in the schema, optional, alongside `branding` and
  the other legacy columns — a stored field absent from the schema fails
  validation on the next write to that document, so removing them outright would
  break the establishments that already hold one. Nothing writes them now.

  `soundConfig` is **not** dead and is kept: `KitchenContent` hands it to
  `KitchenSoundManager` in both apps, on the routed kitchen display, and it decides
  which alerts sound and how loudly. Deleting it would have silenced a working
  feature. It has no editor — the KDS runs on the component's fallbacks — which is
  a gap worth closing and not the same thing.

- 526717a: Two ways a store id reached somewhere it should not have.

  **A stale admin selection no longer takes `/dashboard/team` down.** The persisted
  id is a bare string in localStorage, and localStorage outlives the deployment
  that issued it. `teamMembers.list` declares `storeId: v.id("stores")`, which
  refuses an id from another deployment, and Convex raises that out of `useQuery`
  during render — so the page went blank rather than degrading. `/dashboard/team`
  is one of `StoreGuard`'s `BYPASS_ROUTES`, so it renders before the guard has
  settled the selection; the guard does repair it, but a render happens first, and
  one render was all it took. The page now checks the id against
  `stores.listAll` before sending it, through the same `resolveStoreSelection` the
  guard uses. This is the shape #119 fixed for the storefront and not here.

  **A draft establishment is no longer readable by the storefront.**
  `stores.getById` is public — checkout, the contact page and the open/closed
  banner all need it before anyone signs in — and it returned drafts to anyone who
  had an id: address, contact details, `orderMode`, `overrides`. `stores.list`
  filters drafts out; a direct read walked past that.

  Closing the query was not an option: it is also the administration's read. The
  store detail page exists to publish drafts, and the KDS reads its own
  establishment while holding a role (`kitchen`, `delivery`) that does not have
  `stores:read`, so `getAdminById` is shut to it. The rule is therefore by caller —
  staff see drafts, everyone else gets `null` — using a new non-throwing `isStaff`
  beside `requireStaff`, because a query the storefront shares has to be able to
  answer "not staff" without raising.

- 889dddb: Creating an establishment from the dashboard works.

  It never did. `stores.create` declares six arguments; the create dialog sent a
  seventh — a `settings` object with currency, timezone, service toggles, fees and
  a tax rate. Convex refuses an undeclared argument rather than dropping it, so
  every attempt threw an `ArgumentValidationError` and the dialog showed nothing
  but "Échec de la création de l'établissement". On a product billed per store,
  the only establishments that could exist were the ones `seedFixture` wrote.

  The payload now lives in `buildStoreCreateArgs` instead of inside the React
  handler, because a payload written inline is invisible to the test suite. The
  unit tests call handlers directly, past the validator, and saw nothing;
  `store-create-args.test.ts` reads the argument names off the validator itself
  and compares.

  `resolveTaxRatePercent` loses its `storeTaxRate` source. It read
  `store.settings.taxRate` — a legacy column no mutation declares, so the only
  value it could ever have held came from the payload Convex was rejecting. Every
  order already fell through to `globalSettings.taxRate`; the rate is now read
  from there and nowhere else. A genuine per-store rate belongs in a declared
  argument with an editor behind it.

  `E2E_PORT` gives a Playwright run its own port. Two runs on one machine used to
  share 3000, and `reuseExistingServer` let the second drive the first one's
  build.

### Patch Changes

- Updated dependencies [a561c61]
- Updated dependencies [ebdda7e]
- Updated dependencies [7ae8072]
- Updated dependencies [aa2880f]
- Updated dependencies [629e88e]
- Updated dependencies [74de4e9]
  - @be-in-digital/convex-schema@3.0.0
  - @be-in-digital/core@2.3.0

## 2.2.2

### Patch Changes

- Updated dependencies [3178b2d]
- Updated dependencies [e13cd4e]
  - @be-in-digital/core@2.2.0

## 2.2.1

### Patch Changes

- Updated dependencies [3a25d85]
- Updated dependencies [7e727ff]
- Updated dependencies [5837a81]
  - @be-in-digital/core@2.1.0
  - @be-in-digital/cms@3.0.0

## 2.2.0

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

- 9817b8d: Creating an establishment now makes its creator an administrator of it.

  `stores.create` is the one mutation the store-scoped seam cannot guard — there
  is no store yet to check membership against — and nothing added the new store to
  the creator's profile. A client admin who opened a second location was refused
  by the detail page and every edit, and `profileProvisioning` refused them their
  own profile too, so only a super admin could let them back in.

- Updated dependencies [285b579]
  - @be-in-digital/convex-schema@2.2.0

## 2.1.0

### Minor Changes

- 5eec48d: Maintenance & migration system: a per-deployment maintenance contract (derived status, update coverage keyed on release date), a release catalog synced from npm that locks published versions once the contract expires, site migration requests (controlled-transition workflow plus audit log), self-serve renewal through Stripe (the `bidProduct: maintenance` webhook creates a contract, never ownerEntitlements), and SES notifications when a request is opened. Adds a Maintenance tab to the admin System page.
- 83f6af9: Enforce the order status machine in `updateStatus`.

  The mutation wrote whatever status it was handed. Nothing stopped an order going from `pending` straight to `completed`, or a cancelled order being revived — the transition table existed but only the storefront services consulted it, as advice.

  Three layers each carried their own opinion and they had drifted. The admin UI offered "Envoyer en livraison" on a ready order while the services table forbade `ready -> out_for_delivery`. The table is now single and lives in `@be-in-digital/convex-schema` (`ORDER_STATUS_TRANSITIONS`, `canTransitionOrderStatus`, `getNextOrderStatuses`); the services and the mutation both read it, and `ready -> out_for_delivery` is allowed, matching the button that already existed.

  **Behaviour change:** `updateStatus` now throws `Invalid order status transition: <from> -> <to>` instead of writing. Replaying the current status is an idempotent no-op rather than an error, so webhook retries and double-clicked buttons stay harmless. `updateFromWebhook` is deliberately left unguarded — Uber Eats and Deliveroo are authoritative for the orders they own.

  The cancellation window stops at `confirmed`, matching what Deliveroo permits: an order already being prepared, ready, or with a rider can no longer be cancelled internally.

### Patch Changes

- Updated dependencies [5eec48d]
- Updated dependencies [83f6af9]
  - @be-in-digital/convex-schema@2.1.0

## 2.0.2

### Patch Changes

- 7f0122b: Republished from main. Fixes two problems with the 2.0.1 tarballs that broke consumers:
  - `@be-in-digital/core`: the `./auth/rbac` subpath pointed at `src/auth/rbac.ts` while the tarball only ships `dist/` → broken import for consumers (`convex-functions/auth` included). `files` now includes `src`.
  - The type fixes that were on main but never published (promotion-form/email-config in admin, Uber Eats signatures in integrations/convex-functions) go out with this patch — they had been committed without a changeset.

- Updated dependencies [7f0122b]
  - @be-in-digital/cms@2.0.2
  - @be-in-digital/convex-schema@2.0.2
  - @be-in-digital/core@2.0.2

## 2.0.1

### Patch Changes

- 321adad: Production-readiness audit fixes for delivery integrations:
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

- 1a5ca27: Rename package scope from @beindigital-engine to @be-in-digital for GitHub Packages compatibility
- Updated dependencies [321adad]
- Updated dependencies [1a5ca27]
  - @be-in-digital/convex-schema@2.0.1
  - @be-in-digital/core@2.0.1
  - @be-in-digital/cms@2.0.1

## 2.0.1

### Patch Changes

- b8aaa34: Rename package scope from @beindigital-engine to @be-in-digital for GitHub Packages compatibility
- Updated dependencies [b8aaa34]
  - @be-in-digital/core@2.0.1
  - @be-in-digital/cms@2.0.1
  - @be-in-digital/convex-schema@2.0.1

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
  - @be-in-digital/convex-schema@2.0.0
  - @be-in-digital/core@2.0.0
  - @be-in-digital/cms@2.0.0

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
  - @be-in-digital/convex-schema@1.0.0
  - @be-in-digital/core@1.0.0
  - @be-in-digital/cms@1.0.0

All notable changes to `@be-in-digital/convex-functions` will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2026-02-14

### Added

#### Core Functions

- **helpers.ts** - Utility functions
  - `generateOrderNumber()` - Generate unique order numbers
  - `generateSlug(text)` - Convert text to URL-friendly slugs
  - `now()` - Get current timestamp

#### Store Management (stores.ts)

- `list()` - Query all stores
- `getById(id)` - Get store by ID
- `getBySlug(slug)` - Get store by slug
- `create(...)` - Create new store with default hours
- `update(id, ...)` - Update store information
- `updateHours(id, hours)` - Update opening hours
- `updateBranding(id, branding)` - Update branding
- `updateSettings(id, settings)` - Update settings
- `remove(id)` - Delete store

#### Product Management (products.ts)

- `list(storeId)` - Query all products
- `getById(id)` - Get product by ID
- `getByCategory(storeId, categoryId)` - Get products by category
- `getBySlug(storeId, slug)` - Get product by slug
- `getFeatured(storeId)` - Get featured products
- `create(...)` - Create new product
- `update(id, ...)` - Update product
- `updateStock(id, quantity)` - Update stock quantity
- `toggleStatus(id)` - Toggle active status
- `remove(id)` - Delete product

#### Category Management (categories.ts)

- `list(storeId)` - Query all categories
- `getById(id)` - Get category by ID
- `create(...)` - Create new category
- `update(id, ...)` - Update category
- `reorder(ids)` - Reorder categories
- `remove(id)` - Delete category

#### Order Management (orders.ts)

- `list(storeId)` - Query all orders
- `getById(id)` - Get order by ID
- `getByCustomer(customerId)` - Get orders by customer
- `getByStatus(storeId, status)` - Get orders by status
- `create(...)` - Create new order (auto-calculates totals)
- `updateStatus(id, status, reason?)` - Update order status
- `remove(id)` - Delete order

#### Kitchen System (kitchenTickets.ts)

- `getByStore(storeId)` - Get all kitchen tickets
- `getByStatus(storeId, status)` - Get tickets by status
- `getByStation(storeId, station)` - Get tickets by station
- `getByOrder(orderId)` - Get tickets by order
- `create(...)` - Create new kitchen ticket
- `updateStatus(id, status)` - Update ticket status
- `assignStation(id, station)` - Assign to station
- `assignTo(id, userId)` - Assign to user
- `incrementPrintCount(id)` - Increment print count

#### Payment Processing (payments.ts)

- `getByOrder(orderId)` - Get payments by order
- `getByStore(storeId)` - Get all store payments
- `create(...)` - Create new payment
- `updateStatus(id, status, externalId?)` - Update payment status
- `refund(id, amount, reason?)` - Process refund

#### Team Management (teamMembers.ts)

- `list(storeId)` - Query all team members
- `getByUser(userId)` - Get memberships by user
- `getByRole(storeId, role)` - Get members by role
- `create(...)` - Add team member
- `update(id, ...)` - Update team member
- `toggleActive(id)` - Toggle active status
- `remove(id)` - Remove team member

#### Language Management (languages.ts)

- `list(storeId)` - Query all languages
- `create(...)` - Add new language
- `update(id, ...)` - Update language
- `toggleActive(id)` - Toggle active status
- `setDefault(storeId, languageId)` - Set as default language
- `remove(id)` - Delete language

#### Translation Management (translations.ts)

- `getForEntity(storeId, entityType, entityId)` - Get translations for entity
- `getByLanguage(storeId, languageCode)` - Get translations by language
- `upsert(...)` - Create or update translation
- `bulkUpsert(translations)` - Bulk upsert translations
- `remove(id)` - Delete translation

### Features

#### Automatic Calculations

- **Orders**: Auto-calculate subtotal, taxes, delivery fees, and total
- **Order Numbers**: Auto-generate unique order numbers (ORD-YYYY-XXXX format)
- **Timestamps**: Auto-manage createdAt, updatedAt, startedAt, completedAt, cancelledAt

#### Multi-tenant Support

- All queries filter by `storeId` for data isolation
- Guaranteed separation between different stores/restaurants

#### Smart Logic

- **Languages**: Auto-unset other default languages when setting new default
- **Translations**: Intelligent upsert (update if exists, create if not)
- **Kitchen Tickets**: Auto-set startedAt/completedAt based on status changes

#### Type Safety

- Full TypeScript support
- Convex validators on all arguments
- No `any` types (except payment metadata)

### Documentation

- README.md - Package overview and function list
- USAGE.md - Complete usage guide with examples
- SUMMARY.md - Technical summary
- CHANGELOG.md - Version history

### Scripts

- `copy-to-app.sh` - Script to copy functions to Next.js app
- `pnpm copy-to <app-name>` - Package script for easy copying

### Testing

- Vitest test setup
- Example tests for helper functions
- 13 passing tests with 100% coverage on helpers

### Payment Providers

- Stripe
- SumUp
- PayPal
- Square
- Cash

### Team Roles

- Owner
- Manager
- Staff
- Kitchen
- Delivery

### Statistics

- 1,582 lines of TypeScript code
- 60+ functions (24 queries + 36 mutations)
- 10 functional modules
- 3 utility helpers

[0.1.0]: https://github.com/be-in-digital/beindigital-engine/releases/tag/convex-functions-v0.1.0
