# @be-in-digital/admin

## 8.0.0

### Minor Changes

- 4c60c83: `convex` peer narrowed from `>=1.0.0` to `^1.44.0`.

  `>=1.0.0` was not a considered range, it was an absent one: it claims this
  package works against Convex 1.0 and every version since, including a future
  2.x, none of which is built or tested. The package uses `useQuery`,
  `useMutation` and `useAction` from `convex/react` and nothing else, so the range
  now states what it is actually shipped and exercised against.

  **This does not prevent the duplicate-copy failure**, and it should not be read
  as doing so. That was measured rather than assumed: with `apps/reference` put
  back on 1.31.7, `packages/admin` still resolves to 1.44.0 while the app resolves
  to 1.31.7 — the exact configuration that produced _"Could not find Convex
  client! useQuery must be used in the React component tree under
  ConvexProvider"_. pnpm satisfies a peer from any copy it can find, so narrowing
  which copies qualify does not stop it finding a different one from the app's.
  Adding `strict-peer-dependencies=true` did not change the outcome either; the
  install still succeeded, so that setting was not kept.

  What prevents it is every manifest in the monorepo declaring the same exact
  `convex`, which is already the case. This change makes the declaration honest,
  and gives consumers on npm or yarn — which do fail loudly on an unmet peer,
  unlike pnpm here — a true statement to fail against.

  No consumer is excluded: the boilerplate and both apps are on 1.44.0.

- 906d573: The kitchen display's sound alerts can be configured.

  `stores.soundConfig` decides which alerts sound and how loudly, and every piece
  was already there — the schema field, an audited mutation, and the reader on the
  routed kitchen screen. No screen wrote it, so every establishment ran on a
  literal hardcoded inside `KitchenContent`: a restaurant could not turn down a
  beep that repeats every thirty seconds for as long as a printer stays stuck.

  The store detail page gains a **Cuisine** tab with the three alerts — new ticket,
  overdue ticket, blocked print — each with a switch, a volume, and a preview
  button. Choosing a volume for a screen in a noisy kitchen without hearing it is
  guesswork, and the display already knew how to make the sound.

  The catalogue moves to `lib/kitchen-alerts`, shared by the editor that writes the
  setting and the display that plays it. It had been written out twice already —
  the defaults in `KitchenContent`, the frequencies in `KitchenSoundManager` — and
  a third copy in the editor would have been the one that drifted.

  `resolveSoundConfig` fills the setting in field by field rather than defaulting
  the object whole, so an establishment configured before an alert existed does not
  leave the display reading `undefined.enabled`. The form opens on the display's
  own fallbacks for an establishment that has never been configured, so it shows
  what the kitchen is currently hearing instead of claiming the alerts are off.

### Patch Changes

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

- Updated dependencies [a561c61]
- Updated dependencies [ebdda7e]
- Updated dependencies [213eb1d]
- Updated dependencies [7ae8072]
- Updated dependencies [aa2880f]
- Updated dependencies [629e88e]
- Updated dependencies [e7c6f36]
- Updated dependencies [74de4e9]
- Updated dependencies [526717a]
- Updated dependencies [889dddb]
  - @be-in-digital/convex-functions@3.0.0
  - @be-in-digital/convex-schema@3.0.0
  - @be-in-digital/core@2.3.0
  - @be-in-digital/restaurant@2.1.0

## 7.0.0

### Patch Changes

- 8ce83cb: Publish the packages whose source has been ahead of the registry since July,
  and fix the one thing that kept a client site from compiling even then.

  `@be-in-digital/integrations`, `@be-in-digital/marketing` and `@be-in-digital/ui`
  all still sit at **2.0.2 on GitHub Packages**, and all three have had source
  changes merged since — without a version bump. `changeset publish` then answers
  `already published` and skips them, so the registry keeps serving the July
  build under a version number the repository has since changed. Published 2.0.2
  and workspace 2.0.2 are two different sets of code.

  Nothing catches it in this repository, because `apps/themes` links these
  packages with `workspace:^` and compiles against the current source. Only a real
  client site installs the published artefact — and `beyours-boilerplate` has been
  failing its type-check since 2026-08-16 for exactly this reason:

  ```
  convex/emailCampaignActions.ts:136  Expected 2-3 arguments, but got 4
  convex/uberDirect.ts:387            Property 'uberDirect' does not exist on ...
  ```

  What each package has been withholding:
  - **`integrations`** — the whole **Uber Direct** module (`#66`: book, track and
    cancel a courier, ~950 lines under `src/uber-direct/`) is exported from
    `src/index.ts` and absent from the published bundle. A feature the fleet has
    never received.
  - **`marketing`** — `renderTemplateToEmailHtml` gained a fourth `options`
    argument and `absolutiseUrls` became public (`#185`). Without them, a campaign
    email built by a client site renders `/api/files/…` paths that resolve to
    nothing inside an inbox, and the call site does not compile.
  - **`ui`** — the storefront fix that keeps `draft` establishments out of the
    public site (`#116`), plus accessibility repairs: `Switch` announces itself as
    a switch rather than a checkbox, `Card` carries the `data-slot` every other
    primitive has, `AddressAutocomplete` labels its fields, and `Dialog` stops
    overflowing the viewport.

  **`admin` carries one real fix.** It ships raw TypeScript (`files: ["src"]`,
  every `exports` entry pointing at a `.ts`), so a consumer type-checks its source
  — and `@types/qrcode` sat in `devDependencies`, where an installing client never
  sees it. `qr-codes-page.tsx` therefore failed to compile in every client site
  while compiling fine here, because `apps/reference` happens to declare those
  types itself. For a package that ships source, an `@types/*` backing a runtime
  dependency is part of the public type surface: moved to `dependencies`.
  `@types/react` stays in `devDependencies` — React is a peer dependency and the
  consumer brings its own.

  Otherwise no source changes — only the versions the registry should have been
  serving.

  Verified against a real `beyours-boilerplate` clone with these four packages
  built from this branch and installed in place of the published ones: `tsc
--noEmit` goes from four errors to clean.

- Updated dependencies [8ce83cb]
  - @be-in-digital/marketing@2.1.0
  - @be-in-digital/ui@2.0.3

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
