# Fix prompts — one per unclosed batch

Thirty-three prompts. Twelve close out the original backlog batches; twenty-one address findings
from the **discovery audit of 1 Sep 2026**, which asked a different question — not "are the
57 cards resolved?" but "what was never carded at all?". Paste one into a fresh
conversation opened on this repository.

Batches 02, 03 and 04 are closed and have no prompt here. The discovery prompts are
grouped under *New findings* at the end of the file, and six of them are blockers.

> **The discovery audit is complete.** All eight scopes have reported. The headline number
> from the last of them: of the 92 features `CLAUDE.md` enumerates, **29 ship as described,
> 23 are partial, and 41 are absent or unreachable** from `apps/themes` — the app a paying
> client actually runs.

Each prompt is short on purpose: it points at the **Shared brief** below, which the new
session reads from disk, then states only what is specific to its batch. Keep the brief
and the prompts in sync — if the method changes, it changes in one place.

Card detail: `tasks/sales-readiness-backlog.md` · Batch map: `tasks/battle-plan.md`

---

## Shared brief

*Every prompt below tells the session to read this section in full. Do not skip it.*

### The repository

BeYours / BeInDigital Engine — pnpm + Turborepo monorepo.

- `packages/*`, published as `@be-in-digital/*` — the engine: `convex-functions`,
  `convex-schema`, `core`, `restaurant`, `admin`, `cms`, `ui`, `integrations`,
  `marketing`, `mcp-server`.
- `apps/reference` — the engine's test bench. Carries the CI e2e suite. Sold to nobody.
- `apps/themes` — the shippable client template, cloned into one repo and one Convex
  backend per client. **This is what a paying customer actually runs.**
- `apps/site` — the commercial site (beyours.fr). Own Convex backend, no engine dependency.

Stack: Next.js 16 App Router, React 19, Convex, Better Auth, Tailwind v4, Zustand,
Vitest, Playwright, AWS S3 + SES, Stripe/SumUp/PayPal, Uber Eats/Deliveroo/Uber Direct.

Read `CLAUDE.md` before touching anything.

### Ground truth

Every state claim in these prompts was **verified by execution**, not read off an issue.
Where a probe result is quoted, that is a measurement taken at commit `8d41349`.

Do not trust an issue's wording, a commit message, or a code comment over what you can
run. That is not a general caution — it is the specific, repeated failure mode of this
codebase, and it is why four verification rounds were needed.

### Method — non-negotiable

1. **Reproduce before you fix.** Write a throwaway probe (`zz-probe-*.test.ts`;
   `convex-test` for backend work) that replays the exact failure described. Watch it
   fail. If it passes on the first run, you have not understood the defect — investigate,
   do not celebrate.
2. **A passing existing test is not proof.** Several of these defects have a green test
   sitting on top of them that asserts the broken behaviour. Read the test before
   trusting it. If it blesses the bug, rewrite it and say so explicitly in your report.
3. **A fixture error is yours, not the code's.** When a probe fails on a missing required
   field or an invalid literal, fix the fixture and re-run. Do not report it as a defect.
   This has produced false findings before.
4. **Fix, then prove.** The same probe must go green. Then delete every probe:
   `find . -name 'zz-probe-*' -not -path './node_modules/*' -delete`
5. **Land a permanent test** for each fix, in the package that owns the behaviour. The
   probe proves the fix today; the permanent test stops the regression tomorrow. Several
   items in this backlog regressed precisely because no test held them.
6. **No partial credit.** An item is done when every sub-point is done. Report `n/m`
   honestly. "Mostly done" has cost this project two rounds of rework.

### Traps this repository has already sprung

- **Comments that lie — the single most common failure here.**
  `apps/reference/convex/stripe.ts:83` carries a comment claiming to call
  `assertSettlesOrder`; it does not. False `@guarded-inline` markers silence the ESLint
  rule written to catch exactly them. Verify the call, never the claim.
- **Two apps, one defect.** `apps/reference` and `apps/themes` are twins. A fault is
  routinely byte-identical in both, and any checker that compares the two is blind to it.
  Fix both, or lift the code into a package and render it from both.
- **Packages are consumed from `dist`.** Editing `packages/*/src` changes nothing in a
  running app until you rebuild. Rebuild before concluding a fix did not work.
- **Turbo reports a green it did not earn.** A build can succeed while producing no
  output, replaying another worktree's cache. Use `--force` when a result surprises you,
  and trust a run only on its final `Tasks:` line — never on output read mid-run.
- **Vitest times out under parallel load.** A saturated machine looks exactly like a
  regression. Re-run the suspect package alone before filing anything:
  `pnpm turbo run test --concurrency=1`.
- **A fresh worktree needs `pnpm install`.** Missing `node_modules`, an absent `dist` or
  a stale `.next` all disguise themselves as bugs in your code.
- **`turbo.json` declares no env.** A non-`NEXT_PUBLIC_` variable that is not declared
  never reaches the task — first for `build`, then for `test:e2e`.
- **`apps/themes` carries deliberate dead code.** "No imports" does not prove "deletable"
  there. Read the divergence doc before removing anything.
- **Convex local backends collide between sessions.** A dead backend or a competing
  watcher disguises itself as a code bug. Isolate by port.

### Use the fleet — none of these are solo tasks

Spawn subagents with the Agent tool, in parallel, batched into a single message whenever
their work is independent:

- **Explore** — sweep for every call site, twin and naming variant *before* you touch
  anything. Read-only and cheap, and it is what stops you fixing one occurrence of three.
- **Plan** — design the fix whenever it crosses package boundaries, i.e. anything
  touching `packages/convex-functions` plus a caller in both apps.
- **general-purpose** — one per independent item, so items advance concurrently.
- **An adversarial verifier per fix**, briefed to *prove the fix does not work*. Never let
  the agent that wrote a fix be the one that blesses it. This is how the two regressions
  in this backlog got through.

Load the skills that fit — they are installed, and they beat improvising. For any batch:
`systematic-debugging` (reproduce before fixing), `tdd`, `typescript-expert`,
`convex-patterns` (validators, `internalMutation` vs `internalAction`, `convex-test`),
`full-output-enforcement` (no placeholders, no truncated output), `lint-and-validate`.
Batch-specific skills are named in each prompt.

This repo has **no CodeGraph index** (`.codegraph/` is absent). If you expect to navigate
widely, propose `codegraph init .` to the user first — do not run it unasked.

### Conventions — do not violate

- **English everywhere on GitHub and Git**: commits, branch names, issue and PR text,
  repository docs, code comments, test names. French stays only for customer-facing copy,
  legal text, French domain terms quoted inside an English sentence (*établissement*,
  *apporteur d'affaires*, SIRET), and fixtures.
- **Never mention Claude in a commit message.** No `Co-Authored-By: Claude`.
- TypeScript strict, no `any`, Zod validation on all inputs, barrel files.
- Run `pnpm test` before committing. `main` is protected by 4 required checks.
- **Do not commit or push unless the user asks.**

### What is never yours to close

Some items end in an action inside a third-party console — Stripe, AWS, Convex, Google
Cloud, GitHub secrets. Those belong to the account owner.

Deliver the repo half completely: the code, the guard, the test, and a runbook precise
enough to execute without you. Then **say plainly that the console step is outstanding**.
Do not fabricate an untestable guard to make an item look closed. Each prompt names its
own console-side residue under *Not yours to close*.

---

## Batch 00 — Foundation: deploy, encrypt, observe
**5/8 done · 3 partial · nothing open.** Mostly console residue, plus one real gap: E2E has never run.

````
Read `tasks/fix-prompts.md` and follow its "Shared brief" section in full — method, traps,
fleet, conventions. Then close batch 00 of the sales-readiness backlog.

Three items, all partial. Verified by execution at commit 8d41349:

- #179 — CI is confirmed blocking, but E2E has never actually run. `CONVEX_E2E_ENABLED` is
  unset, there are zero `E2E_*` secrets, and the last 8 CI runs finish in 7-11 seconds with
  the job reported as skipped. A suite that is skipped reports the same green as a suite
  that passed. This is the item that matters: the other two are console actions.
- #171 — 11 of 13 sub-points are done, including the test-timeout flakiness. Two remain:
  E2E is still off (same root cause as #179), and three unaccented French strings survive
  because the accent check compares the two apps against each other and the fault is
  present identically in both. Fix the check, not just the strings.
- #178 — The Convex spending-cap runbook is complete and cross-checked. Reading the actual
  cap requires the Convex console.

Your real work is #179 and the #171 remainder. Start by making the E2E job genuinely run
and genuinely fail on a broken build — prove it by breaking something on purpose and
watching CI go red, then restore it. A green CI that has never executed a test is worth
less than no CI, because it is trusted.

For the accent check: it is a twin-comparison, so it cannot see a fault present on both
sides. Give it an absolute reference instead. Then re-run it against the three known
strings and show it catching them.

Skills: `systematic-debugging`, `lint-and-validate`, `tdd`, `devex-review`, `guard`.
Fleet: an Explore agent to enumerate every workflow file and every E2E gate before you
edit; an adversarial verifier to try to make CI pass while the product is broken.

Not yours to close: reading the Convex spending cap (#178) and placing `E2E_*` secrets in
GitHub (#179) are account-owner actions. Write the runbook, name them as outstanding.

Done when: CI fails a pull request whose e2e is broken, and you have demonstrated it.
````

## Batch 01 — Authentication
**3/4 done · 1 partial.** The repo half is complete; what is left is a console action.

````
Read `tasks/fix-prompts.md` and follow its "Shared brief" section in full — method, traps,
fleet, conventions. Then close batch 01 of the sales-readiness backlog.

One item, partial. Verified by execution at commit 8d41349:

- #180 — `ADMIN_BOOTSTRAP_TOKEN` and the first-administrator path. The repo half is done:
  the call chain exists and the runbook is written. What remains is placing the token and
  restricting the Google Maps key — both console-side.

Before you assume there is nothing to do, verify the repo half yourself: follow the call
chain end to end and prove with a probe that a fresh, unconfigured clone cannot mint an
administrator without the token, and that a correct token mints exactly one. If either is
untrue, that is repo work and it is yours.

Skills: `systematic-debugging`, `security-audit`, `convex-patterns`, `tdd`.
Fleet: an Explore agent to find every path that can create a privileged user — including
seeds, fixtures and test helpers, which are where this kind of hole usually survives.

Not yours to close: placing the token and restricting the Maps key are account-owner
actions. Confirm the runbook is executable without you, then say they are outstanding.

Done when: no unconfigured clone can produce an administrator, proven by a test that stays
in the repo.
````

## Batch 05 — Payments and refunds
**0/4 done · 1 partial · 3 open.** Contains the product's worst regression: a refund is reachable from neither app.

````
Read `tasks/fix-prompts.md` and follow its "Shared brief" section in full — method, traps,
fleet, conventions. Then close batch 05 of the sales-readiness backlog.

This batch is on the critical path to an honest first sale. Verified by execution at
commit 8d41349:

- #128 — The fake refund on cancellation is unchanged; the block simply moved to
  `packages/convex-functions/src/orders.ts:811-830`. Probe: issue the fake refund, then
  attempt a real one — `planRefund` rejects it with `not_settled`. The fake refund
  permanently blocks the real one. Worse, the test that blesses this behaviour survives
  verbatim: read it, and rewrite it.
- #129 — REGRESSION, and it widened. `apps/themes` used to escape this; it no longer does.
  Both apps now mount the same broken refund button, so a refund is reachable from
  neither. The button calls a deleted function; `PaymentsTabContent` is mounted nowhere.
  **This is a smaller job than it looks.** A 645-call-site sweep established that the
  payload at `order-detail-page.tsx:112` (`{ id, amount, reason }`) already matches
  `refundPayment`'s validator exactly — only the name is stale, and `useMutation` must
  become `useAction`, because a refund calls the provider before anything is recorded. The
  sibling dialog was already migrated and explains the rename in a comment
  (`packages/admin/src/pages/payments/refund-dialog.tsx:31-34`) — read it first, then apply
  the same change here. `packages/admin` injects the Convex API as `api: any`
  (`stores/admin-api-store.ts:21`), which is why TypeScript caught neither call.
  Then mount the correct tab in both apps — or lift it into `packages/admin` and render it
  from both, which is the better fix and is the same work as NEW-L-1.
- #162 — 0 of 6 sub-points done: bind Stripe settlement to amount and currency, dedupe
  events, add CSRF state to the SumUp callback, and three more. Note carefully:
  `apps/reference/convex/stripe.ts:83` now carries a comment claiming to call
  `assertSettlesOrder`. It does not — the probe answers `calls assertSettlesOrder: false`.
  Do not let that comment persuade you the work is done.
- #173 — Code guards are correct and covered by 13 tests. The founders coupon and the four
  maintenance prices still have to be created in Stripe.

Order: #128 first (it blocks the real refund), then #129 (nothing is testable through the
UI until the button exists), then #162. Money handling — probe every path against real
amounts and currencies, and assert on the resulting Stripe object, not on your own return
value.

Skills: `systematic-debugging`, `convex-patterns`, `security-audit` (for the CSRF state and
event dedup), `tdd`, `typescript-expert`, `pricing` (for #173's Stripe objects).
Fleet: a Plan agent for #162, which crosses package boundaries; one general-purpose agent
per item; an adversarial verifier per fix — for #129 specifically, brief it to prove a
refund is still unreachable from `apps/themes`, since that is exactly what regressed.

Not yours to close: creating the coupon and the four live prices in Stripe (#173) is an
account-owner action.

Done when: a real payment, then a partial refund, then a total refund all succeed from the
interface of BOTH apps, and appear identically in the Stripe dashboard.
````

## Batch 06 — Kitchen display and printing
**0/4 done · 2 partial · 2 open.** Auto-print regressed from unreachable to dead.

````
Read `tasks/fix-prompts.md` and follow its "Shared brief" section in full — method, traps,
fleet, conventions. Then close batch 06 of the sales-readiness backlog.

Verified by execution at commit 8d41349:

- #164 — REGRESSION. 2 of 9 sub-points done, and both were done by deletion rather than
  implementation. Sub-point 9 went backwards: the print-configuration tab was DELETED
  instead of being lifted into `packages/admin`. Measured consequence:
  `printConfig.enabled` can no longer be turned on by anyone, so `create` always writes
  `printStatus: "not_required"`. Automatic printing is not merely unreachable — it is dead
  product-wide. Restore the tab in `packages/admin`, render it from both apps, and prove a
  ticket reaches `printStatus: "pending"`.
- #135 — `notes: undefined` is hard-coded. End-to-end probe: a customer note dies at the
  validator, and the ticket item arrives with neither options nor note. Carry instructions
  and allergies through — this is a food-safety path, not a nicety.
- #137 — Probe on 5,000 tickets: `getByStore` returns all 5,000 and `getByStatus` returns
  4,988. No retention job exists. Bound the queries and add retention, or the kitchen
  screen eventually renders nothing.
- #136 — The duplicate is still fixed, but the ticket is still created on order creation
  rather than on payment confirmation, and `orderConfirmation` was removed instead of being
  implemented. Removing the caller does not implement the feature.

Note the pattern across #164 and #136: work was closed by deleting the thing that revealed
the gap. Treat any "fixed by removal" as unfixed until you can point at the behaviour
working.

Skills: `systematic-debugging`, `convex-patterns`, `tdd`, `typescript-expert`,
`design-taste-frontend` (the restored print tab is UI — do not ship a default-looking form).
Fleet: an Explore agent to map every writer of `printStatus` and every reader of
`printConfig` across packages and both apps before you touch anything; an adversarial
verifier briefed to prove auto-print is still dead.

Done when: a paid order prints automatically on a configured station, carrying its notes
and allergies; and the KDS query stays bounded at 5,000+ tickets.
````

## Batch 07 — Delivery platforms (Uber Eats, Deliveroo)
**0/6 done · 6 open.** The highest-volume channel, and the repository contains no test that names any of it.

````
Read `tasks/fix-prompts.md` and follow its "Shared brief" section in full — method, traps,
fleet, conventions. Then close batch 07 of the sales-readiness backlog.

Read this first, because it explains the whole batch: **no test in this repository names
`uberEatsWebhook`, `deliverooWebhook`, `mapUberEatsOrderToUnified` or
`mapDeliverooStatus`.** Coverage is zero. That is why five consecutive green CI runs have
never said a word about the eleven defects below. Assume nothing here is exercised, and
build the missing test surface as you go — it is part of the work, not overhead.

Verified by execution at commit 8d41349:

- #134 — Zero occurrences of `kitchenTicket` across 705 lines of Deliveroo handling. Probe
  with a correctly signed webhook: 1 order created, 0 tickets. Accept/reject does not
  exist either.
- #139 — Probe with two stores: an unidentified order AND its ticket both land on
  `allIntegrations[0]` — the wrong restaurant — with a total of 0 and a line reading
  "Commande Uber Eats". A multi-store product that misroutes orders to another owner's
  kitchen cannot ship.
- #140 — Probe: status goes to `confirmed`, `platformSyncStatus` stays `undefined`, and
  `acceptOrder` is never attempted. The order is confirmed to the customer without ever
  being accepted on Uber.
- #138 — Probe `orders.cancel.notification`: HTTP 200, status still `confirmed`,
  `cancelledAt` `undefined`. Cancellations and scheduled orders are never recognised — the
  event names are wrong.
- #163 — 9 of 9 sub-points open. Measured: a line-price ratio of 2.045 (prices roughly
  doubled), and marking `canceled` on a `delivered` order sends it back to `pending`. Plus
  a table scan per webhook, stock not propagated, and sandbox flags.
- #172 — The Deliveroo secret in git history. Four artifacts unchanged. Re-measured: the
  secret appears in 137 commits, of which 41 are ancestors of `main`. `.gitleaksignore`
  claims 18. A green Gitleaks scan proves nothing about this history.

On #172 specifically: rotating the secret is the account-owner's action and it must happen
BEFORE any history rewrite, not after. Rewriting `main`'s history is a decision for the
user, never yours to take unilaterally — prepare it, cost it, and ask.

Skills: `uber-eats-developer` and `deliveroo-developer` (both installed — use them, they
carry the platforms' actual contracts), `systematic-debugging`, `convex-patterns`,
`security-audit` (webhook signatures, #172), `tdd`.
Fleet: this batch parallelises well. One general-purpose agent per item, an Explore agent
first to map every webhook entry point and status mapping across both platforms, and an
adversarial verifier per fix. For #139, brief a verifier specifically to route an order to
the wrong store — that is the failure that costs a customer relationship.

Not yours to close: rotating the Deliveroo secret (#172) is an account-owner action, and
the history rewrite needs the user's explicit decision.

Done when: a signed webhook from each platform produces a correctly-routed order, a kitchen
ticket, correct prices, a real accept, and a cancellation that actually cancels — each
covered by a test that stays in the repo.
````

## Batch 08 — Storefront and SEO
**0/2 done · 1 partial · 1 open.** What the consumer sees, including a page that crashes.

````
Read `tasks/fix-prompts.md` and follow its "Shared brief" section in full — method, traps,
fleet, conventions. Then close batch 08 of the sales-readiness backlog.

Verified by execution at commit 8d41349:

- #152 — The faulty line is unchanged and byte-identical in both apps. A render probe
  replays the exact crash: `Objects are not valid as a React child`. `/contact` renders a
  Convex object directly. The error boundaries are still missing, so the crash takes the
  page down rather than degrading. Fix the render, then add the boundaries — in that
  order, so you can prove each independently.
- #168 — 12 of 12 sub-points open: dead CMS SEO, a 404 sitemap, structured data never
  rendered, a footer newsletter that discards the email, keyboard-inaccessible options.
  Two measurements worth knowing before you start: `noindex,nofollow` parses to
  `index: true` (the robots directive is inverted, so pages you meant to hide are being
  advertised), and a single click on the clean checkbox yields `[]`.

The newsletter that silently discards the email is the one to take personally: the visitor
sees a success state, and nothing was saved. Prove the fix by reading the record back.

Skills: `seo-audit` and `ai-seo` (for #168's SEO half), `design-taste-frontend` (this is
the storefront — the consumer-facing surface, do not ship generic), `systematic-debugging`,
`tdd`, `typescript-expert`. If you touch any customer-facing copy, it stays in French, and
run it through `copywriting` then `humanizer` and `stop-slop`.
Fleet: an Explore agent to find every twin of the `/contact` fault across both apps; one
general-purpose agent for the SEO half and one for the accessibility half of #168, since
they are independent; an adversarial verifier per fix.

Done when: `/contact` renders, a crash degrades instead of taking the page down, the
sitemap resolves, robots directives mean what they say, the newsletter stores what it
accepts, and the options are operable from a keyboard.
````

## Batch 09 — Blog and Auto Blog
**3/3 done.** The blog serves published articles at `/blog/[slug]`, Auto Blog runs on two
crons, and #167 closed 8/8. Kept for the record; the prompt below describes the state
before the batch was closed.

````
Read `tasks/fix-prompts.md` and follow its "Shared brief" section in full — method, traps,
fleet, conventions. Then close batch 09 of the sales-readiness backlog.

Verified by execution at commit 8d41349:

- #149 — Six articles are hard-coded across four files, `listPublishedArticles` has zero
  callers, and there is no `/blog/[slug]` route. The public blog shows demo posts and
  twelve dead links. Wire it to real articles and create the route.
- #150 — The cron registry enumerates exactly 3 jobs, and the AUTO-BLOG section is empty.
  `approvalMode` is read by nobody. Auto Blog is sold and has no scheduler. Either ship
  the crons, or reposition the offer as manual generation — that second option is a
  product decision, so put it to the user rather than deciding it yourself. Note the
  overlap with #175 in batch 14.
- #167 — 8 of 8 sub-points open. Two measurements: `createMedia` accepts a 5 GB SVG and
  `text/html` (an upload path that accepts HTML is a stored-XSS vector, so treat it as
  security work), and `DeleteObjectCommand` appears nowhere in the repository — nothing
  ever deletes from S3. Authorize the `storeId` of the generation actions, reserve quota
  before the OpenAI call, and fix the preview blocked by `X-Frame-Options`.

Reserving quota before the OpenAI call rather than after is what stops a burst of
concurrent requests from spending real money past the cap. Probe it concurrently, not
sequentially — sequential probes will not reproduce it.

Skills: `content-strategy` and `seo-audit` (blog structure and routes),
`security-audit` (#167's upload path), `convex-patterns`, `systematic-debugging`, `tdd`.
Fleet: an Explore agent to enumerate every cron registration and every S3 write path;
independent general-purpose agents for #149 and #167; an adversarial verifier per fix —
for #167, brief it to upload something hostile.

Done when: the public blog serves real articles at real URLs, uploads reject what they
should, quota holds under concurrency, and Auto Blog either runs on a schedule or is no
longer sold as automatic.
````

## Batch 10 — Emailing and CRM
**3/8 done · 2 partial · 3 open.** The heaviest batch; scheduled sending now works, the double opt-in does not.

````
Read `tasks/fix-prompts.md` and follow its "Shared brief" section in full — method, traps,
fleet, conventions. Then close batch 10 of the sales-readiness backlog.

Three items landed since the last round — scheduled campaigns dispatch every minute, and
batched sending is duplicate-proof via a `by_campaignId_subscriberId` index (probed with a
forced restart mid-send: `dupes = []`). Do not re-do that work. What remains, verified by
execution at commit 8d41349:

- #142 — No code anywhere builds or sends the `email/confirm` URL. The token became a real
  proof of consent, and the downstream half (`startWelcome`) landed on a hook nothing can
  reach. So every storefront signup is unreachable: the subscriber exists and can never be
  confirmed. This is the item that matters most in the batch — an opt-in list you cannot
  mail is not a list.
- #146 — The SES ConfigurationSet is hard-coded at 3 sites across 2 apps, and
  `AWS_SES_CONFIGURATION_SET` is never read. A campaign is still marked `sent` with 0
  delivered, which means the dashboard lies to the restaurant owner. Read the variable,
  and fail loudly when it is absent rather than reporting a success nobody got.
- #145 — Permanent bounces are still retried twice, which is what triggers an AWS sending
  pause and can cost the account its SES reputation. `bounceType` is declared at
  `emailHttpHandlers.ts:228-231` and read nowhere; `:331-333` still calls `markBounced`
  with `{id}` alone; `emailSubscribers.ts:267-279` suppresses only at `newCount >= 3`.
  Probe result: passing `bounceType` raises `Validator error: Unexpected field bounceType`
  — the argument does not exist. Suppress a permanent bounce on the first one.
- #166 — 9 of 10 sub-points done. Find the tenth, finish it, and report which it was.
- #177 — The `check-ses-status` script is delivered and tested. Missing: the `ses:check`
  script in `apps/reference`, and the AWS production-access request itself.
  **Correction, verified by execution:** it was delivered but NOT tested — no test
  existed anywhere in the repo. Reading it adversarially found the AWS response was
  `eval`'d, so a crafted `EnforcementStatus` both executed a shell command and graded as
  `HEALTHY`, plus two further states it called "ready" without understanding. Fixed, and
  now covered by `apps/*/scripts/check-ses-status.test.mjs`.

Order: #145 first (it protects the sending account and the rest of the batch depends on
SES staying healthy), then #142, then #146.

Skills: `emails` and `email-sequence` (the opt-in and welcome flows), `convex-patterns`,
`systematic-debugging`, `security-audit` (#142's token handling), `tdd`. Any
customer-facing email copy stays in French and goes through `copywriting`, then
`humanizer` and `stop-slop`.
Fleet: an Explore agent to trace every send path and every ConfigurationSet occurrence
across both apps; one general-purpose agent per item; an adversarial verifier per fix —
for #142, brief it to prove a storefront signup still cannot be confirmed.

Not yours to close: the AWS SES production-access request (#177) is an account-owner
action. Ship the `ses:check` script and the runbook, then say so.

Done when: a storefront signup receives a confirmation email, confirms, and receives the
welcome sequence; a permanent bounce suppresses on the first occurrence; and a campaign
reporting `sent` has actually been delivered.
````

## Batch 11 — Internationalisation
**2/2 done · nothing open.** Was: ten advertised features, and switching language changed
one HTML attribute. The prompt below is kept for the record; the only thing left is the
console step — `OPENAI_API_KEY` on the Convex deployment.

````
Read `tasks/fix-prompts.md` and follow its "Shared brief" section in full — method, traps,
fleet, conventions. Then close batch 11 of the sales-readiness backlog.

Verified by execution at commit 8d41349:

- #148 — The language store is never initialised, there is no working `t()`, and the SSR
  CMS and SEO readers still look for a `locale` cookie while the app writes `beid_locale`.
  Net effect, measured: switching language changes `<html lang>` and nothing else. Mount
  the initialiser, expose a `t()` that is actually used, and align the cookie name across
  every reader — a cookie read by `layout.tsx` but not by the SSR readers is the specific
  shape of this bug, so enumerate the readers before you edit.
- #147 — All three blockers intact. Probe: all three patches are rejected by the
  validator. Declare the schema fields, switch to `internalAction`, and call
  `scheduleTranslation` from the catalogue mutations. The validator rejection is the first
  thing to fix — until the schema accepts the fields, nothing downstream can be tested.

Do #147 before #148: the schema has to accept translated content before there is anything
for `t()` to render.

Skills: `convex-patterns` (this is a validator/schema/action problem end to end),
`systematic-debugging`, `typescript-expert`, `tdd`. GPT-3.5-turbo does the translation —
check the existing helper before writing a new one.
Fleet: an Explore agent to enumerate every reader of the locale cookie and every render
path that should be translated — SSR and client both; a Plan agent, since this crosses
`convex-schema`, `convex-functions` and both apps; an adversarial verifier briefed to find
a surface that still renders untranslated.

Done when: an admin adds a language, a product is translated, and the storefront renders
it — server-side rendering included, with the SEO tags in the right language.
````

## Batch 12 — Gamification
**0/2 done · 2 open.** Sixteen advertised features; a one-line fix means nobody can ever play.

````
Read `tasks/fix-prompts.md` and follow its "Shared brief" section in full — method, traps,
fleet, conventions. Then close batch 12 of the sales-readiness backlog.

Verified by execution at commit 8d41349:

- #130 — The insert at `packages/convex-functions/src/gameQRCodes.ts:14` is byte-identical
  to the audit. A `convex-test` probe replays `Missing required field scannedCount`. No QR
  code can be created, so nobody can ever play. Add `scannedCount: 0`. It is one line, it
  has survived four rounds, and it gates the entire batch — do it first.
- #159 — Commit `7e4f607` DOCUMENTED the divergence between the two apps as intentional
  instead of closing it. Read that commit before you start, so you are not misled by it.
  Probe: the winning path plays in `apps/themes`, and the ticket link still 404s. Lift the
  player flow into a package and render it from both apps, and replace the template's five
  `ComingSoon` placeholders — the five admin pages are one line each.
  `apps/themes/app/game/[qrCodeId]/_components/GameContent.tsx` is still a 37-line
  placeholder whose line 32 reads "Gamification flow will be implemented here."

Be careful with `apps/themes`: it carries deliberate dead code, so "no imports" does not
prove "deletable". Read the divergence doc first.

Skills: `convex-patterns`, `systematic-debugging`, `tdd`, `design-taste-frontend` (the
player flow is customer-facing and it is a game — a generic UI defeats its purpose).
Any player-facing copy stays in French, through `copywriting` then `humanizer`/`stop-slop`.
Fleet: fix #130 yourself immediately — it is one line and it unblocks everything. Then a
Plan agent for the package extraction in #159, and an adversarial verifier briefed to play
the full flow in `apps/themes` and prove it breaks.

Done when: scan → actions → play → win → ticket → counter validation works end to end IN
`apps/themes`, not only in the test bench.
````

## Batch 13 — Commercial site (beyours.fr)
**2/3 done · 1 partial.** Nothing has landed on the last item.

````
Read `tasks/fix-prompts.md` and follow its "Shared brief" section in full — method, traps,
fleet, conventions. Then close batch 13 of the sales-readiness backlog.

`apps/site` has its own Convex backend and no engine dependency, so this batch runs in
parallel with everything else and needs no engine knowledge.

One item, verified by execution at commit 8d41349:

- #181 — Nothing has landed. `issueLicenseKey` exists and has no caller. HTTP probe: an
  UNKNOWN licence key returns `entitled: true`. That is the whole problem — the licence
  check currently entitles anyone who asks, so maintenance renewals are unenforceable and
  so is the product's revenue model. Register each delivered site's licence key, and make
  an unknown key return `entitled: false`.

Start with the probe: send a made-up key and watch it come back entitled. That single
measurement is the item.

Skills: `convex-patterns`, `security-audit` (this is an entitlement check — treat an
unknown key as hostile input), `systematic-debugging`, `tdd`, `typescript-expert`.
Fleet: an Explore agent to find every caller and every entitlement decision in
`apps/site`; an adversarial verifier briefed to obtain `entitled: true` without a valid
key, by any route it can find.

Done when: an unknown licence key is refused, a registered one is accepted, and issuing a
key on delivery is wired into the flow that delivers a site — proven by tests that stay in
the repo.
````

## Batch 14 — Align the sales pitch with the product
**0/1 done · 1 open.** Four features are sold and do not exist. Last, once you know what shipped.

````
Read `tasks/fix-prompts.md` and follow its "Shared brief" section in full — method, traps,
fleet, conventions. Then close batch 14 of the sales-readiness backlog.

Run this LAST, once the other batches have landed, because its answer depends on what
actually shipped. Verified by execution at commit 8d41349, all four still true:

- #175 — Four advertised features do not exist:
  - **Square** — zero lines of code, advertised in three places.
  - **Auto Blog** — no scheduler. `crons.ts` registers 3 jobs and none is Auto Blog.
    Overlaps with #150 in batch 09.
  - **Menus / formules** — not orderable.
  - **"ESC/POS printing"** — what ships is a browser print dialog. `printerSettings` is
    still dead. Related to #164 in batch 06, which regressed.

Two honest ways out per feature: build it, or remove it from the copy. Both are
legitimate; shipping neither is not. This is a product decision with commercial
consequences, so **put the four choices to the user and let them decide** — do not quietly
delete a marketing claim or quietly promise to build a payment integration.

Your job is to make the decision easy: for each of the four, state precisely what exists
today, what "build it" would cost, and every place the claim currently appears — `CLAUDE.md`,
`apps/site` marketing copy, the onboarding tour, the template catalogue. Verify each
location rather than trusting the audit's list; the count was right in August and the copy
has moved since.

Skills: `product-marketing` and `copywriting` for any copy that changes, then `humanizer`
and `stop-slop` before delivery — marketing copy on beyours.fr is customer-facing and stays
in FRENCH. `launch` for the readiness framing.
Fleet: an Explore agent per feature to find every occurrence of the claim across the repo,
the site and the tour — run the four in parallel, they are independent.

Done when: every promise in `CLAUDE.md`, on the site and in the onboarding tour maps to
something a client can actually use — with the user's explicit decision recorded for each
of the four.
````

---

# New findings — discovery audit, 1 Sep 2026

Twenty-one prompts covering 65 defects that **no card in the backlog describes**. Found at
commit `009af63` by a sweep that asked "what was never audited?" rather than "is card #NNN
fixed?". Every claim below is a measurement, quoted from the probe that produced it.

Severity: **13 blockers** (NEW-A ×2, NEW-D, NEW-E, NEW-H, NEW-I, NEW-M, NEW-N, NEW-P,
NEW-Q, NEW-S ×2, NEW-T), 34 major, 18 minor.

All eight audit scopes have reported.

**One sweep came back clean, and that is worth recording.** The validator-versus-caller
direction — a UI call site sending a key the Convex validator does not declare, or omitting
a required one — was swept exhaustively: **645 mutation call sites** across both apps and
`packages/admin` (194 client bindings, 309 invocation sites, 336 server
`runMutation`/`scheduler` calls), 17 resolved by hand, **0 left unresolved**. Genuine
disagreements: **zero**. The only two call sites that do throw name functions that no longer
exist — `payments.refund` (#129) and `stores.updateBranding` (NEW-F-1) — and both were
already known. The P0-01 shape is not systemic here; do not spend another sweep on it.

**The "181+ features" claim is resolved.** `_project/FEATURES_DIAGRAM.md:647` is its only
origin, and that document's own 22-row table sums to **201**, not 181 — the headline is 20
short of its own arithmetic and derived from no code. `CLAUDE.md` copied the headline and
reproduced 9 of the 22 categories, totalling 92. Several categories inflate by counting
non-features: Design counts 6 themes as 6 features, Team counts 7 roles, Gamification counts
6 social-action types. **Neither 181, 201 nor 92 counts anything that exists.** The audited
figure is 29 shipping / 23 partial / 41 absent, and it belongs in `CLAUDE.md` in place of the
number.

**A verdict of mine was wrong, and it is corrected in `tasks/battle-plan.md`.** #169
(TECH-10) was marked resolved in the fourth verification round, closing batch 02. Its
backup/restore half is **not** fixed: `exportBackup` covers 29 of the schema's 100 tables,
omitting `orders`, `payments`, `kitchenTickets`, `teamMembers`, `gamePlays` and
`prizeRedemptions`, and `importTable` re-inserts under new ids so surviving rows point at
storeIds that no longer exist. A probe restored an establishment and reached **0 orders**.
I credited the card because `backup-restore.test.ts` was green — and that file never names
`orders`. This is the Shared brief's rule 2 costing a real error: a passing test is not
proof unless it exercises the failure. Batch 02 is reopened.

**One correction to an existing card, found in passing.** TECH-03 (#162) closes with a
bullet about a partially-refunded payment that "cannot be refunded again from the UI",
citing `payments-page.tsx:166-169`. That page is mounted by nothing (NEW-L-1), so the
bullet describes a defect on a screen no owner can open. The card stays open — its other
five bullets are real — but do not spend time on that last one until the page has a route.
Confirmed the same way: `apps/themes` does **not** escape #129 — no `SettingsContent`
exists there at this commit, so the card's parenthetical is wrong and both apps are
affected.

**Read this before running any prompt in a shared worktree:** engine packages are consumed
from `dist/`. A fresh worktree has none, and `apps/themes` then reports 8 failures that are
purely `Failed to resolve entry for package "@be-in-digital/…"`. Run
`npx turbo run build --filter='./packages/*'` first; the suite is then clean at 47 files /
541 passed / 13 skipped (the skips are Deliveroo sandbox scenarios needing live
credentials). Do not read an unbuilt workspace as a regression.

---

## NEW-A — apps/site: the checkout can be told what to charge
**1 blocker + 2 major + 1 minor.** The most urgent work in this file.

````
Read `tasks/fix-prompts.md` and follow its "Shared brief" section in full — method, traps,
fleet, conventions. Then fix the money path in `apps/site`, the commercial site.

`apps/site` has its own Convex backend and no engine dependency, so this needs no engine
knowledge. All four defects were measured at commit 009af63 and none has a card.

**A-1 — BLOCKER. `createCheckoutSession` bills whatever discount the caller asks for.**
`apps/site/convex/stripe.ts:115` is a public `action` with NO identity check anywhere in
its handler. It accepts `discountPercent: v.optional(v.number())` from the client
(`:134`), and never re-derives it from the referral code: the number goes straight into
the price calculation (`:236`) and into the Stripe coupon's `amount_off` (`:322-335`).
`referralCodes.validateCode` is also public and unauthenticated and hands out the
`referralCodeId` and `referrerId` for any code — and affiliate codes are published by
design. Measured:
```
[PROBE] validateCode says discountPercent = 10
[PROBE] honest order amountCents  = 875000
[PROBE] forged order amountCents  = 207500
[PROBE] discountPercent=500 -> order amountCents = -2800000  status = paid
```
Anyone who reads the Convex URL out of the browser bundle buys a Premium build for
2 075 € instead of 8 750 €, and a percent above 100 writes a negative-amount order. The
forged amount is also what the referral commission and `saRevenue` are computed from.
Fix: derive the percent server-side from `referralCodeId`, never from the caller; clamp
it to the code's own value; reject anything outside 0-100. Then probe the forgery again
and watch it fail.

**A-2 — BLOCKER. The Stripe webhook reads three fields the pinned API version removed.**
The installed SDK pins `2026-02-25.clover`. On that version `invoice.subscription` no
longer exists (it moved to `parent.subscription_details.subscription`) and
`subscription.current_period_start/end` moved to `items.data[].current_period_*`. The code
still reads the old shape at `apps/site/convex/http.ts:378`, `:460` and `:527-528`.
`event.data.object` is typed `Record<string, unknown>` with `as` casts, so `tsc` is blind,
and no test names any of these events. Measured through the real route with a valid HMAC:
```
[PROBE] invoice row after a PREMIUM renewal: [{"plan":"essentielle","subscriptionId":null,"amountCents":240000}]
[PROBE] currentPeriodEnd before = 1731536000000  after renewal = 1731536000000  (unchanged)
```
Every renewal invoice is orphaned from its subscription and labelled `essentielle`, so a
Premium client's 2 400 € renewal is booked and receipted as an Essentielle one, and
`/maintenance/status` tells a paying client their maintenance expired a year ago.

**A-3 — major. `checkout.session.completed` never reads `payment_status`.** The field
exists in the pinned types (`'no_payment_required' | 'paid' | 'unpaid'`) and is read
nowhere. The switch at `http.ts:122-159` handles ten event types;
`checkout.session.async_payment_succeeded`, `async_payment_failed` and
`checkout.session.expired` are not among them. Measured:
```
[PROBE] order status after an UNPAID checkout.session.completed = paid  paymentMethod = klarna
```
An unpaid session marks the order paid, sends the confirmation, writes a payment row,
creates the maintenance subscription and consumes a founders slot — and nothing later
corrects it. The repo's own design doc already required both fixes
(`tasks/web/referral-program-design.md:290-292`).

**A-4 — minor. Anyone can exhaust the advertised founders inventory.**
`countFoundersSold` counts *pending* founders orders for 24 h, and `createCheckoutSession`
creates that pending order (`convex/stripe.ts:243`) before the Stripe session (`:354`),
unauthenticated and unrate-limited. Measured: ten anonymous checkouts →
`countFoundersSold = 10`, "0 places restantes" on the launch offer for 24 hours, and
`isFounders: false` for every genuine buyer in that window.

Order: A-1 first — it is live revenue loss reachable by anyone. Then A-2, which is
silently mis-booking every renewal today. Then A-3, then A-4.

Skills: `security-audit` and `differential-review` (A-1 and A-4 are authorization holes),
`convex-patterns`, `typescript-expert` (A-2 is a types-vs-runtime problem — consider
typing `event.data.object` properly so `tsc` can see the next one), `systematic-debugging`,
`tdd`, `pricing`.
Fleet: an Explore agent first, to list every public Convex function in `apps/site` that
takes a money-relevant argument from its caller — A-1 may not be the only one. A Plan
agent for A-2, since the fix should make the whole webhook type-safe rather than patching
three field reads. An adversarial verifier per fix, briefed to buy the product at a
discount it did not earn.

Done when: a forged `discountPercent` is refused, a renewal invoice carries the right plan
and advances `currentPeriodEnd`, an unpaid session never marks an order paid, and each is
held by a test that stays in the repo.
````

## NEW-B — apps/site: personal data, consent and the affiliate contract
**3 major.** Legal exposure, not polish. French law is the binding constraint here.

````
Read `tasks/fix-prompts.md` and follow its "Shared brief" section in full — method, traps,
fleet, conventions. Then close three data-protection defects in `apps/site`, all measured
at commit 009af63, none carded.

**B-1 — An unauthenticated read returns a whole affiliate profile.**
`apps/site/convex/affiliateUsers.ts:50` (`getByUserId`) has no `withIdentity()` and no
caller anywhere in `app/ components/ lib/ tests/ convex/`. Measured, fully anonymous:
```
[PROBE] {"firstName":"Victime","lastName":"Dupond","address":"12 rue de la Paix","city":"Paris",
"postalCode":"75002","phone":"+33611223344","siret":"93081769700018","role":"admin",
"commissionOverrideCents":90000,"stripeConnectAccountId":"acct_1SECRET","stripeConnectStatus":"active"}
```
Its siblings `orders.get`, `invoices.getByEmail` and `subscriptions.getByEmail` were
deleted for exactly this shape, each with a comment explaining why
(`convex/orders.ts:97-101`, `convex/invoices.ts:84-92`); this one was missed. The same
defect was closed on the engine side as S2-6. Either delete it as unused, or convert it to
`internalQuery` — check for consumers first, then do the one the evidence supports.

**B-2 — The art. L. 221-28 waiver the CGV relies on is never recorded.**
The CGV state the withdrawal waiver is given *« En cochant la case de consentement prévue
à cet effet lors de la commande »* (`app/(landing)/cgv/page.tsx:224`). That box exists only
as React state (`components/checkout/checkout-flow.tsx:29`): `createCheckoutSession` takes
no consent argument and the `orders` table (`convex/schema.ts:169-208`) has no consent
field. Measured: `grep -rn "consent" convex` returns hits only in `affiliateSignature.ts`,
which *does* take `consented: v.boolean()` and refuses without it — so the correct pattern
already exists next door. Two consequences: the company can produce nothing when a consumer
exercises a 14-day withdrawal on a 3 500 € build, and the gate is client-side on a public
action, so it can simply be skipped. Record the consent server-side with a timestamp, and
refuse the order without it.

**B-3 — A signer's name outside Windows-1252 breaks the affiliate contract permanently.**
`convex/affiliateSignature.ts:186-275` draws the PDF with `pdf-lib` and
`StandardFonts.Helvetica`, which is WinAnsi-only. `fullName` is free text validated only on
length. Measured:
```
"Jean Dupont"      -> OK          "Aurélie Lefèvre" -> OK
"Łukasz Kowalski"  -> THROWS: WinAnsi cannot encode "Ł" (0x0141)
"Nguyễn Văn An"    -> THROWS: WinAnsi cannot encode "ễ" (0x1ec5)
"Ayşe Şahin"       -> THROWS: WinAnsi cannot encode "ş" (0x015f)
```
A Convex action is not transactional: `createInAppSignatureRecord` commits a row with
`status: "signed"` *before* the PDF is generated, with no duplicate guard, so every retry
adds another orphan. `activateAfterSignature` never runs, `contractStatus` stays
`pending_contract`, and every `/parrainage/dashboard*` page redirects. An affiliate with a
Polish, Turkish, Romanian or Vietnamese name can never finish onboarding or earn a
commission — and the orphan rows corrupt the audit trail the eIDAS art. 25 claim at
`affiliateSignature.ts:11-17` rests on. Embed a Unicode font, and write the record only
after the document exists.

Also in scope, and the reason to treat this as one job: **the published privacy policy
promises a retention schedule that nothing implements.**
`app/(landing)/confidentialite/page.tsx:99-114` commits to *« Prospects : jusqu'à trois (3)
ans à compter du dernier contact »*. Measured: `grep -rn "db.delete" convex/` finds only a
contract-signature reset, two one-off migrations and a demo reset — no deletion path for
`whitelist`, `contactLeads`, `orders`, `saDeployments` or `affiliateUsers`, and
`convex/crons.ts` runs three referral jobs and nothing else. Separately, `whitelist.join`
is public and throws a distinct message when an address is already registered, which is
e-mail enumeration on a public endpoint. Honouring an art. 17 erasure request today means
an operator deleting rows by hand in the Convex dashboard, unlogged.

Skills: `security-audit` and `differential-review` (B-1 and the enumeration),
`convex-patterns`, `systematic-debugging`, `tdd`. Any user-facing legal or consent text
stays in FRENCH and is a legal artefact — do not reword the CGV or the privacy policy to
match the code. Fix the code to match the published commitment; if a commitment cannot be
met, that is a decision for the user, not a rewrite for you.
Fleet: an Explore agent to list every public Convex function in `apps/site` returning
personal data — B-1 is unlikely to be alone. An adversarial verifier briefed to read
another affiliate's SIRET and Stripe account id without authenticating.

Done when: no anonymous caller can read an affiliate profile, an order carries a
server-side consent record with a timestamp, a signer named Łukasz completes onboarding,
and personal data has a deletion path that matches what the site publishes.
````

## NEW-C — apps/site: a guard that cannot fire, and a console with no producer
**1 major + 1 minor.**

````
Read `tasks/fix-prompts.md` and follow its "Shared brief" section in full — method, traps,
fleet, conventions. Then fix two defects in `apps/site`, measured at commit 009af63,
neither carded.

**C-1 — The VAT guard cannot fire on the state that actually occurs.**
`apps/site/lib/env.ts:180-191` loops with `if (!isSet(value) || value === expected)
continue` — so it refuses a flag set to the *wrong* value, and never an absent one. Absent
is the default state of a fresh Vercel project. Measured:
```
[PROBE] VAT.regime = reel
[PROBE] no flags at all               -> ok = true   problems = []
[PROBE] NEXT_PUBLIC_TVA_ENABLED=false -> ok = false  problems = ['NEXT_PUBLIC_TVA_ENABLED']
```
`TVA_ENABLED = process.env.NEXT_PUBLIC_TVA_ENABLED === "true"`
(`lib/payment-providers.ts:81`) treats absent and `"false"` identically, and
`instrumentation.ts:3` skips validation during the build phase — which is exactly when
`NEXT_PUBLIC_*` is inlined. With `STRIPE_TAX_ENABLED=true` on Convex and the Next flag
simply forgotten, `order-summary.tsx:76` renders the no-VAT branch: the buyer is shown
8 750 € and Stripe charges 10 500 €. The deployment boots clean.
Note four files assert the opposite in prose — "validateSiteEnv refuses a deployment where
they disagree with it" (`lib/legal/company.ts:105`, `lib/payment-providers.ts:71`,
`convex/stripe.ts:158`, `convex/invoiceLegal.ts:114`). Those comments are wrong; fix the
guard and then fix the comments, or delete them.
The deeper cause is worth fixing too: `resolveStripeAccess` reads the **Convex** env while
`validateSiteEnv` reads the **Next** env, and nothing checks the two agree.

**C-2 — minor. The monitoring console has no producer.** `convex/saMonitoring.ts:109`
(`recordCheck`) and `convex/saFleet.ts:311` (`update`) have no callers anywhere. Measured:
```
$ grep -rn "saMonitoringChecks" convex/ | grep insert
convex/saMonitoring.ts:133  (recordCheck — no caller)
convex/saSeed.ts:525,536,546  (demo data)
$ grep -rn "uptime30d" convex/ | grep -v query
convex/saFleet.ts:203  uptime30d: 100    (set once, at create)
```
`recordCheck` also calls `requireAdmin`, so an automated prober could not call it even if
one existed. For every real client the console reports `health: "unknown"` and a constant
100 % uptime, and `saFleet.update` — the only way to correct domain, version, health or
integration state after provisioning — is mounted on no page. Already known internally as a
🟡 item at `apps/site/MISE_EN_PROD.md:99`, but not carded.

Skills: `systematic-debugging`, `typescript-expert`, `convex-patterns`, `lint-and-validate`.
Fleet: an Explore agent to find every other env guard in the repo written with the same
`!isSet(value) || ...` shape — this is a pattern, and it is likely copied. An adversarial
verifier briefed to deploy with no flags set and reach a page that charges the wrong total.

Done when: a deployment with a missing VAT flag is refused rather than silently
mischarging, and either the monitoring console reports real data or it stops claiming to.
````

## NEW-D — Client sites ship a stylesheet missing a third of its rules
**1 blocker.** Invisible in the monorepo. It appears only in what the customer buys.

````
Read `tasks/fix-prompts.md` and follow its "Shared brief" section in full — method, traps,
fleet, conventions. Then fix the client-build defect measured at commit 009af63. It has no
card, and it is the one defect in this file that no amount of internal testing can catch.

**D-1 — BLOCKER. The mirror's `@source` paths resolve outside the client repo.**
Tailwind v4 does not scan `node_modules`, so `apps/themes/app/globals.css:14-15` pulls the
engine packages in through two RELATIVE `@source` lines. `scripts/publish-mirror.mjs`
ships that file unrewritten — its `NOT_SHIPPED` list is only `vercel.json`, `.turbo` and
`tsconfig.tsbuildinfo`. In a client clone the mirror makes `apps/themes` the repo root, so
those paths resolve above the repo and hit nothing:
```
  ../../../packages/ui/src    -> .../packages/ui/src     DOES NOT EXIST
  ../../../packages/admin/src -> .../packages/admin/src  DOES NOT EXIST
```
Built the same `globals.css` in both layouts with the real Tailwind CLI:
```
A (monorepo):     2368 rules, 249672 bytes
B (client clone): 1585 rules, 172892 bytes     # -783 rules, -76780 bytes
  max-h-[60vh]              monorepo=1  client-clone=0
  min-h-[50vh]              monorepo=1  client-clone=0
  text-muted-foreground/30  monorepo=1  client-clone=0
  fill-orange-500           monorepo=1  client-clone=0
```
Every class used only inside `packages/ui` or `packages/admin` has no CSS in what the
client runs: unbounded dialogs with their submit buttons off screen, uncentered store-guard
states, an unstyled spice indicator. `globals.css`'s own comment records that this exact
regression was found and fixed once before, and names the consequence — the promotion
dialog "rendered 1549px tall in a 720px window with its actions off screen… the form could
not be submitted". `max-h-[60vh]` (`promotion-form.tsx:297`) and `min-h-[50vh]`
(`store-guard.tsx:58,66,88`) are among the classes lost again.

The fix is not just to patch the two paths — it is to make the class of defect impossible.
The mirror publishes a different tree from the one CI builds, and nothing compares the two.
Add a check that builds the published mirror's CSS and fails when its rule count diverges
from the monorepo build. Without that, this regresses a third time.

Start by reproducing: reconstruct a client clone from `scripts/publish-mirror.mjs`, build
its CSS, and count the rules. Do not fix anything until you have seen the 783 missing rules
yourself. If you can, verify against the real `beyours-boilerplate` mirror rather than a
local reconstruction — the previous measurement used a reconstruction.

Skills: `systematic-debugging`, `lint-and-validate`, `devex-review`, `typescript-expert`.
Consider `design-review` once fixed, to confirm the restored classes render as intended.
Fleet: an Explore agent to audit everything else `publish-mirror.mjs` copies verbatim that
contains a path relative to the monorepo root — `@source` is unlikely to be the only one.
An adversarial verifier briefed to find a class that still has no CSS in the client build.

Done when: a client clone's stylesheet matches the monorepo build rule-for-rule, and a
check in CI fails if that ever stops being true.
````

## NEW-E — packages/ui: the allergen badge crashes on French allergen names
**1 blocker + 1 major + 1 minor.** A legal disclosure surface that throws.

````
Read `tasks/fix-prompts.md` and follow its "Shared brief" section in full — method, traps,
fleet, conventions. Then fix three defects in `packages/ui`, the design system every app
renders through — 60 source files covered by ONE test file. Measured at commit 009af63,
none carded.

**E-1 — BLOCKER. `AllergenBadge` throws on the allergen names the data actually holds.**
`packages/ui/src/components/restaurant/AllergenBadge.tsx:42-43` looks up a 9-key English
`allergenConfig`. The schema is `allergens: v.array(v.string())`
(`packages/convex-schema/src/tables/catalog.ts:62`) and the caller launders it with
`allergen as Allergen` — `product-detail-client.tsx:169`, byte-identical in both apps.
Measured with `renderToStaticMarkup`:
```
× arachides        × lactose       × fruits à coque
× crustacés        × oeufs         × GLUTEN
✓ the nine declared English keys
  -> TypeError: Cannot read properties of undefined (reading 'icon')
```
These are not invented values: `"arachides"` is written by the repo's own seed
(`apps/reference/convex/seedKitchenOrders.ts:188`), `"lactose"` by its own schema test
(`packages/convex-schema/src/__tests__/validators.test.ts:90`), and the AI extractor
prompts GPT in French for "allergènes" (`apps/reference/convex/imageToProduct.ts:225,251`).
The market is French; the union is English-only. A French owner types the allergens of
their own dish and that dish's page dies with a client-side TypeError — and the allergen
block is a legal obligation under INCO 1169/2011, so the page that carries the disclosure
is the page that no longer renders. `packages/ui` already has the identical hardening for
`StoreStatusBadge`; apply the same shape here, and decide deliberately whether to
normalise French input, widen the union, or render an unknown allergen as plain text.
Do not simply swallow the error — an allergen that fails to display is its own hazard.

**E-2 — major. Icon-only controls in the design system carry no accessible name.**
Measured from the rendered markup:
```
QuantitySelector: aria-labels found: 0
  <button><svg class="lucide lucide-minus"></button>
  <input type="number">            (no id, no label, no aria-label)
  <button><svg class="lucide lucide-plus"></button>
AllergenBadge(nuts): <div title="Nuts"><svg class="lucide lucide-nut"></svg></div>
SpiceLevelIndicator(3): <div title="Spice level: 3/5"><svg …>
```
`title` on a non-interactive `<div>` is not a reliable accessible name and is unreachable
on touch. A blind diner cannot change quantity, and — the sharper one — cannot hear that a
dish contains nuts. This is distinct from card TECH-09, which covers app-level storefront
a11y; these are inside the shared package, so every app and every future client inherits
them.

**E-3 — minor. `PriceDisplay` prints a stray `0` next to the price.** Measured:
```
render(<PriceDisplay amount={12.5} originalAmount={0} />)
-> <span class="text-lg font-bold">12,50 €</span>0
```
`showDiscount && originalAmount && originalAmount > amount` evaluates to the number `0`,
and `{0 && …}` renders `0` in JSX. A `Boolean()` or `> 0` guard fixes it.

E-1 first, and treat it as the allergen-safety bug it is rather than a type mismatch.

Skills: `systematic-debugging`, `typescript-expert` (E-1 is an `as` cast defeating the type
system — remove the cast rather than widening it), `tdd`, `design-review` and
`design-taste-frontend` for E-2. This package has one test file for 60 components; landing
a real test surface here is part of the job.
Fleet: an Explore agent to find every other `as <Union>` laundering of a `v.string()` field
across the repo — E-1's shape is a pattern, and allergens are unlikely to be alone. An
adversarial verifier per fix, briefed for E-1 to find an allergen value that still crashes.

Done when: no allergen value a French owner can type crashes a dish page, the quantity and
allergen controls announce themselves to a screen reader, and `packages/ui` has tests that
would have caught all three.
````

## NEW-F — The design system is forked in two, and per-store theming does nothing
**2 major.** "Design (14)" and "theming per store" are sold. Neither is real.

````
Read `tasks/fix-prompts.md` and follow its "Shared brief" section in full — method, traps,
fleet, conventions. Then resolve two structural defects measured at commit 009af63, neither
carded.

**F-1 — Per-store branding is a form that writes to nothing, behind a page with no route.**
`packages/admin/src/pages/design/design-page.tsx:84,98` writes `primaryColor`,
`secondaryColor`, `accentColor`, `fontHeading`, `fontBody` into `stores.branding`
(`packages/convex-schema/src/tables/stores.ts:113`, typed `v.optional(v.any())`). Measured:
```
105 hits repo-wide for those field names. For store branding: design-page.tsx writes them
(:84,:98) and reads them back only to refill its own form (:61-65); everything else is
seeds, fixtures, and the separate emailConfig.branding table (which does work).
Zero readers in any storefront component, layout, or CSS-variable injection.
```
`--primary` has exactly one definition per app — a hardcoded `24 95% 53%` at
`apps/reference/app/globals.css:28` and `apps/themes/app/globals.css:28`. Nothing maps
branding onto it. And the form is unreachable anyway: `grep -rn "DesignPage" apps/*/app`
returns nothing, there is no `/design` route among the 74 admin routes, and its Settings
wrapper `DesignTabContent` has zero consumers.
Note the schema comment above the field asserts "Nothing writes them now" — `:84` does.
Fix the comment too.
For a product priced per store whose pitch is a theme by restaurant type, this is the
differentiator that does not exist: every restaurant ships the same orange.

**F-2 — Two forked copies of the design system render side by side, with different
geometry.** Measured:
```
apps/reference:  80 imports from @be-in-digital/ui | 100 from @/components/ui
apps/themes:     80 imports from @be-in-digital/ui | 102 from @/components/ui
Button, apps/reference: 25 files import the package one, 25 the local one
Storefront only:         3 package, 9 local
12 files import from BOTH (BlogAutoConfigForm.tsx:19-24 takes Button/Badge/Input/Separator
from the package and Label/Switch from local)
```
They have diverged, not merely duplicated: `button`, `badge`, `card`, `input`, `select` and
`table` all `diff` non-identical. Package Button is `default h-10 / sm h-9 / lg h-11` with
`focus-visible:ring-2 ring-offset-2`; the local copy is `h-9 / h-8 / h-10` with
`focus-visible:ring-[3px] focus-visible:border-ring`, plus `xs` and `icon-xs` sizes the
package lacks. Buttons are 4px different in height with different focus rings on the same
storefront depending on the page.
Related: ten exported components have zero consumers anywhere — `ActionBar`, `DataTable`,
`FilterBar`, `FormField`, `Navbar`, `PriceDisplay`, `ProductCard`, `QuantitySelector`,
`Spinner`, `Toast`. `ProductCard` and `QuantitySelector` are the design system's two
flagship restaurant components; the apps use their own `storefront-product-card.tsx`
instead. Do NOT assume these are deletable — `apps/themes` carries deliberate dead code and
`tasks/reference-themes-divergence.md` governs that. Read it, then propose.

These two are one job: F-1 cannot work until there is a single design system for branding
to drive. Converge first, then wire branding to CSS variables and mount the page.

This is a design decision as much as an engineering one — pick the direction (converge on
the package, or formally demote it) and put it to the user before executing a wide refactor.

Skills: `design-taste-frontend` and `design-review` (the storefront is customer-facing;
a per-restaurant theme is the product's pitch, so a generic result defeats it),
`redesign-existing-projects`, `typescript-expert`, `systematic-debugging`, `tdd`.
Fleet: a Plan agent for the convergence strategy — this touches ~200 import sites across
two apps and one package, and doing it badly is worse than not doing it. An Explore agent
to inventory every duplicated component and its divergences first. An adversarial verifier
briefed to find two visually different buttons on the same page after the fix.

Done when: one design system renders the app, a restaurant owner can reach a colour picker,
and changing a colour there changes what a diner sees.
````

## NEW-G — The engine's own documentation describes an API that was never written
**1 major.** The tool that onboards contractors sends them to imports that do not exist.

````
Read `tasks/fix-prompts.md` and follow its "Shared brief" section in full — method, traps,
fleet, conventions. Then fix the engine's documentation surface. Measured at commit
009af63, uncarded (the backlog's `packages/mcp-server` entry is stale and is about the
package being unwired, not about its data being wrong).

**G-1 — The MCP registry misdescribes 23 of its 145 exports.**
`packages/mcp-server/src/registry.ts` is 1328 lines of hand-maintained data with no test
and no generator. The server itself is healthy — a real stdio handshake returns 5 tools and
10 resources and `search_feature` answers correctly. The *data* is not. One import was
generated per registry claim, from its own `importPath`, and compiled:
```
$ npx tsc --noEmit --moduleResolution bundler --strict zz-probe-imports.ts
23 errors / 145 claims:
  TS2305 '@be-in-digital/core' has no exported member 'CanAccess' | 'RoleGate'
                                                    | 'uploadToS3' | 'sendEmail'
  TS2724 ... no exported member named 'sendTemplatedEmail'
  TS2307 Cannot find module '@be-in-digital/admin/pages'   (x10 page components)
  TS2305 '@be-in-digital/convex-functions' has no 'autoTranslate' | 'imageToProduct'
  TS2305 '@be-in-digital/cms' has no 'sanitizeSvg'   (it is on /sanitize)
  TS2339 Property 'client'|'menuSync'|'orders' does not exist on uberEats/deliveroo (x5)
```
All nine package versions are stale too — the registry says `2.0.1` where admin is at
`8.0.0`, off by six majors.

**G-2 — `CLAUDE.md` documents three AWS functions that do not exist.** Independently
confirmed:
```
$ grep -rn "export .*uploadToS3" packages/ apps/     -> 0 definitions
$ grep -rn "export .*sendEmail\b"  packages/ apps/   -> only sendEmailParamsSchema (a Zod schema)
$ grep -rn "export .*sendTemplatedEmail\b"           -> only sendTemplatedEmailParamsSchema
```
The real API is `createS3Service()` (`packages/core/src/aws/s3/client.ts:111`) and
`createSESService()` (`packages/core/src/aws/ses/client.ts:63`). But note what else the
measurement showed: `packages/core`'s export map is `. ./env ./sentry ./auth/rbac
./aws/media-url ./aws/folders` — **there is no `./aws/ses` or `./aws/s3` subpath at all**,
so neither real service is reachable from outside the package. Fixing the docs is not
enough; decide whether to export the services or to document that they are internal.
`CLAUDE.md`'s AWS section is the source of the fiction — it must change either way.

**G-3 — `packages/admin` declares a subpath that does not exist.** Confirmed:
```
$ grep -n '"./pages"' packages/admin/package.json
29:    "./pages": "./src/pages/index.ts",
$ ls packages/admin/src/pages/index.ts   -> ABSENT
```
This is what makes all ten registry page claims unresolvable, and it is a broken export map
in a published package — a consumer following it gets a module-not-found.

Nothing can catch any of this today: `tsc` sees only strings in the registry, and
`packages/mcp-server`'s `test` script is `vitest run --passWithNoTests` over zero test
files, exiting 0. The durable fix is to generate the registry from the real export maps, or
to add a test that compiles every claim — the probe above is most of that test already.

Skills: `typescript-expert`, `mcp-builder`, `tdd`, `systematic-debugging`,
`document-generate` and `document-release` for the `CLAUDE.md` half.
Note: `CLAUDE.md` is repository documentation, so it stays in ENGLISH.
Fleet: an Explore agent to check every package's export map against the files it names —
G-3 is unlikely to be the only broken subpath. An adversarial verifier briefed to follow
the registry and reach an import that still fails.

Done when: every registry claim compiles, `CLAUDE.md` describes the API that exists, every
declared subpath resolves, and a test fails if any of that drifts again.
````

## NEW-H — The checkout guards are real, and none of them can do its job
**1 blocker + 3 major + 2 minor.** The order path is sound. Both of its ends are not.

````
Read `tasks/fix-prompts.md` and follow its "Shared brief" section in full — method, traps,
fleet, conventions. Then fix the diner-facing order path in `apps/themes`, the app a paying
client actually runs. Measured at commit 009af63; none of these has a card.

Start from the good news, because it shapes the work: `orders.create` is genuinely solid —
it recomputes every price server-side, dedupes on an idempotency key, validates
availability, options, quantity and scheduling, enforces the minimum order and the delivery
radius, gates on the store's service switches, and writes the kitchen ticket in the same
transaction. Most of what the backlog cards as broken here is fixed. What is left is that
its refusals cannot be read, and three of its guards cannot actually hold.

**H-1 — BLOCKER. Every checkout refusal reaches the diner as "Server Error".**
```
$ grep -c 'throw new LineRejectedError' packages/convex-functions/src/orderLine.ts   -> 8
$ grep -c 'throw new Error('            packages/convex-functions/src/orders.ts     -> 15
$ grep -c ConvexError packages/convex-functions/src/orders.ts                       -> 0
$ grep -c ConvexError packages/convex-functions/src/orderLine.ts                    -> 0
```
Convex redacts a thrown `Error` message in production; only `ConvexError` survives to the
browser. The repo states this rule itself, twice — `packages/convex-functions/src/auth.ts:45`
and `apps/themes/tests/convex/invitation-acceptance.test.ts:277` both explain the exact
failure. That fix was applied to the **authorization** path and never to the customer
checkout path. So eight carefully written French sentences — `« Pizza » est épuisé.`,
`« Pizza » exige un choix : Taille.`, plus "below the minimum order", "outside the delivery
radius", "this store does not offer delivery" — all become two words at the moment of
payment. The diner is blocked with no reason and no action, and abandons.
This is what makes it a blocker rather than polish: it renders the entire server-side
validation effort invisible. Convert the checkout path to `ConvexError`, keep the French
messages (they are customer-facing copy), and prove one reaches the browser intact.

**H-2 — major. Tracked stock is never decremented by an order.**
```
$ grep -c stock packages/convex-functions/src/orders.ts   -> 0

PROBE: stock before = {"tracked":true,"quantity":2}
PROBE: order 1 -> stock {"tracked":true,"quantity":2}
PROBE: order 2 -> stock {"tracked":true,"quantity":2}
PROBE: 4 portions sold out of a tracked stock of 2
PROBE: the insufficient_stock guard fires when the number is right
```
The guard and its message are correct and can only ever fire if the owner retypes the
quantity in the dashboard after every single order. A restaurant tracking 10 portions of
the daily special sells 50 and finds out in the kitchen. `autoDisableWhenEmpty`
(`products.ts:426`) is likewise reachable only from the manual `updateStock` mutation. The
backlog asked for the *check* (P0-09) and got it; nobody asked for the *decrement*.
Decrement inside the same transaction as the order, or the race reopens the hole.

**H-3 — major. Opening hours are enforced in the browser only.**
```
$ grep -c hours packages/convex-functions/src/orders.ts   -> 0

PROBE: every day marked isClosed -> order created, tables written ["orders","kitchenTickets"]
PROBE: 04:00 order accepted (hours 11:00-14:00), kitchen ticket written = true
```
`isOrderableStore` (`storeStatus.ts:66`) returns `store?.status === "open"` and nothing
more; its own comment concedes hours are "a separate question, answered in the storefront".
Nothing flips `status` on a schedule — there is no such cron. The only gate is a client-side
`toast.error` at `checkout/page.tsx:414`. A tab left open past closing, a cart restored from
localStorage, or a direct mutation call produces a paid order and a kitchen ticket at 4am in
an empty building. The same hole was closed one level up for the manual `closed` status and
left open for the weekly schedule — which is the one restaurants actually rely on.

**H-4 — major. The menu and the order mutation disagree about scheduling windows.**
```
PROBE @23:00  client(menu) = false  server(order) = true
PROBE @01:00  client(menu) = false  server(order) = true
PROBE tz      client = true (UTC)   server = false (Europe/Paris)
```
The server (`timeWindow.ts:98`) handles midnight-crossing windows and takes a `timezone`.
The client (`packages/restaurant/src/services/product.ts:37`) does neither — `now.getDay()`
/ `now.getHours()` on the visitor's own clock, and `currentTime > availableUntil` reads a
22:00→02:00 late menu as an empty set. Two opposite failures from one seam: the late-night
menu is greyed out every hour it is actually served, and a diner in another timezone sees a
dish, adds it, and is refused at payment — with H-1's unreadable error. This is the same
midnight-crossing bug as carded P0-02, fixed for store hours and left in product windows.
The durable fix is one shared implementation, not two that agree today.

**H-5 — minor. `/cart` shows "Votre Box est vide" before the persisted cart hydrates.**
`packages/restaurant/src/hooks/useCartHydrated.ts` exists precisely for this and documents
the failure mode. It is applied to `/checkout` (twice) and to neither of the two lines in
`app/(storefront)/cart/page.tsx:67` that read `items.length`. A diner who reloads or
arrives from a bookmark gets a full-screen "your basket is empty" hero on first paint. It
self-corrects, but it is the dead-end screen and the hook is already written next door.

**H-6 — minor. Scheduled / pre-orders have no storefront writer.**
`orders.scheduledFor` and `scheduledAt` exist in the schema; the only writer is
`uberEatsOrders.ts`. Zero occurrences across the whole storefront. A diner cannot order at
10am for 12:30 on the restaurant's own site. Low severity only because no marketing copy
was found claiming pre-orders — **check `apps/site` before deciding; if it is sold, this
moves up sharply.**

Order: H-1 first — it makes every other refusal in this list legible, including the ones
you are about to add. Then H-2 and H-3, which are the two guards that silently do nothing.

Skills: `convex-patterns` (the `ConvexError` conversion and transactional decrement are
both squarely Convex idiom), `systematic-debugging`, `tdd`, `typescript-expert`. The French
refusal messages are customer-facing copy — keep them French, and if you write new ones run
`copywriting` then `humanizer` and `stop-slop`.
Fleet: an Explore agent to find every other `throw new Error` on a path whose message is
meant for a customer — H-1's shape almost certainly repeats. A second Explore agent to find
every guard that reads state the mutation never writes (H-2 and H-3 are the same shape). An
adversarial verifier per fix; for H-3, brief it to place an order at 4am.

Done when: a diner who is refused can read why, tracked stock falls when a dish sells,
an order outside opening hours is refused server-side, and the menu and the mutation agree
about a 22:00-02:00 window — each held by a test that stays in the repo.
````

## NEW-I — Dine-in and allergens: two surfaces designed and never wired
**1 blocker + 1 major.** Both are regulatory or operational, not cosmetic.

````
Read `tasks/fix-prompts.md` and follow its "Shared brief" section in full — method, traps,
fleet, conventions. Then finish two product surfaces that were designed, translated, and
never connected. Measured at commit 009af63; neither has a card.

**I-1 — BLOCKER for the `dine_in` order type. A dine-in order carries no table number.**
```
$ grep -c tableNumber packages/convex-schema/src/tables/orders.ts    -> 0
$ grep -c tableNumber packages/convex-schema/src/tables/kitchen.ts   -> 0
$ grep -rn tableNumber "apps/themes/app/(storefront)" apps/themes/components/storefront \
    apps/themes/components/admin/kitchen packages/convex-functions/src/orders.ts \
    packages/convex-functions/src/kitchenTickets.ts | wc -l          -> 0
```
Yet the string is shipped and translated three times — `fr.json:109`
`"checkout.tableNumber": "Numéro de table"`, and the same key in `en.json` and `es.json`.
The only `tableNumber` in the product belongs to gamification QR codes and never touches an
order. "Sur place" is offered in the order-type selector
(`components/storefront/order-type-selector.tsx:36`) and accepted by the server, but the
ticket printing in the kitchen carries a customer name and nothing else. Staff have a plate
and nowhere to take it. The translated-but-unused key is the tell: this was designed and
abandoned. One of the three advertised order types is unusable.
The gamification QR codes already carry a table number — check whether the two should share
one concept before you add a second, parallel one.

**I-2 — major. The allergen chain is broken at every link.** Four measured facts, one root:
```
$ grep -rn allergen apps/themes --include=*.tsx | grep -v node_modules
  components/storefront/product-detail-client.tsx:169   <- AllergenBadge (see NEW-E-1)
  components/admin/kitchen/PrintTicketLayout.tsx:146     <- {allergens.join(", ")}
  components/admin/kitchen/KitchenPrintTrigger.tsx:101

$ grep -rn allergen packages/admin/src --include=*.tsx | grep -v image-to-product
  product-form.tsx:81    allergens: z.array(z.string()).optional()
  product-form.tsx:161   allergens: []
  (zero form controls anywhere in packages/admin/src)

$ grep -n allergen packages/convex-functions/src/uberEatsMenuSync.ts  -> 87 (type decl only)
```
1. **The printed kitchen ticket renders the strings raw** — `{allergens.join(", ")}` under
   an allergen heading. Whatever text is in the array is what the cook reads before
   plating. This is the one place where an unrecognised allergen string is a safety
   question rather than a rendering one.
2. **There is no allergen input anywhere in the admin.** The field exists in the product
   form only as a zod declaration and a `[]` default. A restaurateur cannot declare an
   allergen through the normal product editor at all.
3. So the only production writer is the AI image-to-product flow, whose prompt is written
   in French (`imageToProduct.ts:213,239`, "allergenes tres probables"). That is exactly how
   a French allergen name reaches the badge that crashes on it — see NEW-E-1, which is the
   same chain seen from the other end. **Fix these two together.**
4. `uberEatsMenuSync.ts:87` declares `allergens?: string[]` and never maps it into the
   outgoing payload, while Uber Eats expects an enumerated `Array<{type: string}>`
   (`packages/integrations/src/uber-eats/types.ts:299`). Allergens are silently dropped
   from the synced menu.
Net: a restaurant cannot declare allergens through its own dashboard; the ones the AI
guesses are unvalidated French free text; they print raw on the cook's ticket and crash the
customer-facing badge; and they never reach Uber Eats. For an EU food business under INCO
1169/2011 this is a regulatory surface.
Settle the representation first — an enumerated set with stable keys and localised labels,
or free text with an explicit "unverified" treatment everywhere it renders. Then wire the
admin input, the badge, the ticket and the Uber Eats mapping to that one decision. Do not
fix the four surfaces independently; that is how they diverged.

Skills: `convex-patterns`, `typescript-expert` (I-2 is a `v.array(v.string())` that should
carry a real contract), `systematic-debugging`, `tdd`, `design-taste-frontend` for the
missing admin control and the dine-in table field. Allergen labels shown to diners are
customer-facing copy and stay French. `uber-eats-developer` for the sync mapping in point 4.
Fleet: a Plan agent for I-2 — it crosses `convex-schema`, `convex-functions`,
`packages/admin`, `packages/ui`, both apps and the Uber Eats integration, and doing it
piecemeal is what produced the current state. An Explore agent first, to confirm the four
surfaces above are the complete set. An adversarial verifier briefed to get an allergen
onto a kitchen ticket that the badge cannot render.

Done when: a dine-in ticket tells the kitchen which table, a restaurateur can declare
allergens from the dashboard, and one allergen value renders correctly on the storefront,
on the printed ticket and in the Uber Eats payload.
````

## NEW-J — The new weekly-send cap will stop email marketing, then keep it stopped
**1 major, on a clock.** It works today and fails permanently once a customer is loyal enough.

````
Read `tasks/fix-prompts.md` and follow its "Shared brief" section in full — method, traps,
fleet, conventions. Then fix a query added in the post-audit window. Measured at commit
009af63; uncarded.

**J-1 — `sentCountsSince` reads every subscriber's entire lifetime event history on every
batch.** `packages/convex-functions/src/emailEvents.ts:110`, called from
`emailCampaignActions.ts:207` in both apps, with `BATCH_SIZE = 40`.
```
[probe] emailEvents rows in table ......... 6240
[probe] rows inside the 1-week window ..... 0
[probe] rows the query had to read ........ 6240
[probe] wall clock ........................ 258 ms
[probe] emailEvents indexes: by_campaignId | by_subscriberId | by_storeId_type
                             | by_campaignId_subscriberId
```
It does `.withIndex("by_subscriberId").collect()` per subscriber, then filters
`type === "sent" && occurredAt >= since` **in JavaScript**. No index pairs `subscriberId`
with `occurredAt` or `type`, so the week window cannot narrow the scan: 6,240 documents read
to return an answer that touched 0.

Convex's per-transaction read ceiling is 16,384 documents. At `BATCH_SIZE = 40` that is
roughly **410 lifetime events per subscriber before every batch throws** — and events
accumulate from sent + delivered + opened across campaigns *and* the post-order and win-back
automations wired in this same window. So the failure is not a slow query; it is a wall the
product walks into as its best customers become loyal, after which no campaign for that
store can ever complete.

The fix is a matter of the right index, and the codebase already knows it. In the same file,
`alreadySentTo` (`emailEvents.ts:88`) narrows on `by_campaignId_subscriberId`, and the schema
comment at `packages/convex-schema/src/tables/emailMarketing.ts:584` reasons explicitly about
avoiding this exact shape — "would read every event the campaign has produced, once per
subscriber, which is quadratic". The new query re-introduced it on the subscriber axis.

No test crosses this seam: `grep -rl sentCountsSince --include='*.test.ts'` returns nothing.
`withinWeeklyCap` and `resolveWeeklyCap` are pure and tested, which is precisely why the
suite is green — the tested parts are not the broken part.

Reproduce before fixing: seed a subscriber past the ceiling and watch a batch throw. A fix
that merely makes the query faster is not enough; prove the read count stays bounded as
history grows, and land that as a permanent test.

Skills: `convex-patterns` (index design and the per-transaction read limit are the whole
problem), `systematic-debugging`, `tdd`, `typescript-expert`.
Fleet: an Explore agent to find every other `.withIndex(...).collect()` followed by a
JavaScript filter on a field that is not in the index — this is a pattern and the schema
comment shows it has already happened twice. An adversarial verifier briefed to break the
fixed query by growing history.

Done when: a subscriber with 10,000 lifetime events does not stop a campaign, the read count
is bounded by the window rather than by history, and a test fails if that regresses.
````

## NEW-K — Guards added this window that do not cover what they claim
**1 major + 4 minor.** The repo's signature failure, caught in the act.

````
Read `tasks/fix-prompts.md` and follow its "Shared brief" section in full — method, traps,
fleet, conventions. Then fix five guards and annotations that assert more than they do.
All measured at commit 009af63; none carded.

Read the Shared brief's "comments that lie" trap first — this prompt is that trap, five
times, all introduced or left behind in the last 16 commits.

**K-1 — major. The shipped template's 54 Playwright specs run in no workflow, and the last
commit hardened the job that never runs.**
```
$ grep -n "CONVEX_E2E_ENABLED == 'true'" apps/themes/.github/workflows/ci.yml
116:    if: vars.CONVEX_E2E_ENABLED == 'true'
$ grep -c "if: vars.CONVEX_E2E_ENABLED" .github/workflows/e2e.yml     -> 0
$ find apps/themes/e2e -name '*.spec.ts' | wc -l                      -> 54
$ grep -n "test:e2e" .github/workflows/e2e.yml
259:  run: pnpm test:e2e --filter=@beyours/reference
$ grep -n "e2e" .github/workflows/ci.yml                              -> (no output)
```
Commit `009af63` removed the gate from the root `e2e.yml` (that part is carded and fixed)
and left it on the template's own `ci.yml` — while, in the same commit, adding to that gated
job the backend requirement, the `assert-e2e-ran.mjs` call and the artifact upload. All of
that hardening sits inside a job whose `if:` is false. Root `e2e.yml` runs
`--filter=@beyours/reference` only, root `ci.yml` has no e2e job, and
`apps/themes/.github/workflows/` is not read by GitHub in this repo at all.
The sting: the parity guard added in the same window keeps those 54 specs byte-identical to
the bench's, which reads as "the shippable side is proven". **The app a restaurant owner
actually buys has an end-to-end suite that has never run once.** Distinct from TECH-12 and
LAUNCH-08, which name `e2e.yml` (root/bench) only.
The harness itself is sound — `assert-e2e-ran.mjs` was verified by execution to exit 1 both
when projects are missing from the report and when all three report only skips. So the fix
is reachability, not rewriting the check.

**K-2 — minor. The accent guard passes over de-accented French that the same commit left
behind.**
```
$ node scripts/check-french-accents.mjs
French accent check passed: twins agree, and 736 accented spellings are respected.  (exit 0)
$ for w in thematique completee creee; do grep -cx "$w" scripts/french-accented-words.txt; done
0 / 0 / 0
$ grep -rn -w creee packages apps --include='*.tsx'
suggestions-review.tsx:98  {newCategories.length} categorie(s) sera/seront creee(s) :
category-mapper.tsx:87     La categorie "{newCategoryName}" sera creee automatiquement
blogAutoGuards.ts:326      Votre plan ... est limite a ... thematique(s). Passez au plan supérieur
validators.ts:692          "Au moins une action doit être completee"
bidSubscription.ts:145     "Aucun abonnement Stripe lié a votre compte"
```
`blogAutoGuards.ts:326` was edited by `009af63` itself: `superieur` → `supérieur` was applied
while `limite a` and `thematique(s)` on the same line were not. `thematique`, `completee` and
`creee` have no correct unaccented French spelling, so by the word list's own membership rule
they belong in it. The commit message claims the accents "cannot come back"; the check
currently cannot see them. Add the missing words, then re-run and fix what it surfaces.
Distinct from TECH-12's accent bullet, which was the twin-diff problem and is fixed.

**K-3 — minor. A divergence-checker exemption is justified by files that no longer exist.**
`apps/themes/components/admin/index.ts:5-9` says "DELIBERATE DIVERGENCE from apps/reference —
do not align. StatusBadge, DateDisplay and ComingSoon exist only in this template, next to
the other template-only admin components (dashboard/, design/, games/, orders/, payments/,
products/, stores/, team/)". Measured: all eight directories and `StatusBadge.tsx` are
ABSENT — deleted by a later commit in the same window.
`scripts/check-app-divergence.mjs:74` carries the matching exemption, and the script's own
rule (line 63) requires the reason to be restated in the file. The reason is now false in
both places, and the comment instructs the next maintainer not to align a barrel whose
entire rationale is gone. Re-derive whether the exemption is still warranted; if not, remove
it from both places.

**K-4 — minor. A `@public-by-design` marker still defers rate limiting that was
implemented.** `apps/reference/convex/contactMessages.ts:18` and the themes twin both read
"rate limiting tracked as S3-7". `#261` added `consumeRateLimit(ctx, "contactPerEmail" |
"contactPerStore", …)` at `packages/convex-functions/src/contactMessages.ts:57-60`, which
this wrapper calls. The annotation the ESLint guard reads tells a reviewer the limit is
outstanding when it is done.

**K-5 — minor. `rateLimitArgs` is exported with no consumer and no test.**
`packages/convex-functions/src/rateLimit.ts:205`. Its doc comment says "Args shared by the
table wrappers in each app"; no app has such a wrapper, and its sole repo-wide occurrence is
its own definition. Either wire it or delete it — an exported symbol whose comment describes
an architecture that does not exist will mislead the next reader.

K-1 is the one that matters; K-2 to K-5 are cheap and each removes a false signal that will
otherwise cost someone an hour.

Skills: `devex-review` and `lint-and-validate` (K-1 to K-3 are all CI/tooling reachability),
`systematic-debugging`, `tdd`.
Fleet: an Explore agent to enumerate every workflow file in the repo, including ones under
`apps/*/.github/` that GitHub never reads, and say for each whether it can run at all — K-1
suggests nobody has done that inventory. A second Explore agent to check every
`@public-by-design`, `@guarded-inline` and `@unguarded-tracked` marker against current
behaviour. An adversarial verifier briefed to make the themes e2e job report green without
executing a single spec.

Done when: the template's 54 specs run somewhere and fail when they should, the accent check
sees the five strings above, and no annotation in the repo describes work that is already
done or files that no longer exist.
````

## NEW-L — packages/admin: screens that exist, work, and cannot be reached
**2 major + 2 minor.** 178 files, 4 test files. The engine's largest untested surface.

````
Read `tasks/fix-prompts.md` and follow its "Shared brief" section in full — method, traps,
fleet, conventions. Then fix four defects in `packages/admin`. Measured at commit 009af63;
none carded.

The shape repeats: the component is written, correct, and rendered by nothing. Before you
build anything new here, check whether it already exists unmounted.

**L-1 — major. The Payments screen — the engine's only transaction ledger — has no route,
no nav entry and no mount.**
```
$ find apps/*/app -name 'page.tsx' | grep -Ei 'payment|paiement' | wc -l   -> 0
$ grep -c "Paiements" packages/admin/src/config/nav-config.ts              -> 0
[probe] PaymentsPage: imported by NOTHING
[probe] admin routes matching payments: NONE
        (controls: OrdersPage, SettingsPage, ProductsPage all resolved to a mounting route)
```
`CLAUDE.md:142-143` sells "Payments (8) — Stripe, SumUp, PayPal, Square, Cash, **tracking**,
refunds". The tracking half does not exist for the owner: no transaction list, no filter by
provider or status, no link to a Stripe or SumUp receipt, and no way to refund except by
first finding the order it belongs to. The component and its `RefundDialog` are written and
correct. Give it a route and a nav entry — and note that this compounds with #129, where the
refund button on the order page is itself broken, so today there is no working path to a
refund at all.

**L-2 — major. The sidebar offers "Cuisine (KDS)" to waiter and delivery, whose every KDS
query the server refuses.**
```
[probe] WAITER:   orders:read=1  kitchen:read=0
        DELIVERY: orders:read=1  kitchen:read=0
        KITCHEN:  orders:read=1  kitchen:read=1
        MANAGER:  orders:read=1  kitchen:read=1
[probe] nav gate for Cuisine (KDS): orders:read
        roles shown the link  : super_admin, client_admin, manager, kitchen, waiter, delivery
        roles the server allows: super_admin, client_admin, manager, kitchen
        SHOWN BUT REFUSED     : waiter, delivery
```
The nav gates on `orders:read` (`nav-config.ts:86-90`) while every KDS query requires
`kitchen:read` (`kitchenTickets.ts:55-108`). Both roles are handed out by the owner's own
Team screen (`team-page.tsx:69-74`, "Serveur" and "Livreur"). The route renders
`KitchenContent`, whose first call is `api.kitchenTickets.getByStore`; `useQuery` rethrows
during render and unwinds past the admin shell. Every server and every driver the owner adds
sees a KDS link, clicks it, and lands on an error page.
Gate the nav on the permission the server actually enforces — and check the rest of
`nav-config.ts` the same way while you are there.

**L-3 — minor. `LanguagesTabContent` is a third unmounted settings panel.**
```
LanguagesTabContent: 0 external reference(s)
GeneralTab / HoursTab: 1 each  [settings-page.tsx]
```
`settings-page.tsx:12-16` mounts five tabs; the `settings/` directory holds eight panel
files. All three `*TabContent` files there are unmounted — `PaymentsTabContent` and
`DesignTabContent` were already known, this completes the set. Impact is small (a working
Languages screen exists at `/dashboard/languages`), but decide deliberately: mount it or
delete it.

**L-4 — minor. `KitchenPage` and `LanguagesPage` are dead; both apps hand-roll local
copies.** Neither is imported anywhere. The four route files that serve those screens
import `KitchenContent` / `LanguagesContent` from `@/components/admin/*` instead. No
capability is lost — the owner reaches both screens — but the engine's leverage is: the
screens exist twice, the packaged copy is what `packages/mcp-server` advertises to client
builds, and a fix made in the package reaches no client. TECH-05 records the same drift for
`KitchenSettingsTabContent`; these are two more instances of it.

Also relevant, already written up as **NEW-G-3**: `packages/admin/package.json:29` declares
`"./pages": "./src/pages/index.ts"` and that file does not exist. Resolution across all 20
subpaths the registry publishes showed it is the **only** broken one, and it is what makes
ten registry page claims unresolvable. Fix it here or in NEW-G, but not twice.

Skills: `systematic-debugging`, `typescript-expert`, `convex-patterns` (L-2 is a
permission-model mismatch), `design-taste-frontend` for the Payments screen's route and nav
placement, `tdd`. This package has 4 test files for 178 sources; landing real coverage is
part of the job.
Fleet: an Explore agent to diff every exported `*Page` and `*TabContent` against every
mount site across the three apps — L-1, L-3 and L-4 all came out of that one sweep, and it
should be run to exhaustion rather than sampled. A second Explore agent to check every
`requiredPermission` in `nav-config.ts` against the `permission:` its target's queries
declare. An adversarial verifier briefed to log in as a waiter and reach a screen the
server refuses.

Note for whoever runs this: `packages/admin`'s `vitest.config.ts` is `environment: 'node'`
with no jsdom, so "throws on first render" cannot currently be tested here. If you want L-2
covered by a test rather than by reasoning, that config has to change first.

Done when: the owner can open a transaction ledger, no sidebar link leads a role to a
refusal, and every exported page is either mounted or gone.
````

## NEW-M — A diner's personal data has no retention, no erasure and no consent record
**1 blocker.** A legal obligation on every restaurant that buys this. Not a feature.

````
Read `tasks/fix-prompts.md` and follow its "Shared brief" section in full — method, traps,
fleet, conventions. Then build the personal-data lifecycle the engine does not have.
Measured at commit 009af63; uncarded (the backlog's only GDPR mention is TECH-08, about S3
media objects).

**M-1 — BLOCKER. Nothing in the engine ever deletes, exports or anonymises a diner.**
Probe: seed an order and a game play dated four years back, then run **every** handler
`crons.ts` schedules (there are exactly three: `sweepInvitations`, `dispatchScheduled`,
`sweepInactive`):
```
=== after all three crons ===
  order age (days)     : 1460
  order still stored   : true
    customer email     : marie.dupont@example.fr
    customer phone     : +33612345678
    home address       : 8 rue de Charonne
  gamePlay still stored: true
    IP address         : 88.174.22.10
    device fingerprint : fp-9f3c2a
```
And the surface, by enumeration:
```
$ 135 public functions in apps/reference/convex
$ matching erase|forget|export|anonym|gdpr|rgpd|retention|consent|portabilit
    -> exportBackup only (an admin DB dump, and it excludes orders)
$ grep -rniE 'rgpd|gdpr|anonymi[sz]|data subject|portabilit' apps packages | wc -l  -> 4
    (all four are email-marketing double opt-in)
```
Only two public `remove`/`delete` mutations exist across all 135:
`customerAddresses.removeAddress` and `teamMembers.remove`. `orders`, `gamePlays` and
`prizeRedemptions` have no per-subject delete at any layer — no mutation, no admin UI, no
route. The only way to erase one diner is `storeCascade`, which deletes the entire
establishment.

Worse than the missing deletion: **`gamePlays` has no consent field at all.** Confirmed at
`packages/convex-schema/src/tables/gamification.ts:133-144` — it stores `playerEmail`,
`playerPhone`, `fingerprint`, `ipAddress`, `userAgent`, and records no legal basis for any
of it. A device fingerprint plus an IP is tracking data.

A French restaurant using this is the data controller. It cannot answer an access, erasure
or portability request (RGPD art. 15 / 17 / 20), cannot produce a consent record for the
game (art. 7.1), and accumulates identified customers with IP and fingerprint indefinitely
(art. 5.1.e). The CNIL's retention guidance for restaurant customer data is three years
from last contact.

What to build, in this order:
1. A per-subject erasure path (by email, and by fingerprint for anonymous game plays) that
   reaches `orders`, `gamePlays`, `prizeRedemptions`, `customerAddresses` and the email
   tables — and decide deliberately what happens to an order that must be kept for
   accounting: anonymise the customer, do not delete the invoice.
2. An export path for art. 20.
3. A consent field on `gamePlays`, written at play time, with the game refusing without it.
4. A retention cron with a configurable window, defaulting to the CNIL's three years.
Points 1 and 3 are the ones a client will be asked for first.

Note this is **not** the backup problem: `exportBackup` is an admin dump and is TECH-10's
(reopened — see the correction above). Do not conflate them.

Skills: `convex-patterns` (schema change plus a scheduled job plus a cascading mutation),
`systematic-debugging`, `tdd`, `typescript-expert`. Any consent wording shown to a diner is
customer-facing copy: French, through `copywriting` then `humanizer` and `stop-slop`.
Fleet: an Explore agent to enumerate every table holding personal data across all 100
schema tables — the list above came from the tables the probe touched, not from an
exhaustive sweep, and getting this list wrong is the way an erasure path silently misses
something. A Plan agent for the anonymise-vs-delete decision per table, since accounting
retention and RGPD erasure genuinely conflict and the resolution must be deliberate.
An adversarial verifier briefed to find a copy of a "deleted" diner still in the database.

This has a legal dimension that is not yours to settle alone: what the retention window
should be, and what survives an erasure for accounting purposes, are the user's decisions.
Build the mechanism, propose the defaults, and say plainly that they need confirming.

Done when: a restaurant can honour an access, erasure and portability request from its
dashboard; a game play records its consent; and data past the retention window leaves on a
schedule — each proven by a test.
````

## NEW-N — Anyone can drain a restaurant's entire prize budget in one loop
**1 blocker.** The rate limiter exists and is wired to two mutations out of everything public.

````
Read `tasks/fix-prompts.md` and follow its "Shared brief" section in full — method, traps,
fleet, conventions. Then close the abuse surface on the public gamification endpoints.
Measured at commit 009af63; uncarded.

**N-1 — BLOCKER. The public prize-issuing mutation has no rate limit, and its only guard is
a string the caller invents.** `packages/convex-functions/src/gamePlay.ts:368` (`play`),
plus `recordScan`, `claim` and `ensureReferralCode` — all public, all identical in
`apps/themes`. Probe: 40 unauthenticated calls, changing only `fingerprint`, against a game
with a 5-prize stock:
```
  attempts                   : 40
  refused                    : 0
  gamePlays rows written     : 40
  prizes won                 : 5
  prize.remainingCount after : 0   (from 5)
  rateLimits rows created    : 0
```
The 24h cooldown is keyed on `args.fingerprint` (`gamePlay.ts:90-95`), supplied by the
caller — change the string, get another play. And `completedActions` is also taken from the
caller and never verified, so the social actions the entire gamification pitch rests on
("scan the QR, leave a Google review, follow on Instagram, then play") are **unenforced
server-side**. A diner can claim to have done all of them without doing any.

The rate limiter is not missing — it is written and working, and wired to exactly two
mutations:
```
$ grep -rln 'consumeRateLimit' packages/convex-functions/src/*.ts
contactMessages.ts   emailSubscribers.ts   rateLimit.ts
$ grep -c 'rateLimit' packages/convex-functions/src/gamePlay.ts   -> 0
$ grep -c 'rateLimit' packages/convex-functions/src/orders.ts     -> 0
```
`orders.create` is `@public-by-design` and unbounded the same way — include it. TECH-07's
rate-limiting box named only the email and contact mutations, and both are now fixed; the
gamification and order endpoints appear in no card.

Two distinct problems, and fixing only the first leaves the hole open: bound the endpoints
with the existing limiter, **and** stop trusting caller-supplied identity. A cooldown keyed
on a value the caller chooses is not a cooldown. Derive the key server-side from something
the caller does not control, and verify `completedActions` against something real, or stop
gating prizes on them.

The business consequence is concrete: a restaurant's whole prize budget — free pizzas —
drained in one loop by anyone who has scanned a single table QR code, plus 40 rows of junk
personal data with it (which is also NEW-M's problem).

Skills: `security-audit` and `differential-review` (this is an authorization and abuse
problem before it is a Convex one), `convex-patterns`, `systematic-debugging`, `tdd`.
Fleet: an Explore agent to enumerate EVERY public mutation and action across
`packages/convex-functions` and both apps' `convex/`, and mark for each whether it is rate
limited and whether any guard it has depends on caller-supplied data — N-1 came from
noticing two consumers, and the full inventory has never been taken. An adversarial
verifier briefed to win more prizes than the stock allows after your fix.

Done when: a loop of anonymous calls is refused, the cooldown survives a caller changing
every argument it controls, and prizes cannot be won without the actions actually being
performed — each held by a test.
````

## NEW-O — Operations: nothing reports, and the client template ships ungated
**2 major + 1 minor.**

````
Read `tasks/fix-prompts.md` and follow its "Shared brief" section in full — method, traps,
fleet, conventions. Then fix three operational defects. Measured at commit 009af63; none
carded.

**O-1 — major. No production error from any Convex function, on any client instance,
reaches anyone.**
```
$ grep -rln 'Sentry' apps/reference/convex packages/convex-functions/src | grep -v _generated | wc -l
0
$ grep -rho 'console\.error' apps/reference/convex/*.ts | wc -l        -> 98
$ grep -rniE 'logdrain|axiom|datadog|betterstack|pagerduty|uptime' apps packages .github | wc -l
0
$ find apps/*/app -ipath '*health*'                                     -> (no health route)
```
Sentry is now genuinely wired for the Next.js half — configs, `error.tsx`,
`global-error.tsx`, `@sentry/nextjs` in both apps, one project per client. TECH-12's
"Sentry is dead code" is closed. The backend is not, and `apps/docs/deployment/sentry.md`
says so itself: *"Backend functions run outside Next and report nothing here."* Every
Stripe, Deliveroo and Uber webhook, every SES send, every order mutation and the whole
kitchen path lives there. The only trace is 98 `console.error` calls landing in the Convex
dashboard of that one client's deployment.
With one deployment per client, a Saturday-night order that fails inside Convex is invisible
to BeYours, and finding it means logging into each client's console one at a time — while
the maintenance contract sells support. Wire backend errors somewhere a human sees them,
and add a health route while you are there.

**O-2 — major. The client boilerplate is published on push to `main` with no CI gate.**
`.github/workflows/publish-mirror.yml:16-20` triggers on `push` to `main` for
`apps/themes/**`. The job's only `if:` guards the `workflow_run` path; the `push` path has
no `if:` and no `needs:`. Measured against live branch protection:
```
$ gh api .../branches/main/protection --jq '.required_status_checks.contexts'
["Lint","Type Check","Test","Build"]
$ ... --jq '.enforce_admins.enabled'                        -> false
$ ... --jq '.required_pull_request_reviews.required_approving_review_count'  -> 0
```
`release.yml` was fixed to gate on CI (`needs: [verify]`), so GitHub Packages is protected.
The mirror is not: any push touching `apps/themes/**` rsyncs straight to
`beyours-boilerplate` **in parallel with CI** — and that is the repository every client site
is cloned from and merges from via `pnpm update:template`. With `enforce_admins: false` and
zero required reviews, the person doing the merging can also push directly.
Gate this the way `release.yml` is gated. TECH-12 described the mirror as downstream of
`release.yml`; that path is now safe and this independent trigger is described nowhere, so
closing TECH-12 would leave it open.

**O-3 — minor. `turbo run test` strips every environment variable.** `turbo.json:26` — the
`test` task declares neither `env` nor `passThroughEnv`, while `globalEnvMode` is `strict`.
Measured A/B across the turbo boundary with the same command:
```
--- straight vitest ---            --- through turbo (what CI runs) ---
CONVEX_SITE_URL "https://…"        CONVEX_SITE_URL <STRIPPED>
DELIVEROO_CLIENT_SECRET "s3cr3t"   DELIVEROO_CLIENT_SECRET <STRIPPED>
                                   CI <STRIPPED>
```
Cost today is modest — with the secrets exported, `542 passed | 13 skipped`. But the
mechanism means **setting a GitHub secret can never make a gated suite run**, and `CI`
itself does not reach `test`. `build` and `test:e2e` were both fixed with explicit
`env`/`passThroughEnv`; `test`, `lint` and `type-check` were not. Note `ci.yml:154-155` sets
`CONVEX_SITE_URL` on the Build step where `build` declares only `SENTRY_*` — that line is
inert. `tasks/ci-required-checks-runbook.md` §7 already calls the shape an "armed trap".

Skills: `devex-review`, `lint-and-validate`, `systematic-debugging`,
`posthog-instrument-error-tracking` or the Sentry docs for O-1 — check what the repo already
depends on before adding a provider.
Fleet: an Explore agent to inventory every workflow trigger in the repo and say which ones
can publish anything without a gate — O-2 suggests that inventory has never been taken (and
see NEW-K-1, which found a whole workflow directory GitHub never reads). An adversarial
verifier briefed to get a broken template into the client mirror.

Done when: a backend error surfaces to someone who can act on it, a broken `apps/themes`
cannot reach the client mirror, and a GitHub secret can switch a test suite on.
````

## NEW-P — Four unbounded queries, on the four screens an owner opens most
**1 blocker + 3 major.** Every one of them gets slower as the restaurant succeeds.

````
Read `tasks/fix-prompts.md` and follow its "Shared brief" section in full — method, traps,
fleet, conventions. Then bound the queries that will take the admin down. Measured at
commit 009af63; none carded (#137 names `kitchenTickets` only).

These share one shape and should be fixed as one job: `.collect()` with no limit, no window
and no pagination, on a table that grows with business volume. Convex has a per-transaction
document ceiling, so each of these ends the same way — the screen throws on every load and
no admin action fixes it.

**P-1 — BLOCKER. `orders.list` is unbounded, and it is the only query behind the
`/dashboard` home page.** `packages/convex-functions/src/orders.ts:49-57` —
`.withIndex("by_storeId").order("desc").collect()`. Its sole consumer,
`packages/admin/src/pages/dashboard/use-dashboard-stats.ts:140-147`, downloads every row
and computes today / yesterday / last-7-days **client-side**.
```
orders in table: 500   -> api.orders.list returned 500 rows   | payload 0.31 MB
orders in table: 5000  -> api.orders.list returned 5000 rows  | payload 3.07 MB
```
The dashboard is a reactive subscription, so **every new order re-serialises the
restaurant's entire order history to every open admin tab**. At ~640 bytes/order that
passes 3 MB inside a year at 15 orders a day. The aggregation belongs on the server, over
a date window.

**P-2 — major. `prizeRedemptions.getStats` reads every game play and every redemption to
return five integers.** `gamePlay.ts:689-712`, two unbounded `.collect()` calls in one
handler, consumed on every load of the games and winners pages.
```
gamePlays: 4000, prizeRedemptions: 4000 -> 8000 documents read to return
{"pendingRedemptions":0,"totalPlays":4000,"totalRedeemed":0,"totalWins":4000,"winRate":100}
```
Gamification is the highest-volume table in the product — one row per QR scan — so these
are the first two admin screens to die, and they die together.

**P-3 — major. `payments.getByStore` returns every payment the store has ever received.**
`payments.ts:28-36`. Measured: 4000 in the table, 4000 returned. Note
`payments.by_storeId_status` is **declared** (`tables/payments.ts:72`) and used by no
`withIndex` call anywhere — the index this query needs already exists.

**P-4 — major. `emailAutomationRuns.stepsSentTo` is quadratic, and its exact-fit index is
already used by the write path.** `emailAutomationRuns.ts:20-40` collects every run of the
automation for every subscriber ever via `by_automationId`, then filters `subscriberId` +
`occurrenceKey` in JavaScript. `by_automation_subscriber_step` is declared at
`tables/emailMarketing.ts:538-543` and used by the *write* at `emailAutomationRuns.ts:65` —
but not by this read. Called once per subscriber per step.
The companion instance, `emailEvents.sentCountsSince`, is written up separately as
**NEW-J-1** — same root, same fix, do them together and read that prompt first.

Not measured, but read and almost certainly the same shape — verify each before or after:
`kitchenTickets.getByStation` / `getPrintStuckCount` / `getForDisplay`,
`orders.getByStatus`, `orders.getMyOrders`, `contactMessages.list`,
`translations.getByLanguage`, and `promotions.remove` (which collects every usage of a
promotion into one transaction).

And one free win while you are in the schema: **50 of the 181 declared indexes are never
used by any `withIndex` call** — including `orders.by_external_order`
(`tables/orders.ts:139`), which is precisely the index the carded webhook table scan needs.
The fix for a known performance defect is already sitting in the schema, unused.

Skills: `convex-patterns` (index design and the per-transaction read ceiling are the whole
problem), `systematic-debugging`, `tdd`, `typescript-expert`.
Fleet: an Explore agent to enumerate EVERY `.collect()` in `packages/convex-functions` and
both apps' `convex/`, and mark each as bounded or not — the list above is what one agent
reached, not an exhaustive sweep, and this is a sweep worth finishing. A second Explore
agent to diff declared indexes against `withIndex` usage and produce the dead-index list.
An adversarial verifier briefed to make a fixed query blow past the ceiling by growing data.

Done when: no admin screen's cost grows with the restaurant's lifetime volume, the
aggregations happen server-side over a window, and a test fails if an unbounded `.collect()`
returns to these paths.
````

## NEW-Q — Deleting a product breaks Deliveroo and bricks the menu that used it
**1 blocker + 3 major/minor.** Referential integrity, and three guards that cannot see what they claim to.

````
Read `tasks/fix-prompts.md` and follow its "Shared brief" section in full — method, traps,
fleet, conventions. Then fix the data layer's integrity holes. Measured at commit 009af63;
none carded.

**Q-1 — BLOCKER. `products.remove` is a bare delete.**
`packages/convex-functions/src/products.ts:564-569` is literally
`handler: async (ctx, args) => { await ctx.db.delete(args.id) }` — nothing else. It is
wired to the admin products table at `products-table.tsx:80` via
`useMutation(api?.products?.remove)`; the optional chaining is why grepping for
`api.products.remove` finds nothing. Its sibling `categories.remove`
(`categories.ts:150-166`) *does* refuse while children exist, with a comment explaining why.
Products never got the same treatment. Measured:
```
menu still holds the dead id: ["10006;products"]
that product now resolves to: null
menus.update -> Section "Dessert": product not found
favorites rows left: 1, externalProductMappings rows left: 1
favorites[0].productId resolves to: null
```
Two live consequences, and the first is the serious one:
1. **Deliveroo keeps selling the deleted dish.**
   `externalProductMappings.internalProductId` is a *required* `v.id("products")` and the
   row survives. `getByExternal` (`externalProductMappings.ts:48-61`) returns the mapping
   without ever dereferencing that id, so `deliverooWebhook.ts:526-545` finds a truthy
   mapping, counts zero unmatched PLUs, and sends Deliveroo
   `sendSyncStatus(..., "succeeded")` for an order containing a dish the kitchen no longer
   has.
2. **The formule becomes permanently uneditable.** `menus.update` re-validates the stored
   sections as a unit (`menus.ts:124-163`, `assertSectionsInStore`), so the owner cannot
   even remove the offending section.
`favorites` is orphaned the same way, also behind a required FK. A routine catalogue
tidy-up does all of this silently. Follow `categories.remove`'s precedent — refuse while
referenced, or cascade deliberately — and decide which per referencing table.

**Q-2 — major. `stores.displayConfig` has a live reader and no writer, and three places in
the repo assert the opposite.** Read at `kitchenTickets.ts:199-203,245,261` (`getForDisplay`)
and shipped on the customer-facing dining-room screen `app/display/[storeId]/page.tsx:18` in
both apps. Measured:
```
STORED  displayConfig -> {"autoDismissEnabled":false,"autoDismissMinutes":15}  ready count = 1
DEFAULT displayConfig -> {"autoDismissEnabled":true,"autoDismissMinutes":15}   ready count = 0
writers via db.patch|insert|replace : 0
occurrences of updateDisplayConfig  : 0
readers of store.displayConfig      : 3
```
The schema comment (`tables/stores.ts:101-110`) says "nothing anywhere read the stored
value … Nothing writes them now". `stores.ts:322-325` says the writer "sat beside it with
nothing reading them and was removed". `kitchen-sound-config.test.ts:8-11` certifies the
same. **All three are wrong about the reader**, and `updateDisplayConfig` was deleted on the
strength of a claim nobody checked. Consequence: an order ready for more than 15 minutes
disappears from the dining-room screen while the customer is still waiting for it, and the
owner has no setting anywhere to change that. Restore the writer, and fix all three false
statements.

**Q-3 — minor. The store-cascade guard is blind to any FK not literally named `storeId`.**
`__tests__/storeCascade.test.ts:29-40` filters on the field *name*. It is the only thing
stopping #169 from regressing when a table is added. Measured over the compiled validators:
```
FK columns pointing at stores: 46
  named exactly "storeId": 43        (all the test can see)
  invisible to it:
    userProfiles.storeIds[]          (handled separately by detachStoreFromProfiles)
    blogAutoConfig.targetStoreIds[]  (row deleted by its OWN storeId only)
    systemAuditLog.targetStoreId     (not store-scoped)
```
An Auto Blog config belonging to store A that fans out to store B keeps B's dead id after B
is deleted. More importantly, the next table added with a `restaurantId`- or
`targetStoreId`-style column passes the test silently — the exact failure #169 exists to
prevent. Make the guard walk `v.id("stores")` in the validators, not field names.

**Q-4 — minor, and worth knowing before touching auto-print.** The `printerSettings` table
has 10 required fields, **zero writers and zero readers** anywhere, yet `storeCascade.ts:39`
deletes from it. Auto-print actually runs on the embedded `stores.printConfig` object
instead. `CLAUDE.md:114` advertises `printerSettings` as the auto-print mechanism. It is
pure dead schema behind a documented claim — relevant to batch 06 (#164), where the print
configuration tab was deleted rather than lifted.

Skills: `convex-patterns`, `systematic-debugging`, `typescript-expert`, `tdd`,
`deliveroo-developer` for Q-1's sync-status consequence.
Fleet: an Explore agent to map every `ctx.db.delete` against every FK that points at the
deleted table — Q-1 is `products`, and `menus`, `categories` and `promotions` deserve the
same check. An adversarial verifier briefed to delete a product and then get Deliveroo a
"succeeded" sync for an order containing it.

Done when: deleting a product either refuses or cleans up after itself, the dining-room
screen honours a configurable dismissal, the cascade guard sees FKs by type rather than by
name, and no comment in the data layer asserts a reader or writer that measurement
contradicts.
````

## NEW-R — Six tables grow forever, and one documents a TTL that does not exist
**1 major.** On a product billed per store, cost with no ceiling.

````
Read `tasks/fix-prompts.md` and follow its "Shared brief" section in full — method, traps,
fleet, conventions. Then give the engine a retention story. Measured at commit 009af63;
uncarded (#137's fix note asks for kitchen-ticket retention specifically; nothing covers the
general absence).

**R-1 — `crons.ts` schedules exactly three jobs** — stale invitations, scheduled campaigns,
lapsed-customer win-back — and there is no retention job for any of `rateLimits`,
`oauthStates`, `deliveryQuotes`, `emailEvents`, `kitchenTickets` or `systemAuditLog`. The
only `sweep*`/`purge*` exports in the whole Convex layer are `teamMembers.sweepInvitations`,
`emailAutomationActions.sweepInactive` and `stores.purgeStoreData`.

The sharpest cases:
- **`oauthStates` documents a TTL that does not exist.** `tables/oauthStates.ts:8` states
  "Rows are single-use and expire (TTL)" and declares `expiresAt`. Measured: four
  `oauthStates` sites repo-wide — two inserts, two queries — and **zero deletes** outside
  the matched-callback path. **Convex has no native TTL.** Every abandoned OAuth flow leaves
  a permanent row. The comment is why nobody wrote the sweeper.
- **`rateLimits` grows with every distinct visitor** who ever used the contact form — one
  permanent row per `contactPerEmail:<address>` — and it is **not** in
  `STORE_SCOPED_TABLES`, so it survives store deletion. Same for `oauthStates` and
  `systemAuditLog`.
- `deliveryQuotes` has `expiresAt` and `consumedByOrderId`; nothing sweeps either.
  `emailEvents`'s own schema comment (`tables/emailMarketing.ts:549`) says "Future: events
  older than 90 days can be purged (V2)".

Two consequences, and the second is the one that matters legally: storage and per-query cost
climb with no ceiling on a product billed per store — and the RGPD erasure story in
**NEW-M** has three tables it cannot reach, because they are not store-scoped and have no
per-subject path. Read NEW-M before designing this; the retention window and the erasure
path should be one mechanism, not two.

Note the overlap with **NEW-P**: several of these tables are also the ones whose queries are
unbounded. Retention reduces the blast radius but does not fix an unbounded query, and vice
versa. Both are needed.

Skills: `convex-patterns` (scheduled jobs and the read ceiling), `systematic-debugging`,
`tdd`.
Fleet: an Explore agent to list every table against three questions — is it store-scoped, is
it swept, does it hold personal data — because the answer decides which mechanism each table
needs. An adversarial verifier briefed to find a table that still grows without bound after
your fix.

The retention windows themselves are a business and legal decision, not yours: propose
defaults (the CNIL's three-year guidance for customer data is the anchor), and say plainly
that they need confirming.

Done when: every table either has a bounded lifetime or a documented reason it does not, the
`oauthStates` comment matches reality, and a sweeper proves it by execution.
````

## NEW-S — A guest pays and receives nothing, and no invoice exists
**2 blockers.** One is the commonest support call in restaurant e-commerce. One is a French legal breach.

````
Read `tasks/fix-prompts.md` and follow its "Shared brief" section in full — method, traps,
fleet, conventions. Then close the transactional gap. Measured at commit 009af63; uncarded.

**S-1 — BLOCKER. No order confirmation email is ever sent to a customer.**
```
$ grep -rn "sendTemplatedEmail" packages apps --include='*.ts*' | grep -v node_modules | grep -v /dist/
  -> the definition, its types, its zod schema, its adapter, its own tests,
     and one MCP registry entry. ZERO production callers.
$ grep -rn "SendEmailCommand" apps/themes/convex packages/convex-functions/src
  teamMembersEmail.ts  emailCampaignActions.ts  maintenanceEmail.ts  gameEmail.ts
  emailAutomationActions.ts
```
Five real senders ship — team invitations, marketing campaigns, maintenance notices, game
winners, marketing automations. **Not one is transactional.** The `orderConfirmation`
template is written, registered, unit-tested (`packages/core/src/aws/__tests__/templates.test.ts:19`)
and re-exported at `apps/themes/lib/aws.ts:104`, with no production caller.
The only order-triggered mail is the *marketing* `post_order` automation, and
`packages/convex-functions/src/orders.ts:877-884` deliberately refuses to create a subscriber
from an order ("an order is a purchase, not consent") — correctly, but it means the
transactional path was never built.
A guest pays and receives nothing: no confirmation, no receipt, no "order ready". Note the
template exists, so this is wiring, not authorship — check it against what the diner
actually needs before shipping it.

**S-2 — BLOCKER. No invoice exists, and the order number is `Math.random()`.**
`packages/convex-functions/src/helpers.ts:9-13`:
```ts
export function generateOrderNumber(): string {
  const year = new Date().getFullYear()
  const random = Math.random().toString(36).substring(2, 8).toUpperCase()
  return `ORD-${year}-${random}`   // the schema comment says "ex: ORD-2026-0001"
}
```
Three call sites (`orders.ts:638`, `orders.ts:1067`, `uberEatsOrders.ts:129`). No uniqueness
check before insert, no per-store sequence, no retry on collision.
`packages/convex-schema/src/tables/orders.ts:10` documents the sequential format the code
does not produce. And searching for an invoice across the engine returns five hits, four of
them BeYours' *own* Stripe subscription webhook — the product issues no document to the
diner or the restaurateur. `orderTotals.ts:79` even carries a comment about "the VAT
breakdown an invoice has to show", describing a document that is never produced.
A French business must issue an unbroken sequential series (art. 242 nonies A). Every French
restaurant client inherits that breach, and a random suffix cannot satisfy it. Note this is
the *engine* side; `apps/site`'s own invoicing is a separate surface.

Do S-1 first — it is a day-one support problem and the smaller piece of work. S-2 needs a
numbering design decision (per store, per year, gapless under concurrency) before any code.

Skills: `convex-patterns` (a gapless sequence under Convex's transaction model is the crux
of S-2), `systematic-debugging`, `tdd`, `emails` for the confirmation content. The email and
invoice a diner receives are customer-facing: French, through `copywriting` then `humanizer`
and `stop-slop`.
Fleet: a Plan agent for S-2's numbering scheme — gapless sequential numbering under
concurrent inserts is genuinely hard and doing it wrong is worse than not doing it. An
Explore agent to find every other place a template exists with no caller — `orderConfirmation`
was found this way and is unlikely to be alone. An adversarial verifier briefed to obtain two
orders with the same number.

The legal specifics — what must appear on the invoice, and whether numbering is per store or
per company — are the user's call. Build the mechanism, propose the format, and say plainly
that it needs confirming.

Done when: a diner who pays receives a confirmation, an order carries a sequential number
unique under concurrency, and an invoice can be produced for any order.
````

## NEW-T — Sold and absent: the copy promises what the product does not have
**1 blocker + 8 major + 2 minor.** One product decision, applied eleven times.

````
Read `tasks/fix-prompts.md` and follow its "Shared brief" section in full — method, traps,
fleet, conventions. Then resolve eleven capabilities that are sold and are not there.
Measured at commit 009af63; none carded. **Read batch 14 (#175) first — this is the same
decision at four times the scale, and the two should be settled together.**

Every item below has two honest resolutions: build it, or remove it from the copy. Shipping
neither is not one. These are commercial decisions with revenue consequences, so **put them
to the user** — your job is to make the choice easy by stating precisely what exists, what
building would cost, and every place the claim currently appears.

**T-1 — BLOCKER. "Analytics" is the paid tier's headline differentiator and has zero files.**
```
$ find apps/themes packages -iname '*analytic*' -not -path '*/node_modules/*' | wc -l   -> 0
$ grep -riE 'plats populaires|topProduct|peakHour|returnRate' packages apps/themes | wc -l -> 0
$ grep -riE '"essentielle"|"premium"|planSlug' apps/themes/convex packages/*/src        -> 0
```
`apps/site/components/pricing/pricing-data.ts:111` — « Analytics & suivi des performances »,
`essentielle: false, premium: true` — is the **only** Gestion-tier line separating the two
plans. The named metrics do not exist. What ships is one fixed dashboard with hard-coded
windows, available to everyone. And the last grep is the sharper finding: **there is no plan
gating anywhere in the product**, so nothing withholds anything from Essentielle either. The
Premium upsell buys nothing. This is a refund argument in writing on the pricing page.

**T-2 — major. Customer management (CRM) has no implementation anywhere.**
`<ComingSoon title="Clients" />` in both apps, byte-identical. None of the 72 registered
tables is `customers`. `nav-config.ts:103-104` hides it on purpose ("deliberately kept out of
the nav until the page is built") — yet it is sold at `features-data.ts:203` and
`pricing-data.ts:101`, and the onboarding tour narrates it (see NEW-U).

**T-3 — major. "Themes by restaurant type" has no runtime selector, and 2 of the 6 sold
themes do not exist.** `themeId` appears in 5 declarations with **0 writers and 0 readers**.
Theme choice is a developer running `pnpm template:apply <slug>` at clone time. Against the
six sold: Fast Food ✓, Pizzeria ✓, Chinese ≈ (`asiatique`, pan-Asian), Sushi Bar ≈
(`asiatique-omakase`), **Fine Dining absent**, **Café/Bakery absent**. This is the product's
central promise, and it is a one-way CSS copy. Pairs with NEW-F-1 (per-store branding writes
to nothing) — same theme, both ends broken.

**T-4 — major. The sitemap lists URLs that 404 and the structured data is dead code.**
`apps/themes/app/sitemap.ts:45,53` emit `/s/${slug}` and `/s/${slug}/menu`; no `/s/` route
exists and there are no rewrites. The storefront lives at `/`, `/menu`, `/product/[id]` —
which appear in no sitemap. `buildRestaurantSchema` / `buildMenuSchema` / `<JsonLd>` have no
importer. Sold in **both** pricing tiers. Google is handed a sitemap of dead URLs on every
delivered site.

**T-5 — major. Push notifications: promised four times, zero lines of code.**
```
$ grep -rniE "web-?push|firebase|fcm|expo-notifications|serviceWorker|PushManager" \
    apps/themes packages/admin/src packages/core/src packages/marketing/src | wc -l   -> 0
```
No manifest, no service worker, no provider. « Alertes sonores **et notifications push** »
ships as sound only.

**T-6 — major. Scheduled orders / "click & collect avec créneaux horaires" is a schema field
only.** `orders.create` has no `scheduledFor` argument; the field's only writer is the Uber
Eats importer. No customer can choose a pickup time — the core of a click-and-collect offer.
Same finding as NEW-H-6, promoted here because `apps/site` **does** sell it.

**T-7 — major. Daily backups and 24/7 monitoring are billed and do not exist.**
`pricing-data.ts:152-158`, restated in the FAQ. `crons.ts` registers three jobs, none a
backup. `grep -rniE 'uptime|healthcheck|/health' apps/themes` → one hit, inside a test mock.
The recurring maintenance fee is sold partly on two guarantees with no mechanism. See also
the reopened #169: the backup that does exist cannot restore an order.

**T-8 — major, grouped. Fifteen sold features are schema fields, dead exports, or nothing.**
Each verified individually; grouped because the fix is one decision. Nutritional Information
(dead column, 0 readers) · Image Gallery (no uploader; every reader uses `images[0]`) ·
Custom CSS, Layout Options, Font Selection, Color Customization (no control, no field) ·
Kitchen Analytics (0 files) · Order Assignment (`assignedTo` set by a mutation with no
caller, never rendered) · Priority Management (both ticket writers hardcode
`priority: "normal"`) · Uber Direct Driver Assignment (0 hits) · Bulk Translation Tool
(`translateUIStrings` has 2 hits — its own twin definitions — under a comment claiming the
admin calls it) · Translation Memory (`translationJobs` has zero writers) · RTL Support
(`grep -rn 'dir=' apps/themes/app` → 0; the admin's `isRtl` toggle writes a boolean nothing
reads, Arabic renders LTR) · Date/Time Formats (hardcoded `fr-FR`) · Currency Support
(written once, read once, never reaches the storefront) · Language Toggle UI (one mount,
inside a component with zero mounts) · Loyalty "points, niveaux, défis" (gamification
supports only wheel and scratch card; 0 hits for point/level/challenge/badge/streak).

**T-9 — minor. Reviews, ratings, SMS, table reservations, suppliers and purchase orders have
no schema at all.** 72 registered tables; `grep -inE "review|rating|reservation|sms|push"` →
none. These back whole categories of the advertised feature count.

**T-10 — minor. Two-Factor Auth and Social Login are sold; the plugin is commented out.**
`packages/core/src/auth/config.ts:95-102` — `plugins: []` with `twoFactorPlugin` commented
above it. `twoFactorEnabled` is a **required** field whose only production writers hardcode
`false`, so the column can never be true. `authRoutes.twoFactor` points at a route that does
not exist, and the whole `authRoutes` object is dead (2 hits, both its own definition and
re-export).

Skills: `product-marketing` and `copywriting` for any copy that changes, then `humanizer` and
`stop-slop` — beyours.fr copy is customer-facing and stays FRENCH. `pricing` for T-1's plan
gating. `launch` for the readiness framing.
Fleet: one Explore agent per claim to find every occurrence across the repo, the site and the
onboarding tour — run them in parallel, they are independent, and the count matters because a
claim removed from one surface and left on another is worse than leaving it everywhere.

**And a correction to an existing card, found in passing.** LAUNCH-04 (#175) states
"Menus / formules — the `menus` table has one reader, no customer flow and no order field".
The admin half of that is wrong: `products-page.tsx:214` renders a "Menus / Formules" tab and
`:401` mounts `MenusTab` over a real `menusTable` and `menuSectionValidator`. The
customer-flow and order-field halves may still hold — re-check before working that card.

Done when: every promise in `CLAUDE.md`, on beyours.fr, in the pricing table and in the
onboarding tour maps to something a client can use — with the user's explicit decision
recorded for each item above.
````

## NEW-U — The tour, the docs and the tests that assert nothing
**1 major + 3 minor.** Every one of these is a trust surface that currently misleads.

````
Read `tasks/fix-prompts.md` and follow its "Shared brief" section in full — method, traps,
fleet, conventions. Then fix four surfaces that tell a confident story about a product that
is not there. Measured at commit 009af63; none carded.

**U-1 — major. The onboarding tour auto-launches on first login and is broken.** Mounted at
`apps/themes/app/(admin)/layout.tsx:75` and auto-opened 1.2 s after auth
(`tour-provider.tsx:49-59`). Probe against the real `navGroups` and `TOUR_STEPS` exports,
reproducing `app-sidebar.tsx:111`'s id expression:
```
EMITTED by AppSidebar (18): nav-dashboard, nav-dashboard-orders, nav-dashboard-products, …
REFERENCED by TOUR_STEPS (20): nav-orders, nav-products, nav-customers, …
DEAD (referenced, never emitted) (19): nav-categories, nav-content-blog, nav-customers,
  nav-email, nav-games, nav-inventory, nav-languages, nav-orders, nav-orders-kitchen,
  nav-products, nav-promotions, nav-settings, nav-stores, nav-team, …
TOUR_STEPS total: 27
```
The sidebar emits `nav-dashboard-orders`; the tour asks for `nav-orders`. **Only 1 of 20
anchors matches.** The Gamification step's primary selector `[data-tour="games-tabs"]` is
rendered nowhere. And two steps narrate a full feature then land on `<ComingSoon/>`:
« Clients — Votre carnet d'adresses intelligent » and « Composants … Assemblez-les comme des
Lego ». No test covers the tour; the only e2e mention dismisses it.
27 steps of scripted product demo, unprompted, to every new owner, with 19 dead highlights
and two dead ends. This is the first thing a paying client sees.

**U-2 — minor. Eight of ten Deliveroo "scenario" suites assert their own fixtures.**
```
scenario-02  sendWebhook:12 it():2      scenario-08  sendWebhook:3  it():7
scenario-03  sendWebhook:0  it():6      scenario-09  sendWebhook:0  it():10
scenario-04  sendWebhook:0  it():8      scenario-10  sendWebhook:0  it():10
scenario-05  sendWebhook:0  it():10     scenario-11  sendWebhook:0  it():9
scenario-06  sendWebhook:0  it():10
scenario-07  sendWebhook:0  it():11
```
74 `it()` blocks that run in CI and never touch product code. Representative,
`scenario-04:59-67`: builds `createNewOrderWebhook({ fulfillment_type: "restaurant" })` then
asserts `expect(order.fulfillment_type).toBe("restaurant")`. Its docblock claims it validates
the full order lifecycle and sync-status-after-acceptance; it touches neither. No convex test
exercises any integration webhook route.
This is why batch 07's eleven defects survived five green CI runs — and it is worse than no
coverage, because it reads as coverage. Rewrite them against the real handler or delete them;
do not leave them green.

**U-3 — minor. The template's own gamification e2e suite cannot pass.**
`apps/themes/e2e/admin/games.spec.ts` is byte-identical to the bench's, with no skip markers.
Listing it: 14 tests, of which 10 target four routes the template deliberately renders as
`<ComingSoon/>`. They match the `admin` project's `testMatch` and run whenever a real backend
is configured. LAUNCH-08 ("make CI and E2E required checks on `main`") cannot be executed
until either gamification ships in the template (#159) or these ten are marked divergent.

**U-4 — minor. `CLAUDE.md` points at four documents that do not exist and four commands that
fail.**
```
$ for f in ARCHITECTURE.md FEATURES.md TESTING.md DEPLOYMENT.md; do find . -name "$f"; done
   (all four MISSING)
$ for s in test:coverage test:ui test:e2e:ui test:e2e:debug; do pnpm run "$s"; done
   ERR_PNPM_NO_SCRIPT ×4
```
`CLAUDE.md:164` also claims "Vitest unit tests (80%+ coverage)"; no package configures a
coverage threshold and only three declare a provider. Since `CLAUDE.md` is what every agent
and every new contributor reads first, a false instruction there propagates.

Skills: `design-taste-frontend` and `design-review` for U-1 (a first-run tour is a designed
experience, not a config file), `tdd` for U-2, `devex-review` and `document-generate` for U-4.
`CLAUDE.md` is repository documentation — English. Tour copy shown to a restaurateur is
customer-facing — French, through `copywriting` then `humanizer` and `stop-slop`.
Fleet: an Explore agent to find every other test file whose assertions never reach product
code — U-2's shape is mechanical to detect (fixtures built and asserted in the same block)
and 74 blocks is unlikely to be all of it. An adversarial verifier briefed to run the tour as
a new owner and count what actually highlights.

Done when: every tour step highlights something real and ends somewhere usable, no test suite
asserts only its own fixtures, and every document and command `CLAUDE.md` names exists.
````

---

*Batch prompts generated 30 Aug 2026 from the fourth verification pass at `8d41349`.
 New-findings prompts added 1 Sep 2026 from the discovery audit at `009af63` (all 8 scopes reported).
Statuses: 23 resolved, 11 partial, 23 open. Regenerate after the next pass.*
