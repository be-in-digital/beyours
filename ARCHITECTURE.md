# Architecture

How this repository is put together, and why. Companion to [`README.md`](README.md),
which is the entry point; this file is the level below it — the one you read before
changing where something lives.

**Every claim here was checked against the tree at `158019f` (5 September 2026).**
Counts carry the command that produced them, so you can re-run them rather than
trust them. Where something is absent, it says so; a gap that is quietly omitted
is worse than no document. See also [`FEATURES.md`](FEATURES.md) for what the
product does and does not do, [`TESTING.md`](TESTING.md) for what holds it up,
and [`DEPLOYMENT.md`](DEPLOYMENT.md) for where it runs.

---

## 1. Three applications, three audiences

The repository holds **three distinct Next.js applications** plus ten publishable
packages. Understanding which is which is the whole of the orientation.

| App | Workspace | Who it is for | Deploys to |
| --- | --- | --- | --- |
| `apps/site` | `@beyours/site` | Prospects, affiliates, the internal team | Vercel → beyours.fr |
| `apps/reference` | `@beyours/reference` | Nobody — it is the engine's test bench | Local / preview |
| `apps/themes` | `@beyours/themes` | Each client restaurant, after cloning | Vercel, one project per client |

**`apps/site` is a website, not an instance of the product.** It depends on none of
the engine packages — `grep -c "@be-in-digital" apps/site/package.json` returns `0` —
and it carries its own Convex backend under `apps/site/convex/`. It holds the
marketing pages, the template catalogue, the Stripe checkout, the affiliate portal
(`apps/site/app/parrainage/`) and an internal operations console
(`apps/site/app/admin/`: `flotte`, `clients`, `ventes`, `factures`, `abonnements`,
`apporteurs`, `prospects`, `incidents`, `monitoring`, `parametres`).

**`apps/reference` is where an engine feature is built and proven.** It wires nine of
the ten packages together — storefront, admin dashboard, CMS, kitchen display, QR
games — and carries the Playwright suite CI runs. It is sold to nobody.

**`apps/themes` is the shippable counterpart.** Same application shell, plus
everything the engine cannot carry: the client zone (`site/`), the 51 design
templates (`templates/`), the sales demos (`demos/`) and the site-creation scripts
(`scripts/`). This is what a paying customer actually runs, and it is the app to
check when you want to know whether a feature reaches a client.

Measured today:

```bash
for a in site reference themes; do
  echo -n "apps/$a: "
  echo -n "$(find apps/$a/app -name 'page.tsx' -o -name 'page.ts' | wc -l) page files, "
  echo "$(find apps/$a/app -name 'route.ts' -o -name 'route.tsx' | wc -l) route handlers"
done
# apps/site:      37 page files, 1 route handler
# apps/reference: 108 page files, 5 route handlers
# apps/themes:    108 page files, 8 route handlers
```

Two notes on those numbers. First, `README.md:50` still says "98 routes" for the
reference app; the figure has grown. Second, 37 of the reference app's 77 page files
under `app/(admin)/` are `redirect()` shims onto `/dashboard/*`
(`grep -rl "redirect(" "apps/reference/app/(admin)" --include=page.tsx | grep -v /dashboard/ | wc -l`).
They are historical aliases kept so old bookmarks resolve, not duplicated screens.

### Two npm scopes, deliberately

The three apps are `@beyours/*`. The ten packages are `@be-in-digital/*`, published
privately to GitHub Packages. The scope was **not** renamed with the repositories,
because changing it breaks every client site on its next install — see the Naming
section of [`README.md`](README.md#naming-what-gets-renamed-and-what-never-does)
before any find-and-replace.

Installing the packages from outside the monorepo needs a `read:packages` PAT in
`NODE_AUTH_TOKEN` (`.npmrc` maps the scope to `npm.pkg.github.com`). Inside the
monorepo nothing is fetched: `pnpm-workspace.yaml` sets `linkWorkspacePackages: true`
and the apps consume `workspace:^`.

---

## 2. The ten engine packages

```bash
for p in admin convex-functions core integrations convex-schema ui marketing restaurant cms mcp-server; do
  echo -n "$p: "
  find packages/$p/src -type f \( -name '*.ts' -o -name '*.tsx' \) \
    -not -path '*__tests__*' -not -name '*.test.ts' -not -name '*.test.tsx' \
    | wc -l | tr -d '\n'; echo -n " files, "
  find packages/$p/src -type f \( -name '*.ts' -o -name '*.tsx' \) \
    -not -path '*__tests__*' -not -name '*.test.ts' -not -name '*.test.tsx' \
    -exec cat {} + | wc -l
done
```

| Package | Contents | Source files · lines | Version | Shipped as |
| --- | --- | ---: | --- | --- |
| `admin` | Admin pages, components, stores, the game player flow | 210 · 39,471 | 8.0.0 | TS source |
| `convex-functions` | Convex backend function definitions | 82 · 24,069 | 3.0.0 | TS source |
| `core` | Auth, i18n, AWS (S3/SES), env, Sentry | 37 · 7,458 | 2.3.0 | `dist/` (tsup) |
| `convex-schema` | Convex tables, validators, types | 39 · 5,906 | 3.0.0 | TS source |
| `ui` | React components, design system | 57 · 5,013 | 2.0.3 | `dist/` |
| `integrations` | Uber Eats, Deliveroo, Uber Direct clients | 27 · 4,069 | 2.1.0 | `dist/` |
| `restaurant` | Business logic, hooks, Zustand stores | 21 · 2,343 | 2.1.0 | `dist/` |
| `mcp-server` | MCP server exposing the package registry | 3 · 1,700 | 1.0.4 | `dist/` |
| `marketing` | Email rendering, campaign validation, segments | 7 · 1,716 | 2.1.0 | `dist/` |
| `cms` | Page/block registry, validation, sanitisation | 9 · 982 | 3.0.0 | `dist/` |

**Three packages ship as raw TypeScript.** `admin`, `convex-functions` and
`convex-schema` point `main` at `./src/index.ts` and **have no `build` script at
all** (`node -e "console.log(require('./packages/admin/package.json').scripts.build)"`
→ `undefined`). That is deliberate: the schema and functions have to be read by the
client's own Convex compiler, and `admin` carries Server Components that transpiling
would break. The practical consequence is that a type error in those three surfaces
only under `type-check`, or in the build of the app that consumes them — never in
their own build, because they do not have one.

### Dependency layering

Derived from the `dependencies` and `peerDependencies` of each `package.json`:

```
cms ─┐   convex-schema ─┐   core ─┐   ui ─┐   integrations ─┐   marketing ─┐   mcp-server
     │                  │        │       │                 │              │   (leaf, consumed by no app)
     └──────────────────┴────────┤       │                 │              │
                                 ▼       │                 │              │
                          convex-functions                 │              │
                                 │                         │              │
        restaurant (convex-schema, core)                   │              │
                                 │                         │              │
                                 ▼                         │              │
              admin (convex-functions, convex-schema, core, marketing, restaurant, ui)
                                 │
                    apps/reference · apps/themes  ── depend on 9 of the 10
                    apps/site                     ── depends on none
```

`cms`, `convex-schema`, `core`, `integrations`, `marketing`, `mcp-server` and `ui`
declare **no** `@be-in-digital/*` dependency. `mcp-server` is consumed by no
application; it is tooling that exposes the package registry to editors and agents.

The ASCII diagram in [`apps/docs/README.md`](apps/docs/README.md) shows the same
layering at a coarser grain; it predates `apps/site` and `apps/themes` and shows
"Themes / Admin / Restaurant" as peers inside one Next.js app, which is no longer the
shape.

---

## 3. A push only builds what it touches

Each app carries its own `vercel.json`:

```json
{ "ignoreCommand": "npx turbo-ignore @beyours/<app>" }
```

Turbo follows the **dependency graph**, not the directory tree, so a change in
`packages/ui` rebuilds `reference` and `themes` and skips `site` — because `site`
does not depend on it, and only the graph knows that.

A change at the **root** (`package.json`, `pnpm-lock.yaml`, `turbo.json`) invalidates
everything by construction. That is correct, and it means a dependency bump rebuilds
all three apps.

`turbo.json` declares almost no `env`. The `build` task declares exactly
`SENTRY_ORG`, `SENTRY_PROJECT` and `SENTRY_AUTH_TOKEN`; `NEXT_PUBLIC_*` reaches the
Next builds through framework inference. **Everything else is stripped before the
task runs.** That is the single most surprising thing about this build system, and it
has already cost one silent CI failure — the whole `passThroughEnv` block on
`test:e2e` exists because `next start` was being launched without the variables its
own env check requires. If a variable "is set in CI" and the task cannot see it, this
is why.

---

## 4. The data model

**Convex, one deployment per client.** Isolation is structural: a client's data lives
in a Convex deployment nobody else is pointed at. It is not a filter someone has to
remember, and it is not row-level. See [`README.md`](README.md#convex-deployments) for
the measured deployment inventory and [`DEPLOYMENT.md`](DEPLOYMENT.md#3-convex).

> **Neon is not used anywhere in this repository**, and there is no "one schema per
> restaurant". If you read that somewhere, it is wrong.

### The schema

`packages/convex-schema/src/schema.ts` registers **75 tables** today:

```bash
node -e "const s=require('fs').readFileSync('packages/convex-schema/src/schema.ts','utf8');
  console.log([...s.match(/defineSchema\(\{([\s\S]*)\n\}\)/)[1]
    .matchAll(/^\s{2}([A-Za-z0-9_]+):/gm)].length)"
# 75
```

Each app re-declares the same set in `apps/*/convex/schema.ts`, importing the table
definitions from the package — the Convex compiler needs the schema in the
deployment's own directory.

**Authentication tables are not in this schema.** `schema.ts:80-87` says so in the
file: `user`, `session`, `account`, `verification` and `jwks` are owned by the
Better Auth Convex component. What this schema holds instead is `userProfiles` — the
role and permission record the admin reads. There is no `sessions` table in any
schema in this repository.

The domain groupings, as registered:

| Area | Tables |
| --- | --- |
| Identity & org | `userProfiles`, `teamMembers`, `globalSettings` |
| Establishments | `stores`, `storeIntegrations` |
| Catalogue | `categories`, `products`, `menus` |
| Orders & money | `orders`, `payments`, `paymentConnections`, `paymentEvents`, `promotions`, `promotionUsages` |
| Kitchen | `kitchenTickets` |
| Delivery platforms | `uberEatsConnections`, `oauthStates`, `deliveryQuotes`, `externalProductMappings`, `orphanProducts` |
| i18n | `languages`, `translations`, `translationJobs` |
| Gamification | `gameQRCodes`, `requiredActions`, `games`, `prizes`, `gamePlays`, `prizeRedemptions`, `gameReferrals` |
| Customers | `favorites`, `customerAddresses`, `contactMessages` |
| Email marketing | `emailSubscribers`, `emailTemplates`, `emailCampaigns`, `emailSegments`, `emailAutomations`, `emailAutomationRuns`, `emailEvents`, `emailConfig`, `rateLimits` |
| CMS | `cmsPages`, `cmsBlocks`, `cmsMedia`, plus 16 per-page tables (`cms`, `cmsHome`, `cmsMenu`, …) |
| Blog | `blogCategories`, `blogTags`, `blogArticles`, `blogArticleTags` |
| Auto Blog | `ownerEntitlements`, `blogAutoConfig`, `blogAutoQueue`, `blogAutoUsage` |
| System | `systemAuditLog`, `platformWebhookFailures`, `maintenanceContracts`, `platformReleases`, `migrationRequests` |

### The multi-tenant key is `storeId`, not `restaurant_id`

`grep -rn "restaurant_id" --include='*.ts' --include='*.tsx' .` returns **zero** hits
outside `node_modules`. The field every scoped table carries is `storeId:
v.id("stores")`, and the guard is `requireStorePermission` in
`packages/convex-functions/src/auth.ts`, not a filter written by hand at each call
site. Any instruction telling you to "filter by `restaurant_id`" is describing a
schema this repository does not have.

### Registered fields that nothing uses

The schema deliberately keeps some fields that no code reads or writes, because a
stored field absent from the schema fails validation on the next write to that
document. They are marked in the source; do not treat their presence as evidence a
feature exists.

- `packages/convex-schema/src/tables/stores.ts:151-155` — `displayConfig`,
  `branding`, `integrations` and `settings` are all `v.optional(v.any())`, and the
  file states plainly that **nothing writes them now**. In particular there is no
  `stores.integrations.uberEats` or `.deliveroo` in live data: platform connections
  live in the `storeIntegrations` table and in `uberEatsConnections`.
- `stores.themeId` (`tables/stores.ts:70`) is declared in five places and has **no
  reader and no writer**. Theme choice happens at clone time, through
  `pnpm template:apply`, not at runtime.

### Convex functions

The packages hold the *definitions*; each app's `convex/` directory holds thin
wrappers that bind them to that deployment's generated types and apply the app's own
guards. A wrapper looks like this (`apps/reference/convex/products.ts:1-17`):

```ts
import * as defs from "@be-in-digital/convex-functions/products"
export const list = query(defs.list)
```

`apps/reference/convex/` exports 562 functions today
(`grep -rhoE "^export const [a-zA-Z0-9_]+" apps/reference/convex/*.ts | wc -l`). The
27 August 2026 audit swept 482; the surface has grown since.

Ten cron jobs are registered in `apps/*/convex/crons.ts`: invitation sweep,
scheduled-campaign dispatch, win-back automation, payment-event sweep, Stripe
checkout reconciliation, kitchen-ticket purge, expired-customer-data purge, the
**nightly backup**, Auto Blog planning and Auto Blog execution.

The backup is the one that used not to exist — `grep backup` here returned
nothing, while `exportBackup`'s only caller was a button that downloaded a Blob
to whatever laptop the administrator was sitting at (#366). It runs at 01:30 UTC,
before the three destructive nightly jobs, so a copy exists of what they are
about to carry away. What it carries is one list, shared by the export and the
import: `packages/convex-functions/src/backupTables.ts`.

---

## 5. The admin surface

`packages/admin/src/config/admin-routes.ts` is the **single source of truth for every
admin route**. Every link, redirect and nav entry must resolve through it. The file
is short (82 lines) and worth reading whole; three of its comments record decisions
that keep getting re-litigated:

- **`payments: "/dashboard/payments"`** (`admin-routes.ts:24-31`) — `PaymentsPage`
  carries the only working refund dialog in the admin. Until this route existed the
  page was exported by the package and mounted by neither app, so a refund could not
  be issued from anywhere. Settings → Paiements is provider *configuration*; it is a
  different screen.
- **`design: "/dashboard/design"`** (`admin-routes.ts:50-64`) — the branding editor
  edits **one** establishment, resolved from `useAdminStoreId()`, while Settings is
  headed "Paramètres Globaux — valeurs par défaut héritées par tous les
  établissements". Putting a per-store editor under that heading would tell an owner
  with three restaurants they had just restyled all three.
- **`kitchen: "/dashboard/orders/kitchen"`** sits under Orders rather than at the top
  level, and the sidebar surfaces it as its own entry.

`packages/admin/src/config/nav-config.ts` is what an owner can actually *reach*. Two
routes exist and are deliberately kept out of the nav, each with a comment saying so:
`customers` and `contentComponents`. Only `contentComponents` renders
`<ComingSoon/>`; `customers` has been a real screen since #481 — the customer
book #364 built — and is kept out of the nav for its own reason, not for being
empty. This line said "both" until #534.

`navTourId(href)` in the same file is the one place that computes a sidebar
entry's `data-tour` anchor. It is a function rather than a template literal because
the sidebar and the onboarding tour each used to carry their own copy, and when the
admin moved under `/dashboard` only one of them followed — 19 of 20 tour highlights
pointed at nothing. Both now call this.

---

## 6. The twin-app contract

`apps/reference` and `apps/themes` are meant to be **near-identical twins**. A fault
is routinely byte-identical in both, so fixing one and not the other is the default
mistake here.

The contract is written up in
[`tasks/reference-themes-divergence.md`](tasks/reference-themes-divergence.md) and
**enforced** by `scripts/check-app-divergence.mjs`, which runs inside the required
`Lint` job:

```bash
pnpm check:divergence
# App divergence check passed: 10 documented divergences, no new ones,
# e2e and convex at parity.
```

It applies two rules:

1. **Twins** — a shared file that differs must be listed in `ALLOWED` in the script
   itself, with a reason. There are 10 rows today: four real decisions
   (`convex/auth.ts`, `convex/http.ts`, `app/layout.tsx`,
   `components/admin/index.ts`) and six files whose only difference is a comment
   naming its own app.
2. **Parity** — under `e2e/` and `convex/`, a file may not exist on one side only.

**Know what rule 2 does not cover.** `PARITY_DIRS` is `["e2e", "convex"]`
(`check-app-divergence.mjs:131`), so a **route added to one app and forgotten in the
other passes the check in silence**. This is not hypothetical: `apps/themes` carries
three Next.js route handlers the bench does not —
`app/api/webhooks/{stripe,deliveroo/order,deliveroo/menu}/route.ts`, each a `410`
tombstone telling an integrator to repoint at the Convex endpoint — and the checker
never looks at them. Where route parity matters, it is asserted by hand:
`packages/admin/src/__tests__/design-surface.test.ts` compares both apps'
`dashboard/design/page.tsx` byte for byte, and says in its docblock why it has to.

---

## 7. Configuration and boot

`packages/core/src/env/schemas.ts` defines three tiers.

**Package tier** (`schemas.ts:19-41`) — values identical on every client deployment,
owned by BeYours: `OPENAI_API_KEY` (required), and the Uber Eats, Uber Direct and
Deliveroo partner credentials (all optional).

**Site required tier** (`schemas.ts:69-106`) — the variables a restaurant deployment
**cannot boot without**. There are ten:

```
NEXT_PUBLIC_CONVEX_URL   CONVEX_SITE_URL   SITE_URL
BETTER_AUTH_SECRET       ENCRYPTION_KEY
AWS_REGION   AWS_ACCESS_KEY_ID   AWS_SECRET_ACCESS_KEY
AWS_S3_BUCKET_NAME       AWS_SES_FROM_EMAIL
```

None routes through the `opt()` helper, so an `.env` copied from the template and
left unfilled fails here rather than at the client. `apps/*/instrumentation.ts` calls
`validateAllEnv()` on `register()` and **throws in production** when anything is
missing. (The doc comment above the tier still says "seven"; the AWS credentials moved
into it on 2026-08-28 and the prose was not updated. Count the shape, not the
sentence.)

**Site optional tier** (`schemas.ts:109-240`), plus `SITE_FEATURE_GROUPS`
(`schemas.ts:249-...`): five all-or-nothing groups — Stripe, PayPal, SumUp, BeYours
billing, Sentry source maps. Half a payment provider is worse than none, so setting
any variable in a group makes the whole group required.

The full variable-by-variable reference is
[`apps/docs/deployment/environment-variables.md`](apps/docs/deployment/environment-variables.md);
where each value lives and who owns it is [`DEPLOYMENT.md`](DEPLOYMENT.md#4-environment).

---

## 8. How a client site comes to life

```
packages/*                      published as @be-in-digital/* (changesets)
    │
    ├──► apps/reference         the test bench — where a feature is proven
    │
    └──► apps/themes            the site shipped to the client
              │  git clone (remote `template`)
              ▼
         client repository      1 repo + 1 Convex deployment + 1 Vercel project
```

Clients do not clone this repository. They clone
**`be-in-digital/beyours-boilerplate`**, the distribution mirror, because a client
site cannot clone a subdirectory of a monorepo. `scripts/publish-mirror.mjs` rebuilds
that mirror from `apps/themes`, rewriting the four things that only make sense here:
`workspace:^` → published versions, the lockfile, `vercel.json` (no turbo workspace on
the client side) and the package `name`.

Two update channels, never just one:

| Channel | Command | What it carries |
| --- | --- | --- |
| npm | `pnpm update:engine` | Business logic — the `@be-in-digital/*` packages, by semver |
| git | `pnpm update:template` | The application shell — routes, Convex wrappers, scripts, configs |

They move at different speeds: a logic fix spreads through a version bump, a new
route needs a git merge. A site can take one without the other. Mechanics and secrets
in [`DEPLOYMENT.md`](DEPLOYMENT.md#6-the-distribution-mirror).

### The design templates

`apps/themes/templates/` holds **51 directories**: `default` plus 50 vertical designs
across five categories (`asiatique`, `fast-food`, `food-truck`, `pizzeria`, `poulet`
— 10 each). A template is a `theme.css` + `fonts.ts` pair plus a `template.json`
descriptor; `pnpm template:apply <slug>` copies them into the client zone
(`apps/themes/site/`) and records the choice in `.beindigital-site.json`.

The sales catalogue (`apps/site/lib/templates-data.ts`) lists the same 50 under
compound `<vertical>-<theme>` slugs. Five of them — `asiatique-izakaya`,
`fast-food-smash`, `food-truck-convoi`, `pizzeria-trattoria`, `poulet-braise` — live
in directories named for the bare vertical, and are reached through the `aliases`
field in `template.json` (`apps/themes/scripts/apply-template.mjs:47-66`).
`apps/site/tests/templates-catalogue.test.ts` asserts that every catalogue slug is
applicable, in both directions. The 50 demo pages under `apps/themes/demos/s/` match
the catalogue exactly today, but **nothing tests that third list**, so it can drift.

---

## 9. Structural issues that are open

These are architectural, known, and not fixed. They belong in an architecture
document precisely because they shape decisions.

**The site's demo storefront is a reimplementation.**
`apps/site/lib/template-storefront.ts` shares no code with `apps/themes`, the product
actually shipped. A prospect therefore tries something other than what they buy, and
the two drift with every change. This is the largest open architectural issue in the
repository.

**The maintenance freeze is not enforced.**
`packages/convex-functions/src/maintenance.ts:126` defines
`isReleaseCovered(releasedAt, contract)`, but `apps/themes/scripts/update-template.mjs`
runs a bare `git fetch template` — nothing checks the contract before pulling
commits. An expired site that runs the command gets everything. The business model
is written; its guard is not.

**The divergence checker's parity rule stops at `e2e/` and `convex/`** (§6). Route
and component parity between the twins is unguarded except where a test does it by
hand.

**`packages/mcp-server` is a hand-maintained index of the engine's exports**, and
nothing checks it against them. Until 5 Sep 2026 it advertised `uploadToS3` and a
top-level `sendEmail` as importable from `@be-in-digital/core`: the first exists
nowhere, and the second is a *method* on the SES service, so an agent reading the
registry wrote imports that resolved to `undefined`. Both entries now name the real
surfaces (`createS3Service`, `getSESService`), but the next rename will drift the
same way. See §10.

**`packages/mcp-server` has no tests at all** — `vitest list` reports 0 files for it,
and it is the only workspace with no `test:coverage` script.

---

## 10. The real shape of the shared services

Several documents in this repository describe APIs that were never written. These are
the surfaces as they actually exist.

**S3.** There is no `uploadToS3`. The entry point is `createS3Service()`
(`packages/core/src/aws/s3/client.ts:112`), returning the `S3Service` interface
declared at `:46` of the same file. Valid folders are enumerated by `s3FolderSchema`
(`packages/core/src/aws/s3/validation.ts:27`): `products`, `branding`, `stores`,
`cms`, `email`, `users`.

**SES.** There are no top-level `sendEmail` / `sendTemplatedEmail` exports. Both are
methods on `SESService` (`packages/core/src/aws/ses/client.ts:38` and `:45`, plus
`sendBulkEmail` at `:54`), reached through `createSESService()` (`:63`) or
`getSESService()` (`packages/core/src/aws/ses/adapter.ts:128`).

**Translation.** There is no `translateWithGPT`. The exports are
`translateText(text, sourceLang, targetLang, context?, httpClient?, apiKey?,
maxRetries = 3)` (`packages/core/src/i18n/gpt-translation.ts:113`) and
`batchTranslate(items, sourceLang, targetLang, httpClient, apiKey, rateLimit = 60)`
(`gpt-translation.ts:220`). Both take the HTTP client and the API key as
*arguments* — they read no ambient environment — which is what makes them testable
and what makes a call with two positional arguments wrong.

**Payments.** `packages/core/src` has **no `payments/` directory**. The payment entry
points are in `packages/convex-functions/src/` (`payments.ts`,
`paymentSettlement.ts`, `refundPolicy.ts`, `stripeChargeRouting.ts`) and in each
app's `convex/` wrappers (`stripe.ts`, `stripeWebhook.ts`, `paypal.ts`, `sumup.ts`).
`apps/docs/guides/payments.md` opens with a warning saying exactly this; take it
seriously, every code sample in that guide is module-not-found.

**Delivery-platform environment variables.** `SUMUP_API_KEY`, `UBER_EATS_API_KEY`,
`DELIVEROO_API_KEY` and `UBER_DIRECT_CUSTOMER_ID` are read by no code in this
repository. The real names are in `packages/core/src/env/schemas.ts:28-40` and
`:210-223`: `UBER_EATS_CLIENT_ID` / `_CLIENT_SECRET` / `_WEBHOOK_SECRET`,
`UBER_DIRECT_WEBHOOK_SECRET`, `DELIVEROO_CLIENT_ID` / `_CLIENT_SECRET` /
`_WEBHOOK_SECRET`, `SUMUP_CLIENT_ID` / `SUMUP_CLIENT_SECRET`.

**Gamification** does not live in `packages/marketing`. `packages/marketing/src`
contains seven files: campaign validation, CSV parsing, double opt-in, the email HTML
renderer, segment filtering and stats. The game player flow and the admin screens are
`packages/admin/src/game/` and `packages/admin/src/pages/games/`.

---

## 11. Where the older documents disagree with the tree

Kept short and specific, so that reading them is still useful.

| Document | What to distrust |
| --- | --- |
| [`apps/docs/getting-started/project-structure.md`](apps/docs/getting-started/project-structure.md) | Predates the three-app split. Lists an `apps/admin-dashboard/` that does not exist; does not mention `apps/site` or `apps/themes`; repeats "core: Auth, i18n, payments, AWS". |
| [`apps/docs/README.md`](apps/docs/README.md) | "50+ table definitions" (75), "48 backend function modules" (82 in `packages/convex-functions/src`), and a diagram that predates the split. |
| [`_project/PROJECT_STRUCTURE.md`](_project/PROJECT_STRUCTURE.md) | Historical. Read it as a record of intent, not of the tree. |
| [`_project/FEATURES_DIAGRAM.md`](_project/FEATURES_DIAGRAM.md) | The origin of the "181+ features" figure. See [`FEATURES.md`](FEATURES.md#2-where-181-comes-from). |
| [`README.md`](README.md) | Several counts have drifted: `apps/docs` holds 37 markdown pages not 31; the reference app has 108 page files not 98; 37 `(admin)` redirects not 32; the catalogue holds 50 slugs not 52. Its **structural** claims — the three apps, the mirror, the update channels, the deployment inventory — all check out. |
