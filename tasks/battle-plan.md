# Battle plan — 57 work items in 15 batches

The findings of the 27 Aug 2026 audit, grouped by feature and ordered by dependency.
A batch is closed completely — code, test, verification — before the next one opens.

Readable version (French, for the team): https://claude.ai/code/artifact/e75d9f2c-e3af-46cf-8769-5e2cf5b46380
Card detail: `tasks/sales-readiness-backlog.md`
Ready-to-paste prompts, one per unclosed batch: `tasks/fix-prompts.md`

**Sequential:** batches 00 → 07, each one makes the next testable.
**Independent:** batches 08 → 13 can be split across people.
**Last:** batch 14, once you know what actually shipped.
**Shortest path to an honest first sale:** 00 → 01 → 02 → 04 → 05, i.e. 24 items.
Of those 24, **17 are done**; 7 remain: #178, #171, #179, #128, #129, #162, #173.

## Discovery audit — 1 Sep 2026, commit `009af63`

A fifth pass asked the opposite question of the four before it: not "are the 57 cards
resolved?" but **"what was never audited?"**. Eight agents, eight scopes, every finding
proved by execution. Result: **65 defects no card in this backlog describes**, 13 of them
blockers. Execution prompts for all of them are in `tasks/fix-prompts.md`.

**One verdict below was wrong and is corrected.** #169 was marked resolved in the fourth
round, closing batch 02. Its backup half is not fixed: `exportBackup` covers 29 of the
schema's 100 tables, omitting `orders`, `payments`, `kitchenTickets` and `gamePlays`, and
`importTable` re-inserts under new ids. A probe restored an establishment and reached **0
orders**. It was credited because `backup-restore.test.ts` was green — and that file never
names `orders`. Batch 02 is reopened.

**The "181+ features" claim is settled.** Its only origin, `_project/FEATURES_DIAGRAM.md`,
carries a table summing to **201**, not 181. `CLAUDE.md` copied the headline and reproduced
9 of 22 categories (92). Several categories count non-features — 6 themes as 6 features,
7 team roles, 6 social-action types. Neither number counts anything real. The audited figure,
over the 92 enumerated: **29 ship as described, 23 partial, 41 absent or unreachable** from
`apps/themes`, the app a paying client runs.

### The 13 uncarded blockers

| Where | What |
|---|---|
| `apps/site` | `createCheckoutSession` takes `discountPercent` from the caller, unauthenticated — a Premium build for 2,075 € instead of 8,750 € |
| `apps/site` | The Stripe webhook reads three fields the pinned API version removed — every renewal is mis-plated and mis-billed |
| engine | **No order confirmation email is ever sent.** A guest pays and receives nothing |
| engine | **No invoice exists**, and the order number is `Math.random()` — French law requires an unbroken sequence |
| engine | A diner's personal data has no retention, no erasure path and no consent record |
| engine | The public prize mutation has no rate limit; 40 anonymous calls drained a 5-prize stock |
| client sites | The mirror's `@source` paths resolve outside the client repo — clients ship 783 fewer CSS rules |
| `packages/ui` | `AllergenBadge` throws on the French allergen names the product's own AI writes |
| `apps/themes` | Every checkout refusal reaches the diner as "Server Error" |
| `apps/themes` | A dine-in order carries no table number |
| engine | `orders.list` is unbounded and is the only query behind the `/dashboard` home page |
| engine | `products.remove` is a bare delete — Deliveroo keeps selling the deleted dish |
| `apps/site` | "Analytics", the paid tier's only differentiator, has zero files — and no plan gating exists anywhere |

### What the pass says about the codebase

The signature failure repeated in every scope: **an annotation that asserts more than the
code does.** Three separate places state nothing reads `stores.displayConfig`; it has a live
reader on the customer-facing dining-room screen, and its writer was deleted on the strength
of that claim. The accent guard added by the newest commit misses strings that same commit
left behind. `oauthStates` documents a TTL Convex does not provide, which is why nobody wrote
the sweeper. And the shipped template's 54 Playwright specs run in no workflow at all, while
a parity guard keeps them byte-identical to the bench's — which reads as proof.

Hygiene on this commit: **19/19 tasks, 2,965 tests green**, type-check 19/19. It has been
total for five rounds, and it still says nothing about the seams.

## Verified status — 30 Aug 2026, commit `8d41349`

**23 resolved · 11 partial · 23 open.** Fourth verification pass, 15 commits after the
previous one. Every item was replayed against its original failure with a throwaway probe;
a passing existing test was never accepted as proof on its own.

**Batches 03 and 04 are closed.** Batch 04 — the money path — closed this round: the VAT
regime is settled and propagated (#174 extracts VAT from a gross price rather than adding it
on top), and all five points of #161 hold. Six batches now have nothing open.

**Scheduled emailing works.** #143 and #144 fall together: the cron dispatches campaigns every
minute, and batched send relies on a `by_campaignId_subscriberId` index that makes duplicates
impossible — probed with a forced restart mid-send, `dupes = []`.

**Two regressions, not to be lost in the green.** #164 item 9: the print-configuration tab was
*deleted* instead of being lifted into `packages/admin`, so `printConfig.enabled` can never be
turned on and `create` always writes `printStatus: "not_required"` — auto-print went from
unreachable to dead. #129 widened: both apps now mount the same broken refund button.

**The recurring pattern is the comment that lies.** `stripe.ts:83` now claims to call
`assertSettlesOrder`; the probe answers `calls assertSettlesOrder: false`. The CMS
`@guarded-inline` markers silence the ESLint rule written for them. The accent check is
blocking but blind to faults present on both sides. A guardrail that is described is not a
guardrail that runs.

**Why batch 07 had not moved:** no test in the repository named `uberEatsWebhook`,
`deliverooWebhook`, `mapUberEatsOrderToUnified` or `mapDeliverooStatus`. Zero coverage — which
is why five green CI passes never spoke to its eleven defects. That surface now exists, and
building it was most of the work.

Full suite re-run serially on this commit: **19/19 tasks, 2,956 tests green** (2,437 the
previous round), type-check 19/19. Hygiene is intact; the seams are what fail, and no test
crosses them.



## Batch 00 — Foundation: deploy, encrypt, observe
*8 items · 5 P0 · first, no exceptions · _5 done · 3 partial_*

Nothing is testable while a clone boots broken in silence and no error surfaces
anywhere. This batch is what makes the rest verifiable.

- [x] **#176** ✅ — Settle the S3 bucket policy: private + proxy, or public/CloudFront — _blocks #158 and #151_
- [x] **#158** ✅ — Align the 16 files on the chosen policy — two opposite assumptions coexist today
- [x] **#151** ✅ — Close the stored XSS: `content:write` check on `/api/upload`, SVG through DOMPurify, `/api/files` authenticated
- [x] **#156** ✅ — Make client-supplied environment variables required — all 28 are `opt()`
- [x] **#157** ✅ — Reject an empty `BETTER_AUTH_SECRET`, which currently opens an email relay
- [ ] **#178** 🟡 — Check the Convex spending cap — too low, it disables the whole team including production
- [ ] **#171** 🟡 — Type-check `convex/` in CI, install or remove Sentry, add `error.tsx`, restore the template's tests
- [ ] **#179** 🟡 — Make CI blocking and switch E2E on — `release.yml` publishes without waiting for tests

> **Closed when.** A fresh unconfigured clone refuses to boot, naming what is missing; a production error surfaces somewhere; a failing test stops publication.

## Batch 01 — Authentication & team
*4 items · 2 P0 · nobody can sign in today · _4 done — closed 4 Sep 2026_*

Without an account, no other feature is reachable. This is the first wall a
deploying client hits.

- [x] **#131** ✅ — Send the verification email — verification is on and no sender is configured
- [x] **#180** ✅ — Provision `ADMIN_BOOTSTRAP_TOKEN` and build the first-administrator path
      — `/setup` calls `claimFirstAdmin` in both apps, the claim fails closed on an
      unconfigured deployment, and the guarantee is held by
      `apps/*/tests/convex/authorization.test.ts` ("claiming the first admin seat").
      The tests that stood here before asserted `rejects.toThrow()` and stayed green with
      the token comparison deleted outright; they were rewritten to read the refusal code
      and count super-admin rows. **Console residue is not part of this item and is not
      closed**: placing the token and restricting the Maps key are account-owner actions,
      tracked in `tasks/sales-readiness-backlog.md` under LAUNCH-09 and scripted in
      `scripts/wizards/github-e2e-maps-bootstrap.sh`.
- [x] **#132** ✅ — Create `/invite/[token]` in both apps — the email link 404s
- [x] **#170** ✅ — Role gate on `/dashboard`, session revocation on reset, per-module permissions enforced or removed

> **Closed when.** Sign up → email → sign in → dashboard works end to end, and a signed-in customer typing `/dashboard` is redirected instead of crashing the page.
>
> **Closed 4 Sep 2026.** All four items done. The console half of #180 —
> `ADMIN_BOOTSTRAP_TOKEN` on each deployment, and the Google Maps referrer restriction —
> is an account-owner action and stays open under LAUNCH-09; it was never inside this
> batch's scope.

## Batch 02 — Multi-store
*3 items · 2 P0 · the product is billed per store · _2 done · 1 partial_*

Creating an establishment and opening it at the right hours is the commercial
foundation. Both are broken.

- [x] **#125** ✅ — Drop the undeclared `settings` field — creation is rejected by the validator
- [x] **#126** ✅ — Handle the midnight wrap in `isStoreOpen` — an 18:00–02:00 service reads as closed all evening
- [ ] **#169** 🟡 — Delete cascade, timezone honoured, global hours applied, Uber Direct credentials not wiped on save — **CORRECTED 1 Sep: backup/restore is NOT fixed.** `exportBackup` covers 29 of 100 tables; `orders`, `payments`, `kitchenTickets`, `teamMembers`, `gamePlays` are all absent, and `backup-restore.test.ts` never names `orders`. A restaurant cannot recover its orders.

> **Closed when.** Creating a second store from the dashboard succeeds; an 18:00–02:00 store accepts an order at 23:00 and at 01:00; deleting a store leaves no orphans.

## Batch 03 — Catalogue & products
*2 items · 1 P0 · _2/2 done — batch closed_*

The server must refuse what it cannot serve. Today it accepts everything and charges.

- [x] **#133** ✅ — Validate in `orders.create`: active product, stock, scheduling window, required options, quantity, option dedup
- [x] **#165** ✅ — Cross-store scope on propagation and mappings, category cascade, `duplicateCatalog` fixed, product sort

> **Closed when.** Ordering a deactivated, out-of-stock, out-of-window product, or one missing its required option, fails server-side — not just in the browser.

## Batch 04 — Cart, orders & VAT
*5 items · 2 P0 · the money path · _5/5 done — batch closed_*

The displayed price must be the charged price. Commercially and legally the most
sensitive batch.

- [x] **#174** ✅ — Settle the VAT regime and propagate it to engine, site and issued invoices — _blocks #127_
- [x] **#127** ✅ — Extract VAT from the price instead of adding it, and sum per-product rates
- [x] **#153** ✅ — Give cart lines a stable `lineId` — option variants of one dish are conflated
- [x] **#160** ✅ — Promotions: product/category scope, happy hour, automatic offers, displayed ≠ applied discount
- [x] **#161** ✅ — Creation idempotence, cash settlement, cancellation that closes the ticket, minimum order and radius

> **Closed when.** The cart total is exactly what Stripe charges, at every rate; two variants of a dish behave independently; a Back navigation from Stripe creates no duplicate.

## Batch 05 — Payments & refunds
*4 items · 2 P0 · _1 partial · 3 open_*

A refund that is not one creates an accounting gap nobody in the app can close
afterwards.

- [ ] **#128** 🔴 — Remove the fake refund on cancellation — it permanently blocks the real one
- [ ] **#129** 🔴 — `useAction(api.payments.refundPayment)` and mount the right tab — the current button calls a deleted function
- [ ] **#162** 🔴 — Bind Stripe settlement to amount and currency, dedupe events, add the CSRF state to the SumUp callback
- [ ] **#173** 🟡 — Create the founders coupon and the 4 maintenance prices — without them the first sale is refused by the code

> **Closed when.** A real payment, then a partial refund, then a full refund all succeed from the UI and match the Stripe dashboard exactly.

## Batch 06 — Kitchen & printing
*4 items · 3 P0 · _4 done — closed 4 Sep 2026_*

This is the screen the restaurant watches all day. A missing ticket or a duplicate
costs a service.

- [x] **#136** ✅ — The ticket is created on payment, not at checkout. The rule lives in
      `releaseToKitchen`, which every card path reaches through `orders.recordPaymentStatus`
      and cash reaches through `markCashPaid`. An abandoned checkout leaves nothing on the
      pass; `store.orderConfirmation` decides *when* — withdrawn once for promising a
      workflow nothing implemented, and reinstated here because this is the implementation.
- [x] **#135** ✅ — The customer's instruction survives the Uber Eats mapper, the
      `createFromWebhook` validator and the ticket insert, through one shared mapping
      (`toKitchenTicketItemsFromPlatform`) rather than two hand-written copies. Each half
      had a green test before; the seam between them dropped the note.
- [x] **#137** ✅ — `getByStore` reads the active statuses only, capped and oldest-first;
      the completed tab paginates; `purgeExpiredTickets` runs nightly at 02:30 UTC in both
      apps, rescheduling itself while there is more to delete.
- [x] **#164** ✅ — 9 of 9, two of them on the storefront path only. The print-configuration
      tab is back — in `packages/admin` this time, on the store-detail screen both apps
      already mount — so `printConfig.enabled` can be turned on at all and a ticket reaches
      `printStatus: "pending"`. Beside it:
      `claimForPrint` takes a slip in one transaction, failed prints return to the queue
      until `MAX_PRINT_ATTEMPTS`, the trigger commits with `flushSync`, the three cloud
      providers are offered `disabled` with the reason in view, and an order is split into
      one ticket per station it touches under a single tracking token. The allergen block
      and the prep time are the two that stop at the storefront — see the note below.

> **Closed when.** An abandoned payment produces no ticket; a confirmed one produces exactly one, with its allergies; two open tablets do not print twice.
>
> **Closed 4 Sep 2026** (PR #311, with the cash release in #335), re-verified by execution
> the same day. Each guard was mutation-checked rather than read: removing the payment gate
> fails 5 tests, collapsing the station split fails 3, dropping the platform note fails the
> end-to-end Uber Eats test. Two things are deliberately **not** counted as closed:
>
> - **The allergen block and the prep time are fed on the storefront path only.**
>   `releaseToKitchen` computes both from the ordered products; the Uber Eats webhook builds
>   its own ticket and passes neither, so a platform order still prints without its allergen
>   block and cannot arm the overdue alarm. Feeding it means resolving platform lines to
>   internal products through `externalProductMappings` — real work, not a line, and it
>   belongs to the delivery surface rather than to this batch.
> - **The diner is still offered nowhere to type an allergy.** The whole pipeline exists
>   behind it — schema, `orders.create`, the printed `Note:` block — and the storefront
>   checkout sends no `notes` at all. Tracked as NEW2-P8-1 in
>   [#325](https://github.com/be-in-digital/beyours/issues/325), not here.

## Batch 07 — Delivery integrations
*6 items · 4 P0 · the highest-volume channel · _5 done · 1 owner action outstanding_*

Three silent order-loss paths. A restaurant connecting Deliveroo lost orders on day one.

- [x] **#134** — The Deliveroo kitchen ticket is created. **The card was wrong about accept/reject:**
      `TicketCard.tsx:99-104` already routed both platforms through
      `api.kitchenTickets.acceptTicket`, which already called `deliveroo.acceptOrder`. The
      accept path existed and was unreachable only because no ticket was ever made.
      `apps/*/convex/deliverooOrders.ts` is dead duplicate code with zero callers — left in place.
- [x] **#138** — Uber's real event catalogue (`orders.cancel.notification`,
      `orders.scheduled.notification`, `orders.release.notification`, `store.provisioned`).
      The `eats.order.status_update` branch and its status map were deleted: Uber has never
      sent that event.
- [x] **#139** — `allIntegrations[0]` is gone. An order that cannot be placed is refused and
      kept in the new `platformWebhookFailures` table with its raw body, rather than guessed at.
      Also refuses an ambiguous store id (two integrations sharing one `platformStoreId`) and
      survives a non-string one, both of which an adversarial pass found afterwards.
- [x] **#140** — `confirmed` is written only on a 2xx from Uber. `platformSyncStatus` — declared
      since the beginning and written by nothing — now records the outcome, with a bounded
      retry (15s/60s/180s, 255s total, inside Uber's 11.5-minute auto-cancel) that abandons
      itself if staff have acted in the meantime.
- [x] **#163** — 9 of 9. Prices (2.209× measured → correct, plus modifier quantity and the
      storefront's clamps), Deliveroo's real status vocabulary (`canceled`, one l), the `denied`
      landmine pinned at source, `by_external_order` instead of a full table scan, 86'ing and
      store pause wired to the documented endpoints, menu-sync fan-out (100 sweeps per
      50-product import → 2) with 429/5xx backoff, sandbox flags centralised, Deliveroo failures
      answered 500 so they are retried, and an e2e suite that can finally sign.
- [ ] **#172** 🔴 — **Owner action, deliberately left open.** The repo half is done: two Gitleaks
      rules now match the credential (validated over all 7,459 blobs — 3 matches, one distinct
      token, zero false positives), and the false claims in `.gitleaksignore` are corrected.
      Rotating the secret and rewriting the history are the account owner's calls.
      **Corrected 2026-09-09:** this entry used to end "the `Gitleaks (secret scan)` job will
      now fail on `main`". It does not. The four findings those rules produce were
      fingerprint-scoped in `.gitleaksignore:110-113` so that a *fifth* leak stays visible, and
      the job is green again — verified by execution with the pinned gitleaks 8.21.2: 4
      findings without the entry, 0 with it, 1 when a new secret is added on a new line. The
      job is still not one of the five required checks. The history is still dirty; the
      scanner has simply stopped shouting about the part we already know.

> **Closed when.** An order from each platform reaches the kitchen with the right price and notes; a cancellation removes it; a failed accept is visible instead of swallowed. — **Met**, and covered by tests that stay in the repo: `uber-eats-webhook.test.ts` and `deliveroo-webhook.test.ts` in both apps, `platform-webhook-failures.test.ts`, and `platformWebhook.test.ts` in the package. Each drives the signed HTTP endpoint, and each was proven red against the unfixed code.

## Batch 08 — Customer storefront
*2 items · 1 P0 · what the consumer sees · _1 partial · 1 open_*

A page linked from the header of the whole site crashes on every visit. The rest is
the finish that decides whether the theme sells.

- [ ] **#152** 🟡 — Fix `/contact`, which renders a Convex object as a React child, and add the error boundaries
- [ ] **#168** 🔴 — Dead CMS SEO, 404 sitemap, structured data never rendered, footer newsletter discarding the email, keyboard-inaccessible options, sub-AA contrast

> **Closed when.** All eleven public routes return 200 with their real metadata, and a configurable dish can be bought entirely from the keyboard.

## Batch 09 — CMS, blog & media
*3 items · 2 P0 · _3 done_*

The editing admin exists and works; it was the public output that was missing.
Everything written went nowhere.

- [x] **#149** ✅ — The public blog reads published articles and `/blog/[slug]` exists; the six demo posts and twelve dead links are gone
- [x] **#150** ✅ — Both crons ship: `plan auto blog jobs` hourly, `execute auto blog queue` every 10 minutes. `approvalMode` is honoured and re-checked against the plan at execution time, so auto-publish needs an entitlement and everything else lands as a draft
- [x] **#167** ✅ — 8/8. Generation actions authorize their `storeId`, quota is reserved before the OpenAI call (measured: 10 concurrent past a quota of 2), uploads refuse `text/html` and active SVG, media deletion reaches S3, and the preview renders

> **Closed when.** An article published in the admin appears on the site with its own page, and a weekly configuration produces one with no human action.

## Batch 10 — Email marketing
*8 items · 6 P0 · the heaviest batch · _7 done · 1 partial (console-side)_*

Three headline features were dead on arrival, and two defects put the domain's sending
reputation at stake — which also means order confirmations.

- [ ] **#177** 🟡 — Move AWS SES out of the sandbox — otherwise no client can email a real consumer — _repo half done: `ses:check` is wired in both apps and tested; what is left is one production-access request per client AWS account, an account-owner console action — see LAUNCH-06_
- [x] **#146** ✅ — Read `AWS_SES_CONFIGURATION_SET` instead of the hard-coded name, and fail loudly
- [x] **#141** ✅ — Fix the CSV import — three required arguments missing, two rejected fields added
- [x] **#142** ✅ — Send the double opt-in email — no path did, so every signup was unreachable
- [x] **#143** ✅ — Add the scheduled-campaign cron — there is no `crons.ts` in the engine
- [x] **#144** ✅ — Stop "Relancer" re-sending from the first subscriber
- [x] **#145** ✅ — Suppress permanent bounces immediately — three retries lead to an AWS sending pause
- [x] **#166** ✅ — `List-Unsubscribe` headers, POST unsubscribe, verified SNS signature, batched sending, automations

> **Closed when.** An import succeeds, the signup gets its confirmation, a scheduled campaign sends itself, pause-then-resume sends no duplicates, and a permanent bounce suppresses on the first event.

## Batch 11 — Internationalisation
*2 items · 2 P0 · _2 done_*

CMS translation genuinely worked. Everything else — UI strings and catalogue — was wired
to nothing, and now is not.

- [x] **#147** ✅ — Schema fields declared on products/categories/menus and `translationQuota` on stores; `executeTranslation` and `batchChunk` re-registered as `internalAction`s over internal query → fetch → internal mutation; `scheduleTranslation` called from all six catalogue mutations; `translateCatalogue` added so the batch back-fill has a way in
- [x] **#148** ✅ — `StorefrontI18nProvider` mounted in the shell fills the language store; `useTranslation()` exposes `t()` and the header, cart, product grid and product card use it; the SSR CMS and SEO readers now read `beid_locale` rather than a `locale` cookie nothing writes

**CLOSED 4 Sep 2026** — PR #317, merged as `04836fed`. Verified by execution:
`scheduleTranslation` is called from all six catalogue mutations, the storefront reads
the translations, and the language selector works with two active languages.

> **Closed when.** Adding a language, saving a product, then switching on the storefront shows a translated menu and translated buttons.
>
> **Console residue.** `OPENAI_API_KEY` must be set on the Convex deployment, or every
> translation logs `OPENAI_API_KEY not set` and clears its pending flag without
> translating. Nothing in the repository can set it.
>
> **Related new work — not a reopening.** Adding the *first* extra language flips the
> whole storefront to English: NEW2-JOURNEY-2, issue #325 (batch 05 of the 4 Sep audit).
> A new defect on the surface this batch shipped, and only reachable because it shipped —
> before #317 nothing read the language list at all, so nothing could flip. The mechanism
> is the default-locale fallback in `StorefrontI18nProvider`:
> `active.find((l) => l.isDefault)?.code ?? active[0]?.code ?? "fr"`. A fresh deployment
> seeds no `languages` rows, so the first language added is `active[0]`, carries no
> `isDefault` flag, and becomes the establishment default for every diner. The selector
> renders `null` at ≤1 language, so the UI offers no way back.

## Batch 12 — Gamification
*2 items · 2 P0 · 16 advertised features · _2 open_*

The backend is complete and the draw is correctly server-side. What is missing is QR
creation and the whole client layer of the template.

- [ ] **#130** 🔴 — Add `scannedCount: 0` to the insert — without a QR nobody ever plays — _one-line fix_
- [ ] **#159** 🔴 — Lift the player flow into a package and render it from both apps; replace the template's five `ComingSoon` — _the 5 admin pages are one line each_

> **Closed when.** Scan → actions → play → win → ticket → counter validation works end to end **in `apps/themes`**, not only in the test bench.

## Batch 13 — Commercial site (beyours.fr)
*3 items · 2 P0 · this is how you get paid · _2 done · 1 partial_*

Separate backend, no engine dependency — so it can run in parallel with the other
batches, handled by someone else.

- [x] **#154** ✅ — Convert to `internalQuery` the three queries exposing invoices, Stripe PDFs, SIRET and amounts — none has a caller
- [x] **#155** ✅ — Close the test-mode branch: with no Stripe key, every visitor gets a free "paid" order
- [ ] **#181** 🟡 — Register each delivered site's licence key, otherwise maintenance renewals are unenforceable

> **Closed when.** The billing queries no longer answer an anonymous browser, and removing the Stripe key makes checkout fail instead of giving the product away.

## Batch 14 — Align the sales pitch with the product
*1 item · product decision · **decided 5 Sep 2026** · _1 open sub-item_*

Ran last, once the other batches had landed. Five promises, not four: Auto Blog
was struck (its crons ship and both targets exist), and the native app and table
reservations joined from #330.

- [x] **#175** ✅ — All five settled by the owner, and the copy now matches the
  product. **Native app** — Premium sold honestly as « à venir », and refused at
  checkout by `planAvailability.ts` rather than by a badge · **Reservations** —
  `stores.reservationUrl` links out to TheFork/Zenchef, https-validated on three
  sides; the demos' fake booking flow and mocked back-office module are gone ·
  **ESC/POS** — copy now describes the browser path that ships; cloud printing
  (Star CloudPRNT / Epson) chosen over a local agent, with no public promise
  made · **Square** — kept visible, marked « Bientôt ».
- [ ] **#352** 🟠 — **Menus / formules** — decided **build**, deferred to its own PR. The
  admin half is complete; the storefront, cart and order path are not, and
  `orders.ts:518` rejects any line without a `productId`. The cost is VAT
  allocation across a mixed-rate formule and the promotion interaction — money
  correctness, which wants a PR of its own. Until it lands the guided tour still
  promises « offres combinées » that nobody can order.

> **Closed when.** The formule flow is orderable (#352). Everything else in `CLAUDE.md`,
> on the site, in the demos and in the onboarding tour now maps to something a
> client can use — see `tasks/sales-readiness-backlog.md` → LAUNCH-04 for what
> was decided and what shipped for each.

## Batch NEW-T — Sold and absent, at four times the scale
*11 items + 2 uncarded · product decisions · **decided 5 Sep 2026** · _3 open sub-items_*

LAUNCH-04's question, asked of eleven more capabilities. Re-measured at
`158019f` before anything was decided, and two of the eleven had moved: **T-4
was already fixed** by #340, and **four sub-claims of T-8 and T-10 were wrong**
— the controls they said were missing exist, save correctly, and change nothing
a customer can see. Two findings nobody had carded outranked most of the list.

- [x] **Fake social proof in every delivered client site** ✅ — three invented
  five-star testimonials with generated avatars, a hard-coded `4.5★` on every
  real dish, two invented dishes, "4.9/5" and "10K+" tiles, and an About page
  defaulting to a customer count and an average rating. None of it removable
  from the admin. Deleted in both apps and held by
  `tests/storefront/no-fabricated-social-proof.test.ts`, which fails 7 of 7
  against the pre-fix tree.
- [x] **T-1 Analytics** ✅ — reworded; the row is `true/true` because the one
  dashboard is available to everyone, and Premium differentiates on the app
  alone. The three named metrics are decided **build** (below).
- [ ] **T-2 Clients (CRM)** 🟠 — decided **build**, its own PR. Cheaper than it
  looks: orders carry name/email/phone indexed `by_customerId`, and
  `emailSubscribers.metadata` already computes and renders the per-person
  history. The tour steps that walked an owner to the placeholder are removed
  until it ships.
- [x] **T-3 Themes** ✅ — the six-theme picker (two of which had no template)
  is gone; Couleurs and Typographie are disabled with a stated reason; the Logo
  tab points at the CMS block that genuinely drives every logo surface.
- [x] **T-4 Sitemap and JSON-LD** ✅ — already fixed by #340. Dead `store-url.ts`
  deleted in both apps; the bare admin paths added to the crawler disallow list.
- [x] **T-5 Push** ✅ — one bullet reworded. Eight of nine mentions were already
  gated behind the Premium app.
- [x] **T-6 Créneaux horaires** ✅ — copy reworded, the sales demo's working slot
  picker removed, the no-op Click & Collect switch disabled with a reason, the
  dead `scheduledAt` deleted and the inverted kitchen priority corrected.
- [ ] **T-7 Backups and monitoring** 🟠 — copy aligned to the manual export and
  the measured availability that exist; the **nightly backup and the alert** are
  decided **build**, their own PR. #169 is closed, not reopened.
- [x] **T-8 Fifteen features** ✅ — loyalty reworded to the wheel and scratch
  card that ship (including the tier-system mockup, which drew a product that
  exists in no form); the controls that report success and change nothing are
  disabled with reasons.
- [x] **T-9 Reviews, SMS, suppliers** ✅ — the marketing was already clean; the
  live SMS toggle with no sender is gone.
- [x] **T-10 2FA and social login** ✅ — never sold commercially. The auth guide
  is rewritten against the code, the dead `authRoutes` (7 of 8 paths wrong) is
  deleted, `twoFactorEnabled` is optional and commented.
- [x] **The "181+ features" headline** ✅ — replaced with the audited figure.
- [ ] **Analytics metrics** 🟠 — decided **build**, its own PR; carries the
  server-side aggregate that also closes NEW-P.

> **Closed when.** The Clients page is reachable, the nightly backup runs and
> alerts, and the three named metrics exist — see
> `tasks/sales-readiness-backlog.md` → LAUNCH-11 for what was decided and what
> shipped for each. **`apps/site` was red on `main` independently of this
> batch:** `checkoutReferralIntegrity.test.ts` failed 25 cases because every one
> called the plan #350 closed, leaving the referral guards unexercised. This
> branch diagnosed it and carried its own repair for one commit; #355 landed
> the same two-part fix on `main` first, so the merge takes that one and this
> branch no longer touches the file. 41 files / 644 tests passing.
