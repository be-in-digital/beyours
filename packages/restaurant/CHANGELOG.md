# @be-yours/restaurant

## 1.0.0

### Major Changes

- Renamed from `@be-in-digital/restaurant` to `@be-yours/restaurant`, and reset to 1.0.0.

  The npm scope now matches the GitHub organisation that owns this repository,
  which is what GitHub Packages requires: a package published to
  `npm.pkg.github.com` must carry the owning org as its scope, and the org is
  `be-yours`. The previous scope belonged to `be-in-digital`, the agency.

  The version is a reset, not a bump. Under the new scope this package has no
  published history, so `1.0.0` is its first release rather than a downgrade
  from `4.2.1`. The old scope keeps everything it published: those
  versions stay on the registry and already-deployed client sites continue to
  resolve them until they are migrated. See `RELEASE_HOLD.md` for the
  migration and the conditions this release is held on.

## 4.2.1

### Patch Changes

- 1d9f5e1: Four places where a failure or a limit was invisible to the person it affected.

  `recordOrderStatusChange` promised "Never throws" and wrapped only the identity
  lookup; the insert sat outside the try, in the caller's transaction, so a failed
  audit line took the order's status change with it. It is inside now.

  The unmatched-import panel rendered nothing for both "still loading" and
  "nothing to resolve", which mean opposite things on a screen an owner opens
  right after an import. The unresolved state now says it is still counting; the
  clean one stays silent.

  « Taux de retour » read 2,000 customer rows and said nothing when it stopped
  there, so an establishment with more distinct diners than that in the period
  read a rate over an arbitrary slice of its book. `DashboardDiners` carries its
  own `truncated` — the orders read beside it has its own, and a period can
  exhaust either cap alone — and the card qualifies the figure when it is set.

  A refused card payment told every diner « Choisissez un autre moyen de
  paiement », including on a delivery order at an establishment that takes neither
  cash nor PayPal, where card is the only tile on the page. `cardUnavailableMessage`
  decides the second sentence from the same context the tiles were rendered from.

- 4f44255: Bundle convex-schema so the package loads under plain Node

  `dist` left `@be-yours/convex-schema` external, and that package publishes
  raw `.ts` on purpose — the Convex bundler compiles it, and a schema has to stay
  readable as source. So the bundle carried a runtime import of TypeScript.

  It worked everywhere it was tried. In the monorepo `convex-schema` resolves
  outside `node_modules` and Node strips types there. A client installs it from the
  registry, where it is under `node_modules`, and Node refuses:

      Error: Stripping types is currently unsupported for files under
      node_modules, for ".../@be-yours/convex-schema/src/index.ts"

  That is every Playwright spec importing a value from this package — the client
  template's own `e2e/storefront/cart-line-identity.spec.ts` imports
  `CART_STORAGE_VERSION` — on every client repo.

  `tsup.config.ts` already had this exact reasoning written down for
  `@be-yours/core/allergens`, one package along. `convex-schema` joins it in
  `noExternal`. Bundled rather than repackaged: the four helpers used here are pure
  functions and a constant, with no singleton to duplicate.

- Updated dependencies [2a0e474]
  - @be-yours/convex-schema@6.8.1

## 4.2.0

### Minor Changes

- 17e67d3: Make _formules_ orderable — the customer half that never shipped

  An owner was told in three places in the product that they could sell formules:
  the menus tab's empty state, the products page heading, and the guided tour
  auto-launched on first login. No customer could ever order one.

  The admin half was complete — schema, CRUD, RBAC, a 473-line tab over a 761-line
  section builder — and the seven customer-facing strings were already translated
  into French, English and Spanish. `menu.addComboToCart` (« Ajouter la formule au
  panier ») was referenced nowhere in either app. Someone translated the button
  before anyone built it.

  What was missing, and is here now:

  - **`menus.listActive`** — the filtered public query `menus.list`'s own comment
    asked for. It resolves `pick_category` sections server-side, leaves out a
    formule whose mandatory dish has been switched off (rather than offering it and
    refusing the diner at the checkout), and keeps offering one whose dish is
    merely sold out, marked so.
  - **`menuLine.ts`** — a pure module that verifies a composed formule against its
    sections and prices it. Every chosen dish passes the same gate an à-la-carte
    line does, so a formule is refused for the same reasons: sold out, switched
    off, outside its serving window.
  - **`orders.create` accepts one.** It used to throw on any line with no
    `productId`, which is exactly what a bundle is. A formule becomes N order rows
    sharing a `menuLineId`, one per dish, each priced at its share — so the money,
    the kitchen and the invoice all get what they need without a nested shape.
  - **The cart can hold one.** `CartItem.productId` is optional and `menu` carries
    the composition; `cartLineId` hashes the whole selection, so two « Formule
    Midi » composed differently are two lines. `CART_STORAGE_VERSION` is 2 and
    every persisted cart migrates without losing anything.
  - **The storefront** renders the formules above the à-la-carte grid, composes one
    in a dialog, lists its dishes in the cart, and sends it to the checkout.

  **The two money decisions, stated because they were the reason this was its own
  change:**

  1. **VAT across a mixed-rate bundle** is split **pro rata on à-la-carte value**,
     the standard treatment of an _offre composite à prix global_. A 15 € dish at
     10 % and a 5 € glass of wine at 20 % sold at 20 € owes 1,36 € + 0,83 €. Split
     evenly it would have declared 0,39 € more VAT than is owed, on a numbered
     fiscal document. The leftover centime goes to the largest share,
     deterministically, so the shares always sum to exactly the price and two runs
     bill the same.
  2. **A formule's dishes are not discountable** by product- or category-scoped
     promotions. The bundle price is already the owner's discount; letting « -20 %
     sur les desserts » reach the dessert inside it discounts the same dish twice
     without the owner asking. Order-level promotions still apply. A coupon that
     matches nothing but formules is **refused with a sentence** rather than
     granted at zero — a diner charged full price with no explanation cannot tell a
     rule from a bug.

  Also: the kitchen slip prints « Formule Midi · Plat — Risotto », so a cook can
  see which dishes are one cover; and `menu.sections` / `menu.fixedItem`, the two
  translated strings this change does not use, are removed rather than left as dead
  translations in three languages.

### Patch Changes

- Updated dependencies [17e67d3]
- Updated dependencies
  - @be-yours/convex-schema@6.6.0

## 4.1.1

### Patch Changes

- 92dc32f: Read the storefront's opening hours on the same clock the order path uses

  `useStoreStatus` computes two answers from one moment and says so — "Both
  answers off one reading of the clock, so they cannot describe two different
  moments" — but they came from two functions that fell back differently.
  `openNow` goes through `isWithinBusinessHours` → `restaurantClock`;
  `hoursStatus` goes through `isStoreOpen` → `readingFrame`. Given no
  `globalSettings.timezone`, the first read the server's clock and the second read
  the visitor's.

  `globalSettings` is a singleton nothing seeds, so "no timezone" is not an
  unusual caller: it is every deployment whose settings have never been saved. On
  those, one screen showed "Ouvert" decided in one zone beside "ferme à 02:00"
  computed in another, and the order was then refused by a mutation reading a
  third.

  `readingFrame` now falls back to `DEFAULT_RESTAURANT_TIMEZONE`, the same
  constant `restaurantClock` uses for the same absence — including for a zone
  `Intl` refuses, which used to drop to the visitor's clock. The visitor's clock
  survives only where even the default cannot be read.

  `store-service.test.ts` now says which clock each case means. Its date literals
  carry no offset, so they are parsed in the environment's zone; a zone-less
  `isStoreOpen` read them on that same clock and the two cancelled, which is what
  made those cases true in any runner. Left bare they would have become cases
  about Paris, so the ones about midnight arithmetic pin the reading frame to the
  zone their own literals are written in, and the ones about zones were already
  explicit.

- Updated dependencies [92dc32f]
  - @be-yours/convex-schema@6.2.0

## 4.1.0

### Minor Changes

- 6d6df2d: Withhold a payment tile the order cannot use, and record a routing refusal

  `isPaymentMethodSelectable` knew whether the establishment offers cards and
  whether it can charge one. It did not know what the order costs — and below a
  provider's floor there is no card payment to be had however well the deployment
  is configured, while at zero there is no payment at all. The tile was offered,
  the diner chose it, and the refusal arrived from inside Stripe as a redacted
  "Server Error" on an order no retry could settle.

  `PaymentMethodContext` gains `amountDue` and `cardMinimum`, both optional so a
  caller that has not priced the basket keeps today's behaviour exactly — greying
  every tile while a delivery quote lands would be worse than the defect. Card and
  PayPal are withheld below the floor; an order that owes nothing is a fourth
  state (`nothingIsDue`) where the cash branch — the one that places the order
  without calling a provider — is offered whatever the cash settings say, so a
  free order does not become uncompletable.

  Alongside it, `assertChargeableOnPlatform` now records its refusal.
  `resolveStripeCharge` throws before any call to Stripe, so the credentials
  verdict `createCheckoutSession` writes on a refused key is never reached —
  correctly, since nothing has asked Stripe anything, but the consequence was that
  a deployment turning every diner away for a routing reason left no trace
  anywhere. It writes a `payment_collection_refused` line through
  `recordRefusedCollection`. `paymentAvailability` already greys the tile from the
  same rule; a new test drives both over every status the schema declares, so the
  two cannot drift.

### Patch Changes

- b9e20ea: Serve no draft dish, route no menu event by guess, and make eleven guards see

  **A public query served unpublished products.** `products.getManyByIds` took an
  array of ids and returned the documents behind them with no filter of any kind:
  no `isActive`, no ceiling on how many ids one call may look up. It is the query
  the favourites grid calls before any sign-in, and ids are not secret — they
  appear in order lines, in favourites and in the storefront's own DOM — so
  anything holding one read the dish behind it whatever its state: name, cost,
  allergens, platform overrides, for a draft or a dish taken off the menu. Every
  other public read of that table already honoured the flag. It now does too, and
  caps the lookup at `MAX_PRODUCT_ID_LOOKUP` so an anonymous caller does not choose
  the read count. Deliberately still cross-store: a deployment is one client's, and
  the favourites grid splits "here" from "your other establishments" on purpose.

  **A Deliveroo menu event could land on a sibling establishment.** The menu path
  matched `site_id` with a bare `.find()` and, when that missed, fell through to
  the BRAND — which covers every location of a chain, so the sync status was
  written to whichever sorted first. The event said "site 42's menu failed
  validation"; the screen said the Boulevard branch's had. `resolveMenuStoreIntegration`
  applies the order path's own refusal policy: a named site's verdict is final,
  and a brand that matches more than one establishment is `ambiguous_store`, which
  is the ordinary shape of a two-location client rather than an edge case.

  **A refused SVG kept its bytes for thirty days.** `cmsMediaConfirmUpload` reads
  an uploaded SVG back, refuses it for active content, and then deleted it with a
  bare `DeleteObjectCommand` — which on the versioned bucket `setup-aws.sh` builds
  writes a delete marker and retains every version. That is the defect #331 removed
  from `cmsMediaDelete.ts` and this path reintroduced, for the one object we have
  decided is hostile. It goes through `purgeS3Objects` now.

  **CMS video uploads landed as `.bin`.** The upload route kept a private
  six-entry MIME-to-extension map while `@be-yours/cms`'s `MIME_TO_EXT` —
  which calls itself the single source of truth, and is what the presigned Convex
  flow uses — held twelve. `ALLOWED_MIME_TYPES.cms` admits mp4, webm and three
  Office formats; all six fell through to `"bin"`.

  **The order-confirmation email printed no timing row, for any order, ever.**
  `timingLine` reads `order.estimatedPrepTime` and `orders.create` wrote the prep
  time it computes onto the kitchen ticket — a different document. `orders.create`
  now stamps the longest line's preparation time on the order as well, off the
  products its verification loop already holds, and stays silent when no dish
  declares one rather than promising "environ 0 minutes".

  **Dead code that contradicted the live product.** `packages/core`'s
  `src/auth/config.ts` is gone, with `createAuthConfig`, `authHooks`,
  `emailTemplates`, `authErrors`, `validatePassword`, `validateEmail`,
  `DEFAULT_SESSION_EXPIRY`, `DEFAULT_SESSION_REFRESH` and `MIN_PASSWORD_LENGTH`:
  zero call sites, and it declared `MIN_PASSWORD_LENGTH = 8` against the live
  `minPasswordLength: 12`, with five lifecycle hooks whose bodies were a
  `console.info` and a list of TODOs over names like "lock the account after N
  attempts". `@be-yours/convex-schema` loses the six printer types that
  outlived the `printerSettings` table — `PrinterType = 'network' | 'usb' |
'bluetooth'`, the ESC/POS transports `CLAUDE.md` records as decided against.
  Both are BREAKING on a published API and neither had a consumer.

  **`@be-yours/admin`** gains `PAYMENT_STATUS_LABELS`, so the payments screen
  stops declaring six operator-facing strings of its own, and the dashboard's
  recent-orders table stops declaring eleven — `lib/vocabulary.ts` claimed "label
  drift is now impossible" while two screens held their own copies.

  **And the guards that could not see what they were written for.** The attribution
  guard missed four shapes `CLAUDE.md` names by hand — a robot-emoji signature, a
  bare "Claude Code" in a body line, "AI-generated", "Made with Claude" — while
  still accepting the collisions that matter here (this product has an AI-generated
  blog; Claude is an ordinary French given name). The swallowed-pipe rule needed
  spaces around the pipe, so `2>&1|tee` walked through it, and never read
  `apps/themes/.github/workflows/`, the CI every client runs. The turbo test inputs
  still hashed `apps/themes`'s `.convex-build/` and `tsconfig.tsbuildinfo`, so a
  local typecheck threw the monorepo's whole test cache away. The Convex manifest
  guard's transcription of `entryPoints()` omitted `looksLikeNestedComponent`, so a
  legal local component would have turned it red. The mirror publisher walked the
  filesystem and shipped untracked files; it now ships what git tracks, minus the
  exclusions, and refuses rather than guessing when git cannot answer. The
  Infisical doc-claim checker knew one phrasing and the document used another, so
  it reported "0 folder claim(s) checked" and exited 0.

- Updated dependencies [7713538]
- Updated dependencies [6d6df2d]
- Updated dependencies [b9e20ea]
- Updated dependencies [6d6df2d]
  - @be-yours/convex-schema@6.0.0
  - @be-yours/core@4.0.0

## 4.0.0

### Major Changes

- e4955e7: Take the dead half of four published packages off the client's API

  The sweep behind #413 counted, rather than guessed, what these packages export
  that nothing imports. Most of it is harmless clutter, and
  `tasks/reference-themes-divergence.md` already ruled on that class: removing a
  name from a published package is "a breaking major that buys nothing but a
  shorter barrel", so twenty consumer-free `packages/ui` components stay. What
  follows is the residue that argument does **not** cover — exports that are
  broken rather than merely unused, and exports left behind by a removal that only
  finished on one side of a package boundary.

  **`@be-yours/ui` shipped a second toast system whose hook could only
  throw.** The product's toasts are `sonner`, mounted in each app's
  `app/providers.tsx` and imported by 129 files. Beside it, `Toast.tsx` held a
  module-private `ToastContext` defaulting to `undefined`, and exported a
  `ToastProvider` that supplied it and a `useToast` that threw `useToast must be used within ToastProvider` when it was
  absent — and `ToastProvider` was mounted in no app, no package and no test. So
  `useToast` was not an export nobody happened to import; it was an export with no
  reachable behaviour except the throw. A probe run before the removal confirmed
  both halves: the hook resolved off the root barrel as a function, and rendering a
  consumer of it raised that exact error. Provider, hook and context are gone. (Only the first two were ever on the
  published API; an earlier draft of this note said all three were.)
  `Toast` — the presentational box, which needs no provider and carries the
  accessible-name test for its dismiss button — deliberately stays, because "a hook
  whose every call throws" and "a component nobody imports" are different claims
  and only the first was acted on. `packages/ui/src/__tests__/one-toast-system.test.ts`
  holds it: the barrel is `export * from "./Toast"`, so anything added to that file
  is republished without a second decision, which is how the provider reached a
  client API in the first place.

  **`@be-yours/marketing` kept the pure half of a mutation #397 removed.**
  That PR deleted `incrementRevenue` from `convex-functions` and left a tombstone
  saying why — nothing writes a `converted` email event and no order carries the
  campaign that led to it, so the attribution behind a "revenu attribué" figure
  does not exist in this schema. `incrementRevenueStat` computed the identical
  `{ revenue + amount, converted + 1 }` shape for that caller, on the far side of a
  package boundary, and was kept alive only by its own two tests. It now carries
  the same tombstone in `stats.ts`. Two siblings in that file,
  `incrementCampaignStats` and `calculateSubscriberMetadata`, are equally
  consumer-free — but they are the barrel-pruning case the divergence doc rules
  against, not the finishing of a removal, so they are recorded here and left
  alone.

  **`@be-yours/restaurant` published five cart selectors nothing selected
  with.** `useCartItems`, `useCartSummary`, `useCartItemCount`, `useCartOrderType`
  and `useCartStoreId` were compiled into `dist` and exported from both the root
  and `./hooks`, with zero references in either app, any package or any test. The
  storefront reaches for `useCartStore` with an inline selector instead — about
  sixty call sites — which is the ordinary Zustand idiom and the reason the
  wrappers never took. `useCart` stays: `packages/mcp-server`'s registry tells a
  client developer to import it, so removing it would break an instruction rather
  than an unused export. `apps/docs` taught `useCartSummary` in two code samples
  and now teaches `getSummary` off the store, which is what the cart page actually
  does.

  **`@be-yours/admin` exported four components no screen mounts.** Two auth
  forms — `ForgotPasswordForm` and `ResetPasswordForm` — which both apps rewrote
  inline from `@be-yours/ui` primitives rather than import, plus a
  `StatusBadge` and a `DateDisplay`. The `StatusBadge` _interface_ in
  `lib/vocabulary.ts` is a different, live thing and is untouched.

  **Two more were deleted and put back, and the reason is worth keeping.**
  `PropagationModal` and `DuplicateCatalogModal` are mounted by nothing either, and
  the first draft of this change removed them on the stated ground that "there is
  no propagation or catalogue-duplication path in `convex-functions` at all". That
  was false, and adversarial review caught it: `products.updateWithPropagation`
  and `products.duplicateCatalog` both exist, are registered as `storeMutation` in
  both apps, are permission-guarded, and are covered by `catalogue-scope.test.ts`
  and `authorization.test.ts`. `PropagationModal`'s
  `onConfirm(scope, targetStoreIds)` is an exact match for
  `updateWithPropagation`'s validator. They are the unmounted UI of a _built_
  feature — multi-store propagation, which is what "1 restaurant owner = 1-∞
  locations" is made of — and that closes by wiring them in, not by deleting them.
  Recorded as the near-miss it was: this repository's own named failure mode is a
  claim nobody checked, and this one would have shipped as the changelog of a
  major bump.

  **`@be-yours/core` carried 466 lines of i18n examples.** Fifteen exported
  `example1_…` through `example15_…` functions, on no barrel, in no `exports` map
  and in no `tsup` entry — so never compiled into `dist`, but shipped in the
  tarball by `"files": ["dist", "src"]`. No supported import path reaches them,
  which is why this is a patch. Two `apps/docs` pages cited the file for a claim
  about the package shipping no JSX; they now make that claim on their own
  authority.

  `@be-yours/mcp-server` is a patch because its registry advertised `Toast` to
  client builds as a "Toast notification system". It is a box, and now says so.

  **One thing this does NOT do, said plainly.** The class (c) sweep in the same
  change removes 71 public _registrations_ from `apps/*/convex` while leaving the
  handler definitions they wrapped exported from `@be-yours/convex-functions`
  — so roughly sixty definitions there now have no registration anywhere. That is
  deliberate, and it is the opposite of what was done to `incrementRevenueStat`
  above, so the difference is worth stating. `incrementRevenue` was removed by
  #397 _with a tombstone explaining that the figure it computed cannot exist in
  this schema_, and the marketing half computed that same impossible figure. These
  definitions compute things that are perfectly possible; they are the
  implementation a restored six-line wrapper would call, which is how a screen
  gets wired to one again. Pruning them is a decision about that package's own
  surface, not a loose end of this one.

### Patch Changes

- e4955e7: Stop the confirmation email rendering from a field no order has ever carried

  `orders.scheduledFor` had no writer. Its only one was `uberEatsOrders.saveFromPlatform`,
  an importer with zero callers deleted with #313, and #363 had already removed the
  sibling `orders.scheduledAt` on an explicit finding — that customer-facing
  scheduled ordering is a capability this product does not have, and
  `orders.create` takes no time argument at all. It took `scheduledAt` and missed
  `scheduledFor`.

  **What made it worth removing rather than recording is that something read it.**
  `timingLine` in the confirmation email opened with `if (input.scheduledFor)` and
  rendered « Prévue pour le 12 mars 2026 à 19:30 ». That branch was written in
  #367, _after_ #363 had ruled the feature unbacked, against a field that was
  already unwritten — so it has never run for any order and never could. The
  field, its Zod line, its three type declarations, the payload mapping and the
  email branch are gone together.

  **A second, live defect was found underneath it, and is deliberately NOT fixed
  here.** `timingLine`'s remaining branch reads `order.estimatedPrepTime`, and
  `orders.create` writes the prep time it computes onto the **kitchen ticket**
  instead — `estimatedPrepTime: summary.estimatedPrepTime`, inside the ticket
  insert. Nothing writes the field the email reads. So the confirmation email
  prints no timing row for any real order and never has: both branches were dead,
  not one. That is a defect in what a customer-facing email says rather than dead
  code, and wiring it is a change with its own review, so it is reported under
  #413 and recorded in `timingLine`'s own docblock instead of being smuggled in
  under a deletion.

  **The tests that covered this were green throughout, and proved nothing.**
  `packages/core`'s `timingLine` cases call it with a `scheduledFor` and an
  `estimatedPrepTime` they supply themselves, so they exercise the rendering and
  say nothing about whether an order can reach it. The one asserting « Prévue pour
  le » is gone with its branch; the two that remain now carry a note saying what
  they do and do not establish.

  `packages/convex-functions/src/__tests__/confirmation-reads-what-orders-write.test.ts`
  asks the question those tests could not: every field the confirmation payload
  reads off an order must be written by some `insert("orders", …)` or order
  `patch`, or be named in an allowlist with its reason. `estimatedPrepTime` is the
  one entry, carrying the defect above. Writing that test surfaced two ways a
  scan like it can lie, both now closed in it: a loose key scan sees `orders.ts`'s
  _kitchen ticket_ literal and reports `estimatedPrepTime` as written — which is
  the very confusion that caused the bug — and a colon-only key regex misses the
  shorthand properties (`orderNumber,`, `viewToken,`) that a third of the orders
  insert uses.

  Two `packages/restaurant` cases ranking a scheduled order's kitchen priority
  went with the field; what they were really pinning — that being a delivery is
  what makes an order urgent — is the pair of cases they sat between. The
  Deliveroo `it.todo` that asked for this field to be written is rewritten rather
  than deleted: the need behind it is real, but it is a **KDS lateness** concern
  (an order an hour overdue looks identical to one placed this second), not a
  diner-facing booking feature, and the todo had gone stale — it still cited
  `scheduledAt`, deleted three PRs earlier, and two line numbers that had moved.

  **Why `@be-yours/core` is a major.** `./aws/ses/order-confirmation` is a
  first-class entry in that package's `exports` map — `convex-functions` and both
  apps import it across the package boundary — and this removes `scheduledFor`
  from the exported `OrderConfirmationInput` interface and drops `timingLine`'s
  second parameter. Either is a compile break for a consumer pinning a version.
  An earlier draft called it a minor, which would have been the same field being
  `major` in `convex-schema` and `minor` in `core` in one changeset.

  **No migration.** The field never had a live writer, so no document should carry
  it; #363 removed `scheduledAt` on the same reasoning with no migration and the
  registry in `convex/migrations/index.ts` is still empty. If some deployment does
  hold a document with the field, Convex refuses the schema push — a loud failure
  at deploy time, not silent data loss.

- Updated dependencies [e4955e7]
- Updated dependencies [038eb9d]
- Updated dependencies [e569498]
- Updated dependencies [bdf8012]
- Updated dependencies [e4955e7]
- Updated dependencies [58f890f]
- Updated dependencies [ecb21a1]
- Updated dependencies [ecb21a1]
  - @be-yours/convex-schema@5.0.0
  - @be-yours/core@3.0.0

## 3.1.0

### Minor Changes

- 16521f2: Fix the diner's broken first-day moments

  Five defects a client meets on their first day of service (#376). Each was
  reproduced with a throwaway probe before being touched, and each leaves a
  permanent test behind in the package that owns the behaviour.

  **1. The storefront had no way to declare an allergy.** The whole pipeline
  existed except the input: `orders.create` takes `notes`, the order carries it,
  `releaseToKitchen` copies it onto the ticket, and the printed slip has a line
  for it. `grep -c notes checkout-form.tsx` answered 0, byte-identically in both
  apps, so the line was forever blank. The checkout now carries an
  « Allergies & instructions » field, capped by `FIELD_LIMITS.orderNote` — read
  from the server, so the input and the mutation cannot disagree. Two things the
  note reached only halfway are fixed with it: the printed slip announced it as
  « Instructions livraison: » even on a dine-in ticket, and the kitchen _screen_
  never showed it at all, so a kitchen working off the display — which is the
  display this product ships — could not see it.

  **2. Product creation dead-ended in silence when « Sélections max » was left
  empty.** `maxSelections` was the one number on the form not wrapped in the
  file's own `optionalNumber` guard, so `valueAsNumber` turned an empty box into
  NaN, zod refused it, react-hook-form blocked the submit of the whole product,
  and nothing on screen said which field was at fault. The schema moved into
  `product-form-schema.ts` so its guards can be parsed rather than only read, the
  field renders its own error, and a sweep asserts every optional number on the
  form survives NaN.

  A second defect sat underneath it: the placeholder promises « Illimité », the
  storefront renders an uncapped checkbox group, and both platform syncs publish
  `choices.length` — while `orderLine.ts` read an absent maximum as **one**, under
  a comment claiming to match the storefront. So a diner who ticked the two sauces
  the menu offered was refused at the moment of payment, by a sentence naming a
  maximum nobody had configured. Absent now means unlimited on all four surfaces.
  The test that blessed the old reading is rewritten and says so.

  **3. The promotion form sold two discount types no order could ever be given.**
  `resolvePromotionDiscount` threw `not_applicable` on `free_product` and `bogo`
  at order time and always had; `promotions.create` stored them happily. An owner
  built a campaign and printed flyers for it. Both are now refused at creation and
  at update, with a `ConvexError` naming what to use instead, and the form takes
  its options from `HONOURABLE_DISCOUNT_TYPES` — the resolver's own list — so
  implementing either type returns the option on the same commit. Rows stored
  before the guard stay listed, deletable, and honest: their value column reads
  « Aucune remise appliquée ». `promotions`' two duplicate-coupon-code refusals
  became `ConvexError`s in the same pass; as plain `Error`s the admin read
  "Server Error" where the French sentence should have been.

  **4. Two badges on French storefront screens spoke hardcoded English.**
  `OrderStatusBadge` and `StoreStatusBadge` held eleven English labels between
  them and took no label from outside, so a diner following their order read
  « Preparing » and « Out for Delivery » between French sentences. The vocabulary
  now lives once in `@be-yours/core/status-labels` — the source-language word
  and the catalogue key, per status — the badges take a `labels` override, and
  `useOrderStatusLabels` / `useStoreStatusLabels` in `@be-yours/restaurant`
  resolve it through `t()` for the locale being rendered. Two further copies of
  the same eight words are gone with it: a private map in the order page and
  `getOrderStatusLabel`'s English map. `order.delivered` was missing from the
  catalogues and is added in fr, en and es.

  **5. The card path could not be turned off.** `payments.cardProvider` was a
  `stripe | sumup` union with no third answer, and the checkout rendered the card
  tile unconditionally — so a cash-only food truck, one of the five verticals this
  engine is sold for, shipped with a pre-selected payment method it could not
  honour. `none` is now a stored value; `cardPaymentAvailability` answers `card`
  and `cardOffered` as two separate questions, because a provider that is merely
  unconfigured owes the diner a greyed tile saying so while an owner who does not
  take cards owes them no tile at all. Réglages → Paiements carries the switch,
  and warns when the last method is turned off.

  The guest dead-end behind it is closed too. Cash requires an account by recorded
  decision, so a cash-only establishment left every guest facing an empty grid
  under a disabled button reading « Choisissez un moyen de paiement ». The
  checkout now says which of the two situations it is and renders the sign-in
  where the diner is blocked. The test that asserted that button is rewritten.

  Closes #376.

### Patch Changes

- Updated dependencies [16521f2]
  - @be-yours/convex-schema@4.1.0
  - @be-yours/core@2.5.0

## 3.0.0

### Major Changes

- 60dbd7d: Let a refused diner read why, and make three checkout guards able to hold

  `orders.create` is sound: it recomputes every price server-side, dedupes on an
  idempotency key, validates availability, options, quantity and scheduling,
  enforces the minimum order and the delivery radius, and gates on the store's
  service switches. What was left is that its refusals could not be read, and that
  three of its guards could never fire.

  **Every checkout refusal reached the diner as "Server Error".** Convex redacts
  the message of a thrown `Error` in production; only `ConvexError` carries its
  `data` to the browser. The repository states the rule itself, at
  `packages/convex-functions/src/auth.ts:45` and again in
  `invitation-acceptance.test.ts` — and the fix had been applied to the
  **authorization** path and never to the customer checkout path:

  ```
  $ grep -c 'throw new LineRejectedError' packages/convex-functions/src/orderLine.ts   -> 8
  $ grep -c 'throw new Error('            packages/convex-functions/src/orders.ts     -> 15
  $ grep -c ConvexError packages/convex-functions/src/orders.ts                       -> 0
  ```

  So eight carefully written French sentences — `« Pizza » est épuisé.`,
  `« Pizza » exige un choix : Taille.`, the minimum order, the delivery radius, a
  service the restaurant does not run — all became two English words at the moment
  of payment. The diner was blocked with no reason and no action, and abandoned.
  It made the whole server-side validation effort invisible.

  New `RefusalError` (`packages/convex-functions/src/refusal.ts`) extends
  `ConvexError<{ code, message, … }>` — the flat payload `auth.ts` established and
  `lib/convex-error.ts` already reads in both apps. `LineRejectedError`,
  `OrderZoneRejectedError`, `QuoteRejectedError`, `PromotionRejectedError`,
  `FieldTooLongError` and `RateLimitedError` extend it, so every existing throw
  site and every `instanceof` catch is unchanged and the payload now survives the
  wire. `ConvexError` overwrites `message` with the JSON of `data`; the base
  restores the sentence, because a good deal of the storefront and of the suite
  reads `error.message`. Ten plain throws in `orders.ts` became a new
  `OrderRefusedError`, and the checkout page reads `convexErrorMessage(error, …)`
  instead of `error.message`.

  Three of those messages were in **English** — "This store is not open for
  orders", "This store is not accepting orders right now", "This store does not
  offer delivery orders" — the only English copy a diner could be shown on this
  path. They are French now, like the rest of the storefront.

  **Tracked stock was never decremented by an order.**

  ```
  PROBE: stock before = {"tracked":true,"quantity":2}
  PROBE: order 1 -> stock {"tracked":true,"quantity":2}
  PROBE: order 2 -> stock {"tracked":true,"quantity":2}
  PROBE: 4 portions sold out of a tracked stock of 2
  ```

  The `insufficient_stock` guard and its message are correct, and could only ever
  fire if the owner retyped the quantity in the dashboard after every single
  order. A restaurant tracking ten portions of the daily special sold fifty and
  found out in the kitchen. `autoDisableWhenEmpty` hung off the same manual
  `updateStock` mutation, so a dish that ran out never came off the menu on its
  own either.

  `orders.create` now sells the stock the order takes, in the same mutation as the
  order and its kitchen ticket — one transaction, so two checkouts racing for the
  last portion are serialised by the same read-write conflict that protects the
  promotion counter. The auto-disable rule moved out of `updateStock`'s handler
  into a pure `stockPatch`, shared by both callers. A basket is counted as a
  basket: two lines of the same dish were each checked against the stored
  quantity, so a stock of 3 accepted 2 + 2.

  **Opening hours were enforced in the browser only.**

  ```
  PROBE: every day marked isClosed -> order created
  PROBE: 04:00 order accepted (hours 11:00-14:00)
  ```

  `isOrderableStore` returns `store?.status === "open"` and its own comment
  concedes that hours are "a separate question, answered in the storefront".
  Nothing flips `status` on a schedule — there is no such cron — so the weekly week
  the dashboard writes was honoured by exactly one thing: a `toast.error` on the
  checkout page. A tab left open past closing, a cart restored from localStorage
  or a direct call produced a paid order and a kitchen ticket at 4 a.m. in an
  empty building. The hole had been closed one level up for the manual `closed`
  status and left open for the weekly schedule, which is the one restaurants
  actually rely on.

  New `isWithinBusinessHours` and `resolveStoreHours` in
  `@be-yours/convex-schema` — the only package `convex-functions` and
  `restaurant` can both import, which is why `storeStatus` and `storeServices` are
  there already. `orders.create` refuses an order outside the resolved week, on the
  establishment's clock and honouring `useGlobalHours`; `isStoreOpen` and
  `useStoreStatus` delegate their boolean to the same function, so the button the
  storefront disables and the order the mutation refuses cannot drift apart. An
  empty week is not a closure — `stores.create` seeds a full one, so an empty array
  means nobody declared anything, and `status` decides as it always has.

  **The menu and the order mutation disagreed about scheduling windows.**

  ```
  PROBE @23:00  client(menu) = false  server(order) = true
  PROBE @01:00  client(menu) = false  server(order) = true
  PROBE tz      client = true (UTC)   server = false (Europe/Paris)
  ```

  The server handled midnight-crossing windows and took a timezone;
  `isProductScheduledNow` did neither — `now.getDay()` / `now.getHours()` on the
  visitor's own clock, and `currentTime > availableUntil` reading a 22:00→02:00
  late menu as an empty set. Two opposite failures out of one seam: the late menu
  was greyed out for every hour it was actually served, and a diner in another
  timezone saw a dish, added it, and was refused at payment — with the unreadable
  error above. `timeWindow` moved to `@be-yours/convex-schema` and
  `isProductScheduledNow` renders from it; `isProductAvailable`, the product card,
  the grid, the menu and the favourites grid all take the establishment's
  timezone, which `useStoreStatus` now returns.

  **`/cart` showed "Votre Box est vide" before the persisted cart hydrated.**
  `useCartHydrated` exists for exactly this and documents the failure mode; it had
  been applied to `/checkout`, twice, and to neither read in `CartContent`. A diner
  who reloaded or arrived from a bookmark got a full-screen dead-end hero on first
  paint.

  **Four things adversarial verification of the above turned up, all fixed here.**

  Two were regressions this change introduced. `isOvernight` compared the raw
  `"HH:MM"` strings while `parseClockTime` accepts `H:MM`, so the two disagreed
  about what a time is — in both directions. `"17:00" <= "9:00"` is
  lexicographically true, so a 9-to-5 bakery written `9:00` read as an overnight
  service and took orders at four in the morning; `"2:00" <= "18:00"` is false, so
  a food truck written `18:00 – 2:00` read as a window no minute is inside and
  could not sell at any hour of its own service. Both functions compare parsed
  minutes now, and an unreadable time closes the shop rather than waving an order
  through — the same call `storeStatus` makes next door, where forgetting hides a
  restaurant rather than letting one take orders it cannot honour. `isStoreOpen`
  also reported "open, no current service, opens again in two hours" when the two
  reading frames fell back differently on a timezone `Intl` rejects; it asks
  `isWithinBusinessHoursAt` about its own clock now. The rule is shared, the clock
  is each caller's.

  Two were consequences of selling stock for the first time. A cancelled order
  gave nothing back — a restaurant that cancelled three orders was left showing
  three portions it still had, with the dish possibly off the menu and a full tray
  behind the counter — so `updateStatus` returns what the order took, once, which
  `cancelled` being terminal is what makes safe. And the sale told the delivery
  platforms nothing: `stock.quantity` is what suspends an item on Uber Eats and
  builds the Deliveroo availability delta, the Inventaire screen has booked that
  push on every manual edit since the beginning, and there is no sweep to catch a
  missed one. Both apps' `products.ts` and `menus.ts` carried their own copy of
  `scheduleMenuSync`; it is one module now, and the order path is its third
  caller.

  One more, on the same path and the same shape: `/checkout/success` rendered
  `error.message` from the payment-verification actions straight onto the screen a
  diner sees _after_ being charged — `[CONVEX A(stripe:verifyCheckoutSession)]
Server Error`. `SettlementRejectedError` joins the family, so the sentence that
  says a payment does not settle this order arrives intact.

  Held by tests that stay: `openingHours.test.ts` and the cross-checked window
  cases in `product-service.test.ts` for the rules, `refusal.test.ts` (including a
  `convexToJson`/`jsonToConvex` round trip of every payload) and `stockPatch.test.ts`
  for the pieces, and `checkout-refusals.test.ts`, `order-opening-hours.test.ts`
  and `cart-hydration.test.ts` in both apps for the wiring — including the
  restock, the platform push, and the two malformed-hour outages above. Assertions that matched
  a thrown English message now match `data.code`: the copy is French and gets
  edited, the code is the contract.

### Minor Changes

- 4e625bd: Let a diner change their mind about how to pay, and stop offering them a card nobody can charge

  **A failed card attempt retried as cash stranded the order for good (#374).**
  `orders.create`'s idempotent branch reused the existing order on the same
  attempt key and ignored that the retry carried a different `paymentMethod`.
  Measured end state on a live bench, after the exact journey a fresh deployment
  invites — card pre-selected, no card provider configured, retry as Espèces:

  ```
  paymentMethod:"card" | paymentStatus:"pending" | status:"confirmed" | tableNumber:"12"
  kitchenTickets: empty
  ```

  Every unit suite was green the whole time. Each piece was correct in
  isolation: idempotence refused a duplicate order (#161), `releaseToKitchen`
  refused an unpaid card order (anti-abandon, #136), and « Encaisser en
  espèces » only shows for cash orders. Composed, they made a confirmed,
  accepted order that no button anywhere could settle or cook, while the diner
  sat at table 12.

  The idempotent hit now patches the reused order's method when the retry
  differs AND the payment is still `pending` — the diner's last confirmed
  choice is the truth — and `createWithTicket`'s release call re-applies the
  method-dependent release rule, so the switched-to-cash order reaches the pass
  the way a cash-first order always did. Two boundaries hold it, both demanded
  by adversarial review: an order whose payment has progressed past pending is
  never re-methoded (the stored method describes what actually happened), and
  neither is an order the kitchen has already been fed — a stale tab retrying a
  released cash order as card would have rebuilt the same strand in the other
  direction. Idempotence itself is untouched — one order, ever.

  **Defence in depth: the checkout no longer pre-selects a tile the deployment
  cannot serve.** `payments.cardProvider` declares WHICH provider, never
  WHETHER it works, and the signal that decides — the Stripe platform key, the
  SumUp connection row — never reached the storefront. So `useState("card")`
  landed every diner on the dead tile, and a second inline fallback resolved to
  card too. Both rules moved into one pure `resolvePaymentMethod`
  (`@be-yours/restaurant`), fed by a new `paymentAvailability.get` query
  (def in `@be-yours/convex-functions/globalSettings`, mounted by both
  apps) that answers a single boolean and mirrors exactly the checks the
  charge-starting actions make — including `getSiteEnv()`'s `sk_` validation,
  so a pasted publishable key reads as unavailable instead of arming a tile in
  front of a redacted crash. Card unavailable: the tile renders disabled with
  « Indisponible pour le moment », the diner lands on the first servable tile,
  and a deployment that can serve nothing disables submit instead of sending a
  doomed attempt.

  **And when a card attempt still fails because nothing is configured, the
  diner is told that.** The provider actions threw plain `Error`s
  ("STRIPE_SECRET_KEY is not configured", "SumUp is not connected"), which
  production redacts to "Server Error" — so the checkout showed its generic
  retry toast for a payment that could never work, on the very tile it had
  pre-selected. New `CardPaymentUnavailableError` in
  `@be-yours/convex-functions/refusal` joins the `RefusalError` family:
  « Le paiement par carte est indisponible pour le moment. Choisissez un autre
  moyen de paiement. » crosses the wire like every other checkout refusal. The
  staff-facing paths (verify, refund, reconcile) keep their plain errors — their
  reader is a log, not a diner.

  Held by tests that cross the seam the green suites never did:
  `orders.test.ts` replays the card-then-cash retry against
  `createWithTicket` and pins the never-past-pending guard;
  `order-lifecycle.test.ts` in both apps drives the full journey through the
  real schema to `markCashPaid` and exactly one ticket;
  `checkout-refusals.test.ts` in both apps proves the refusal reaches the
  browser readable; `payment-method-selection.test.ts` pins the no-preselect
  rule; and `checkout-payment-preselect.test.tsx` in both apps mounts the real
  form and pins the wiring.

### Patch Changes

- Updated dependencies [60dbd7d]
- Updated dependencies [c9619e2]
- Updated dependencies [bd7a656]
- Updated dependencies [91d388a]
- Updated dependencies [009af63]
- Updated dependencies [ab869a8]
- Updated dependencies [cde4410]
- Updated dependencies [91d388a]
- Updated dependencies [bd17a78]
  - @be-yours/convex-schema@4.0.0
  - @be-yours/core@2.4.0

## 2.1.0

### Minor Changes

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

- e7c6f36: A service that crosses midnight is open.

  `isStoreOpen` compared `"HH:mm"` strings with no wrap: `now >= open && now <
close`. For an 18:00–02:00 restaurant that is false at 23:00 (`"23:00" <
"02:00"`) and false at 01:00 (`"01:00" >= "18:00"`), so it read as closed all
  evening, every evening. `09:00–00:00` read as closed at every hour of the day.
  The boolean disables add-to-cart on every product card and blocks checkout, so
  the shipped `fast-food-minuit` vertical and the food-truck templates could not
  take a single order.

  `close <= open` now means the service ends on the next calendar day, and the
  _previous_ day's row is read first: at 01:00 on Saturday the service still
  running was declared on Friday. Saturday's own row cannot answer for it —
  Saturday opens at 18:00, and Saturday may be closed altogether.

  `nextChange` follows: a service that opened at 18:00 closes at 02:00 tomorrow,
  not at 02:00 today.

  Neither hours editor gained a `close > open` check. Typing 02:00 into a closing
  field is a legitimate thing for an owner to do; the reading was wrong, not the
  writing.

### Patch Changes

- Updated dependencies [a561c61]
- Updated dependencies [ebdda7e]
- Updated dependencies [7ae8072]
- Updated dependencies [aa2880f]
- Updated dependencies [629e88e]
- Updated dependencies [74de4e9]
  - @be-yours/convex-schema@3.0.0
  - @be-yours/core@2.3.0

## 2.0.3

### Patch Changes

- 83f6af9: Enforce the order status machine in `updateStatus`.

  The mutation wrote whatever status it was handed. Nothing stopped an order going from `pending` straight to `completed`, or a cancelled order being revived — the transition table existed but only the storefront services consulted it, as advice.

  Three layers each carried their own opinion and they had drifted. The admin UI offered "Envoyer en livraison" on a ready order while the services table forbade `ready -> out_for_delivery`. The table is now single and lives in `@be-yours/convex-schema` (`ORDER_STATUS_TRANSITIONS`, `canTransitionOrderStatus`, `getNextOrderStatuses`); the services and the mutation both read it, and `ready -> out_for_delivery` is allowed, matching the button that already existed.

  **Behaviour change:** `updateStatus` now throws `Invalid order status transition: <from> -> <to>` instead of writing. Replaying the current status is an idempotent no-op rather than an error, so webhook retries and double-clicked buttons stay harmless. `updateFromWebhook` is deliberately left unguarded — Uber Eats and Deliveroo are authoritative for the orders they own.

  The cancellation window stops at `confirmed`, matching what Deliveroo permits: an order already being prepared, ready, or with a rider can no longer be cancelled internally.

- c1af162: Ship the `./stores`, `./services` and `./hooks` subpaths the package already declared. The build only bundled `src/index.ts`, so those three `exports` entries pointed at files that never existed — in the workspace and in the published tarball alike. Any consumer following the documented import paths (`import { useCartStore } from '@be-yours/restaurant/stores'`) hit a resolution error.

  The store state and action types (`CartState`, `CartActions`, `CartStore`, and their `Store`/`UI`/`Language` counterparts) are now exported too. They were internal, which made the inferred store types unnameable: `export const cart = useCartStore` failed with TS4023 in a consumer.

  Code splitting is enabled so the Zustand stores stay singletons across entry points — importing `useCartStore` from the root and from `./stores` returns the same store, not two carts.

- Updated dependencies [5eec48d]
- Updated dependencies [83f6af9]
  - @be-yours/convex-schema@2.1.0

## 2.0.2

### Patch Changes

- 7f0122b: Republished from main. Fixes two problems with the 2.0.1 tarballs that broke consumers:

  - `@be-yours/core`: the `./auth/rbac` subpath pointed at `src/auth/rbac.ts` while the tarball only ships `dist/` → broken import for consumers (`convex-functions/auth` included). `files` now includes `src`.
  - The type fixes that were on main but never published (promotion-form/email-config in admin, Uber Eats signatures in integrations/convex-functions) go out with this patch — they had been committed without a changeset.

- Updated dependencies [7f0122b]
  - @be-yours/convex-schema@2.0.2
  - @be-yours/core@2.0.2

## 2.0.1

### Patch Changes

- 1a5ca27: Rename package scope from @beindigital-engine to @be-yours for GitHub Packages compatibility
- Updated dependencies [321adad]
- Updated dependencies [1a5ca27]
  - @be-yours/convex-schema@2.0.1
  - @be-yours/core@2.0.1

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
  pnpm add @be-yours/core @be-yours/ui @be-yours/restaurant
  ```

### Patch Changes

- Updated dependencies [7c3d4da]
  - @be-yours/convex-schema@2.0.0
  - @be-yours/core@2.0.0

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
  pnpm add @be-yours/core @be-yours/ui @be-yours/restaurant
  ```

### Patch Changes

- Updated dependencies [ad4d8d2]
  - @be-yours/convex-schema@1.0.0
  - @be-yours/core@1.0.0
