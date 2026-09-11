# Changelog - @be-in-digital/convex-schema

## 6.3.0

### Minor Changes

- b8c6f3e: Stop three deletes leaving a reference behind.
  - `categories.remove` left `stores.stationMapping[].categoryId` — a required
    `v.id("categories")` inside an array — naming a row that no longer exists.
    Inert only because `orders.ts` compares strings rather than dereferencing,
    and re-persisted on every save of the kitchen tab. It is stripped now.
  - `blog.deleteArticle` left `blogAutoQueue.articleId`: a generation work item
    for an article nobody can open. Cascaded, through a new `by_articleId` index.
  - `languages.remove` left every `translations` row for that language.
    `languageCode` is a `v.string()`, so no validator could see the orphan — and
    re-adding the same code **resurrected** the stale rows, putting last month's
    German back on the storefront. Cascaded, batched at
    `LANGUAGE_TRANSLATION_BATCH`, with the app wrapper draining the rest.

  `requiredActions.remove` is measured and left alone: its ids live in
  `gamePlays.completedActions`, nothing dereferences them, and those rows carry
  the prize claim, the cooldown and the art. 7.1 consent. The reason is now in
  the code rather than absent from it.

### Patch Changes

- 390c8d5: Give a prize that gives something away a way to say what.

  `prizes.productId` and `prizes.menuId` were declared in the schema and written
  by nothing, which cost two things. The delete guards that read them —
  `menus.remove`'s `menu_in_prize` and the matching refusal in `products.remove`
  — could not fire outside their own tests, because no production path could put
  a prize in that state. And an owner could create a « Menu offert » that named
  no menu: it read « Menu offert » on the wheel, on the winning screen and on the
  QR code the diner brought to the counter, where nobody could tell what had been
  promised.

  `PRIZE_TARGET_FIELDS` declares the rule beside the code that enforces it — the
  shape `HONOURABLE_DISCOUNT_TYPES` established for promotions. A target is
  required for the type that gives something away, refused for every other type,
  and checked to belong to the same establishment. The admin prize form offers the
  picker for exactly those two types.

## 6.2.0

### Minor Changes

- 92dc32f: Read the restaurant's clock on Paris time when nothing has said which clock

  `restaurantClock` fell back to `getUTCDay()` / `getUTCHours()` whenever it was
  given no timezone. The timezone comes from `globalSettings.timezone`, and
  `globalSettings` is a singleton the team writes — nothing seeds it — so a
  deployment whose settings have never been saved passed `undefined` from every
  call site and had its opening hours, its dish schedules and its happy hours all
  enforced on the server clock. Convex runs in UTC.

  Measured on the order path against a store open 11:00–14:00 with no settings
  row: an order at 14:30 Paris was accepted and written to the kitchen, and one at
  11:30 Paris — mid-service — was refused `outside_opening_hours`. Two hours of
  every summer day taking orders after closing and refusing them during service.

  `DEFAULT_RESTAURANT_TIMEZONE` is `Europe/Paris`, and it is the fallback for an
  unusable timezone as well as an absent one — the reason that fallback existed
  was that a settings row holding a typo must not close the whole catalogue, and
  that is served better by the product's clock than by the server's. A deployment
  that has set its timezone is unaffected: the default is the absence of an
  answer, not a policy.

  Nothing could see this. Every case in `order-opening-hours.test.ts` seeded the
  settings row, which is the one thing that hides it, so the default is now pinned
  beside the function that applies it in `__tests__/timeWindow.test.ts`, and the
  order path carries two cases that omit the row.

## 6.1.0

### Minor Changes

- e5394e5: Serve no draft dish, settle the hours the screen promises, and measure the targets

  **The public catalogue returned everything.** `products.list` collected the
  whole table and `products.getById` answered for any id, both to anyone with no
  account, so a dish the owner had not published was on the carte and on its own
  product page — and then refused at the checkout, where `orders.create` has
  always checked. `sitemap.ts` and `structured-data.ts` had each grown an
  `isActive` filter of their own, which is why the hole looked closed; the menu
  page had none, and it is the page a diner opens.

  The filter is in the query now, once. `products.list`, `products.getById` and
  `categories.list` serve only what is on sale, and `products.listAll`,
  `products.getAnyById` and `categories.listAll` — guarded by `products:read` —
  are what the back office reads, which is exactly what those screens saw before.
  `menus.list` had no public caller at all in the repository, so it is guarded
  rather than filtered: a filtered public query nothing public calls is surface
  bought for nothing.

  **`useGlobalHours` had two readings.** The field is optional, so a store written
  before it existed carries no value; the dashboard read that as `?? true` and
  drew the switch on, `resolveStoreHours` read it as a falsy `&&` and served the
  store's own week. An owner could edit the deployment-wide hours, watch the
  screen agree this location follows them, and have the order path enforce
  something else. `followsGlobalHours` is now the single reading, and it answers
  `false` — what the order path has always enforced, so no establishment's
  opening hours change; only the dashboard stops claiming otherwise.

  **The blog title was stored as typed.** Only `content` was sanitised, while the
  title travels further — the page `<title>`, the breadcrumb JSON-LD, the Open
  Graph tags. `sanitizePlainText` cleans the title, excerpt and both meta fields
  on write, keeping their words and dropping their markup.

  **Two instruments were reporting green over defects they could see.**
  `scanContrast` never passed the `overlays` argument `loadTokens` takes, so a
  caller naming a template measured the engine palette — the one no client ships;
  and it read `className` only, so an element painting its ink or its surface
  inline was unmeasured. Both are fixed, with a fixture suite that fails if either
  input stops being honoured.

  **And twenty-one icon-only controls were smaller than WCAG 2.5.8 allows**, from
  22×22 down to the 16×16 password reveal on the sign-in dialog. `scanTargetSize`
  in `@be-in-digital/ui/target-size` measures every one of them from the markup,
  each control is now at least 24×24, and the sweep is a test rather than a list
  that goes stale on the next filter chip.

## 6.0.0

### Major Changes

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
  six-entry MIME-to-extension map while `@be-in-digital/cms`'s `MIME_TO_EXT` —
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
  attempts". `@be-in-digital/convex-schema` loses the six printer types that
  outlived the `printerSettings` table — `PrinterType = 'network' | 'usb' |
'bluetooth'`, the ESC/POS transports `CLAUDE.md` records as decided against.
  Both are BREAKING on a published API and neither had a consumer.

  **`@be-in-digital/admin`** gains `PAYMENT_STATUS_LABELS`, so the payments screen
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

### Minor Changes

- 7713538: Let a bounce or a complaint reach the subscriber when SES sends no headers

  `handleSesWebhook` correlates feedback to a subscriber through `X-Store-Id`,
  `X-Subscriber-Id` and `X-Campaign-Id`, injected at send time and readable only
  from `mail.headers` — and SES omits `mail.headers` from a notification unless
  the sending identity is configured to include the original headers. Nothing in
  this repository configured that, and nothing provisioned the notification at
  all: `setup-aws.sh` created the configuration set with no destination and no SNS
  topic, so `POST /webhooks/ses` was routed and never called.

      grep -rniE "event-destination|EventDestination|sns create-topic|sns subscribe" \
        --include='*.sh' --include='*.ts' --include='*.mjs' --include='*.yml' .
      (no output)

  The provisioning is the apps' half (`scripts/setup-aws.sh`, Step 2b). This is
  the engine's: what the handler needs to act on a notification that arrives
  without those headers, which is every notification any client provisioned before
  today will send.
  - `emailSubscribers` gains `.index("by_email", ["email"])` — the address alone,
    no store.
  - `emailSubscribers.listByEmail` reads it, capped at 32 rows.

  **Across stores, and that is the conservative direction rather than the
  convenient one.** A hard bounce says the mailbox does not exist, which is
  equally true of every store holding it; a complaint says this person reported
  the operator for spam. The rate AWS suspends over is per-ACCOUNT — one AWS
  account per client, every store of theirs inside it — so suppressing the address
  wherever it appears is what keeps the account sending. The cost is one
  subscriber row belonging to a store that did not send the message, and that row
  would have bounced too.

  Deliveries, opens and clicks deliberately do not fall back: those are campaign
  statistics, and attributing one to a store that did not send the message
  corrupts the figure rather than completing it. A bounce or complaint that still
  matches nobody is reported through `captureBackendError` instead of answering a
  silent 200, because a 200 tells SNS the delivery succeeded and is exactly how
  this stayed invisible.

- 6d6df2d: Stop the delivery tiles sending a restaurant's own customers to a marketplace

  The menu page carried a « Commandez aussi sur vos apps » section whose two
  tiles were hard-coded to `https://www.ubereats.com` and
  `https://www.deliveroo.com` — the marketplaces' HOME pages, not this
  restaurant — under a COMMANDER button, on every menu, whether or not the store
  had either integration. A restaurant's own site was routing its own customers
  into a marketplace to be shown the competition, and paying commission on
  anything they ordered there.

  There was nothing to derive a correct link from: `platformStoreId` is an API
  identifier (a UUID for Uber Eats, a site id for Deliveroo) and neither
  platform's public URL is built from it. So the owner supplies it —
  `storeIntegrations.storefrontUrl`, a field on the store's integration card —
  and no tile renders without one.

  `normalisePlatformStorefrontUrl` refuses what the hard-coded links were: a
  non-https URL, a host that is not the platform's, embedded credentials, and the
  platform's home page itself (a path of `/` is the defect, not a value). The host
  check walks LABELS rather than matching a pattern over the string, because
  `deliveroo.com.attacker.example` satisfies the second and is a domain somebody
  else registers — and this value becomes an anchor on the restaurant's own site.

  `storeIntegrations.publicLinks` is the storefront's read: a platform name and a
  URL, for the integrations that are switched on and have one. Nothing else on the
  row is a diner's business.

- 6d6df2d: Bound the send path's last unbounded read, count an unsubscribe, and pin the SNS topic

  **`alreadySentTo` grew with how much the audience liked the campaign.** It
  collected every event on the (campaign, subscriber) pair and looked for a `sent`
  among them in JavaScript. That pair holds one `sent` and one `delivered` — and
  one `opened` for every reopening, without limit. Asked once per subscriber in
  every batch of the send, it aborted at about 410 events per subscriber per
  campaign: Convex refuses a transaction past 16,384 documents, and past that the
  campaign can never complete. `by_campaignId_subscriberId` becomes
  `by_campaign_subscriber_type`, and the read is a `.first()` over three
  equalities. It was the one send-path query absent from `queryBounds.test.ts`;
  it is there now.

  **`campaign.stats.unsubscribed` never counted an unsubscribe.** Its only writer
  was the SES _Complaint_ branch of the webhook, so the figure labelled
  « Désabonnements » counted spam reports and nothing else — a campaign that cost
  a restaurant forty subscribers reported zero. Attribution has to come from the
  link, because that is all an unsubscribe carries: the campaign now stamps its id
  into the URL it sends, `emailSubscribers.unsubscribe` charges the removal to it
  (refusing a campaign belonging to another store — the value arrives in a URL the
  recipient holds) and writes the `emailEvents` row that was also missing. It is
  idempotent, so a mail client pre-fetching the link, a provider retrying its
  RFC 8058 one-click, and a recipient clicking twice are one person leaving.

  **A valid SNS signature said Amazon sent it, not that our topic did.** Every SNS
  topic in every AWS account is signed by the same infrastructure, with a
  certificate on the same hosts the URL check allows — and `/webhooks/ses`
  confirmed any subscription whose `SubscribeURL` was on such a host, so a
  stranger pointed their own topic at the endpoint and the endpoint subscribed
  itself. From then on their forged bounces carried a genuine signature and
  suppressed real addresses. `SES_SNS_TOPIC_ARN` now names the topic: no
  subscription is auto-confirmed without it, and notifications are checked against
  it when it is set. `SignatureVersion: "1"` — SHA-1 — is refused; the sender
  picks the version, and the "sender" of a body that has not been authenticated
  yet is whoever POSTed it. Both are written up in
  `tasks/webhook-migration-checklist.md`.

## 5.0.0

### Major Changes

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

### Minor Changes

- 038eb9d: Make the delete refusals reach the owner, and stop five more removes orphaning rows

  #400 gave six deletes a `ConvexError` carrying a French sentence the owner is
  meant to act on. Four admin screens caught it and showed a fixed line instead —
  so the owner clicked delete, something went grey, and the reason never appeared.
  The engine half was right and undelivered. The prize case was the worst of them:
  the server says _do not retry, deactivate instead_ and the screen said
  « Suppression impossible — réessayez ».

  **The refusal is now what the screen shows.** `games`, `prizes`, `emailTemplates`
  and `emailSegments` read it out of the `ConvexError` payload through
  `convexErrorMessage`, as `products-table` already did. So do the other eleven screen files,
  because the defect was the class and not the four instances — seventeen call
  sites across fifteen files, and a source-level case now holds every one of them,
  including the second delete in the two files that make two. (The first version
  of that sweep matched one binding per file, which left `catalog-page`'s prize
  delete and `use-store-detail`'s Deliveroo delete uncovered; reverting either
  kept the whole admin suite green.)

  **And five more removes were still leaving rows pointing at nothing.**
  - **A subscriber's rows go with them.** `emailSubscribers.remove` was a bare
    delete over TWO non-optional foreign keys — `emailEvents.subscriberId` and
    `emailAutomationRuns.subscriberId` — behind a live button. `privacy.ts` has
    cleared exactly those two tables, in that order, since the erasure path was
    written and says why; this delete was the one path that did not call it. It
    cascades now, a batch at a time, and the subscriber survives every pass but
    the one that finishes them — a half-drained delete never leaves the two tables
    promising a row the database no longer has.
  - **A campaign that has reached somebody is refused.** The delete button is
    offered for `draft`, `cancelled` and `failed`, and two of those three are
    states a send lands in mid-list: `markFailed` only fires on a campaign that
    was `sending`. What that partial send is recorded in is `emailEvents`, one
    `sent` row per (campaign, subscriber), which is what makes « Relancer » resume
    instead of restart. The rows survived a delete; the key did not. The only
    route left to finish the send was to rebuild the campaign — and the copy, with
    a new id, asks the same question of the same table and is told nobody has been
    reached, so everyone who already had it gets it again. Marketing mail is not
    recallable. It refuses and points at « Relancer ». Not a cascade: those rows
    are also the weekly cap's answer and the establishment's record of what it
    sent.
  - **A QR code that has been played is refused**, and can now be deactivated
    instead. `gamePlays.qrCodeId` has no reader anywhere, which is why nothing
    crashed and nothing was noticed — and that is the whole damage: a `gamePlays`
    row is the establishment's evidence under art. 7.1 that it was allowed to
    record a fingerprint, and `qrCodeId` is the only field saying where the
    consent was given. `isActive` has been in the schema from the start and the
    screen offered create and delete and nothing in between, so a refusal would
    have been a dead end; `gameQRCodes.setActive` and a control on the screen are
    the way out the refusal names.
  - **A formule a prize gives away is refused, and its translations go with it.**
    `menus.remove` was a bare delete. `prizes.menuId` gets the same treatment
    `products.remove` already gives a dish a prize names. `translations.entityId`
    is a `v.string()`, so no validator could see it was a foreign key: a menu's own
    name and description in every language the owner added were cleared by nothing
    short of deleting the whole establishment.
  - **A coupon an order was discounted by is refused.** `promotions.remove` was
    not a bare delete — it cleared the `promotionUsages` ledger in batches, which
    is what made deleting a popular coupon possible. The reference it never
    touched is the one that matters: `orders.promotionId` is optional and
    unindexed, so every order that coupon discounted was left naming a row that no
    longer resolved, with the discount still on the order and on the numbered
    invoice issued for it. `releasePromotionForOrder` read that id, found nothing,
    and quietly released nothing. A redeemed coupon is history now, and
    deactivation was already on the screen. It asks the order directly, through a
    new `orders.by_promotionId` — the cheap proxy is not equivalent, because the
    retention cron and an art. 17 erasure both clear `promotionUsages` while a
    paid order is ANONYMISED and keeps its `promotionId`, so proxying would have
    made a three-year-old coupon deletable again and re-created the very
    reference the guard exists to stop. `promotionUsages` is asked too: its
    `promotionId` is REQUIRED and its `orderId` is not. `purgeUsages` stays
    exported and the wrappers no longer schedule it: Convex resolves a scheduled
    function by name at run time, and a client deployment running the previous
    `remove` can still have a drain booked.
  - `emailAutomations.remove` gets the same guard over `emailAutomationRuns`. It
    has no UI caller; it is live on the API under `marketing:write` all the same.

  **BREAKING.** `emailSubscribers.remove` returns `{ deleted, complete }` and
  `menus.remove` returns `{ deleted, hasMore }`, both of which the app wrappers
  must drain — `emailSubscribers.purgeRemoval` and `menus.purgeTranslations` are
  new internal mutations, wired in both apps. `promotions.remove` no longer
  deletes usage rows; it refuses instead. `gameQRCodes.setActive` is new. One new
  index, `orders.by_promotionId`; every other index these guards seek was already
  declared.

  **And the instrument that measures all of this was reading low.** The
  read-counting double under-counted the exact unindexed scan it exists to catch.
  Convex's `.filter()` is a post-scan predicate — the stream reads every document
  of the scanned range and charges each one against the 16,384-document
  transaction limit, and the predicate only decides what comes back — but the
  double narrowed its candidate array inside `filter` and then counted the
  survivors. `.filter().collect()` over 6,000 rows scored the handful it returned;
  `.filter().first()` over a table where nothing matched scored **zero** for the
  most expensive query Convex will run. It caught a live one immediately:
  `storeIntegrations.getBySiteId` and `getByBrandId` — how both platform webhooks
  resolve their store on every delivery — were exactly that shape, and now narrow
  through `by_platform_enabled` first. No new index; the narrowing moved into the
  one that was already there. That is `dueForSending`'s own defect
  (#327), and it is what the hand-rolled double this one replaced was thrown out
  for. It was masked rather than hidden: `filter` took a plain JavaScript
  predicate while every real handler passes Convex's `FilterBuilder`, so the shape
  threw `TypeError` instead of under-counting — and the obvious repair would have
  turned that crash into a silently green full-table scan. It now speaks
  `FilterBuilder` and charges every document it walks, and eight cases in the
  double's own guard hold it there.

  The refusal only ever names a control the screen is rendering: « Relancer » is
  offered for `paused` and `failed`, so a campaign cancelled mid-list is told
  instead that it stays as the record. A refusal that sends the owner after a
  button that is not there is the dead end this whole change is about.

  Probes. Three throwaway suites, each reverted against the unfixed code:
  the games and prizes screen showed « Suppression impossible — réessayez » where
  the server had said « Désactivez-le pour le retirer du jeu », and the two email
  screens « Échec de la suppression » where it had named the campaign blocking
  them; seven of nine backend cases
  failed and the two controls — a delete that should still work — passed; and the
  counting cases returned 1 and 0 where Convex charges 6,000. Two tests that were
  green while blessing the defect are rewritten and named as such: the three
  `promotions.remove` cases in `queryBounds.test.ts` and the app-level
  "clears the offer at once and its usage record in batches".

  Closes #412.

- e569498: Stop six bare deletes leaving rows pointing at nothing

  Six handlers were written as `ctx.db.delete(args.id)` against tables other rows
  reference, and `v.id("table")` validates how an id is ENCODED, not that it still
  resolves — so no validator, no type and no test ever complained. Each one cost
  something different, and every one of them shipped to every client site.

  **A diner's won prize could be deleted out from under them (#326.1).**
  `prizeRedemptions.prizeId` is REQUIRED. Tidying the prize list left the
  redemption standing at `pending`, holding an id that resolves to nothing, and
  `redeemByCode` dereferences that column — so the person at the till with a valid
  code was told their prize did not exist. `games.remove` was the same shape over
  `gamePlays.gameId`, and worse in one respect: a play carries the diner's consent
  under art. 7.1, which is the establishment's evidence that it was allowed to
  record a fingerprint at all. Both now refuse and name the way out, which already
  existed and is already on the screen — `isActive: false` takes the prize out of
  the draw and the game off the QR codes immediately, without touching a record. A
  prize nothing has won still deletes, and the wheel section that named it keeps
  its label and colour and loses only the dead link.

  **Deleting an email template halted a send; deleting a segment widened one
  (#326.2).** `emailCampaigns.templateId` is required, so `sendBatch` read the
  template, found nothing, logged one line and returned: the campaign sat at
  `sending` for ever while the owner's screen read « En cours ». `segmentId` is
  optional, and that was worse — the code said "if the segment is there, filter by
  it", so a deleted segment meant no filter at all and the campaign went to the
  WHOLE list. Copy written for one slice reached every subscriber, in batches, and
  marketing mail cannot be recalled. Both deletes now refuse while a campaign that
  can still send, or any automation step, names them; a campaign that has finished
  does not block, which is the trade written down in `emailAssetReferences.ts`.

  **And the send no longer holds.** A batch that cannot read its template, its
  configuration or its segment marks the campaign `failed` with a sentence naming
  what to fix, shown under the campaign's name. That is a new status and a new
  `failureReason` column — relaunchable, so the owner fixes the cause and presses
  « Relancer », which keeps the cursor and resumes rather than mailing the first
  batch twice. The two defences are not redundant: the refusal covers deletes from
  now on, the failure covers every template or segment already gone, and every
  other way one can go missing.

  **A cancelled couponed order burned the diner's one use (#326.3).** The
  cancellation branch restored tracked stock and left the promotion exactly as
  checkout had spent it — `promotions.usageCount` still counted it, and the
  `promotionUsages` row still stood against the customer's email. A one-per-
  customer code was gone for good on an order the restaurant itself cancelled, and
  no screen anywhere edits either number. Both are released now, from a shared
  helper called by BOTH cancellation paths, because `updateFromWebhook` is a
  separate handler and a rule that lives in one caller is a rule the other skips —
  which this file has already paid for once, with a kitchen ticket left live on
  the pass after Uber cancelled the order.

  **`orders.remove` would have taken the invoice (#312).** One line, against a row
  that `payments.orderId`, `kitchenTickets.orderId` and `invoices.orderId` all
  reference REQUIRED. No screen calls it, which is the reason to guard it now
  rather than later: it is live under `orders:delete`, and whoever wires the first
  button to it will not be reading this file. It refuses on an invoice — a
  numbered fiscal document in an unbroken series, art. 242 nonies A CGI — and on a
  payment that moved money or is still in flight; it carries away the kitchen
  tickets, the dead payment attempts and the spent delivery quote, and releases
  the promotion. `orderCascade.ts` records which table is on which side and why.

  **The dead Uber Eats importer is gone (#313).** `uberEatsOrders.saveFromPlatform`
  inserted `paymentStatus: "paid"` with no `releaseToKitchen` — an order paid for
  and never reaching the pass — and its docblock claimed the webhook action called
  it. `grep` found zero callers; the live path is `orders.createFromWebhook`.
  Deleted rather than wired, because keeping it means keeping a second, wrong way
  to create a marketplace order. It was also the only writer of
  `orders.scheduledFor`, so `FEATURES.md` now says that field has none at all.

  **Four indexes were added for these guards, and one for the release:**
  `gamePlays.by_gameId`, `gamePlays.by_prizeId`, `prizeRedemptions.by_prizeId` and
  `promotionUsages.by_orderId`. Each answers its question in one row rather than
  by reading an establishment's whole history, so a delete does not get more
  expensive the longer a restaurant has been trading.

  **BREAKING:** `@be-in-digital/convex-functions` no longer exports
  `uberEatsOrders`, and the `./uberEatsOrders` subpath is removed. Both apps'
  wrappers and generated `api.d.ts` are updated here.

  32 new cases. `destructivePaths.test.ts` seeds the referencing row, runs the real
  handler and asserts BOTH halves — the refusal carries the code a screen switches
  on, AND neither side of the reference was deleted; 16 of its 21 fail against the
  code they fix, and the 5 that pass are the controls proving a delete that should
  still work does. The double is index-faithful, so the four new indexes are proved
  declared rather than merely spelled correctly. Both apps gain four cases on the
  campaign state machine.

  Closes #326. Closes #312. Closes #313.

- bdf8012: Close the second double-collection vector, and stop a correct refusal 500-looping

  #378 closed cash-then-card: `assertSettlesOrder` refuses a card settlement on an
  order the counter has already collected, because the order records WHICH method
  it is on and the two differ. Two card sessions differ in nothing it can see.

  A diner who opens checkout twice — a stale tab, a back-navigation, a retry —
  left two live Stripe Checkout Sessions against one order. Both referenced that
  order, that currency and that total, so the guard passed both; both were `card`,
  so #378's method check did not separate them; and `settlePayment` deduplicated
  on `externalId`, which two payment intents never share. Measured on the code as
  it stood:

  ```
  [PROBE] order total: 120000  collected: 240000
  [PROBE] succeeded rows: 2
  [PROBE] second session refused: false
  ```

  A 1 200 € order collected 2 400 €, in two `succeeded` rows, each independently
  refundable, with the order untouched and nothing anywhere saying so (#411).

  **The ledger is where the rule now lives — for every writer, not four of them.**
  `settlePayment`'s order-level check carried `p.provider !== args.provider`,
  which read two Stripe charges as one collection. That clause is gone, and it
  cannot come back: execution only reaches the check when `by_externalId` found no
  row for THIS charge on THIS order, so every row still standing there belongs to
  another charge, whoever minted it. Stating it inside `settlePayment` was not
  enough either — the claim was that this made the invariant "a property of the
  ledger rather than of five call sites remembering to ask a guard", and two other
  writers reached the same table without asking anything: `orders.markCashPaid`
  inserts a `succeeded` row directly, and `payments.create` + `payments.updateStatus`
  is a public pair under `payments:write` that writes one in two steps. All three
  now read `collectionOnOrder` from the new `paymentLedger` module.

  `assertSettlesOrder` is unchanged and stays the fast pre-check: it is given one
  claim and one order and no charges, so it cannot tell a redelivery from a second
  session, and the two tests that describe it waving one through now say so.

  **A refusal is not a failure, and the two need opposite answers.** The Stripe
  webhook answered 500 to every throw. A settlement refusal is permanent —
  retrying delivers the same answer — so Stripe retried for three days, each
  attempt re-ran the guard to the same refusal, the delivery stayed
  `processed: false` and was re-admitted as `in_flight` every time, and nobody was
  told. It now answers 2xx, retires the delivery and RECORDS it: refusing the row
  keeps the ledger honest but does not make the diner whole, because a provider
  does not report a charge it did not take. `payment_collection_refused` is a new
  `systemAuditLog` action, rendered in Dashboard → Système, naming the order, the
  charge and the reason — the only place a human learns a refund is owed. It takes
  its ids as strings on purpose: Convex validates arguments before a handler runs,
  so a `v.id()` there would throw out of the very catch block whose contract is
  "this can never fail its caller", straight back into the retry loop.

  `deliberateSettlementRefusal` tells the two apart, and reads the error's `data`
  rather than its class: Convex rebuilds a `ConvexError` across the mutation
  boundary, so `instanceof` is false at exactly the call site that matters and
  fails closed into the loop. Its code list is a `Record` over both reason unions,
  so a ninth reason does not compile rather than silently reading as a failure.

  The settlement is also written BEFORE the order status now. They are two
  transactions, and writing the status first committed it where a refusal could
  still follow — leaving an order reading « Payé » with no payment row against it.
  That was survivable while every refusal answered 500 and the endpoint showed red
  in Stripe's dashboard; a 200 makes it final and silent.

  **And the second charge is no longer taken at all.** `createCheckoutSession`
  overwrote the order's stored session id and told Stripe nothing about the old
  one, which stays payable for about twenty-four hours. It now expires the
  previous session before the replacement becomes payable, and READS the outcome:
  Stripe reports "already paid" and "already expired" with the same error, and one
  of those means the previous session has been completed with its settlement still
  in flight — the order reads `pending`, so no status gate can see it, and a
  replacement would collect the same meal twice. All three provider checkouts also
  refuse outright to open a payment on an order already collected, reading both
  the order's status (which counts `refunded`, so they agree with
  `markCashPaid`: a refunded order is closed business) and the ledger (which
  catches the window between a payment row being written and the status catching
  up). The refusal is a `ConvexError` — `order_already_paid` — so the diner reads
  « Cette commande a déjà été réglée » rather than being told to retry a payment
  they have already made.

  What this does NOT close, and the ledger is why it does not have to: an action
  is four round trips with no transaction around them, so two checkouts genuinely
  in flight at once can still open two sessions. They settle through
  `settlePayment`, which is serializable — one succeeded row, the second refused
  and recorded.

  **A Stripe key the API rejects no longer arms the card tile.**
  `cardPaymentAvailability` checked `STRIPE_SECRET_KEY.startsWith("sk_")`, which
  is a check on the shape of a string: a key that is revoked, rolled or from
  another account all passed it, so the tile was pre-selected and the
  `StripeAuthenticationError` thrown by `sessions.create` reached the diner as the
  redacted "Server Error" #374 was written to remove. Only Stripe can answer
  whether a key works and a query cannot ask it, so the verdict is recorded when
  it is learnt — in the new `cardProviderHealth` table, written by the hourly
  `stripe.verifyStripeKey` and by every checkout that succeeds or is refused — and
  read back by the availability query.

  Its own table for two reasons, both learnt the hard way from putting it on
  `globalSettings` first: that document is read by a PUBLIC query before any
  sign-in, and a provider's refusal message names the key's mode and last four
  characters; and it is created by exactly one thing, the owner pressing
  Enregistrer, so a deployment whose owner has never opened that screen — a fresh
  one, which is what #374 is about — had nothing to write a verdict onto and the
  fix was inert. The row is written only when the verdict moves, because it is
  read on the order path and Convex conflicts a write with every concurrent
  transaction that read it. Hourly rather than nightly because the cron is the
  only writer that can bring the tile BACK: once a verdict disarms it, no diner
  can reach the checkout that would report the key working again.

  A credentials refusal, and only that: a declined card, a rate limit or an outage
  say nothing about the key, and disarming the tile over one would take card
  payments away from a working establishment.

### Patch Changes

- ecb21a1: Stop `promotions.create` and `promotions.update` accepting the configuration of a withdrawn offer type

  #403 withdrew « Produit offert » and « Offre BOGO » as discount **types** — both
  alter the item list rather than the order total and no code path builds those
  items, so `assertHonourableDiscountType` refuses them on create and on update,
  and the promotion form stopped offering them. It left their five configuration
  fields on both args validators: `freeProductId`, `bogoTriggerProductId`,
  `bogoRewardProductId`, `bogoTriggerQuantity`, `bogoRewardQuantity`. Both
  handlers spread `args` straight into the row, so all five went on reaching the
  database unexamined for another five commits.

  **One of them was live.** `products.remove` reads the first three to refuse
  deleting a dish a promotion still points at. Measured against the real
  mutations: a plain `percentage` promotion given a `freeProductId` made that dish
  **undeletable**, and the refusal named a promotion that used the product in no
  way the owner could find — the field is on no form, and `update` has no way to
  clear an optional field, only to overwrite it with another product. There was no
  route back short of deleting the promotion.

  The five are gone from both validators. That is the whole guard: a Convex
  mutation refuses an argument no validator declares — `Validator error:
Unexpected field \`freeProductId\` in object`— which the tests measure rather
than assume.`discountTypeValidator`keeps all five **literals** deliberately:`update`reads`existing.discountType` to refuse an edit that would keep a
  withdrawn type, and that refusal is a French sentence an owner can act on. A
  narrowed union would turn it into an untranslated validator error.

  **The schema keeps the five as `v.optional`**, because rows written before the
  withdrawal still hold them — the treatment `stores.integrations` already has.
  The comments there described a feature that cannot be created ("for discountType
  === \"free_product\"", "BOGO fields"); they now say that nothing writes these,
  that one thing reads three of them, and what implementing `bogo` would take.
  `WITHDRAWN_PROMOTION_CONFIG_FIELDS` lives in `promotionDiscount.ts` next to the
  withdrawal itself, so the args that must refuse them, the delete guard that
  still reads them and the tests that hold both name one list.

  **The delete refusal now names an action that exists.** The guard still blocks —
  a legacy row pointing at a deleted dish is the dangling reference it was written
  to stop — but « Modifiez ou supprimez cette promotion » was half an instruction
  nobody could follow. The two references are told apart: `targetProductIds` is
  the promotion's product scope, which the form renders and the owner can unpick,
  and keeps that sentence; the three withdrawn fields get their own, saying that
  the reference is not on the promotion form and cannot be removed there, and that
  deleting the promotion is what frees the dish. Deactivating does not clear it,
  so the message does not suggest it.

  `promotion-discount-types.test.ts` asserted the form source held no
  `bogoTriggerQuantity` and no `bogoRewardQuantity`, and nothing at all about the
  server — which is exactly how the server half survived the #403 cleanup. It now
  covers all five names on both ends, against the validator objects rather than a
  source scan.

## 4.1.0

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

## 4.0.0

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

- cde4410: One design system, and per-store theming that reaches a diner

  Two structural defects, resolved together because the first cannot work until
  the second is settled: theming has to drive one design system.

  **Per-store branding painted nothing.** The Design screen has always written
  `stores.branding` — colours, typography, logo — and nothing read the colours
  back. `--primary` had exactly one definition per app, the literal `24 95% 53%`
  in `app/globals.css`, so every establishment the engine has delivered shipped
  the same orange. `buildBrandingCss` turns the stored blob into design tokens
  and `StoreTheme` paints the storefront with them, following the same
  establishment the rest of the storefront follows. Colours are re-emitted from
  parsed numbers and font families rebuilt from an allowed character set, because
  `updateBranding` validates a type and a length, not grammar. The foreground on
  a brand colour is chosen by contrast ratio rather than fixed to white — white
  on `#ffeb3b` is 1.07:1, a button whose label cannot be read.

  **The design system was forked five ways.** `packages/ui` (50 components),
  `apps/reference/components/ui` (37), `apps/themes/components/ui` (37,
  byte-identical to reference), `packages/admin/src/ui` (9). Sixteen of the
  twenty-six shared names had drifted: a default Button was `h-10` in the package
  and `h-9` in the apps, with different focus rings, so one storefront rendered
  two button heights depending on the page. There is now one implementation, in
  `packages/ui`, on the newer shadcn generation, reached through one specifier.

  Breaking changes for `@be-in-digital/ui`:
  - `Input`, `Textarea` and `Checkbox` are bare primitives. The composed-field
    API (`label`, `error`, `description` props and a wrapping `div`) is gone —
    pair them with a `Label`, which is what every call site but two already did.
  - `Breadcrumb` is the composable seven-part set. The data-driven component that
    took `items` is gone, and with it the `BreadcrumbItem` _type_ — that name is
    now a component.
  - `Alert` keeps `warning` and `success` but loses its `title` prop and its
    automatic icon map; use `AlertTitle`, `AlertDescription` and your own icon.
  - `Button` sizes shift to the current generation (`default` 40px → 36px) and
    gain `xs`, `icon-xs`, `icon-lg`. `Card`, `Switch`, `Label`, `Badge`,
    `Skeleton`, `Table` and `Tooltip` change geometry with them.
  - `ButtonProps`, `InputProps` and the other per-component prop interfaces are
    no longer exported; the components are typed from `React.ComponentProps`.
  - The package is published as TypeScript source. `exports` points at `src`,
    there is no `dist`, and consumers must transpile it. This is what restores
    the `"use client"` boundaries the bundler was stripping.

  `@be-in-digital/admin` no longer carries its own copy of nine primitives, and
  re-exports the sidebar from `@be-in-digital/ui`.

  `@be-in-digital/convex-schema` gains a typed `StoreBranding` and
  `StoreDoc.branding`, which were implicitly `any`.

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

## 2.1.0

### Minor Changes

- 5eec48d: Maintenance & migration system: a per-deployment maintenance contract (derived status, update coverage keyed on release date), a release catalog synced from npm that locks published versions once the contract expires, site migration requests (controlled-transition workflow plus audit log), self-serve renewal through Stripe (the `bidProduct: maintenance` webhook creates a contract, never ownerEntitlements), and SES notifications when a request is opened. Adds a Maintenance tab to the admin System page.
- 83f6af9: Enforce the order status machine in `updateStatus`.

  The mutation wrote whatever status it was handed. Nothing stopped an order going from `pending` straight to `completed`, or a cancelled order being revived — the transition table existed but only the storefront services consulted it, as advice.

  Three layers each carried their own opinion and they had drifted. The admin UI offered "Envoyer en livraison" on a ready order while the services table forbade `ready -> out_for_delivery`. The table is now single and lives in `@be-in-digital/convex-schema` (`ORDER_STATUS_TRANSITIONS`, `canTransitionOrderStatus`, `getNextOrderStatuses`); the services and the mutation both read it, and `ready -> out_for_delivery` is allowed, matching the button that already existed.

  **Behaviour change:** `updateStatus` now throws `Invalid order status transition: <from> -> <to>` instead of writing. Replaying the current status is an idempotent no-op rather than an error, so webhook retries and double-clicked buttons stay harmless. `updateFromWebhook` is deliberately left unguarded — Uber Eats and Deliveroo are authoritative for the orders they own.

  The cancellation window stops at `confirmed`, matching what Deliveroo permits: an order already being prepared, ready, or with a rider can no longer be cancelled internally.

## 2.0.2

### Patch Changes

- 7f0122b: Republished from main. Fixes two problems with the 2.0.1 tarballs that broke consumers:
  - `@be-in-digital/core`: the `./auth/rbac` subpath pointed at `src/auth/rbac.ts` while the tarball only ships `dist/` → broken import for consumers (`convex-functions/auth` included). `files` now includes `src`.
  - The type fixes that were on main but never published (promotion-form/email-config in admin, Uber Eats signatures in integrations/convex-functions) go out with this patch — they had been committed without a changeset.

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

All notable changes to this package will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/fr/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/lang/fr/).

## [0.1.0] - 2026-02-14

### Added

#### Complete Convex database schema

**Better Auth tables**

- `user` - Users with authentication
- `session` - Session management
- `account` - OAuth accounts and passwords
- `verification` - Email verifications and tokens

**BeYours extensions**

- `userProfiles` - Extended user profiles with roles and permissions
- `stores` - Multi-store management (unlimited per owner)
- `teamMembers` - Team members with specific roles

**Catalog**

- `categories` - Product categories (hierarchical)
- `products` - Full products with options, allergens, schedules, stock
- `menus` - Set menus and combos

**Orders**

- `orders` - Full orders (delivery, pickup, dine-in)
- `kitchenTickets` - Kitchen tickets with stations
- `printerSettings` - ESC/POS printer configuration
- `payments` - Multi-provider payments (Stripe, SumUp, PayPal, Square, Cash)

**Internationalization**

- `languages` - Dynamic languages (unlimited)
- `translations` - Translations per entity and field
- `translationJobs` - GPT-3.5 auto-translation jobs

**Gamification**

- `gameQRCodes` - QR codes on restaurant tables
- `requiredActions` - Required social actions (Google review, Instagram follow, etc.)
- `games` - Games (Wheel of Fortune, Scratch Card) with a controllable win rate
- `prizes` - Winnable prizes with types and validity
- `gamePlays` - Play history with a 24h cooldown
- `prizeRedemptions` - Prize redemptions with QR codes

#### Complete Zod validators

**50+ validators** for every CRUD operation:

- Stores (create, update, status)
- Categories (create, update)
- Products (create, update, stock)
- Menus (create, update)
- Orders (create, update status, update payment)
- Kitchen (create ticket, update status)
- Printers (create, update)
- Payments (create, refund)
- Languages (create, update)
- Translations (create, batch translate)
- Team (create, update)
- Gamification (QR codes, actions, games, prizes, play, redeem)
- User Profiles (create, update)

**Validator features:**

- Error messages in French
- Strict format validation (emails, URLs, country codes, schedules)
- Automatic transformations (uppercase, lowercase, normalization)
- Sensible defaults
- Business constraints (prices in cents, win ratio 0-100%, etc.)

#### TypeScript types

**90+ exported types** including:

- Input types (CreateXInput, UpdateXInput)
- Document types (XDoc with \_id and \_creationTime)
- Enum types (OrderStatus, PaymentStatus, UserRole, etc.)
- Complex types (ProductOption, OrderItem, etc.)
- Utility types (BaseEntity, PaginationParams, etc.)

#### Full documentation

- `README.md` - Package overview
- `EXAMPLES.md` - Concrete usage examples (7+ scenarios)
- `CHANGELOG.md` - Change history

#### Unit tests

- 23 Vitest tests covering all the main validators
- Positive and negative validation tests
- Edge case tests
- Coverage of the automatic transformations

#### Optimized indexes

**35+ indexes** for fast queries:

- Simple indexes (`by_storeId`, `by_email`, etc.)
- Composite indexes (`by_storeId_status`, `by_storeId_categoryId`, etc.)
- Sort indexes (`by_storeId_createdAt`, `by_storeId_sortOrder`, etc.)

### Configuration

- TypeScript strict mode support
- ESLint configuration
- Vitest configuration for unit tests
- Build configuration with tsconfig.json
- Private package for the monorepo

### Dependencies

- `convex` ^1.18.0 - BaaS backend
- `zod` ^3.24.0 - Schema validation

### Technical notes

- **Multi-tenant**: 1 Convex instance per restaurant
- **Prices**: Stored in cents (integer) to avoid precision problems
- **Timestamps**: In milliseconds (Date.now())
- **Country codes**: ISO 3166-1 alpha-2 format (2 letters)
- **Language codes**: ISO 639-1 format (2-5 letters)
- **Schedules**: HH:mm format (24h)

### Architecture

- Centralized schema, reusable across every app
- Shared validators for consistent validation
- TypeScript types inferred automatically from Zod
- Barrel exports for ease of use

---

## [Unreleased]

### Coming up

- Validators for webhooks (Stripe, Uber Eats, Deliveroo)
- Types for real-time events
- Helpers for price calculations
- Utilities for slug generation
- Migration scripts
- Performance benchmarks
- Auto-generated API documentation

---

[0.1.0]: https://github.com/be-in-digital/beindigital-engine/releases/tag/convex-schema-v0.1.0
