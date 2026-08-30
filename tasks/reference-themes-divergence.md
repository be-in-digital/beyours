# `apps/reference` vs `apps/themes` — what may differ, and why

Written on 2026-08-29. `apps/reference` is the engine's test bench;
`apps/themes` is the template cloned into one repo per client. They are meant to
be near-identical twins, so every file that differs is either a decision someone
made or a fix that only landed on one side.

This note exists so the next person can tell those two apart without re-deriving
the whole comparison. **Before "fixing" a divergence, look for it here.**

---

## How to reproduce the comparison

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
do, and every one of them is listed below.

---

## Deliberate — do not align

Each of these now carries its own comment in the file, so the reason travels
with the code. This table is the index, not the explanation.

| File | Why the template differs |
|---|---|
| `convex/auth.ts` | The bench trusts `localhost:3000-3003` because its workspaces fight over ports. A client site runs on its own domain and has no business accepting a dev origin. |
| `convex/http.ts` | The template keeps the old Next.js `/api/webhooks/*` routes as 410 tombstones, so a client whose provider dashboard still points at the old path gets an explanation instead of a 404. The bench deleted them on 2026-07-18. |
| `app/layout.tsx` | Metadata, fonts and theme come from the client zone (`site.config.ts`, `site/fonts.ts`, `site/theme.css`). Already documented in the file and in `apps/themes/docs/UPDATES.md`. |
| `app/(test)/layout.tsx` | Template-only. Sends the `(test)` route group to `notFound()` in production unless `NEXT_PUBLIC_ENABLE_TEST_ROUTES=true`. Playwright harnesses have no business on a client site. |
| `app/(admin)/dashboard/games/{actions,catalog,qr-codes,winners,settings}/page.tsx` | Gamification is not part of what a client buys today. The template renders `ComingSoon`; the bench renders the real pages from `@be-in-digital/admin`. The routes stay declared because the sidebar links to them. |
| `app/(admin)/games/settings/page.tsx` | Follows from the row above: the bench deleted `/dashboard/games/settings` and redirects this legacy path to `/dashboard/games`. That route exists in the template, so the redirect keeps its original target. |
| `app/game/[qrCodeId]/_components/GameContent.tsx` | The player-facing half of the same decision. The bench implements the full flow across ten sibling components plus `lib/game`; the template ships a CMS-editable placeholder rather than a copy left to rot out of step with the engine. |
| `e2e/admin/coming-soon.spec.ts` | Asserts one extra route — `/dashboard/games/settings`, which exists here and 404s in the bench. This is the single test that separates the two suites. |
| `components/admin/index.ts` | Exports `StatusBadge`, `DateDisplay` and `ComingSoon`, which exist only in the template alongside its other local admin components. The bench renders those screens straight from `@be-in-digital/admin`. |
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
`coming-soon` case above.

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

## Verification

```bash
pnpm exec turbo run type-check test --force --filter=@beyours/themes --filter=@beyours/reference
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
| `app/(admin)/dashboard/games/actions/page.tsx` | deliberate | ComingSoon vs `GameActionsPage` |
| `app/(admin)/dashboard/games/catalog/page.tsx` | deliberate | ComingSoon vs `GameCatalogPage` |
| `app/(admin)/dashboard/games/qr-codes/page.tsx` | deliberate | ComingSoon vs `GameQrCodesPage` |
| `app/(admin)/dashboard/games/winners/page.tsx` | deliberate | ComingSoon vs `GameWinnersPage` |
| `app/(admin)/games/settings/page.tsx` | deliberate | redirect target follows the route above |
| `app/(auth)/sign-in/page.tsx` | drift →themes | `sr-only` accessible name on the loading button |
| `app/(storefront)/_components/HomepageContent.tsx` | drift →themes | 400 from the image optimizer on a missing hero |
| `app/(storefront)/order/[orderId]/page.tsx` | drift →themes | Uber Direct courier tracking never surfaced |
| `app/(test)/address-test/page.tsx` | drift →themes | fixture Maps key, without which the spec mocks nothing |
| `app/api/contact/route.ts` | drift →themes | domain logic extracted + `null` body answered 400 |
| `app/game/[qrCodeId]/_components/GameContent.tsx` | deliberate | full player flow vs CMS placeholder |
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
| `components/admin/kitchen/CompletedTickets.tsx` | drift →themes | accents |
| `components/admin/kitchen/KitchenContent.tsx` | drift →themes | accents |
| `components/admin/kitchen/TicketCard.tsx` | drift →themes | accents |
| `components/admin/index.ts` | deliberate | template-only components in the barrel |
| `components/storefront/user-menu.tsx` | benign | comment rewording |
| `components/website/meal-card.tsx` | drift →themes | 400 from the image optimizer on every photoless product |

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
| `e2e/admin/coming-soon.spec.ts` | deliberate | one extra route the template has |
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
