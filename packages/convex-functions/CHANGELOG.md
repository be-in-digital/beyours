# Changelog

## 7.1.0

### Minor Changes

- c5500af: Give a Resend deployment a feedback path.

  `EMAIL_PROVIDER=resend` is the escape hatch for a client whose AWS SES
  production-access request was refused. That deployment shipped with
  `/webhooks/ses` as the only feedback endpoint in the app, and SNS never calls
  it, so nothing suppressed a dead address, nothing recorded a spam report, and
  `delivered` read 0 for ever. The first symptom available to anybody was the
  sending domain being throttled.
  - `convex-functions` gains `./resendSignature`: the Svix scheme's testable
    half — which headers carry the signature, exactly which bytes are signed,
    how old a message may be, and which Resend event maps onto which of ours.
  - `core` declares `RESEND_WEBHOOK_SECRET`. The route refuses every delivery
    while it is unset rather than acting on an unverified body, because that
    body names the subscriber to suppress.

### Patch Changes

- Updated dependencies [c5500af]
  - @be-in-digital/core@4.2.0

## 7.0.1

### Patch Changes

- Updated dependencies [92dc32f]
  - @be-in-digital/convex-schema@6.2.0

## 7.0.0

### Major Changes

- 549026f: Refuse an SNS notification from a topic this deployment was never told about

  `isAllowedTopic` answered `true` on an empty list, and the argument for it was
  that SNS delivers only to a confirmed subscription while `/webhooks/ses` refuses
  to confirm one. The argument has a hole and the hole is the attack: **nothing
  requires a subscription at all.** The endpoint is an HTTPS URL that takes a POST
  from anyone. An attacker publishes on a topic in their own AWS account, keeps
  the envelope Amazon signed for them, and replays it here — genuine signature,
  certificate on an allowed host, topic check waved through — after which the
  handler marks whichever subscribers the body names bounced and complained,
  suppressing a client's mail to real customers.

  So a deployment with no `SES_SNS_TOPIC_ARN` now refuses notifications as well as
  confirmations, logging `topic_not_configured` and the ARN it saw, which is the
  value to paste in. `tasks/webhook-migration-checklist.md` already required the
  variable to be set before a subscription is confirmed, and the SES subscription
  has not yet been repointed, so nothing in the fleet is currently relying on the
  old behaviour.

  `SES_SNS_ALLOW_ANY_TOPIC=true` restores it for a deployment caught
  mid-configuration with a subscription an operator already confirmed. It is a
  separate variable on purpose — restoring a fail-open should be an act somebody
  performed — and it never re-opens subscription confirmation, which is the half
  that made a forged topic self-service.

### Patch Changes

- 549026f: Let the Convex authorisation rule recognise Convex Auth's session lookup

  `GUARD_SIGNALS` matched `/AuthUser\b/`, which is every Better Auth spelling the
  engine uses and none of Convex Auth's: `getAuthUserId` continues into `Id`, so
  the word boundary fails. Turning the rule on for `apps/site` — 68 publicly
  callable functions that had never been linted — made forty-odd correctly guarded
  queries read as `@guarded-inline` claiming something the rule could not see,
  which is the failure mode that gets a guard switched off rather than obeyed.

- Updated dependencies [549026f]
  - @be-in-digital/core@4.1.0

## 6.2.0

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

### Patch Changes

- Updated dependencies [e5394e5]
  - @be-in-digital/convex-schema@6.1.0

## 6.1.0

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

- Escape JSON-LD properly, run the guard on the path every caller takes, and serve no draft

  Five defects a diner or an attacker meets, and the lint rule that was supposed
  to catch the worst of them and could not.

  **Stored XSS in the JSON-LD block, reachable by a manager.** `JsonLd` escaped
  `</script>` with `.replace(/<\/script>/gi, …)`, and an HTML parser ends a script
  element on `</script` followed by whitespace, `/` or `>`. `JSON.stringify`
  escapes tab, newline and carriage return but not space or solidus, so
  `</script >` and `</script/>` both walked straight through. Reproduced as
  execution rather than injection:

      HTML: ..."name":"</script ><script>document.title='PWNED'</script >"...
      document.title after parse = "PWNED"

  It is reachable because a blog title is sanitised nowhere — the body is
  sanitised twice, on write and again on publish — and rides `saveDraft` →
  `publishArticle` → `article.content.title` into the breadcrumb trail.
  `Role.MANAGER` holds `content:write` and production CSP grants
  `'unsafe-inline'` with no nonce. `serialiseJsonLd` now escapes `<`, `>`, `&`,
  U+2028 and U+2029 to their `\uXXXX` forms: those characters cannot occur in
  JSON output except inside a string, so the encoding is total in a way a pattern
  match cannot be, and a JSON parser decodes them back unchanged. `title`,
  `excerpt`, `metaTitle` and `metaDescription` also go through a new
  `sanitizePlainText` on both write and publish.

  The only previous test asserted
  `read("lib/json-ld.tsx")).toContain('type="application/ld+json"')` — a
  string-containment check against the source file, which says nothing about
  escaping and passed throughout.

  **A permission check that ran for nobody.** `validateIntegration.validate`
  carried `@guarded-inline: checks settings:read by role` and put the check inside
  `if (!identity) { … }` — the branch only unauthenticated callers take, and they
  were rejected on the next line anyway. Every signed-in account, a diner's
  included, skipped it and could drive credential probes against the
  restaurant's own Uber Eats, Deliveroo and Uber Direct credentials, using the
  sanitised replies as a store/brand-id oracle. `categories.reorder` had the same
  shape with a smaller blast radius: its `requireStorePermission` sat inside
  `if (storeId)`, and `storeId` stays null when `args.ids` is empty, so
  `{ ids: [] }` reached the handler authorised by nothing.

  **The rule that should have caught both.** A harness of twelve declarations —
  one control that must error, one that must pass, ten known evasions — was run
  against `eslint/convex-auth.mjs` on ESLint 9.39.4. Ten of the twelve slipped.
  The rule read declarations as TEXT (`sourceCode.getText()` returns comments and
  string literals), so a guard named in prose counted as a guard, a variable
  merely named `requireX` counted as a call to it, an unknown or aliased or
  member-expression builder was ignored entirely, and `permission: undefined`
  satisfied the permission rule. It now walks the AST and asks the three
  questions text cannot answer: is the signal a call, is it in code, and does
  every caller reach it. The harness is kept as
  `src/__tests__/convex-auth-rule.test.ts` — the rule had no test of any kind.
  Over the real tree it reported exactly the two live defects above and, once its
  heuristics were corrected against 56 false positives on `ctx.db.query(…)`,
  nothing else. Its glob widens from `convex/*.ts` to `convex/**/*.ts`.

  One limit is asserted rather than papered over: a marker's REASON cannot be
  graded by a linter, so harness case K passes and will keep passing. That is now
  the only part left to human judgement, instead of being the part everyone
  trusted while the mechanism underneath it was decorative.

  **A draft dish on the public carte.** `products.list` is public and
  unauthenticated and returned every row, `isActive` ignored:

      products.list => [{"name":"LIVE"},{"name":"SECRET-DRAFT","isActive":false}]

  `categories.list`, `menus.list` and `products.getById` were the same; `menus`
  already declared the `by_storeId_isActive` index the query did not use. #440
  closed this in `getManyByIds` and said the fix made it behave "like every other
  public read of that table" — measured, the other public reads did not filter.
  `list` is what the public carte, `sitemap.ts` and the JSON-LD all call, and
  `orderLine.ts` refuses an inactive product at order creation, so a draft
  rendered live at full price, was indexed, and the diner who added it was
  refused at payment. The three public reads now serve what is on sale; the
  drafts move to `products.listAll` and `categories.listAll`, store-scoped behind
  `products:read`, which the trending picker and the kitchen station mapping use.

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

- 6d6df2d: Count only money that arrived, and stop a settled charge sitting at `pending`

  Three defects on the money path, all of them a layer answering a question next
  to the one it was asked.

  **The dashboard counted orders nobody paid for.** `computeDashboardStats`
  filtered on `status !== "cancelled"` — a test about orders being UNMADE,
  standing in for one about orders being PAID — and `DashboardOrderRow` did not
  carry `paymentStatus` at all, so the distinction was not available to be got
  wrong; it was absent. An abandoned checkout, a declined card and a table whose
  cash has not been rung up all counted in full. Measured on a probe store: the
  card read 1 720,00 € against 20,00 € collected.

  `revenue` is now money that arrived (`COLLECTED_PAYMENT_STATUSES`: `paid`,
  `refund_pending`, `partially_refunded` — the states in which the till is
  holding it). `orderCount` still means orders that happened, because that is
  what an owner is asking when they look at « Commandes », and the difference is
  reported as `uncollected` rather than left to be inferred. « Chiffre
  d'affaires » now carries « dont X € en attente d'encaissement » when the two
  disagree.

  **A settled charge could sit at `pending` for ever.** `settlePayment` asked
  whether a row for this charge EXISTED, not whether it was DONE, so a
  `payment_intent.succeeded` landing on a placeholder row returned it untouched
  while `settleByExternalReference` marked the ORDER paid. The result was « Payé »
  over a `pending` payment row — which `planRefund` refuses permanently, and which
  `collectionOnOrder` does not count, so a second collection was still allowed on
  the same order. The row is now promoted in place (provider, amount and currency
  taken from the settlement: a refund is issued against whatever `provider` says).
  `LEDGERED_STATUSES` names the states that mean "already on the ledger" —
  including `refunded`, so a replayed event cannot resurrect a refunded charge.

  **A 100 % coupon produced an order no card could pay.**
  `createCheckoutSession` sent `unit_amount: order.total` and asked nothing about
  it; Stripe's EUR floor is 0,50 €, and the session create throws an SDK error
  that Convex redacts to "Server Error" behind the checkout's generic retry
  toast. The layers disagreed in both directions: `assertSettlesOrder` settles a
  0 c order and `settlePayment` refuses to write a row for one.
  `cardChargeFloor.ts` holds the rule — per-currency minimums, and `nothing_to_pay`
  as its own refusal, because an order that owes nothing is not a small payment —
  and the three card actions enforce it before calling a provider.

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

### Patch Changes

- Updated dependencies [7713538]
- Updated dependencies [6d6df2d]
- Updated dependencies [b9e20ea]
- Updated dependencies [6d6df2d]
  - @be-in-digital/convex-schema@6.0.0
  - @be-in-digital/core@4.0.0

## 6.0.0

### Major Changes

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

### Minor Changes

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

- 58f890f: Put the restaurant's website and its orders in the backup

  The export order and the import allow-list were written out twice — once in
  `system.exportBackup`, once in `systemInternal.ts` — and kept in step by hand.
  Between them they named **22 of the schema's 77 tables**. Omitted: `orders`,
  `payments`, `kitchenTickets`, `translations`, `teamMembers`, and **all sixteen
  `cms*` singletons** — so a "backup" of a restaurant's website did not contain
  that website's pages, and a restore reached zero orders (#169, #366).

  **One list now**, `@be-in-digital/convex-functions/backupTables`, read by both
  sides: 53 tables exported and restored, 3 exported and never re-inserted, 21
  excluded with the reason written down next to the name.

  The fiscal archive is the interesting case. `tables/invoices.ts` states the rule
  in the schema itself — an invoice is never edited and never deleted, so a
  restore must not delete-and-re-insert the series (art. 242 nonies A CGI). But a
  backup that loses an establishment's invoices is not a backup of that
  establishment. Both are answered by carrying them in the file and refusing them
  at the import, which is also what keeps `orders.invoiceId` resolving across a
  restore: those rows never move.

  **Two defects found on the way in.**

  `stores.stationMapping[].categoryId` points at `categories`, and `categories`
  points back at `stores`. No order satisfies both, so the kitchen routing came
  back naming categories that no longer existed — silently, because `v.id()`
  validates an id's encoding rather than that it resolves, so every ticket fell
  through to single-station behaviour. `remapDeferredReferences` is a second pass
  with the full id map, and `DEFERRED_REMAP_TABLES` is where an edge the order
  breaks on purpose has to be declared.

  And the export carried two live single-use credentials into a JSON file an
  administrator downloads to a laptop: `teamMembers.invitationToken`, which grants
  a role to whoever opens the link, and `emailSubscribers.doubleOptInToken`. Both
  fields are optional, so a restore comes back without them and the invitation is
  re-sent.

  A restore now also schedules the retention sweep: a backup carries personal data
  and can be older than the window it is restored into, and re-running the purge
  is what stops a restore resurrecting what the establishment was obliged to
  remove (art. 5.1.e).

  The manifest states, in the file itself, what a restore will not put back and
  what the backup does not carry at all — table by table with a reason each. The
  admin's Sauvegarde card says the short version before anyone clicks. "Absent
  because it is not the establishment's" and "absent because someone forgot" used
  to look identical from the outside.

  Tests check the lists against the schema rather than against memory: the import
  order is verified to be a topological sort of the foreign-key graph derived from
  Convex's own validators, and every table in the schema must be classified
  exactly once — which is how sixteen CMS singletons went missing without anyone
  noticing.

  Refs #169, #366.

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

- ecb21a1: Repair the orders ↔ invoices link a restore breaks, and stop the comment that said it did not

  `backupTables.ts`'s header claimed that leaving the invoices out of the import
  "keeps `orders.invoiceId` correct across a restore: the invoice rows are never
  re-inserted, so their ids never change, so the reference still resolves". That
  is true of the invoice's own id and says nothing about the ids inside it, or
  about the other end of the link. `backup-coverage.test.ts` skipped the
  `orders → invoices` edge on the strength of the sentence
  (`if (exportOnly.has(target)) continue`), and never walked `invoices`' own
  references at all — so neither half was ever examined.

  **`invoices.orderId` breaks on EVERY restore, the same deployment included.**
  `orders` is deleted and re-inserted under new ids; the invoices sit untouched
  naming the ids the orders had before. That is the authoritative half of
  `assertOrderHasNoInvoice` — the half that exists for an order invoiced before
  `orders.invoiceId` was populated — so after a restore such an order could be
  deleted with its invoice standing. `invoices.storeId` moves with it and takes
  the establishment's invoice list (`by_storeId_issuedAt`) with it. Measured:
  `invoice.orderId = 10001;orders`, restored order `10004;orders`,
  `invoices.by_orderId(restored order) = null`.

  **`orders.invoiceId` breaks on a REBUILT deployment**, where the invoices are in
  the file and not in the database. `invoiceRefusal` reads that field for
  truthiness rather than resolution — `if (order.invoiceId) return "already_issued"`
  — so the sale could never be invoiced again, by the automatic path or the manual
  one, and the admin showed no number and the reason "already issued". Measured:
  `ctx.db.get(invoiceId) = null`, `invoiceRefusal = already_issued`.

  Neither is answerable by the import ORDER: an export-only table has no position
  in it. Both are now repaired after the last insert.
  `systemInternal.relinkArchiveReferences` rewrites the archive's ids through the
  full map — not editing the document, whose number, dates, parties and figures
  are untouched, but re-pointing this deployment's pointers at the rows the sale
  and the establishment came back as. `systemInternal.reconcileOrderInvoiceLinks`
  then re-points a dangling `orders.invoiceId` at the invoice that stands for that
  order, or clears it when none does, so the order is invoiceable again from the
  new deployment's own series. Nothing fiscal is deleted: the documents are in the
  backup file, which on a rebuilt deployment is then the ONLY copy of that series
  and has to be kept as such (art. L102 B LPF) — `numberSequences` is export-only
  too, so the rebuilt deployment starts a fresh series. The counts reach the
  import's return message and the `backup_import` audit entry, and the rehearsal
  runbook now tells an operator what `clearedInvoiceLinks` obliges them to do.

  Every edge that crosses the archive boundary is declared in the new
  `ARCHIVE_EDGES`, in both directions, with what answers it — including
  `systemAuditLog → stores`, which is left unrepaired **deliberately** and says so:
  rewriting an audit row is the one thing that table is export-only to prevent, so
  after a restore its entries fall out of a non-super-admin's view. Known, named,
  not fixed. `backup-coverage.test.ts` derives the set from the schema and fails
  on an undeclared one, so the next `v.id("invoices")` is a decision rather than a
  dangling reference found during someone's restore.

  Also in this file: the header said "Two edges the order deliberately breaks are
  declared in `DEFERRED_REMAP_TABLES` below" over a one-element array, and had
  since `58f890f` introduced the sentence, the single bullet and the array in one
  diff. No second edge was ever removed — the plural was never true. It now states
  `DEFERRED_REMAP_TABLES.length === 1`, and two guards hold it: the count in the
  prose against the array's length, and one bullet per entry.

- e4955e7: Record what happened to the app-side registrations of these definitions

  No source change here — this is the note that belongs beside one. #413's third
  class was the app-side public Convex surface, which lives in `apps/*/convex` and
  is outside changesets (`apps/*` is on the `ignore` list). It is recorded here
  because the definitions it registered are this package's.

  **Measured, and the issue's own number was wrong.** #413 said 36 callerless
  public functions per app. That counts only bare `query(`/`mutation(`/`action(`
  and misses the 200 exports built with
  `storeQuery`/`storeMutation`/`authedQuery`/`authedMutation` — which
  `lib/storeFunctions.ts` binds to the same generated builders, so they are routed
  just as publicly and merely permission-checked inside. Counting them: **359
  registrations per app, 81 of them with no caller anywhere.** A caller sweep also
  has to tolerate optional chaining, because `packages/admin` takes the API as
  `any` and writes `api?.products?.list`; scanning for `api\.x\.y` alone reports
  132 dead where there are 81, and would have deleted live screens' backends.

  **Eleven of the 81 were unauthenticated storefront reads no screen opened** —
  `products.getFeatured`, `getBySlug`, `getByCategory`, `cms.getPage`,
  `menus.getById`, `categories.getById`, two blog listings, two translation reads,
  and `orders.getByViewToken`. Their live siblings (`products.list`,
  `cms.getPageBlocks`, `orders.getById`) are what the storefront actually calls.
  None of the 81 was an unguarded write, so this was never an open door; it was
  surface, and #281 is the precedent for what surface becomes.

  **71 registrations are gone, in both twins identically. Ten are kept, annotated
  `@kept-callerless` at the declaration**, because something outside the code
  reaches them: three from `apps/reference`'s own ops scripts, and seven named by
  a runbook or guide as something an operator runs by hand.

  **Making them internal was tried first, and is wrong.** Every one authorises
  from the _caller's_ identity, and an internal function reached from a cron, the
  Convex dashboard or `npx convex run` has none — it would refuse every caller it
  could ever have, which is the same defect as the `useToast` that threw.
  `tests/convex/scheduled-paths.test.ts` caught three Deliveroo actions doing
  exactly that, and that is why the answer is delete-or-keep rather than
  delete-or-internalise.

  **One removal was a real break, found by review rather than by a test.**
  `uberEatsOAuth.generateAuthorizeUrl` is the only writer of a `uberEats` row in
  `oauthStates`, and the live `uberEatsConnectCallback` HTTP route validates that
  row before exchanging a code. With no writer the callback could only ever answer
  "Invalid or expired OAuth state" — Uber Eats would have become unconnectable on
  every client. It is restored and annotated, along with the five others a runbook
  names. The lesson is in the guard's shape: "no caller in this repository" and
  "nothing needs this" are different claims, and a source scan can only measure
  the first.

  `apps/*/tests/convex/public-surface.test.ts` now holds the line in both apps: it
  enumerates every public registration, requires a caller for each, and requires
  any exception to be listed _and_ to carry its reason next to the code. It fails
  when a callerless public function is added, and its allowlist is itself checked
  for entries that have gone stale.

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
