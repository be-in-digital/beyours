# @be-in-digital/core

## 4.2.0

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

## 4.1.0

### Minor Changes

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

## 4.0.0

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

## 3.0.0

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

- 58f890f: Make `S3Service.delete` remove every version, not write a delete marker

  `setup-aws.sh` turns bucket **versioning** on, and on a versioned bucket
  `DeleteObject` without a `VersionId` deletes nothing at all. It writes a _delete
  marker_ over the key and retains every prior version: still billed, still
  readable by anyone who can name a version id, and invisible to an ordinary
  listing. `client.deleteObject({ key })` was the whole of `delete()`, so
  « définitivement supprimé » in the media library kept every byte, and the
  offboarding runbook ticked an erasure box the infrastructure could not honour
  (#331).

  `delete()` now enumerates the key's versions and removes each one by id. Delete
  markers go too, and by id: a marker _is_ a version, so removing only the object
  versions leaves the key hidden with its marker still billed, and removing only
  the marker un-deletes the file. The listing is filtered to an exact key match
  because the S3 API is prefix-based and `products/x.jpg` is a prefix of
  `products/x.jpg.bak`.

  `S3Operations` gains `listObjectVersions` and `deleteObjectVersion`, both
  **optional**, and that is a deliberate compromise rather than an oversight:
  `setup-aws.sh` has granted `s3:DeleteObject` and not `s3:DeleteObjectVersion`
  since the bucket was created, so every already-provisioned client's IAM user can
  call one and not the other. Making them required would have turned `delete()`
  into a function that throws on every deployment in the field the day it shipped.

  So `delete()` degrades instead — and says so. It returns a `DeleteResult` naming
  what actually happened: `purged` with a version count, or `delete-marker` with
  the reason (`unsupported-adapter`, or `listing-refused` when the IAM policy
  predates `s3:ListBucketVersions`). A caller can then tell a client something
  true, which is the entire point. **This changes the return type of `delete()`
  from `void`**; existing callers that ignore it are unaffected.

  The lifecycle rules that collect what a fallback leaves behind
  (`NoncurrentVersionExpiration`, `ExpiredObjectDeleteMarker`) ship with the same
  change in `scripts/setup-aws.sh`, along with the three version permissions.
  Re-run that script for a client provisioned before it.

  Refs #331.

### Patch Changes

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

- ecb21a1: Make the documented S3 adapter version-capable, so `S3Service.delete` can purge

  `S3Service.delete` removes every version of a key. It can only do that through
  the injected `S3Operations` adapter, and the two operations it needs —
  `listObjectVersions` and `deleteObjectVersion` — are OPTIONAL on that interface.
  An adapter without them compiles, runs, and returns
  `{ outcome: 'delete-marker', reason: 'unsupported-adapter' }` on every single
  delete: on the versioned bucket `setup-aws.sh` provisions, that keeps every
  byte.

  The adapter in `packages/core/src/aws/README.md` was such an adapter. It
  declared four methods — `putObject`, `deleteObject`, `getSignedUrl`,
  `headObject` — and neither version method, and it is the only concrete
  `S3Operations` adapter in the repository: nothing in `apps/*` builds one, because
  the delivered app's media path (`convex/cmsMediaDelete.ts`) talks to the AWS SDK
  directly. So the purge shipped, was covered by four passing tests, and was
  reachable by nobody who followed the documentation. Measured before this change,
  through the documented adapter:

  ```
  [PROBE] delete result: {"outcome":"delete-marker","versionsDeleted":0,"reason":"unsupported-adapter"}
  [PROBE] commands sent: deleteObject
  ```

  What changes:
  - **`README.md`'s adapter implements all six operations**, including both
    arrays S3 returns (`Versions` and `DeleteMarkers` — a marker _is_ a version,
    and reading only the first is how a purge leaves the markers behind) and the
    `IsTruncated` guard that stops the purge walking its page ceiling on every
    delete. The `delete` example now shows the three outcomes and says that only
    `purged` means the bytes are gone.
  - **A guard on the document.** `s3-documented-adapter.test.ts` extracts the
    adapter from `README.md`, runs it against a stubbed SDK, and asserts the
    service reports `purged`. Remove either version method from the README and it
    goes red — the four existing purge tests would not have noticed, because what
    was missing was not the loop but a caller able to enter it.
  - **The annotations that overstated are corrected.** `S3Operations`' docblock
    framed the fallback as a legacy minority case, when in this repository it was
    100% of executions; the `S3Service.delete` JSDoc did not say the optional
    methods gate the purge, nor that nothing in `apps/*` calls it;
    `IMPLEMENTATION.md` and the `createS3Service` entry in
    `@be-in-digital/mcp-server`'s registry still described the obsolete
    four-method interface.

  No new dependency: `@be-in-digital/core` still has exactly one AWS SDK
  dependency, `@aws-sdk/client-sesv2`. The adapter stays injected.

  Refs #414 (OBS-2), #331.

## 2.5.0

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

- 5f61648: Add the `./email` and `./email/providers` entry points

  **Recorded after the fact, on 09/09/2026.** These two public subpaths shipped
  in 2.5.0 and this release note did not mention them, because #405 landed with
  no changeset at all. Nothing here is new code — 2.5.0 is published and its
  contents are unchanged. What was missing was the announcement, and a consumer
  reading this file had no way to learn that the package had grown a new entry
  point. Written from the diff of `5f61648`, not from memory.

  `@be-in-digital/core` gained two exports, taking it from ten public subpaths
  to twelve:
  - **`@be-in-digital/core/email`** — the barrel, built by `tsup` (`src/email/index.ts`).
  - **`@be-in-digital/core/email/providers`** — the transport switch itself.

  What they are for: `EMAIL_PROVIDER` chooses which transport carries a
  deployment's mail, so a client whose AWS SES production-access request is
  refused can be pointed at Resend instead of having no way to send at all
  (#212). It is built on `SESOperations`, the seam that already existed, so
  `createSESService(config, operations)` — validation, the sandbox rate limit,
  bulk batching, templates — works unchanged over either transport.
  `createResendOperations()` implements the same interface using plain `fetch`.

  Two properties worth keeping when you touch this:
  - **No AWS SDK in this path.** `createSESv2Operations` remains the only module
    in `packages/core` that imports `@aws-sdk/client-sesv2`, so a Convex isolate
    can import `./email/providers` without pulling the SDK in.
  - **`resolveEmailProvider` never throws.** It returns a reason, so a
    misconfiguration is logged rather than crashing a scheduled action
    mid-campaign. An unknown provider name is refused, not silently defaulted.

  `configurationSet` is deliberately not abstracted: it is SES's open/click
  tracking and Resend has no equivalent, so the Resend transport ignores it. A
  client who moves loses open tracking, not their mail.

  **Why this is a note and not a changeset.** A changeset would cut 2.6.0 for
  code that is already inside 2.5.0, which would be a worse lie than the silence
  it fixes. The gap it fell through is closed for future changes:
  `pnpm check:source-drift` (added by #402, `d89ade4`, which merged _after_
  #405) fails CI when a `packages/*` source has moved since its last bump and no
  changeset names it. Verified by reproduction on 09/09/2026 — a one-file change
  under `packages/core/src` with no changeset naming `core` gives
  `@be-in-digital/core  2.5.0  drifted` and exit 1. At #405's merge, CI ran only
  `check:pending-release`, which reports changesets that exist and is silent
  about a missing one.

## 2.4.0

### Minor Changes

- c9619e2: Report Convex backend errors to the client's Sentry project

  The Next.js half of a client site has reported to Sentry for a while. The Convex
  half reported nothing, and `apps/docs/deployment/sentry.md` said so: _"Backend
  functions run outside Next and report nothing here."_ Every Stripe, Deliveroo,
  Uber Eats and SES webhook runs there, along with every order mutation and the
  whole kitchen path, and the only trace of a failure in any of them was one of
  112 `console.error` calls landing in the dashboard of ONE client's deployment.
  With one deployment per client, a Saturday-night order that failed inside Convex
  was seen by nobody, and finding it meant opening each client's console in turn —
  while the maintenance contract sells support.

  `@be-in-digital/core/sentry` gains the pieces a Convex module needs to report
  without an SDK: `parseSentryDsn`, `buildSentryErrorEvent`, `buildSentryEnvelope`,
  `describeUnknownError`, `redactSentryExtra` and a `'convex'` member on
  `SentryRuntime`, which reads `SENTRY_DSN` from the Convex environment store
  (falling back to `NEXT_PUBLIC_SENTRY_DSN`). The envelope is written out by hand
  because a Convex module is not a Node program — the default runtime is a V8
  isolate with `fetch` and no Node API, and moving the reporting into a
  `"use node"` action would put it behind a boundary no `httpAction` can cross,
  which is every webhook.

  Two behaviours change for existing consumers:
  - `isSentryDsn` is now defined as "`parseSentryDsn` can read it" rather than as a
    separate regex. The two disagreed while they were written apart:
    `https://:pass@host/4505` passed the gate and failed the parser, so the browser
    SDK would have initialised on a DSN the backend could not use.
  - `scrubSentryEvent` is unchanged, but context objects now go through
    `redactSentryExtra`, which matches its own key list — `code` and `key` are
    credentials in a query string and ordinary words in an object, so
    `statusCode` and `idempotencyKey` are no longer filtered while
    `stripe_signature_header` and `x-api-key` now are.

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

### Patch Changes

- bd17a78: Stop the upload schema refusing five folders the type says are valid

  `S3_FOLDERS` declares eleven folders and is documented as "the single source of
  truth". `s3FolderSchema` restated six of them by hand, and `upload()` and
  `getPresignedUploadUrl()` both parse their options through it. So this compiled
  and threw:

  ```ts
  createS3Service(config, client).upload(file, { folder: 'categories' })
  ```

  Measured across the declared set: `categories`, `storefront`, `blogs`,
  `blog-auto` and `avatars` were refused by both methods — the five the earlier
  proxy fix was about. Their MIME and size tables had been extended to eleven, the
  `/api/files` allowlist derives from those tables, and `convex/storageUpload.ts`
  allows all eleven; only the Zod enum was left behind.

  Nothing shipped calls those methods today — the two live upload paths are the
  HTTP route and the Convex presigned flow, and neither goes through `S3Service`
  — so this was a trap rather than an outage. But `CLAUDE.md` and the MCP registry
  both present `createS3Service(...).upload()` as the way to upload, so a
  developer following the documented API for a category image got a runtime throw
  with a type that said it was fine.

  The enum now derives from `S3_FOLDERS`, which makes the drift unrepresentable,
  and a test asserts the two agree — it fails against the hand-written list.

  The HTTP route's five-folder allowlist is untouched: that one is a deliberate
  security boundary (the rest are written by the presigned flow under its own
  authorisation), documented as such at the narrowing site.

## 2.3.0

### Minor Changes

- ebdda7e: AWS is a site variable now: every client owns its AWS account.

  `AWS_REGION`, `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY` were package-level
  — one fleet-wide key, shipped to every deployment. `apps/themes/scripts/env.mjs`
  copies them into each client's Convex deployment, so any one client's backend
  could read and write every other client's media, and a departed client kept
  working credentials that nothing rotated.

  It also made a promise the product already sells undeliverable. The admin
  console tells the restaurant its site belongs to it and can be migrated to the
  team of its choice, and `maintenance.ts` accepts the scopes `assets` and
  `emails` — but the media sat in a bucket BeYours owned and the mail left an SES
  identity BeYours owned. The backup export says so outright: it carries
  references and URLs, not the objects.

  The three move into `siteEnvRequiredSchema`, still declared without `opt()`.
  The tier changed, not whether a deployment can boot without them: an empty value
  fails at startup exactly as before, and `validateAllEnv()` now reports a missing
  `AWS_REGION` under `'site'` rather than `'package'` — which is where an operator
  should go looking, since it is their own account.

  `getSESConfig()` reads them off `getSiteEnv()` instead of `getPackageEnv()`. The
  site reader is deliberately lenient and never throws, so the three arrive as
  `string | undefined`; the adapter names whichever is missing rather than handing
  `undefined` to the SDK, which would fail later with a signature error that says
  nothing about the cause.

  **Type change:** `PackageEnv` no longer carries the three AWS properties, and
  `packageEnvSchema` no longer requires them. Nothing in the workspace read AWS
  off `getPackageEnv()` except the SES adapter, but code outside it that does will
  stop compiling — read them off `getSiteEnv()`.

  `setup-aws.sh` (both copies) takes `SITE_SLUG` and `DOMAIN` and names the bucket,
  the IAM user, the policy and the SES configuration set for that client. With no
  `SITE_SLUG` it keeps the fleet-wide names unchanged, because those designate
  resources that already exist in the shared account and renaming them here renames
  nothing in AWS. Its preflight now prints the account it is about to provision
  into and refuses on an `EXPECTED_ACCOUNT_ID` mismatch — with per-client accounts,
  running against the wrong one is the new way to get this wrong.

  Two things this does not do: clients already on the shared bucket still have to
  be migrated, and SES production access is granted per AWS account, so each new
  client needs its own request. Start it early in onboarding — until it is granted,
  that restaurant sends no order confirmation and no password reset.

## 2.2.0

### Minor Changes

- 3178b2d: Harden `POST /api/email/send` so the body cannot choose where a link points.

  This route sends from the restaurant's SES-verified domain, so anything it will
  put in front of a recipient is signed by the client's own brand. Three things
  were wrong with that:
  - **Links came from the request body, unchecked.** `resetLink` and
    `dashboardLink` were validated by `z.string().url()`, which is as happy with
    `https://evil.example/harvest` as with the real thing. Verified against the
    pre-fix handler: it returned 200 and the attacker's host was in the rendered
    "Reset my password" button. Both links are now required to share an origin
    with `linkOrigin` (normally `SITE_URL`), falling back to the request's own
    origin when the config omits it.
  - **An unusable secret weakened the route instead of closing it.**
    `timingSafeEqual` over two EMPTY buffers returns `true`, so a secret of `''`
    matched an empty token. A secret under `MIN_EMAIL_API_SECRET_BYTES` (32) now
    disables the route: every request gets 503 and a log naming what to set,
    rather than an authentication check that can be satisfied by nothing. The
    comparison also digests both operands first, so it no longer returns early on
    a length mismatch — which leaked the secret's length.
  - **The mail relay shared the session-signing key.** `EMAIL_API_SECRET` is now
    read and declared, with `BETTER_AUTH_SECRET` kept as a transitional fallback
    on both the route and the caller so existing deployments keep sending. Set it
    on the Next env _and_ the Convex deployment — they are two halves of one
    handshake.

  `EmailRouteConfig` gains an optional `linkOrigin`. Callers that pass nothing
  keep working and get the request-origin behaviour.

- e13cd4e: Sentry is wired, and every client site reports to its own project.

  `NEXT_PUBLIC_SENTRY_DSN` was in the schema and in both `.env.example` files.
  `@sentry/nextjs` was in no `package.json`, `packages/core` exported a
  `createSentryConfig()` nothing called, and no app had an error boundary. An
  operator filled the DSN in, saw no error, and believed monitoring was live — so
  a Saturday-night checkout failure was seen by nobody. Shipping the variable
  without the integration buys the confidence without the coverage.

  New `@be-in-digital/core/sentry` resolves the `Sentry.init` options for the
  three runtimes:
  - `resolveSentryOptions(runtime, env?)` returns `null` when the DSN is unset,
    empty, or is not a DSN — a project-page URL pasted instead of the client key
    passes the schema's `.url()` and is refused here, with a warning naming the
    variable. Every call site skips `Sentry.init` on `null`, so a deployment
    without a Sentry project pays nothing: no transport, no breadcrumb buffer.
  - `environment` resolves `NEXT_PUBLIC_SENTRY_ENVIRONMENT` → `VERCEL_ENV` →
    `NODE_ENV`, which keeps a client's preview deploys out of its production
    issues with no configuration on Vercel.
  - `tracesSampleRate` defaults to **0.1 in production**, 1.0 elsewhere. At 1.0 a
    busy restaurant spends its free-tier quota on traces and Sentry drops the
    overflow, so a 100% rate records _less_ than 10%. Override per client with
    `NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE`.
  - `sendDefaultPii` is `false` and not configurable. That flag is not enough on
    its own: verified against a live SDK, a server event still carried
    `cookie: session=…` and `authorization: Bearer …` in `request.headers`, since
    the flag governs IP and user attribution rather than headers. So
    `scrubSentryEvent` runs as both `beforeSend` and `beforeSendTransaction` —
    headers filtered to an allowlist, `request.cookies` emptied, and sensitive
    query values redacted out of `request.url` and `request.query_string`
    (`/reset-password?token=…` is a live password reset; `/order/<id>?token=…`
    opens one customer's order).
  - Events carry a `site` tag (the host of `NEXT_PUBLIC_SITE_URL`) and a
    `runtime` tag, so two deployments sharing a DSN by accident stay
    distinguishable instead of merging.

  The module has no imports — not even `@sentry/nextjs` — so the browser bundle,
  the edge runtime and Convex actions can all read it, and it is unit-tested
  without a process environment. It replaces the unused `createSentryConfig`,
  `defaultSentryConfig` and `SentryConfig` exports, which had no call site
  anywhere in the workspace.

  Four variables are newly declared, and `SENTRY_ORG` / `SENTRY_PROJECT` /
  `SENTRY_AUTH_TOKEN` become a `SITE_FEATURE_GROUPS` entry: half a source-map
  upload uploads nothing and leaves every production stack trace minified. The
  DSN is deliberately **not** in that group — a DSN on its own is a complete,
  working configuration.

## 2.1.0

### Minor Changes

- 3a25d85: The environment fail-fast now validates what a deployment cannot run without.

  Every one of the 28 `siteEnvSchema` fields was optional, and `opt()` mapped `''`
  to `undefined` — so a `.env.example` copied and left unfilled validated clean.
  The site booted printing "All environment variables validated successfully" and
  then failed at the restaurant one feature at a time: Stripe not configured, no
  encryption key, no S3 bucket, password reset silently returning early.

  `siteEnvSchema` splits into three:
  - `siteEnvRequiredSchema` — the seven a deployment cannot boot without
    (`NEXT_PUBLIC_CONVEX_URL`, `CONVEX_SITE_URL`, `SITE_URL`, `BETTER_AUTH_SECRET`
    now at least 32 characters, `ENCRYPTION_KEY`, `AWS_S3_BUCKET_NAME`,
    `AWS_SES_FROM_EMAIL`). Declared without `opt()`, so
    an empty value fails exactly like a missing one.
  - `siteEnvOptionalSchema` — the rest, refined by `SITE_FEATURE_GROUPS`:
    set one variable of Stripe, PayPal, SumUp or BeYours billing and the whole
    group becomes required. Half a payment provider fails at the till, not at boot.
  - `siteEnvSchema` — a deliberately lenient reader, unchanged in behaviour, and
    still what `getSiteEnv()` parses. It runs inside Convex actions holding only a
    subset of the variables, so tightening it would turn a configuration problem
    into a failed customer order.

  Thirteen variables the runtime reads were absent from every schema and are now
  declared, `ADMIN_BOOTSTRAP_TOKEN`, `NEXT_PUBLIC_SITE_URL` and `BID_APP_URL`
  among them.

  `validateAllEnv()` reports each problem under `'package' | 'site' | 'feature'`
  and names an unset variable as unset rather than as a type error.

- 7e727ff: Serve every folder the product uploads to

  The bucket is private and `/api/files` is the only read path, so the proxy's
  allowlist decides whether an uploaded object is reachable at all. That allowlist
  derived from `ALLOWED_MIME_TYPES` (6 folders) while `convex/storageUpload.ts`
  accepted 10. Uploads to `categories`, `blogs`, `blog-auto`, `storefront` and
  `avatars` therefore succeeded, stored a `/api/files/<key>` URL, and that URL
  returned 404 — the object was written and then unreachable. Category images in
  the admin were the visible case.
  - New `@be-in-digital/core/aws/folders` holds `S3_FOLDERS` and
    `isKnownS3Folder`. Like `aws/media-url`, it has no imports, so Convex actions
    can use it without pulling the package into their bundle.
  - `S3Folder` now covers all eleven folders, and `ALLOWED_MIME_TYPES` and
    `MAX_FILE_SIZES` describe each one. `/api/files` picks the additions up
    automatically, since it derives `SERVABLE_FOLDERS` from that table.
  - `convex/storageUpload.ts` and `/api/upload` derive their allowlists from the
    shared list instead of restating it, so the three cannot drift apart again.
    `/api/upload` previously rejected `email` and `categories` outright.

## 2.0.2

### Patch Changes

- 7f0122b: Republished from main. Fixes two problems with the 2.0.1 tarballs that broke consumers:
  - `@be-in-digital/core`: the `./auth/rbac` subpath pointed at `src/auth/rbac.ts` while the tarball only ships `dist/` → broken import for consumers (`convex-functions/auth` included). `files` now includes `src`.
  - The type fixes that were on main but never published (promotion-form/email-config in admin, Uber Eats signatures in integrations/convex-functions) go out with this patch — they had been committed without a changeset.

## 2.0.1

### Patch Changes

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
