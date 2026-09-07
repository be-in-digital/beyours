# Changelog

## 5.0.0

### Major Changes

- 895d200: Bound the four queries that grow with the mailing list and the order book

  **Convex refuses a transaction that reads more than 16,384 documents, and each
  of these was a live `useQuery`.** They do not degrade: at the row count where a
  restaurant's mailing list or order book has become worth having, the screen
  behind them throws on every load, permanently, and no admin action clears it.
  #316 made every storefront signup, order and game play add a subscriber, so the
  list grows on its own. Measured on the read-counting double:

  ```
                                          20,000 rows     before -> after
  PROBE emailSubscribers.list             subscribers     20,000 ->     15
  PROBE emailSubscribers.countByStatus    subscribers     20,000 -> 10,005
  PROBE emailSegments.countMatching…      subscribers      4,000 ->  2,001
  PROBE products.getTrending              orders          20,008 ->  1,008
  ```

  (`countByStatus` reads five index ranges of 2,000 rather than one table of
  20,000, and the segment preview's 4,000 is the active fifth of that seed — both
  were already past the ceiling on a list two or three times this size, which is
  one good year.) `dueForSending` is not in the table because the double cannot
  show its defect: a Convex `.filter` reads every row it rejects, and the double
  applies the predicate before counting. On the real backend the sweep read every
  campaign the establishment had ever written, once a minute, to find the almost
  always empty set of due ones.

  **The audience page reads a page.** `emailSubscribers.list` takes
  `paginationOpts` and resolves the status tab through `by_storeId_status`; the
  page is clamped to `MAX_PAGE_SIZE`, so `{ numItems: 1_000_000 }` from anyone
  holding `marketing:read` cannot reinstate the transaction the pagination
  prevents. `source` is gone from its arguments: no index carries it, and
  filtering after `.paginate()` returns two rows out of fifteen and calls it a
  page. The screen narrows source and search over the rows it has loaded and says
  so in the placeholder and the empty state, and « Charger plus » widens what they
  can see — the shape `/dashboard/orders` already uses.

  **The counts are counted, not downloaded.** Convex has no count, so a total is
  however many documents you were willing to read: `countByStatus` walks one
  `by_storeId_status` range per status, stopped at `SUBSCRIBER_COUNT_SCAN_LIMIT`,
  and `countMatchingSubscribers` reads at most `SEGMENT_PREVIEW_SCAN_LIMIT` active
  subscribers before applying rules that no index can answer. Both report whether
  they were capped: the dashboard renders « 2 000+ » and the segment dialog says
  which population its count describes, rather than presenting a floor as a total.
  `countMatchingSubscribers` now returns `{ count, scanned, truncated }` — a bare
  number could not say which of the two it was.

  **The homepage carousel ranks a window.** `products.getTrending` is the public
  storefront's own subscription, one per open tab, re-run on every new order, and
  it collected a month of orders to return three products. It now reads the
  `TRENDING_ORDER_SCAN_LIMIT` most recent orders of the window, newest first — so
  what the cap drops is the far end of the month, not this week — with a separate
  budget for the product lookups a reworked catalogue can otherwise stretch, and a
  clamped `limit`, because a public query is handed whatever a visitor sends.

  **And the cron stops scanning the archive every minute.** `dueForSending`'s
  docblock described an indexed per-store walk; what shipped was
  `.filter(q => q.eq(q.field("status"), "scheduled")).collect()`, and a Convex
  `.filter` narrows rows the database has already read. It walks
  `by_storeId_status` per establishment now, which is what the paragraph always
  claimed.

  **`incrementRevenue` is removed, and the dialog stops reporting a zero it cannot
  stand behind.** It had zero call sites, and nothing produces the figures it
  patched: no path writes a `converted` email event, and no order records the
  campaign that led to it. The campaign stats dialog rendered a hard « 0,00 € »
  and « 0 conversions » beside real send and open counts, for every campaign, for
  ever, and an owner reading it concluded their mailing sold nothing. Both tiles
  now say « Non suivi » with the reason underneath. `stats.converted` and
  `stats.revenue` stay in the schema, so wiring a real producer later is a
  producer, not a migration.

  Probes: 15 read-count cases in `queryBounds.test.ts`, seeding 20,000 rows — more
  than Convex will read in one transaction — and asserting the number of documents
  the query asks for rather than the answer it returns, because an answer is right
  on ten rows and right again on ten million. Two of them assert the count does
  not move at all as the table grows. The index-faithful double refuses an index
  the schema does not declare and an equality off the index prefix, so "narrow it
  in JavaScript instead" cannot pass either. 8 companion cases in each app's
  `query-bounds.test.ts` run the same paths through the real schema and the real
  auth wrappers, and `dueForSending`'s own tests moved off a hand-rolled `db` that
  answered `.filter().collect()` with the rows the test wanted — it could not tell
  the indexed walk from the table scan it replaced, and was green for the whole
  time that scan was shipping.

  Closes #327.

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

- cdc6c81: Stop one order being collected twice, in cash and by card

  **A live Stripe session settled an order the counter had already taken in cash
  (#378).** Reproduced end to end, not read: the diner submits with card, presses
  Back and confirms « Espèces » on the same checkout attempt — since #374 the
  reused order is re-methoded to cash, which is the point of that fix — staff take
  the notes, and the Stripe session left behind the tab stays payable for ~24 h.
  Completing it collected the same meal a second time:

  ```
  PROBE payments: [
   { "provider": "cash",   "amount": 1200, "status": "succeeded" },
   { "provider": "stripe", "amount": 1200, "status": "succeeded" }
  ]
  PROBE order total: 1200 collected: 2400
  ```

  Nothing refused it and nothing flagged it. Each piece was right on its own.
  `assertSettlesOrder` binds identity, currency and amount — and all three match,
  because it genuinely is this order at this total. `paymentStatusAfterSettlement`
  answers `null` for an order already paid, so the order looked untouched.
  `settlePayment` deduplicates on `externalId`, and a cash row carries none, so
  the two could never collide. The order read « Payé » while both rows sat there
  independently refundable.

  **The guard grows a fourth check.** `OrderToSettle` now carries the order's
  `paymentMethod` and `paymentStatus`, and `assertSettlesOrder` refuses a
  settlement whose provider is not the method the order was collected through —
  new reason `method_mismatch`. It is deliberately about the method in force at
  settlement time, not about ordering: the check needs money to have _already_
  moved, so a card payment arriving first settles exactly as it always did, a
  replayed webhook on the order it itself paid still passes (throwing there is a
  500 answered with three days of Stripe retries), and an order carrying no method
  — every Uber Eats and Deliveroo order — is waved through rather than refused on
  evidence the guard does not have.

  **And the ledger states the same rule where it cannot be stepped around.**
  `settlePayment` refuses to insert a second `succeeded` row for an order another
  provider already holds money for. Five call sites remember to ask the guard; the
  sixth written next year would not have to.

  **The real fix is that the second charge is never taken.** A refusal happens
  after the diner's card has been debited. So the session is expired at the moment
  the order stops being a card order: `abandonedCheckoutSession` hands the id to
  `orders.create`'s wrapper, which schedules `stripe.expireCheckoutSession`. The
  id stays _on_ the order deliberately — it is the only pointer
  `reconcilePendingCheckouts` has, and the one case where the expiry fails is a
  session Stripe refuses to expire because it has already been paid, which is
  exactly when that pointer is what recovers the money.

  Probes, each proven red against the code it fixes: the cash-then-card replay
  ends with one `succeeded` row and the second refused; the guard-skipped call
  into `settlePayment` is refused too. Four companion probes prove the guard
  cannot be satisfied by refusing everything — a card payment arriving first, a
  replayed Stripe delivery, either card provider on a card order, and a
  cash-labelled order nothing has collected yet all still settle. 16 new cases
  across `paymentSettlement.test.ts` and both apps' `payment-dedup.test.ts`.

  Closes #378.

### Patch Changes

- Updated dependencies [16521f2]
  - @be-in-digital/convex-schema@4.1.0
  - @be-in-digital/core@2.5.0

## 4.0.0

### Major Changes

- dc26361: Serve the blog somebody actually wrote, and run Auto Blog on the schedule it is sold on

  Three things met in the same feature: a public blog wired to a fixture, a
  subscription with no scheduler, and a generation path that authorised the wrong
  thing and counted the cost too late.

  **The public blog showed six of somebody else's articles.** `BLOG_POSTS` was a
  hard-coded array — Unsplash photography, dates in the future — repeated across
  three storefront surfaces in each app, and every card linked to `/blog/${slug}`
  on a route that did not exist. Twelve dead links on every client site. Meanwhile
  `listPublishedArticles` had been written, exported, and never called by anything.

  `/blog`, the menu teaser and the homepage teaser now read
  `api.blog.listPublishedArticles`, and `app/(storefront)/blog/[slug]/page.tsx`
  exists: a server component, because a blog earns its keep in search results and
  `generateMetadata` cannot run in a client one. It resolves the article through
  `getArticleBySlug`, answers `notFound()` for a draft or an unknown slug, and
  sanitises the stored HTML at the render. Server-side store resolution is new —
  `resolveStorefrontStore` reads the `storeSlug` cookie and otherwise falls back to
  the first published establishment, which is the same answer the browser's
  `useStoreId` settles on, so a crawler arriving without a cookie reads what a
  visitor reads. `listPublishedArticles` and `getArticleBySlug` now return
  `readingMinutes`, computed from the stored markup, because the card design has
  always shown a reading time and only the fixture ever had one.

  **Auto Blog had no scheduler at all.** `blogAutoConfig` stored a frequency,
  weekdays, an hour, a timezone and an approval mode; `blogAutoQueue` carried an
  index whose own comment read "Cron: find pending jobs due for execution"; `grep
cronJobs` across both apps returned nothing. An owner who configured "weekly,
  Tuesday, 09:00, auto-publish" and saved got an article only by pressing the
  button themselves.

  Both crons from `tasks/auto-blog-spec.md` §4.2 now exist: `plan auto blog jobs`
  hourly, which asks each enabled configuration whether this is its hour in its own
  timezone and writes a queue row if it is, and `execute auto blog queue` every ten
  minutes, which generates what was queued. Planning is separate from generating so
  that a generation dying half way leaves a row saying so rather than an hour of
  silence. The scheduling rule is pure and tested against a clock rather than a
  database: local wall-clock time via `Intl`, so 09:00 stays 09:00 across a
  summer-time shift; one slot key per store per hour, so a retried or overlapping
  sweep cannot queue the same slot twice; and themes rotate by date, so an owner
  with three of them sees all three.

  **`approvalMode` was validated and then read by nobody** — every generated
  article was saved as a draft, whatever the owner had configured and paid for. It
  is honoured now, and re-checked against `entitlements.autoBlog.allowAutoPublish`
  at execution time rather than trusted from the config row, because a
  subscription can be downgraded after the row was written. An article the model
  produced without a cover image still stays a draft: `publishArticleCore` requires
  one, and failing the whole generation over it would throw away work already paid
  for.

  **The quota was checked, then charged after the OpenAI call.** Measured: ten
  concurrent requests against a quota of two produced ten articles, every one of
  them billed. Nothing about the check was wrong — the several-minute gap after it
  was. `reserveArticleQuota` and `reserveImageQuota` read and write in one Convex
  mutation, before the first paid call, and the caller releases on failure so a
  generation that produced nothing costs no slot. The article pipeline's own image
  generations — up to four `gpt-image-1` calls each — were free of the image quota
  entirely; they are charged now, and running out of images skips the image rather
  than failing the article.

  **The generation actions never authorised their `storeId`.** `_checkAccess` took
  an `ownerId` and nothing else, so any account holding an Auto Blog plan could
  generate into any establishment in the deployment — and the `@guarded-inline`
  marker above the action asserted this check covered the store, which is what kept
  the linter quiet about it. Both `generateArticle` and `generateImage` now
  authorise `content:write` on the store they are given and derive the owner from
  the session. The Enterprise multi-language gate, previously a disabled `<Switch>`
  and nothing else, is enforced on the server.

  **Article HTML is sanitised on write.** Only the AI path was cleaned; the
  editor's own output went into the database verbatim and out to the public site
  unchanged, which mattered the moment the blog stopped rendering a fixture. One
  allow-list now serves all three writers — `saveDraftCore`, `publishArticleCore`
  and `saveGeneratedArticleCore` — and the public renderer sanitises again, for the
  rows written before it existed.

  **Image-to-Product had the same quota defect, and was not on the card.** It
  checked the analysis quota, made three OpenAI requests — a vision pass, an
  enrichment pass and up to several image generations — and incremented the
  counter seventy-five lines later. It now reserves through the same primitive and
  releases on failure. Reported rather than left, because it is the same hole and
  it spends the same money.

  **`prose` was a class nothing defined.** `@tailwindcss/typography` was never
  installed, so the blog preview's `prose prose-lg dark:prose-invert` container
  produced no CSS at all: an article's `<h2>`, `<p>` and `<ul>` came out with
  Tailwind's preflight reset still on them — no margins, no heading sizes, no
  bullets — and read as one wall of text. The public article page renders the same
  stored markup, so the plugin is installed and loaded rather than a second set of
  hand-written rules being added beside it.

  **Reading time is computed by a scan, not a regular expression.**
  `/<[^>]*>/g` looks linear and is not: given markup with many `<` and no `>`, the
  engine restarts at each one and the cost becomes quadratic — measured at 15
  seconds, inside `listPublishedArticles`, which is the query behind every render
  of `/blog`. It is one pass over the characters now, and bounded at 200 kB.

  An adversarial pass over the above found five more, all fixed here. The
  `storeSlug` cookie had **three server-side readers and no writer anywhere in the
  repository**, so a server render always fell back to the first published
  establishment while the browser resolved its own from localStorage or
  geolocation: on a multi-store deployment the blog listed one store's articles
  and linked to slugs the server looked for in another — the same dead links,
  reintroduced. `useStoreId` now writes the cookie, and the article route falls
  back to the deployment's other published establishments, because an article
  belongs to the brand rather than to a branch. Configurations saved in the
  deprecated `preferredWeekday`/`preferredMonthDay` shape were **silently never
  due** — not queued, not skipped, not reported. A stale-executor recovery put the
  job back without giving the reserved slot back, so four dead executors burned
  four articles' quota and produced none; and a run that died _after_ the article
  committed would have been retried into a duplicate, which is why the article and
  its queue row now commit in one transaction. A missed sweep lost the slot for
  ever; there is a six-hour catch-up window now. `preferredHour` and `timezone`
  are bounded where they are saved rather than only in the form.

  Two of that pass's findings were not defects and are recorded as such: the
  sanitiser held against forty hostile payloads, and three apparent bypasses were
  correctly entity-escaped attribute values.

  Breaking: `saveGeneratedArticleCore` returns `{ articleId, status }` rather than
  an id, and takes an `approvalMode`. `incrementUsageCore` and
  `incrementImageUsageCore` are removed — counting after the fact is the defect,
  and `reserveArticleQuota` / `reserveImageQuota` replace them.

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

- dc26361: Refuse the uploads a CMS should refuse, delete what deletion promises, and let the preview render

  Four faults in the same library, each of which had a control that looked like it
  was doing the work.

  **The upload path accepted anything.** `createMedia` declared `mimeType`, `kind`
  and `size` and validated none of them: measured, it accepted `text/html` and a
  5 GB SVG. `validateMediaUpload` existed, had a full test suite, and was imported
  in exactly two places — both browser components. The client was doing the
  checking and the client is not the security boundary; `createMedia`,
  `getPresignedUrlForMedia` and `confirmUpload` are public Convex functions and a
  browser is not their only caller. An upload path that accepts HTML is stored
  XSS, so this was treated as security work.

  `createMedia` now refuses anything the allow-list does not name, and re-uses
  `validateMediaUpload` rather than growing a second list beside it. The list
  gained what it was missing: the extension must agree with the MIME type, SVG is
  capped at 1 MB — the ceiling `cmsSvgUpload` already applied on its own route —
  and a negative or non-finite size is refused. `kind` is checked against the MIME
  type as well, because it is a separate caller-chosen argument and it is what
  `confirmUpload` branches on. Both later steps re-validate, since rows written
  before this guard still hold whatever they were given.

  **An unsanitised SVG could reach `status: "ready"`.** `confirmUpload` routed
  `image/svg+xml` around sharp straight to `setMediaReady` — measured returning
  `{"status":"ready"}` for an SVG carrying `<script>alert(document.cookie)</script>`
  and `onload=`. It now reads the object back and inspects it: active content
  means the S3 object is deleted and the record fails with `SVG_ACTIVE_CONTENT`. A
  clean SVG is rewritten with `ContentDisposition: attachment`, so its inertness
  travels with the object rather than depending on the `/api/files` proxy — a
  deployment with `AWS_S3_PUBLIC_BASE_URL` set bypasses that proxy entirely.

  **Deleting media did not delete the file.** `deleteMedia` removed the Convex row
  and nothing else; `DeleteObjectCommand` appeared nowhere in the repository, so
  no GDPR erasure request could be satisfied and the admin dialog's "sera
  définitivement supprimé" was false. The keys are now collected before the row
  goes — variants derived from the `s3Key` prefix, exactly inverting what
  `processImage` writes, and legacy URL-only rows recovered through a resolver
  that refuses a URL belonging to another deployment — and a `purgeS3Objects`
  action removes source and every variant. A media that is still referenced keeps
  both its row and its files, as before.

  **`X-Frame-Options: DENY` made the CMS preview permanently blank.** It was
  applied to `/(.*)`, and `PreviewClient` renders the storefront in a same-origin
  `<iframe>`; `DENY` refuses a same-origin frame as flatly as a cross-origin one.
  `frame-ancestors` is now `'self'` and the header is decided in three places
  rather than one: `SAMEORIGIN` on pages — kept rather than dropped, for browsers
  that never implemented `frame-ancestors`, and not left at `DENY`, which would
  have overridden the CSP beside it — and still `DENY` on `/api/files/:path*`,
  which proxies user-uploaded bytes and whose own `default-src 'none'` is not a
  fallback for `frame-ancestors`. Cross-origin framing is refused everywhere.

  `cms-preview.spec.ts` could not have caught it, and for a worse reason than
  "weak assertion": its "unauthenticated" test ran authenticated, because the file
  matches only the `admin` Playwright project, which carries a signed-in
  `storageState`; and its other test wrapped its only assertion in an `if`, so it
  passed with zero assertions. It now asserts the response headers, that the child
  frame reached the previewed page, and that an `h1` inside the frame is visible —
  none of which a blocked frame satisfies.

  **Rich-text fields rendered escaped, and were stored unsanitised.** Four
  `richtext` fields store `editor.getHTML()`, and the About page rendered one as a
  plain React child: the visitor read the `<strong>` tags. They are rendered as
  markup now, through a `CmsRichText` component that sanitises with DOMPurify, and
  `saveDraftBlockCore` sanitises on write before validation — so what is measured
  and what is stored are the same string. The write guard came first: `<script>`
  was reaching `cmsBlocks.values` verbatim, and rendering without it would have
  turned a display bug into stored XSS.

  Standing findings, recorded in `tasks/client-offboarding-runbook.md` rather than
  fixed here: deleting an _établissement_ still orphans its S3 objects
  (`storeCascade.ts` bulk-deletes `cmsMedia` rows and never touches the bucket),
  `/api/upload` objects are referenced by URL rather than by a media record, and
  three of the four `richtext` fields are read by no renderer at all.

- 20ccb42: Give the contact form's messages a screen to be read on

  `contactMessages.create` was called by the storefront form. `list` and
  `updateStatus` were exposed and permission-guarded, and called by nothing: a
  customer wrote, the row landed in `contactMessages`, and the restaurant had no
  way to read it. The `status` field offered `new` / `read` / `archived`, and
  nothing could move a message between them.

  There is a Messages screen now, in the Opérations group of the admin, behind
  `customers:read`. It lists a store's messages newest first with sender, subject,
  date and status, and filters over the three statuses. Opening one is what marks
  it read; archiving it is a button in the dialog.

  The two halves of that screen are guarded differently, and the roles show it:
  `list` asks for `customers:read`, `updateStatus` for `customers:write`, and a
  manager and a waiter hold the first without the second. They read the inbox and
  change nothing in it, rather than failing on every click.

  **Breaking: `contactMessages.list` now requires `paginationOpts`.** It used to
  collect a store's whole table on every call. An inbox only grows, and until now
  nothing read it, so nobody had met the cost. Any consumer wrapping `defs.list`
  has to pass the argument through; both apps in this repository do.

  A second query, `unreadCount`, is bounded at 99 and feeds a badge on the sidebar
  entry, so a message that arrives while the owner is on another screen says so.

- ab869a8: Let a paid order print itself, and stop the kitchen screen going dark

  Four defects met in the same place, and three of them had been closed once by
  deleting the thing that revealed them.

  **The kitchen cooked orders nobody had paid for.** `createWithTicket` inserted
  the order and its ticket in one transaction, before any provider redirect: a
  customer who reached Stripe and closed the tab left a slip on the pass, and
  nothing retracted it. The rule is now "a _paid_ order feeds the kitchen", and
  it lives in `releaseToKitchen` rather than in any one caller — every payment
  path reaches it through `orders.recordPaymentStatus` (Stripe webhook, Stripe
  success-page verify, PayPal capture, SumUp verify) or `markCashPaid`. It is
  idempotent, so a webhook racing its own success page still produces one ticket.

  **`orderConfirmation` is a promise the product can keep now.** It was withdrawn
  for offering a workflow nothing implemented. `releaseToKitchen` reads it:
  `"auto"` — and unset, which is every existing establishment — releases on
  payment; `"manual"` holds the order until staff accept it, which is what
  `orders.updateStatus` to `confirmed` now does.

  **Automatic printing was dead product-wide.** `stores.updatePrintConfig` had no
  caller in `packages/admin` or either app, so every establishment ran with
  `printConfig === undefined`, `kitchenTickets.create` stamped every slip
  `printStatus: "not_required"`, and `getPrintQueue` was permanently empty. The
  editor is back, in `packages/admin` this time, on the store-detail screen both
  apps already render. Beside it: the print reliability work — `claimForPrint`
  takes a ticket in one transaction so two tablets on the same pass cannot both
  print it; `getPrintQueue` returns failed slips again once their retry delay has
  passed, so `printAttempts` is finally read by something; and the trigger commits
  its render with `flushSync` and refuses to print a slip whose content is not
  there, because a blank page filed as "printed" leaves the queue and is never
  seen again.

  **The KDS query was unbounded and nothing was ever deleted.** `getByStore`
  subscribed to every ticket a store had ever had; `getByStatus` behind the
  "Terminées" tab did the same for the class that only grows. Both are bounded
  now — the live read to the three active statuses, the completed tab to a page at
  a time — and `purgeExpiredTickets` runs nightly, because bounding a read while
  the table grows for ever only moves the failure.

  **A customer's allergy reached the validator and stopped there.** The Uber Eats
  mapper extracts `special_instructions` and `customer_request.allergy` into
  `notes`; `createFromWebhook`'s item validator had no field for it and the
  webhook passed `notes: undefined` one line before the insert. Both carry it now,
  through one shared `toKitchenTicketItemsFromPlatform` rather than the same
  mapping hand-written in two byte-identical files.

  Two things the ticket never carried and the product depended on: `allergens`,
  gathered from the products ordered, which the printed slip has always had a
  block for and only demo data ever filled; and `estimatedPrepTime`, without which
  `estimatedReadyAt` was never set and the overdue alarm could not fire for a real
  order. Stations are routed as well — `stationMapping` sends a category to a
  pass, and an order is split into one ticket per station it touches, so the cold
  station is not handed a slip for a pizza.

  Breaking: `kitchenTickets.getByStatus` now takes `paginationOpts` and returns
  Convex's `PaginationResult` — `{ page, isDone, continueCursor }` — rather than
  an array, so a caller reads `result.page` and drives it with
  `usePaginatedQuery`. `printStatus` gains a `"printing"` literal, and
  `markPrintSent` / `markPrintFailed` take an optional `claimId`.

- 91d388a: Stop a product deletion from breaking Deliveroo and bricking the menu that used it

  `products.remove` was `handler: async (ctx, args) => { await ctx.db.delete(args.id) }`
  and nothing else, while thirteen columns across nine tables pointed at
  `products`. Two of them are REQUIRED — `externalProductMappings.internalProductId`
  and `favorites.productId` — so those rows survived holding an id that resolves to
  nothing and could not be repaired field by field. Measured before the fix:

  ```
  menu still holds the dead id: ["10002;products"]
  that product now resolves to: null
  favorites rows left: 1, externalProductMappings rows left: 1
  favorites[0].productId resolves to: null
  ```

  **Deliveroo was told a deleted dish had synced.** Proven end to end through the
  real signed webhook route, with only `globalThis.fetch` standing in for
  Deliveroo's servers:

  ```
  --- ordered dish was DELETED, its PLU was mapped ---
  [Sync Debug] Item PLUs: Tiramisu:PLU-TIRAMISU
  [Sync Debug] hasMissingPLU=false, hasMismatch=false
  sync_status body: {"status":"succeeded","occurred_at":"..."}
  ```

  `getByExternal` returned the surviving mapping without ever dereferencing
  `internalProductId`, so the webhook's PLU loop counted zero unmatched items and
  answered `sendSyncStatus(..., "succeeded")` for an order the kitchen cannot
  cook. **And the formule became permanently uneditable**: `menus.update`
  re-validates every stored section as a unit, so one dead id refused every
  subsequent write — including the one removing that section.

  **The decision is per referencing table, and it splits on authorship**, which is
  the reasoning `categories.remove` already established: a cascade destroys an
  afternoon's work on a click meant to tidy up.
  - **Refused** while they point at the dish — `menus`, `promotions`, `prizes`.
    Each is a selling decision the owner made, and each has a screen to unmake it
    on. The refusal names them: _Ce produit est utilisé dans 1 formule : "Formule
    Midi"._
  - **Cascaded** — `externalProductMappings` and `favorites` (machine-kept rows
    that mean nothing without the dish), `orphanProducts` (the platform match is
    void, so the import returns to `pending` for review), and the
    `linkedProductId` provenance link on twins in other establishments.
  - **Left alone** — `orders.items[].productId`. What was sold is history, the
    column is already optional, and rewriting it would falsify the receipt.

  `favorites` gained a `by_productId` index. Every index on that table started at
  `userId`, so reaching the customers who favourited one dish would have meant
  collecting the whole establishment's favourites inside a mutation that deletes a
  single row — the same reason `by_storeId` was added to it for the store cascade.

  The refusals are `ConvexError`, not plain `Error`: Convex redacts a plain
  error's message in production, so a carefully counted refusal would have reached
  the owner as "Server Error" and read as a bug in the product — the same
  reasoning `auth.ts`'s `denied()` records. The products table was throwing that
  sentence away too, showing a generic _Échec de la suppression du produit_; it
  now shows the reason, through a `convexErrorMessage` reader added to this
  package.

  **`getByExternal` dereferences the product**, and keeps doing so after the
  caller was fixed. `products.remove` can no longer create such a row, but a store
  cascade, a restore or a hand-run mutation all arrive at this same query, and "we
  have a mapping" must never outlive "we have the dish". `getByInternal` is
  deliberately left alone: it is keyed on a product id the caller already holds,
  so it cannot manufacture a match for a product nobody asked about.

  **Two more routes to the same `succeeded` were found by an adversarial pass and
  closed.** Both produce the identical customer-visible outcome, reached without
  deleting anything.

  The webhook accepted `pos_item_id` **or** `plu` **or** `external_reference_id`
  as a POS identifier when testing for "no identifier at all", but the check that
  looks the identifier up in our own mappings read `pos_item_id` alone. A line
  identified by either of the other two skipped the database check entirely. All
  four sites now resolve the identifier through one `posItemId()` helper, which
  uses `||` rather than `??` because an empty string is not an identifier — with
  `??` a line carrying `pos_item_id: ""` alongside a real `plu` stopped at the
  empty one and a dish we can cook was refused.

  And **the mapping lookup spanned the whole deployment.** A PLU is unique inside
  one restaurant, not across an account, so an order for one establishment whose
  PLU happened to be mapped in ANOTHER was answered as producible by a kitchen
  that has never heard of the dish. The same span made `.unique()` throw the
  moment two establishments shared a PLU string — which is exactly what a chain
  running one menu across its locations does — and the caller counts a throw as an
  unmatched item, so a correct multi-store deployment refused its own orders.
  `getByExternal` now takes the establishment and reads a new
  `by_store_platform_external` index. Both directions are pinned by tests that
  were confirmed to fail without the change: the cross-tenant line answered
  `succeeded`, and the shared-PLU chain answered `failed`.

  **The store-cascade guard now sees foreign keys by type, not by name.** It read
  `validator.fields.storeId` — the field literally called `storeId` — which is not
  the same question as "what points at `stores`". Measured over the compiled
  validators: 46 FK columns, 43 named `storeId`, three invisible. More to the
  point, so was the next column somebody would call `restaurantId`, which is the
  exact failure the guard exists to prevent. It now walks the serialised validator
  by type and reports every path reaching `v.id("stores")`, however nested and
  whatever it is called. Verified by injecting `restaurantId: v.optional(v.id("stores"))`
  into an existing table: the guard fails, where the name filter passed it
  silently.

  Walking `validator.json` rather than the live validator objects is not a
  preference — the two use different keys for the same thing (`type` vs `kind`),
  and reading `.type` off a live node yields `undefined` for every field: a walk
  that finds nothing and a test that passes.

  That walk immediately found a live orphan. **`blogAutoConfig.targetStoreIds` is
  now detached on store deletion**, by `detachStoreFromBlogAutoConfigs`. A config
  belonging to establishment A that fans articles out to establishment B kept B's
  dead id forever after B was deleted; only the config's own `storeId` was ever
  handled. Every reference the guard finds must now be resolved either by the row
  being swept or by a named entry in `DETACHED_STORE_REFERENCES` that says what
  handles it — so a dangling id cannot be parked there to quiet the test.
  `systemAuditLog.targetStoreId` is listed as dangling on purpose: the
  `store_deleted` entry points at the store that was just deleted, and resolving
  it would erase the record of the deletion.

  **Breaking: the `printerSettings` table and `printerSettingsTable` export are
  gone.** Ten required fields, zero readers and zero writers anywhere in the
  repository since it was declared — the only reference outside the schema was the
  delete cascade, removing rows nothing could ever create. Its own comment kept it
  on the grounds that the planned thermal path would need "roughly" these fields,
  but those fields are ESC/POS-shaped (`ipAddress`, `port`, `usbVendorId`,
  `type: network | usb | bluetooth`) and that path is explicitly ruled out: the
  thermal path when it comes is cloud printing, whose shape `stores.printConfig`
  already carries. Auto-print runs on `stores.printConfig` today. Nothing can have
  written a row, so nothing is lost. The documentation that described it — in
  `CLAUDE.md`, both package READMEs, `STRUCTURE.md`, `EXAMPLES.md`, the docs app
  and `IMPLEMENTATION_STEPS.md` — was corrected with it, including a `SUMMARY.md`
  line advertising a `printerSettings.ts` function module that never existed.

### Minor Changes

- bd7a656: Wire up dine-in table numbers, and make the four allergen surfaces agree

  Two product surfaces were designed, translated, and never connected.

  ## A dine-in order now carries the table it is served to

  "Sur place" was offered in the order-type selector and accepted by
  `orders.create`, and nothing anywhere carried a table number — zero occurrences
  in `tables/orders.ts`, `tables/kitchen.ts`, the storefront, the kitchen
  components or the order functions. The printed slip gave a cook the dish and
  the customer's name, so staff had a plate and nowhere to take it. One of the
  three advertised order types was unusable. The tell was `checkout.tableNumber`:
  shipped and translated into `fr`, `en` and `es`, and read by no code at all.

  `orders.tableNumber` and `kitchenTickets.tableNumber` are new
  `v.optional(v.string())` columns. `orders.create` accepts a table, normalises
  it, and `releaseToKitchen` copies it onto every ticket the order produces; the
  slip prints `TABLE <n>` at the same size as the order number, and the kitchen
  display card shows it beside the order number.

  It is a **label**, not a number — dining rooms use `A3` and `Terrasse 4` as
  readily as `12`, and parsing the field as an integer would reject half of them.

  It deliberately does **not** share a foreign key with `gameQRCodes.tableNumber`,
  which names the same real-world thing. There is no `tables` table, and adding
  one would make dine-in service depend on the gamification QR codes being
  configured — a restaurant can serve _sur place_ without ever running the wheel
  of fortune. The two share a representation instead:
  `@be-in-digital/core/dining` normalises and bounds a table label for both.

  Required at the storefront, optional on the server. Uber Eats and Deliveroo
  forward `dine_in` orders that carry no table of their own, and refusing those
  would lose the order outright. A table number on a `delivery` or `pickup` order
  is rejected, which catches the order whose type was switched after the table
  was typed.

  While wiring it, the checkout form turned out to carry its **own** two-option
  fulfilment toggle that knew nothing about the store's services: a cart set to
  `dine_in` showed "À emporter" selected, and one click silently rewrote the type
  to `pickup`. The customer sat at a table and the kitchen was told to bag the
  order. The toggle now offers the same three types the cart does, filtered by
  the same predicate the server validates against, and selects exactly.

  ## One allergen vocabulary instead of four

  The chain was broken at every link, and each surface had drifted because each
  carried its own idea of what an allergen was:
  - the printed kitchen ticket rendered `{allergens.join(", ")}` — whatever text
    was in the array is what a cook read before plating;
  - the admin product form had **no allergen control at all**, only a zod field
    and a `[]` default, so a restaurateur could not declare one through the
    normal product editor;
  - the only production writer was therefore the AI image-to-product flow, whose
    prompt is written in French, feeding an unvalidated comma-separated text box;
  - `uberEatsMenuSync` declared `allergens?: string[]` and never mapped it, so
    every dish synced to Uber Eats went out with no allergen declaration.

  For an EU food business under INCO 1169/2011 that is a regulatory surface.

  `@be-in-digital/core/allergens` is now the single source of truth: the
  fourteen Annex II allergens plus `shellfish` and the two dietary markers, the
  alias table that matches French and English spellings through accents,
  ligatures and punctuation, the localised labels, and the Uber Eats mapping.
  It is framework-free and exported as raw source, so the design system, both
  apps, the admin package and the Convex runtime can all consult it.

  The representation decision, made once and applied everywhere: **allergens stay
  free text** — refusing a name we do not know would push a real declaration off
  the menu — **but every surface resolves through this vocabulary, and a value it
  does not recognise is treated explicitly as unverified rather than passed off
  as checked.**

  So: the badge renders it as the owner typed it and announces it as the
  restaurant's own wording; the kitchen slip prints it under `MENTIONS À
VÉRIFIER :` rather than folded into the allergen line, because a cook has to
  treat it differently; the admin marks the chip `non vérifiée` and states the
  consequence; and Uber Eats is not sent it at all, since filing an unknown value
  as `OTHER` would show a diner a declaration that names nothing. Those are
  reported to the owner instead of dropped in silence.

  Dietary markers are no longer treated as allergens anywhere: `vegan` printed
  under `ALLERGÈNES :` told a cook it was one.

  `packages/admin` gains one allergen control, shared by the product form (a new
  `Allergènes` tab) and the AI review card, so the two cannot disagree again.

  ### Known limitation

  `UBER_EATS_ALLERGEN_TYPE` maps every canonical key to an Uber Eats enum member,
  but those spellings are **not verified against Uber's live menu schema** —
  `developer.uber.com` is unreachable from CI and Uber does not publish the enum
  outside the partner portal. The mapping is total and typed, so correcting it is
  a one-table change that every caller inherits. Confirm it during Uber Eats
  onboarding; see `tasks/uber-eats-go-live-runbook.md`.

- 91d388a: Give the dining-room screen a dismissal window the owner can set

  `stores.displayConfig` decides how long a finished order stays on the
  customer-facing screen in the dining room. `kitchenTickets.getForDisplay` has
  read it since that screen shipped — `autoDismissEnabled` decides whether a ready
  order is dropped at all, `autoDismissMinutes` how long it survives — and nothing
  wrote it. Measured:

  ```
  STORED  displayConfig -> {"autoDismissEnabled":false,"autoDismissMinutes":15}  ready count = 1
  DEFAULT displayConfig -> {"autoDismissEnabled":true,"autoDismissMinutes":15}   ready count = 0
  writers via db.patch|insert|replace : 0
  readers of store.displayConfig      : 3
  ```

  So every establishment ran on the query's own fallback: **an order the customer
  is still waiting for disappeared from the wall they are watching, fifteen
  minutes after the kitchen called it ready, with no setting anywhere to change
  it.**

  The mutation had been deleted, and the field filed under "legacy", on the claim
  that nothing read the stored value. Three places in the repository stated that
  claim — the schema comment, the `updateSoundConfig` docblock, and
  `kitchen-sound-config.test.ts`, which certified it as a test — and the reader had
  never gone away. All three are corrected. So are four more found alongside them:
  both package CHANGELOGs (annotated rather than rewritten, as this repository's
  convention has it), `kitchen-alerts.ts` and its test, which still said
  `soundConfig` had no editor after #243 gave it one, and the audit line in
  `tasks/sales-readiness-backlog.md` that the claim originally came from.

  `updateDisplayConfig` is restored on the `updateSoundConfig` model, the field is
  typed rather than `v.any()`, and the editor is a fifth **Écran de salle** card on
  the kitchen tab, placed last because that tab is ordered as a service runs
  through it and the dining-room screen is downstream of everything.

  **The mutation refuses a window it cannot honour.** `v.number()` accepts `NaN`,
  `Infinity`, zero and negatives, and `getForDisplay` turns whatever is stored into
  `readyAt > now - minutes * 60_000`: `NaN` makes every comparison false, zero and
  negatives keep only tickets that became ready in the future — each of them
  emptying the ready column, which is the failure this setting exists to prevent,
  reached from the other side. `Infinity` is the odd one out, measured rather than
  assumed: it stores and round-trips, and quietly becomes a second, undeclared way
  to say "never dismiss" when `autoDismissEnabled: false` is the declared one. All
  are refused rather than clamped — silently storing a number other than the one
  sent is how a setting comes to disagree with the screen it governs, and it would
  put a value nobody typed into the audit trail. The editor clamps its own input to
  the same range, and a test pins the two ranges together so they cannot drift.

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

- 4e625bd: Say out loud that a deployment issues no invoices, and give the owner the form that fixes it

  **A seller-incomplete deployment took money indefinitely with no legal
  invoice and no warning anywhere (#375).** `issueInvoiceForOrder` deliberately
  answers `{ issued: false, reason }` instead of throwing — a missing SIREN
  must not fail a payment, and that part is right. Its docblock then claimed
  "the admin surfaces it", and nothing did: both callers awaited the result and
  discarded it, the paid order's detail page had zero invoice references, and
  no banner existed. The repo's signature failure class — an annotation
  asserting more than the code does — this time on the fiscal path
  (art. 242 nonies A CGI requires an unbroken numbered series).

  Worse than the docblock: **the state was unfixable from inside the product.**
  No admin screen collected `globalSettings.seller`, and `globalSettings.upsert`'s
  validator did not even accept a `seller` argument — `seller_incomplete` was
  permanent on every deployment ever cloned.

  Three surfaces now exist, and one form:
  - **The paid order says it.** New `orderInvoiceSurface` computes the invoice
    number or the refusal fresh on every read — never persisted, so completing
    the identity clears it by itself — and `orders.getById` in both apps
    spreads it onto the order. The detail page grew a « Facture » card: the
    number when issued, « Facture non émise » with the reason in French and a
    link to the fix when not — and for the backlog, a third state adversarial
    verification demanded: an order paid while the seller was incomplete stops
    refusing once the identity is complete, which used to make the card vanish
    and leave that order invoiceless for ever. It now offers « Générer la
    facture », the first UI caller `invoices.issueForOrder` has ever had,
    gated on the same `payments:write` the mutation enforces. While in the
    file: `tableNumber`, persisted since day one and displayed never, is now
    on the dine-in detail.
  - **The dashboard warns.** A persistent banner while `seller` is incomplete,
    shown only to holders of `settings:write` — exactly SUPER_ADMIN and
    CLIENT_ADMIN, the people who can act — using the engine's own
    `sellerIsComplete` so the banner and the refusal cannot disagree.
  - **The docblock now describes surfaces that exist.**
  - **The settings screen collects the identity.** A « Facturation » tab
    (raison sociale, forme juridique, siège, SIREN/SIRET, TVA, RCS, capital,
    mentions légales), backed by a `seller` argument on `upsert` matching the
    schema exactly. Only the legal name gates issuance, as before; the rest
    stays optional — a micro-entreprise legitimately leaves most of it empty.

  Deliberately NOT done: seller identity is not a boot-blocking requirement.
  Whether go-live should hard-require it is an owner decision; the banner is
  the honest middle until that decision is made.

  Held by tests that cross the seam the green suites never did:
  `order-detail-invoice.test.tsx` renders the real page and pins the refusal,
  the number, the link and the table; `seller-incomplete-banner.test.tsx` pins
  shown-when-incomplete, gone-when-complete, silent-to-staff;
  `order-invoice-surface.test.ts` in both apps drives the whole journey —
  money in, refusal on the order, identity saved through the new validator,
  refusal clears, catch-up issuance names the document; and
  `invoices.test.ts` pins `orderInvoiceSurface` itself, including that it
  recomputes on every read.

- 1c21483: Refuse a Stripe charge when the stored connection claims it is routed elsewhere

  `convex/stripe.ts` builds its client from the PLATFORM secret key and sends no
  `stripeAccount`, no `on_behalf_of` and no `transfer_data`, so every euro paid by
  card lands in the platform balance. For a while the connect flow wrote
  `paymentConnections.status: "connected"` the moment Stripe reported
  `charges_enabled`, and the admin showed a green "Connecté" to an owner whose
  takings were going somewhere else. The flow was corrected to write
  `onboarding_complete`, the honest literal.

  Nothing stopped the next person writing `"connected"` again. `grep -c
paymentConnections convex/stripe.ts` returned 0 — the charge path never read the
  row at all, so the deception could come back with no test going red anywhere.

  New subpath `@be-in-digital/convex-functions/stripeChargeRouting` exports
  `resolveStripeCharge(connection)`. It throws for exactly one status —
  `connected`, the literal whose meaning is "charges are routed to the connected
  account" — and returns `{ mode: "platform" }` for `onboarding_complete`,
  `disconnected`, `error` and no connection at all. Both Stripe money paths call
  it: `createCheckoutSession` and `internalRefund`, before either reads the
  platform key.

  The rule is narrow on purpose, and the wide version is a trap. "Refuse whenever
  a Stripe connection exists" would mean completing Connect onboarding breaks card
  payments outright for that restaurant. `connected` is unreachable today, so
  refusing it changes nothing about how anyone is charged — it is a tripwire, not
  a behaviour change.

  This is deliberately half of Stripe Connect. Routing the charge for real needs
  two product decisions and a live Connect account; `tasks/stripe-connect-runbook.md`
  holds that work.

### Patch Changes

- 009af63: Restore the accents on French copy that the twin comparison could not see

  The accent guard compared `apps/reference` against `apps/themes`, so a word
  de-accented identically in both was invisible to it: "doit etre dans le futur",
  "n'est pas configure" and "l'import reel" all passed a green check. It now
  measures each string against a list of French spellings instead of against the
  other app, which does not care how many copies of a fault exist.

  That found 128 de-accented words across 40 files, all of them user-facing:
  "Article supprime", "Commande acceptee sur Uber Eats", "Publiee le",
  "La quantite doit etre positive", "Selectionnez au moins un element a migrer".
  Validator messages, kitchen tickets, the blog editor and the system pages are
  all affected, and the strings ship to every client.

  `createMigrationRequest`'s test asserted the misspelling (`/au moins un
element/`), so it has been rewritten to assert the corrected message.

- ec8e3ea: Let a game QR code be created at all

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

- e7182b5: Hold the KDS cap with a test that fails when the cap is removed

  `getByStore` is bounded on two axes — the three active statuses, and
  `ACTIVE_TICKET_LIMIT` rows of each, read oldest-first. Only the first was held
  by a test. The 5,000-ticket case seeds `completed` rows, so it answers with an
  empty list on the status filter alone: replacing `.take(ACTIVE_TICKET_LIMIT)`
  with `.collect()` left it green.

  That gap is not academic. `purgeExpiredTickets` deliberately never deletes a
  ticket still on the pass — an establishment that left one open overnight has a
  problem, and silently deleting it is not the answer — so for tickets that are
  never completed the cap is the only thing standing between a busy service and
  the unbounded subscription every open tablet re-reads on every write. It is the
  failure #137 exists to prevent, and it would have regressed silently.

  "A pass nobody ever cleared" seeds 250 live tickets and holds both halves: the
  row count, and the choice of which end to keep. The ordering is the half worth
  asserting — keeping the newest would drop the longest-waiting orders off the
  screen, and nobody would ever cook them. Both go red when the corresponding
  line is removed. `ACTIVE_TICKET_LIMIT` is exported so the test names the bound
  rather than restating the number, matching `MAX_PRINT_ATTEMPTS` and
  `RETENTION_BATCH_SIZE` beside it.

- Updated dependencies [60dbd7d]
- Updated dependencies [dc26361]
- Updated dependencies [c9619e2]
- Updated dependencies [bd7a656]
- Updated dependencies [91d388a]
- Updated dependencies [009af63]
- Updated dependencies [ab869a8]
- Updated dependencies [cde4410]
- Updated dependencies [91d388a]
- Updated dependencies [bd17a78]
  - @be-in-digital/convex-schema@4.0.0
  - @be-in-digital/cms@3.1.0
  - @be-in-digital/core@2.4.0

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

  > **Correction, 5 Sep 2026 (Q-2).** The entry above is left as written, because
  > it is the record of what was decided; this note is the record of what was
  > wrong with it. `displayConfig` did have a reader, and had one at the time:
  > `kitchenTickets.getForDisplay` reads it on every tick of the customer-facing
  > dining-room screen, `app/display/[storeId]/page.tsx` in both apps, and its
  > own unit tests asserted the behaviour throughout. Deleting
  > `updateDisplayConfig` therefore left a live setting with no writer, and every
  > establishment on the query's fallback: an order the customer was still
  > waiting for left the screen fifteen minutes after the kitchen called it
  > ready, with nothing anywhere to change that. The mutation is restored, the
  > schema field is typed rather than `v.any()`, and the kitchen tab has an
  > "Écran de salle" card. `orderConfirmation` came back separately with #164,
  > which implemented the workflow it promised. The one claim in the entry that
  > held is the one about `soundConfig` — which has had an editor since #243.

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
