# @be-in-digital/restaurant

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

  **`@be-in-digital/ui` shipped a second toast system whose hook could only
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

  **`@be-in-digital/marketing` kept the pure half of a mutation #397 removed.**
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

  **`@be-in-digital/restaurant` published five cart selectors nothing selected
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

  **`@be-in-digital/admin` exported four components no screen mounts.** Two auth
  forms — `ForgotPasswordForm` and `ResetPasswordForm` — which both apps rewrote
  inline from `@be-in-digital/ui` primitives rather than import, plus a
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

  **`@be-in-digital/core` carried 466 lines of i18n examples.** Fifteen exported
  `example1_…` through `example15_…` functions, on no barrel, in no `exports` map
  and in no `tsup` entry — so never compiled into `dist`, but shipped in the
  tarball by `"files": ["dist", "src"]`. No supported import path reaches them,
  which is why this is a patch. Two `apps/docs` pages cited the file for a claim
  about the package shipping no JSX; they now make that claim on their own
  authority.

  `@be-in-digital/mcp-server` is a patch because its registry advertised `Toast` to
  client builds as a "Toast notification system". It is a box, and now says so.

  **One thing this does NOT do, said plainly.** The class (c) sweep in the same
  change removes 71 public _registrations_ from `apps/*/convex` while leaving the
  handler definitions they wrapped exported from `@be-in-digital/convex-functions`
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

  **Why `@be-in-digital/core` is a major.** `./aws/ses/order-confirmation` is a
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
  - @be-in-digital/convex-schema@5.0.0
  - @be-in-digital/core@3.0.0

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
  now lives once in `@be-in-digital/core/status-labels` — the source-language word
  and the catalogue key, per status — the badges take a `labels` override, and
  `useOrderStatusLabels` / `useStoreStatusLabels` in `@be-in-digital/restaurant`
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
  - @be-in-digital/convex-schema@4.1.0
  - @be-in-digital/core@2.5.0

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
  `@be-in-digital/convex-schema` — the only package `convex-functions` and
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
  error above. `timeWindow` moved to `@be-in-digital/convex-schema` and
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
  (`@be-in-digital/restaurant`), fed by a new `paymentAvailability.get` query
  (def in `@be-in-digital/convex-functions/globalSettings`, mounted by both
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
  `@be-in-digital/convex-functions/refusal` joins the `RefusalError` family:
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
  - @be-in-digital/convex-schema@4.0.0
  - @be-in-digital/core@2.4.0

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
  - @be-in-digital/convex-schema@3.0.0
  - @be-in-digital/core@2.3.0

## 2.0.3

### Patch Changes

- 83f6af9: Enforce the order status machine in `updateStatus`.

  The mutation wrote whatever status it was handed. Nothing stopped an order going from `pending` straight to `completed`, or a cancelled order being revived — the transition table existed but only the storefront services consulted it, as advice.

  Three layers each carried their own opinion and they had drifted. The admin UI offered "Envoyer en livraison" on a ready order while the services table forbade `ready -> out_for_delivery`. The table is now single and lives in `@be-in-digital/convex-schema` (`ORDER_STATUS_TRANSITIONS`, `canTransitionOrderStatus`, `getNextOrderStatuses`); the services and the mutation both read it, and `ready -> out_for_delivery` is allowed, matching the button that already existed.

  **Behaviour change:** `updateStatus` now throws `Invalid order status transition: <from> -> <to>` instead of writing. Replaying the current status is an idempotent no-op rather than an error, so webhook retries and double-clicked buttons stay harmless. `updateFromWebhook` is deliberately left unguarded — Uber Eats and Deliveroo are authoritative for the orders they own.

  The cancellation window stops at `confirmed`, matching what Deliveroo permits: an order already being prepared, ready, or with a rider can no longer be cancelled internally.

- c1af162: Ship the `./stores`, `./services` and `./hooks` subpaths the package already declared. The build only bundled `src/index.ts`, so those three `exports` entries pointed at files that never existed — in the workspace and in the published tarball alike. Any consumer following the documented import paths (`import { useCartStore } from '@be-in-digital/restaurant/stores'`) hit a resolution error.

  The store state and action types (`CartState`, `CartActions`, `CartStore`, and their `Store`/`UI`/`Language` counterparts) are now exported too. They were internal, which made the inferred store types unnameable: `export const cart = useCartStore` failed with TS4023 in a consumer.

  Code splitting is enabled so the Zustand stores stay singletons across entry points — importing `useCartStore` from the root and from `./stores` returns the same store, not two carts.

- Updated dependencies [5eec48d]
- Updated dependencies [83f6af9]
  - @be-in-digital/convex-schema@2.1.0

## 2.0.2

### Patch Changes

- 7f0122b: Republished from main. Fixes two problems with the 2.0.1 tarballs that broke consumers:
  - `@be-in-digital/core`: the `./auth/rbac` subpath pointed at `src/auth/rbac.ts` while the tarball only ships `dist/` → broken import for consumers (`convex-functions/auth` included). `files` now includes `src`.
  - The type fixes that were on main but never published (promotion-form/email-config in admin, Uber Eats signatures in integrations/convex-functions) go out with this patch — they had been committed without a changeset.

- Updated dependencies [7f0122b]
  - @be-in-digital/convex-schema@2.0.2
  - @be-in-digital/core@2.0.2

## 2.0.1

### Patch Changes

- 1a5ca27: Rename package scope from @beindigital-engine to @be-in-digital for GitHub Packages compatibility
- Updated dependencies [321adad]
- Updated dependencies [1a5ca27]
  - @be-in-digital/convex-schema@2.0.1
  - @be-in-digital/core@2.0.1

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
