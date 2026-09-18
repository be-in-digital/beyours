# `apps/reference` vs `apps/themes` — what may differ, and why

Written on 2026-08-29. `apps/reference` is the engine's test bench;
`apps/themes` is the template cloned into one repo per client. They are meant to
be near-identical twins, so every file that differs is either a decision someone
made or a fix that only landed on one side.

This note exists so the next person can tell those two apart without re-deriving
the whole comparison. **Before "fixing" a divergence, look for it here.**

Since 2026-08-30 this note is also enforced. `scripts/check-app-divergence.mjs`
runs in CI inside the required `Lint` job and fails on any shared file that
differs without being listed, and on any file under `e2e/` or `convex/` that
exists in one app and not the other. Adding a divergence therefore means adding
a row to `ALLOWED` in that script *and* explaining it here and in the file
itself — three deliberate acts, which is the point.

The note came first and caught nothing: ten PRs after it was written, #256 added
`getByIdInternal` to the bench only, and `sendBatch` on a client deployment
called a Convex function that did not exist. `tsc` did not catch it, the tests
did not, review did not. It was found by hand, ten PRs late. That is what the
guard is for.

---

## How to reproduce the comparison

```bash
pnpm check:divergence
```

Or by hand, which is what the script automates:

```bash
diff -rq apps/reference apps/themes | grep '^Files '
```

Ignore the app-specific config that is *supposed* to differ: `.env*.example`,
`package.json`, `vercel.json`, `tsconfig.json`, `next.config.ts`,
`playwright.config.ts`, `eslint.config.mjs`, `vitest.config.ts`, `README.md`,
`.gitignore`. Also ignore what exists on one side only by design — the template
carries `site/`, `site.config.ts`, `templates/`, `demos/`, `docs/`, `.template`
and its own `scripts/`; the bench carries its design and setup notes.

At the start of this pass, **70 shared source files differed**. Afterwards, 19
did — a count that included config files outside the checker's comparison, so it
never matched the guard's own tally. Go by the guard: `ALLOWED` in
`scripts/check-app-divergence.mjs` held **17** rows, closing the gamification
split (#159) removed **7**, and closing the admin barrel (#413) removed one
more. **Nine** remain, and they are listed below.

---

## Deliberate — do not align

Each of these now carries its own comment in the file, so the reason travels
with the code. This table is the index, not the explanation.

| File | Why the template differs |
|---|---|
| `convex/auth.ts` | The bench trusts `localhost:3000-3003` because its workspaces fight over ports. A client site runs on its own domain and has no business accepting a dev origin. |
| `lib/convex.ts` | The Next.js half of the same seam as `convex/auth.ts`, and deliberate for the same reason. The bench trusts `localhost:3000` and `:3001`; the template trusts localhost only while `BETTER_AUTH_URL` *is* localhost, so a delivered site trusts its own domain and nothing else. Both files used to append a dev origin unconditionally, on every client site — the Convex one directly under a comment forbidding it. Held by `apps/themes/tests/security/client-site-trusted-origins.test.ts` (#445). |
| `convex/http.ts` | The template keeps the old Next.js `/api/webhooks/*` routes as 410 tombstones, so a client whose provider dashboard still points at the old path gets an explanation instead of a 404. The bench deleted them on 2026-07-18. |
| `app/layout.tsx` | Metadata, fonts, theme and layout come from the client zone (`site.config.ts`, `site/fonts.ts`, `site/theme.css`, `site/layout.ts`). The layout half is #507: seven `data-*` families on `<html>`, read by rules confined to `.storefront-theme` in `app/globals.css` — which both apps carry identically, so only the app that HAS a client zone sets them. Already documented in the file and in `apps/themes/docs/UPDATES.md`. |
| `app/(test)/layout.tsx` | Template-only. Sends the `(test)` route group to `notFound()` in production unless `NEXT_PUBLIC_ENABLE_TEST_ROUTES=true`. Playwright harnesses have no business on a client site. |
| `convex/tsconfig.json` | Template build config (`outDir`, `paths`). Config file — outside the comparison by the rule above, listed here only because it shows up in a raw `diff -rq`. |

## Benign — a comment naming its own app

No action, ever. These will keep differing and that is correct:
`lib/auth-client.ts`, `lib/i18n.ts`, `lib/rbac.ts` ("the reference app" vs "the
themes app"), `lib/stores/addresses-store.ts`, `lib/stores/favorites-store.ts`,
`components/storefront/user-menu.tsx` (comment rewording), `e2e/README.md`
(each app documents its own CI).

---

## What was actually drift, and got ported

### The e2e suite — the finding that mattered

The template's Playwright suite was a **stale snapshot of the bench's, taken
before the bench repaired it**. This was not divergent copy for a divergent UI:
the UI is the same in both apps, and the template's assertions had simply
stopped matching it.

Verified against the source, before the port — every one of these would have
failed:

| Template asserted | Both apps actually render |
|---|---|
| heading `Connexion` on `/sign-in` | `Bon retour` |
| password placeholder `Votre mot de passe` | `••••••••` |
| button `Créer un compte` | `Créer mon compte` |
| heading `Shopping Cart` on `/cart` | `Votre Box` |
| heading `Checkout`, `Select Store` | `Votre Box`, `Choisir un restaurant` |
| link `Se connecter` in the header | `Connexion` |
| footer `Powered by BeYours Engine` | `Tous droits réservés` |
| `Lien de suivi invalide` on `/track` | `Commande introuvable` |
| h1 `Creer depuis une image` | `Créer depuis une image` (in `packages/admin`) |

Underneath that, the whole hardening pass the bench received was missing:

- **`countAfterLoad`** (`e2e/helpers/list.helpers.ts`) did not exist. Every list
  in this admin arrives from a Convex query a moment after the page does, so a
  bare `.count()` counts an empty page — and the tests that then wrote
  `if (rowCount > 0) { ...assert... }` **passed having verified nothing**. This
  is the worst class of defect in the whole comparison: a green suite that is
  green because it checked nothing.
- **`chooseOption`** (`e2e/helpers/filter.helpers.ts`) did not exist. Radix
  renders every option twice, so the unscoped `getByRole("option")` the template
  used matches both and strict mode refuses to choose.
- **Silent `if` → `test.skip`** across ~15 suites, so a test that cannot run says
  so instead of finishing green.
- **Plan/state gates** — `skipIfLocked`, `skipIfNoCategory`,
  `skipIfGeneratorLocked`, `skipIfEmailUnconfigured`, `campaignTable`,
  `activateSoundAlerts`, `openCustomHours` — all absent, so ~25 tests were
  really asserting an entitlement or a seed-data state.
- **`e2e/helpers/credentials.helpers.ts`** did not exist, and three specs signed
  in with the literal password `"julien"` — committed in the artefact that gets
  cloned into every client repo. Now read from `SEED_PASSWORD`, skipping with a
  reason when it is unset.
- **Nine suites had no counterpart at all**: `store-creation`,
  `store-global-hours`, `store-overnight-hours`, `store-sound-alerts`,
  `settings-uber-direct`, `order-service-types`, `stale-team-store-selection`,
  `cart-line-identity`, `checkout-vat` — i.e. most of what #244–#248 proved about
  the engine was proved only on the bench.

Result: the template went from 45 to 54 spec files, and now collects **542 tests
in 55 files** against the bench's 541 — the one extra being the deliberate
`coming-soon` case. Closing #159 removed that last difference too: the two
suites are now identical.

### `convex/seedFixture.ts` — yes, the template should have the fixtures

The question was open; the answer is yes. `internalSeedFixture` is an
`internalMutation`, unreachable from a browser and invoked only by
`scripts/seed-users.mts` through `npx convex run`, and it already seeds a fake
store, categories and products on a template deployment. The team roster, the
blog category, the sender address, the tracked-stock product, the owner
entitlements and the draft campaign are the same kind of data with the same risk
profile — and without them roughly a third of the newly-ported suite skips
itself, which puts us back where we started. The `.test` sender domain is
reserved by RFC 2606 and can never be delivered to.

### Product defects that had only been fixed on the bench

- `components/website/meal-card.tsx` and
  `app/(storefront)/_components/HomepageContent.tsx` — the placeholder
  `/imagery/hero-burger-v2.png` does not exist and `public/imagery/` does not
  either, so **every product without a photo, and every homepage without a hero
  upload, asked the image optimizer for a missing file and got a 400**. Shipping
  to clients; fixed on the bench only.
- `app/(storefront)/order/[orderId]/page.tsx` — the Uber Direct courier tracking
  link was never surfaced, although the template's own backend writes
  `uberDirectTrackingUrl` and its order page already imports `ExternalLink`.
- `app/(auth)/sign-in/page.tsx` — the loading button was a bare spinner with no
  accessible name: assistive technology announced "button" and nothing else,
  exactly when the user most wants to know what is happening.
- `components/admin/blog/CreateArticleDialog.tsx` and `GenerateArticleDialog.tsx`
  — `htmlFor`/`id` label linkage. (The brief named the first; the second had the
  same gap, on three fields.)
- **The French accents.** Commit `4ff7d15` landed in `apps/reference` only and
  had *not* been ported despite being believed done. The template was still
  shipping "Publie", "Planifies", "Archives", "Echec de la mise a jour",
  "Generer avec l'IA", "Non imprimee" and "Etes-vous sur de vouloir supprimer",
  across eight blog and three kitchen components. Now aligned.
- `app/(test)/address-test/page.tsx` — without a fixture key the component
  returns before requesting the Maps script, so the spec was mocking a call that
  never happened.
- `app/api/contact/route.ts` — the domain logic is now
  `lib/services/contact-service.ts`, unit-tested (5 tests), with the route a thin
  transport adapter. A `null` body used to throw a 500 instead of answering 400.

### Scripts

- `scripts/seed-users.mts` — Better Auth refuses any state-changing request with
  no `Origin`, and Node's `fetch` sends none, so **every seed call came back 403
  and the script ended having created nothing**. The CI step runs it with
  `|| true`, so the run continued against an empty database and surfaced 400
  tests later as admin screens that would not load. Also gained `.env.e2e`
  loading, the `minPasswordLength: 12` pre-check, and `SEED_ADMIN_EMAIL`.
- `scripts/kiosk-print.sh` — header comments translated to English, per the repo
  standard.

### Drift the other way — the bench was the lagging side

`scripts/setup-aws.sh`. The template carried the fix; `apps/reference` did not.
The `beindigital-*` names in that script are **AWS resources, not branding**: an
S3 bucket, an IAM user, an IAM policy, an SES configuration set, all of which
already exist. The BeYours rename of 2026-08-16 swept `POLICY_NAME` to
`BeYoursEnginePolicy` on the bench, which does not rename anything in AWS — it
provisions a second, parallel, empty policy. Reverted to
`BeInDigitalEnginePolicy` and the template's warning block ported across.

This is the one to remember: **drift is not always the template lagging.** Check
both directions.

---

## Left open, deliberately

- ~~`<label>` without `htmlFor`~~ — **done**, see below.
- **The English storefront strings** are not a divergence: `/cart`, `/checkout`
  and `/store-selector` render French in both apps. Only the template's *stale
  specs* said otherwise, and they have been replaced.
- **`e2e/README.md`** stays per-app: each documents its own CI. The one factual
  gap — the missing `E2E_CONVEX_DEPLOY_KEY` row, without which seeded accounts
  get no role and every admin spec fails on an empty screen — was added.

---

## The label debt, closed in both apps

Separate from the drift, and done second so the two passes stay readable in the
history. 26 `<label>` elements named nothing: they were siblings of their field
rather than bound to it, so clicking them focused nothing and assistive
technology announced the control unlabelled. Identical in both apps, so both
were changed identically — the six files involved are byte-for-byte twins before
and after.

**20 wired** with `htmlFor`/`id`, because each sat over exactly one control:
the five contact-form fields; the four address fields (via `useId()`, since the
component can appear twice on a page for billing and delivery); the promo code;
the image prompt; the auto-translate switch; and eight fields in
`BlogArticleEditor` (title, slug, excerpt, cover alt, meta title, meta
description, category, schedule).

**6 changed to `<p>`**, because they headed something no `htmlFor` can target —
a rich text editor, two upload blocks, a tag-chip group, an image preview, and a
block that swaps between two different controls. A `<label>` bound to nothing is
invalid, and saying so in the markup beats leaving it to be "fixed" later by
adding an attribute that would point at the wrong thing. Each carries a one-line
comment saying which case it is.

The audit is repeatable — this should print nothing, in either app:

```bash
grep -rn '<label' app components | grep -v htmlFor
```

---

## Drift that hid from this comparison

Two blind spots, both found after the pass and both now closed.

**A byte-identical file is invisible to `diff -rq`, even when it is dead on one
side.** `components/admin/categories/` was the same in both apps, so the
comparison printed nothing about it — while being reachable from nothing in the
bench and rendered by `products/ProductsContent.tsx` in the template. #260
removed it from the bench, and it now shows as a template-only directory
alongside `dashboard/`, `design/`, `games/`, `orders/`, `payments/`,
`products/`, `stores/` and `team/`. If you are hunting dead code rather than
divergence, `diff -rq` is the wrong tool; check reachability instead.

**`internal.*` was not type-checked at all.** Four files per app carried
`const internal = _internal as any` under the comment "Email modules not yet in
codegen — will resolve after `convex dev` regenerates types". Codegen had long
since caught up; the workaround outlived its reason and turned the whole Convex
internal API into `any`. A probe calling
`internal.emailCampaigns.thisNameCannotPossiblyExist` compiled without a
murmur, in both apps.

That is how #256 shipped `getByIdInternal` to the bench and not to the
template, with CI green, while `apps/themes/convex/emailCampaignActions.ts`
called it — `sendBatch` would have failed at runtime on a client deployment,
mid-campaign. Removing the casts surfaced it immediately, plus a second latent
bug in both apps: a plain `string` passed where `Id<"emailTemplates">` was
required.

The lesson for this note: a divergence in a Convex internal function reference
used to be invisible to every check in the repo. It no longer is — the type
checker catches it, so it does not need hand-auditing here.

**`grep '^Files '` threw away half the output.** The comparison above was run as
`diff -rq apps/reference apps/themes | grep '^Files '`, which keeps only
*"Files X and Y differ"*. A file present in one app only is reported as
`Only in …` and was filtered out before anything could classify it. Two
template-only admin components reached the end of the pass unexamined that way,
and #263 asked — rather than guessed — whether they were deliberate template
material like `StatusBadge`, `DateDisplay` and `ComingSoon`, or leftovers.

They were leftovers, and reachability was not the argument that settled it:

> Read this paragraph as the history it is. The three names it treats as the
> settled, protected case did not survive the question either — see "The admin
> barrel converged" below. `StatusBadge` was deleted at some point after this
> was written and the barrel's comment went on naming it; the other two were
> forks with no importer.

- **`components/admin/SidebarUserMenu.tsx`** was a *stale copy*. The layout
  renders `SidebarUserMenu` from `@be-yours/admin`, and the package version
  has since gained a fix the local copy never did: it clears the selected
  establishment on sign-out, because it outlived the session and the next person
  to use that browser was greeted by name with the previous user's restaurant.
  A template-only component is a starting point a client developer is invited to
  reach for. Leaving this one there offered them a copy with a fixed privacy
  defect back in it — which is worse than dead code, and is the difference
  between it and its three protected neighbours (those are barrel exports the
  template actually renders).

- **`components/admin/AdminLanguageSwitcher.tsx`** would have been inert if it
  had been mounted. It drives `useLanguageStore`, which **nothing in
  `packages/admin` reads** — the admin's own strings are French in the source.
  Mounting it would have given an owner a language picker that saves a choice
  and changes nothing on screen: the same shape as the RTL switch and the
  currency picker, which are disabled with a stated reason precisely so nobody
  mistakes a stored value for a working feature. Translating the admin is a real
  piece of work; this file was not a head start on it.

Both were removed rather than documented. What is worth keeping is the method:
**if you are hunting dead code rather than divergence, ask what happens when the
file is used, not whether it is reachable.** A reachability argument would have
deleted `getMyMemberships` too.

## The admin barrel converged (2026-09-09, #413)

`components/admin/index.ts` was the ninth documented divergence and is no longer
a divergence at all: the two barrels are byte-identical, the `ALLOWED` row is
gone, and the twins check now *enforces* that they stay that way rather than
excusing them from comparison.

What it had been allowed for stopped being true in stages, and nothing noticed
because an `ALLOWED` row is a permanent exemption from the only check that looks:

- **`StatusBadge` was deleted, and its description was not.** The barrel's own
  doc comment opened "StatusBadge, DateDisplay and ComingSoon exist only in this
  template" while no `StatusBadge.tsx` existed in that directory and the barrel
  exported no such name. This note repeated the claim in two places. A comment
  is not checked by anything, so it outlived its subject.
- **`ComingSoon` and `DateDisplay` were forks with no importer.** Every live
  `ComingSoon` call site — two per app — takes it from `@be-yours/admin`.
  Nothing rendered the local `DateDisplay` at all. Both had drifted from the
  package components they were copied from, which is precisely the hazard #405
  removed `SidebarUserMenu` for: a template-only component is a starting point a
  client developer is invited to reach for, and offering them a stale fork is
  worse than offering them nothing.

The lesson is about the mechanism rather than the three files. **An `ALLOWED`
row is not documentation, it is a hole in the guard** — `checkTwins` skips the
file outright. So a row must be re-earned, not merely explained: this one
justified itself by naming three local components, and survived the deletion of
one and the abandonment of the other two. Where a divergence can be *closed*
instead, closing it converts the row into enforcement, which is what happened
here. Adding `export { DateDisplay } from "./DateDisplay"` back to either barrel
now fails `pnpm check:divergence`; before this change it could not have.

Be precise about how far that reaches. `checkTwins` compares files present in
**both** apps, so it covers the barrel and not a brand-new one-sided component
file — dropping a fresh `DateDisplay.tsx` into the template alone still passes,
which is the gap the script's own header declares and the route by which these
two forks originally arrived. Closing the barrel closes the door they were
*exported* through, not every door.

### Dead code in `packages/ui` — one correction and one removal

The keep-list of twenty below still stands as a verdict, with two amendments:

- **`PageHeader` is no longer consumer-free.**
  `packages/admin/src/pages/privacy/privacy-page.tsx` imports it from
  `@be-yours/ui`. The list is 19 of 20 accurate; do not cite it as twenty.
- **`Toast` stays; its provider and hook did not.** `ToastProvider`, `useToast`
  and `ToastContext` were removed by #413, and the keep-list reasoning is exactly
  why the box beside them was not. That reasoning — removing a name from a
  published package is a breaking major that buys nothing but a shorter barrel —
  covers an export nobody imports. It does not cover an export whose every
  possible call throws, which is what `useToast` was: nothing anywhere mounted
  the provider that could have satisfied it. The two claims are different and
  only the second was acted on.

## The design system left both apps (2026-09-05)

`apps/reference/components/ui/` and `apps/themes/components/ui/` no longer
exist. Neither does `packages/admin/src/ui/`. There is one design system, in
`packages/ui`, and every consumer imports it from `@be-yours/ui`.

This note is the right place to record it because the deleted directories were
**byte-identical between the two apps** — `diff -rq` printed nothing about 37
files that were, between them, a second copy of the engine's component library.
That is the blind spot this document already names ("a byte-identical file is
invisible to `diff -rq`, even when it is dead on one side"), in its most
expensive form: not one dead directory, but a whole parallel design system that
every twin check in the repository agreed was fine.

What it cost while it lived: sixteen of the twenty-six shared component names
had drifted. The package's default Button was `h-10` with
`focus-visible:ring-2 ring-offset-2`; the apps' was `h-9` with
`ring-[3px] focus-visible:border-ring`. So the same storefront rendered buttons
4px apart with different focus rings depending on which page a diner was on, and
twelve files per app imported from both systems at once —
`BlogAutoConfigForm.tsx` took Button, Badge, Input and Separator from the
package and Label and Switch from the local copy, on one form.
`packages/admin` was stranger still: 97 files imported the old Button from the
package while the package's own `src/ui/button.tsx` held the new one with zero
importers.

The newer generation won. What only the package had was merged back rather than
dropped — the dialog's `max-h`/`overflow-y-auto` fix (the app copy, which is the
one that rendered, never had it), the Alert's `warning` and `success` variants,
and `packages/admin`'s `useOptionalSidebar` and `min-w-0` sidebar inset.

**For a client repository this means 37 fewer files.** `apps/themes` is the tree
a client site is cloned from, so the next publish removes `components/ui/` from
every delivered site. A client who had edited one of those files locally loses
that edit — worth checking before the next mirror publish.

### Do not reintroduce a local `components/ui`

`packages/ui/src/__tests__/design-system-singularity.test.ts` fails if any of
the three directories comes back, if a file imports `@/components/ui/*` or a
relative `ui/` path, or if the surviving geometry stops being the newer
generation. `scripts/check-app-divergence.mjs` cannot help here: it compares the
two apps against each other, and this fault was identical on both sides.

`apps/*/components/ui/empty.tsx` used to be a one-line re-export bridge to the
package. It was the only file of its kind and it is gone with the rest. It was a
transitional device, not a pattern — a bridge is a second name for one module,
and a second name is where the next fork starts.

### Dead code in `packages/ui`, and why it stays

Twenty of the fifty-nine components have no consumer anywhere:

```
Container, DataTable, EmptyState, FormField, InputGroup, Navbar, PageHeader,
Progress, RadioGroup, ScrollArea, Section, Spinner, Toast,
admin/ActionBar, admin/AdminLayout, admin/FilterBar,
restaurant/CartItem, restaurant/PriceDisplay, restaurant/ProductCard,
restaurant/QuantitySelector
```

Verdict: **keep, and record.** Two different reasons.

`ProductCard` and `QuantitySelector` are the design system's flagship restaurant
components, and both apps render their own `storefront-product-card.tsx`
instead. That is a real gap — a design system whose headline components nothing
uses — but it closes by wiring them into the storefront, which is a storefront
redesign with its own review, not by deleting them in a refactor.

The other eighteen are the surface of a **published** package. A client site
runs a pinned `@be-yours/ui` and can import any exported name; removing one
is a breaking major that buys nothing but a shorter barrel.

What must not happen is the list growing. A component with no consumer is a
component nobody has proven, and the state this convergence undid is what
happens when that goes unremarked for long enough.

---

## Verification

```bash
pnpm exec turbo run type-check test --force --filter=@be-yours/themes --filter=@be-yours/reference
```

`Tasks: 10 successful, 10 total`. Reference 486 passed / 13 skipped across 40
files; themes 199 passed / 13 skipped across 19 files. Playwright collection:
542 tests in 55 files (themes), 541 in 55 (reference).

The Playwright suites were **collected, not run** — they need a live Convex
deployment and a seeded `SEED_PASSWORD`. What is proven here is that the ported
specs parse, resolve their imports and register; what they assert against a real
deployment is the next thing to check, and `e2e/README.md` has the procedure.

---

## Appendix — every file that differed, and its verdict

`benign` = a comment naming its own app, no action. `deliberate` = a real reason
to differ, now commented in the file. `drift →themes` / `drift →reference` = a
fix one side had and the other did not; ported to the side named.

### `app/` (12)

| File | Verdict | Note |
|---|---|---|
| `app/(auth)/sign-in/page.tsx` | drift →themes | `sr-only` accessible name on the loading button |
| `app/(storefront)/_components/HomepageContent.tsx` | drift →themes | 400 from the image optimizer on a missing hero |
| `app/(storefront)/order/[orderId]/page.tsx` | drift →themes | Uber Direct courier tracking never surfaced |
| `app/(test)/address-test/page.tsx` | drift →themes | fixture Maps key, without which the spec mocks nothing |
| `app/api/contact/route.ts` | drift →themes | domain logic extracted + `null` body answered 400 |
| `app/layout.tsx` | deliberate | client zone owns metadata, fonts, theme |

### `components/` (14)

| File | Verdict | Note |
|---|---|---|
| `components/admin/blog/BlogArticleEditor.tsx` | drift →themes | accents (`4ff7d15`) |
| `components/admin/blog/BlogArticlesTable.tsx` | drift →themes | accents |
| `components/admin/blog/BlogCategoryManager.tsx` | drift →themes | accents |
| `components/admin/blog/BlogContent.tsx` | drift →themes | accents |
| `components/admin/blog/BlogRichTextEditor.tsx` | drift →themes | accents |
| `components/admin/blog/CreateArticleDialog.tsx` | drift →themes | accents + `htmlFor`/`id` label linkage |
| `components/admin/blog/GenerateArticleDialog.tsx` | drift →themes | accents + `htmlFor`/`id` on three fields |
| `components/admin/blog/GenerateImageDialog.tsx` | drift →themes | accents |
| `components/admin/kitchen/CompletedTickets.tsx` | drift →themes | accents — file since moved, see below |
| `components/admin/kitchen/KitchenContent.tsx` | drift →themes | accents — file since moved, see below |
| `components/admin/kitchen/TicketCard.tsx` | drift →themes | accents — file since moved, see below |
| `components/admin/index.ts` | ~~deliberate~~ **converged** | held a local `StatusBadge`/`DateDisplay`/`ComingSoon`; see "The admin barrel converged" below |
| `components/storefront/user-menu.tsx` | benign | comment rewording |
| `components/website/meal-card.tsx` | drift →themes | 400 from the image optimizer on every photoless product |

> **`components/admin/kitchen/` no longer exists in either app.** The nine
> files it held were the KDS, kept twice — and a third, older `KitchenPage` sat
> unrendered in `packages/admin`. The live screen now lives in
> `packages/admin/src/pages/kitchen/` and both apps render it, so the three rows
> above record a reconciliation between two copies that have since become one.
> `components/admin/languages/LanguagesContent.tsx` went the same way;
> `UIOverridesContent.tsx` stays local, because it lists the template's own
> translation keys. Two copies cannot diverge when there is one.

### `e2e/` (32)

All 29 spec files below were the **same class**: the template held a pre-repair
snapshot — stale text assertions, missing `countAfterLoad`/`chooseOption`,
silent `if` instead of `test.skip`, missing plan/state gates. All ported to the
template.

`admin/blog-articles`, `admin/blog-auto-config`, `admin/dashboard`,
`admin/email-campaigns`, `admin/email-segments`, `admin/email-subscribers`,
`admin/games`, `admin/image-to-product`, `admin/inventory`, `admin/kitchen`,
`admin/order-detail`, `admin/orders`, `admin/product-form`, `admin/products`,
`admin/promotions`, `admin/store-detail`, `admin/stores`, `admin/subscription`,
`admin/team`, `auth/sign-in`, `auth/sign-up`, `auth.setup`, `cms/cms-page-editor`,
`cms/cms-translation`, `responsive/admin-responsive`, `storefront/display-screen`,
`storefront/public-pages`, `storefront/storefront-layout`, `storefront/tracking`.

| File | Verdict | Note |
|---|---|---|
| `e2e/helpers/filter.helpers.ts` | drift →themes | `chooseOption` (Radix double-render) |
| `e2e/README.md` | benign | each app documents its own CI (deploy-key row added) |
| *(new)* `e2e/helpers/list.helpers.ts` | drift →themes | `countAfterLoad` |
| *(new)* `e2e/helpers/credentials.helpers.ts` | drift →themes | removes the literal `"julien"` |
| *(new)* `e2e/load-env.ts` | drift →themes | needed by `seed-users.mts` |
| *(new)* 9 suites | drift →themes | see the list in the body |

### `lib/` (5)

| File | Verdict |
|---|---|
| `lib/auth-client.ts`, `lib/i18n.ts`, `lib/rbac.ts` | benign — "the reference app" vs "the themes app" |
| `lib/stores/addresses-store.ts`, `lib/stores/favorites-store.ts` | benign — comment rewording |
| *(new)* `lib/services/contact-service.ts` + test | drift →themes |

### `scripts/` (3)

| File | Verdict | Note |
|---|---|---|
| `scripts/seed-users.mts` | drift →themes | missing `Origin` header made every seed call 403 |
| `scripts/kiosk-print.sh` | drift →themes | header comments translated to English |
| `scripts/setup-aws.sh` | **drift →reference** | `POLICY_NAME` names an existing AWS resource |

### `convex/` (4)

| File | Verdict | Note |
|---|---|---|
| `convex/auth.ts` | deliberate | already documented |
| `convex/http.ts` | deliberate | already documented |
| `convex/seedFixture.ts` | drift →themes | the template *should* have the fixtures — see body |
| `convex/tsconfig.json` | deliberate | template build config |

---

## What closed — the gamification split (#159)

Seven of the nineteen documented divergences were one decision, recorded rather
than resolved: `apps/themes` shipped a 37-line placeholder where the bench had
the whole player flow, and four admin screens behind `ComingSoon`. The note said
gamification "is not part of what a client buys today". A client's backend
served it regardless — all seven Convex wrappers were live and byte-identical,
`convex/gameEmail.ts` was already emailing a `/game/prize/<code>` link to a
route that did not exist in the template, and `dashboard/games` was never
stubbed at all: it rendered the real overview, linking to four placeholders.

The flow now lives in `packages/admin/src/game/`, exported from
`@be-yours/admin/game`, and both apps render it through identical thin
adapters that supply the three things that are genuinely per-app: the generated
Convex API, `useCmsPage`, and the route params. `apps/themes` gained
`/game/prize/[code]`, which closes the emailed 404.

Two claims in the removed rows were false, and are worth recording so they are
not reintroduced:

- **"The routes stay declared because the sidebar links to them."** It does not.
  `packages/admin/src/config/admin-routes.ts` declares five game routes and
  `nav-config.ts` links exactly those five; `/dashboard/games/settings` is not
  among them. That route was reachable from nothing in either app, so the
  template's copy has been deleted and its legacy `/games/settings` redirect now
  points at `/dashboard/games`, as the bench's already did.
- **"a copy left to rot out of step with the engine."** The concern was real —
  the answer is one copy in a package, not a placeholder.

~~Still deliberately one-sided: `components/admin/index.ts` exports a local
`ComingSoon` and `DateDisplay` that nothing imports.~~ **Closed** — see "The
admin barrel converged" below.
