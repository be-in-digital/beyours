# BeYours

Everything that makes up the **BeYours** restaurant offering: the site that
sells it, the engine that runs it, and the template that ships it to each
client.

pnpm + Turborepo monorepo. Next.js 16 · React 19 · Convex · strict TypeScript.

**Live: https://beyours.fr**

![Demo catalogue](docs/captures/demos-catalogue.png)

> **BeYours is the product sold to restaurant owners. BeInDigital is the
> agency.** Two brands, two businesses. The rule and its exceptions are spelled
> out under [Naming](#naming-what-gets-renamed-and-what-never-does) — read it
> before any find-and-replace.

---

## In one minute

| | |
| --- | --- |
| **What we sell** | A turnkey online ordering site for restaurants, with no commission on direct sales |
| **Model** | One-off sale + 1 year of maintenance included, then annual renewal |
| **Multi-location** | 1 owner = 1 to N locations, unlimited |
| **How we sell it** | 50 browsable demos, real cart, Stripe test payments — prospects try before they buy |
| **How we ship it** | 1 repository and 1 Convex backend per client, cloned from `apps/themes` |
| **Who brings clients** | Independent affiliates, contract signed online, commissions tracked |

---

## The three applications

This is the first thing to understand: the repository holds **three distinct
Next.js applications**. They deploy to different places and serve different
audiences.

| App | Workspace | Audience | Where it runs |
| --- | --- | --- | --- |
| [`apps/site`](apps/site) | `@beyours/site` | Prospects, affiliates, internal team | Vercel → **beyours.fr** |
| [`apps/reference`](apps/reference) | `@beyours/reference` | Nobody — it is the engine's test bench | Local / preview |
| [`apps/themes`](apps/themes) | `@beyours/themes` | Each client restaurant, after cloning | Vercel, 1 project per client |

**`apps/site` — the commercial site.** Marketing pages, a catalogue of 52
templates, the Stripe checkout, the affiliate portal and the internal operations
console, across 37 routes. It depends on **none** of the engine packages: it is
a website, not an instance of the product.

**`apps/reference` — the reference application.** 98 routes wiring all ten
packages together: storefront, admin dashboard, CMS, kitchen display, QR games.
This is where an engine feature is built and proven before it is published. It
is sold to nobody.

**`apps/themes` — the client template.** The shippable counterpart of
`apps/reference`, plus everything the engine cannot carry: the client zone, the
51 design templates, the site-creation scripts, the 50 sales demos.

![Storefront demo](docs/captures/demo-storefront.png)

![Back-office demo](docs/captures/demo-admin.png)

---

## A push only builds what it touches

This is why the repositories were merged. Each app carries its own
`vercel.json`:

```json
{ "ignoreCommand": "npx turbo-ignore @beyours/<app>" }
```

Turbo follows the **dependency graph**, not the directory tree:

| What you change | site | reference | themes |
| --- | --- | --- | --- |
| `apps/site/**` | ✓ builds | ⏭ skipped | ⏭ skipped |
| `packages/ui/**` | ⏭ skipped | ✓ builds | ✓ builds |
| `apps/themes/**` | ⏭ skipped | ⏭ skipped | ✓ builds |

The site is spared by a change in `packages/ui` because it does not depend on
it — and only the graph knows that. A path-based rule would not have guessed.

⚠️ A change at the **root** (`package.json`, `pnpm-lock.yaml`, `turbo.json`)
invalidates everything, by construction. That is correct, but it means a
dependency bump rebuilds all three apps.

---

## Layout

```
apps/
  site/          Commercial site — marketing, catalogue, checkout, affiliates, console
  reference/     The engine's reference application (98 routes)
  themes/        The site shipped to clients — app + 51 templates + 50 demos
  docs/          31 pages of product documentation (markdown, not a workspace)

packages/        The 10 published packages — see below

.changeset/      Package versioning (the apps are excluded)
_project/        Historical architecture and design notes
tasks/           Runbooks: Uber Eats go-live, secret rotation, production audit
docs/captures/   Screenshots used by this README
```

---

## The engine packages

Ten packages published to **GitHub Packages** under the `@be-in-digital/*`
scope, versioned together by changesets.

| Package | Contents | Size | Shipped as |
| --- | --- | --- | --- |
| `admin` | Administration pages and components | 170 files · 31,500 lines | TS source |
| `convex-functions` | Convex backend functions | 65 files · 17,500 lines | TS source |
| `core` | Auth, i18n, AWS (S3/SES), env, Sentry | 41 files · 8,100 lines | `dist/` (tsup) |
| `integrations` | Uber Eats, Deliveroo | 28 files · 6,200 lines | `dist/` |
| `convex-schema` | Convex tables and validators | 32 files · 5,800 lines | TS source |
| `ui` | React components, design system | 57 files · 4,300 lines | `dist/` |
| `marketing` | Email, campaigns, segments | 13 files · 3,400 lines | `dist/` |
| `restaurant` | Business logic, hooks, Zustand stores | 25 files · 3,100 lines | `dist/` |
| `cms` | Block registry, validation, sanitisation | 14 files · 2,400 lines | `dist/` |
| `mcp-server` | MCP server exposing the package registry | 3 files · 1,600 lines | `dist/` |

**Three packages ship as raw TypeScript** — `admin`, `convex-functions` and
`convex-schema` point their `main` at `./src/index.ts`. This is deliberate: the
schema and functions must be read by the client's Convex compiler, and `admin`
carries Server Components that transpiling would break. Practical consequence:
**those three have no `build` task**, so a type error in them only surfaces
during `type-check` or in the build of the app that consumes them.

### The scope stays `@be-in-digital`

The repositories were renamed to `beyours-*`; the npm scope was not. Changing it
would break every client site on its next install. So it remains
`@be-in-digital/*` — a registry identifier, not a brand name.

---

## How a client site comes to life

```
packages/*                      published as @be-in-digital/* (changesets)
    │
    ├──► apps/reference         the test bench — where a feature is proven
    │
    └──► apps/themes            the site shipped to the client
              │  git clone (remote `template`)
              ▼
         client repository      1 repo + 1 Convex backend + 1 Vercel project
```

Creating a site, from a terminal:

```bash
beyours create client-luigi --name "Chez Luigi" --template pizzeria --repo be-in-digital/client-luigi
```

The command chains clone → `template` remote → private repo creation →
`pnpm install` → configuration (`site.config.ts`, secrets, `.env.local`) →
initial commit → push. Details in
[`apps/themes/README.md`](apps/themes/README.md).

### The distribution mirror

Clients do not clone this repository but
**`be-in-digital/beyours-boilerplate`**, because a client site cannot clone a
subdirectory of a monorepo: git clones whole repositories. The mirror is the
shippable cut.

[`scripts/publish-mirror.mjs`](scripts/publish-mirror.mjs) pushes to it, fixing
the four things that only make sense here:

| | In `apps/themes` | In the mirror |
| --- | --- | --- |
| Engine dependencies | `workspace:^` | `^2.0.2` — whatever is published |
| Lockfile | the root one | its own, regenerated |
| `vercel.json` | `turbo-ignore` | absent — no turbo workspace on the client side |
| `name` | `@beyours/themes` | `beyours-boilerplate` |

`.github/workflows/publish-mirror.yml` triggers on two events, because the
mirror can drift in two ways: a template change (push to `main` touching
`apps/themes/**`) and a package republication (end of the *Release* workflow).
`workflow_dispatch` allows an on-demand dry run.

Locally:

```bash
NODE_AUTH_TOKEN=<PAT read:packages> node scripts/publish-mirror.mjs --check
```

⚠️ The mirror is rebuilt in full on every run: **a commit made directly on it
disappears**. Its history, however, is preserved — never a force-push, because
every client site has a `template` remote pointing at it and merges from it.

Required secret: `MIRROR_PUSH_TOKEN`, a fine-grained PAT with `contents: write`
on `beyours-boilerplate`. Without it the job runs as a dry run and reports drift
without pushing — `GITHUB_TOKEN` is scoped to the current repository only.

### Two update channels, never just one

| Channel | Command | What it carries |
| --- | --- | --- |
| **npm** | `pnpm update:engine` | Business logic — the `@be-in-digital/*` packages, by semver |
| **git** | `pnpm update:template` | The application shell — routes, Convex wrappers, scripts, configs |

They are separate because they move at different speeds: a logic fix spreads
through a version bump, a new route requires a git merge. A site can take one
without the other.

---

## The maintenance model

The site is sold once, with **one year of maintenance included**, then renewed
annually. While the contract is covered, the client receives every update. Once
it expires, their deployment **stays frozen on the last release published before
`coveredUntil`**, and they can request a full migration of the site to the host
or team of their choice.

The logic lives in
[`packages/convex-functions/src/maintenance.ts`](packages/convex-functions/src/maintenance.ts):

```ts
export function isReleaseCovered(contract, releasedAt) {
  return releasedAt <= contract.coveredUntil
}
```

⚠️ **The freeze is not enforced client-side.** `update-template.mjs` runs a bare
`git fetch template`: nothing checks the contract before pulling commits. An
expired site that runs the command gets everything. The business model is
written; its guard is not.

---

## Naming: what gets renamed, and what never does

Three levels, not to be confused:

| | |
| --- | --- |
| **BeYours** | The restaurant product. Interfaces, emails, demos, documentation |
| **Be in Digital** | The agency's registered trade name, operated by the company |
| **TUUM AGENCY SAS** | The legal entity — SIREN 930 817 697, RCS Paris |

**Never run a global find-and-replace.** These occurrences of `beindigital` must
survive:

| Identifier | Why it does not move |
| --- | --- |
| `@be-in-digital/*` | npm registry scope — changing it breaks every client site |
| `.beindigital-site.json` | Init sentinel present in every deployed site |
| `beindigital-addresses` · `beindigital-favorites` | `localStorage` keys — renaming them wipes end customers' addresses and favourites |
| `beindigital-email-tracking` | A Configuration Set that exists in AWS SES |
| `integrator_brand_id: "beindigital"` | Identifier registered with Uber Eats |
| `utm_source=beindigital` | Unsplash attribution must match the registered app name |
| `com.beindigital.<slug>` | Bundle identifier — frozen once the app is published to the stores |
| `beindigital.fr` | The domain does belong to the agency |

And **`apps/site` is out of scope**: "Be in Digital" is the trade name that
affiliate contracts are **already signed** against, and clause 5.2 forbids
altering it. Everything flows from
[`apps/site/lib/legal/company.ts`](apps/site/lib/legal/company.ts) — never
duplicate that information elsewhere.

### Language

Everything in this repository is written in **English**: documentation, code
comments, commit messages, variable names. The one exception is **user-facing
content**, which is French — site copy, i18n catalogues, transactional emails,
the demos and the legal pages. The audience is French restaurant owners.

---

## Getting started

```bash
pnpm install
```

Requires **Node 20+** and **pnpm 10.4.1**.

No `NODE_AUTH_TOKEN` is needed here: inside the monorepo the apps consume the
packages through `workspace:^`, not from the registry. The token is only
required in a **client repository**, which installs from GitHub Packages.

```bash
pnpm dev:site          # commercial site
pnpm dev:reference     # reference application
pnpm dev:themes        # client template
```

Apps with a Convex backend need a second terminal (`convex dev` from the app
directory). Each app documents its own startup:

- [`apps/site/README.md`](apps/site/README.md)
- [`apps/themes/README.md`](apps/themes/README.md)
- [`apps/docs/`](apps/docs) — 31 pages: product guides, API reference, deployment

---

## Commands

| Command | Effect |
| --- | --- |
| `pnpm build` | Builds everything, in graph order |
| `pnpm lint` · `pnpm type-check` | Quality, across the 13 workspaces |
| `pnpm test` | Vitest — 56 files: 48 in packages, 6 on the site, 2 on the reference app |
| `pnpm test:e2e` | Playwright — 43 specs on the reference app, 43 on the template, 1 on the site |
| `pnpm changeset` | Declares a package change (required to publish) |
| `pnpm format` | Prettier |

Turbo caches: a second run with no changes re-executes nothing.

---

## Publishing the packages

1. `pnpm changeset` — describe the change, pick patch / minor / major
2. Commit the generated file under `.changeset/`
3. Merge to `main`

The `release.yml` workflow then opens a "chore(release): version packages" pull
request. **Merging it publishes** to GitHub Packages and updates the
`CHANGELOG.md` files.

All three apps are excluded from versioning (`.changeset/config.json`): they are
not published, they are deployed.

---

## CI

| Workflow | What it does |
| --- | --- |
| `ci.yml` | lint · type-check · test · build, on PRs and pushes to `main` |
| `e2e.yml` | Playwright on the reference app, in four shards, on PRs · pushes to `main` · the merge queue. No gate and no `E2E_*` secrets: the job starts its own Convex backend. ~536 tests, 16-19 min |
| `release.yml` | changesets — version PR, then publication |
| `publish-mirror.yml` | Pushes `apps/themes` to the distribution mirror |
| `security.yml` | gitleaks over full history + `pnpm audit`, plus a daily run |

**Five checks block a merge.** `main` requires `Lint`, `Type Check`, `Test` and
`Build` — the four job names from `ci.yml` — plus `E2E Status` from `e2e.yml`.
Since 3 September 2026 the protection is a **ruleset**, not classic branch
protection, so `GET /branches/main/protection` answers `404 Branch not protected`
while the branch is very much protected; read the rules at
`/rules/branches/main`. No approving review is required, and admins can bypass.

*Require branches to be up to date* is **off**. A merge queue builds the
prospective merged state and runs these same checks against it, which is the
same guarantee without asking every author to rebase behind every merge.

The required E2E check is `E2E Status`, never `E2E Tests`. `E2E Status` is a
one-step aggregate over the four shards and the report job, and it fails on
anything that is not a real pass — `failure`, `cancelled` and `skipped` alike.
Requiring a *shard* instead would be the old trap: a job that does not run
reports `skipped`, and GitHub counts a skip as satisfied.

Deliberately **not** required: the two `security.yml` checks — a new advisory in
an untouched dependency would block unrelated merges. The reasoning behind each
choice is `tasks/ci-required-checks-runbook.md` §5–§6.

⚠️ **A job that fails in ~3 seconds having run zero steps is a billing block,
not a defect.** The Free plan's 2,000 Actions minutes ran out in July and again
on 27–28 August 2026; every workflow on every branch dies at once with "recent
account payments have failed or your spending limit needs to be increased", and
`gh api …/actions/jobs/<id>` shows `steps: []`. Check that signature before
debugging code that is fine. Once billing is settled, `gh run rerun <id>` is
enough — do not push an empty commit. In the meantime verify locally:
`pnpm lint`, `pnpm type-check`, `pnpm test`, `pnpm build`.

---

## Deployment

| Vercel project | Team | Source | Root Directory |
| --- | --- | --- | --- |
| `beindigital-restaurant` | `be-in-digital` | this repo, `main` branch → **beyours.fr** | `apps/site` |
| 1 project per client | `be-in-digital` | the client's cloned repository | root |

Convex is pushed separately, from the app directory: `npx convex deploy`. Each
client has **their own Convex deployment** — data isolation is structural, not
enforced in application code.

### Convex deployments

The authoritative inventory. Re-measured 2026-09-01, after the cutover to the
dedicated company account **and** after the project transfer that finished it.

**Everything the product runs on is now on team `be-yours`.** The site's backend
got there by *transfer*, not by migration: the project moved teams, the
deployment did not move at all. Same `famous-wildcat-229`, same URLs, same env
vars, same data, same deploy keys — nothing was re-wired on Vercel or Stripe, and
the site served traffic throughout.

#### On `be-yours` — what runs the product

| Deployment | App | Role | Convex project |
| --- | --- | --- | --- |
| `famous-wildcat-229` | `apps/site` | **production** — beyours.fr | `beyours-commercial-site` |
| `hallowed-schnauzer-20` | `apps/site` | dev (`dev/mamadou-seck`) | `beyours-commercial-site` |
| `optimistic-swordfish-937` | `apps/reference` | **production** — the engine, incl. Stripe BID billing | `beyours-engine-reference` |
| `dusty-nightingale-945` | — | **empty and unused** — see below | `beyours-commercial-site` |
| `zany-barracuda-114` | `apps/themes` | **the shared demo backend** — one for every template's demo; not yet deployed | `beyours-client-template` |

#### Still on `momoseck8` — none of it serves anything

| Deployment | Former role | `/version` |
| --- | --- | --- |
| `robust-elephant-263` | former production of the engine | `200` |
| `fearless-poodle-133` | former production of beyours.fr | `200` |
| `capable-crocodile-720` | dev, `apps/site` | `200` |
| `reliable-parrot-452` | dev — personal (`dev/mamadou-seck`) | `200` |
| `youthful-goose-352` | stray dev | `200` |
| `happy-otter-123` | dead — caused bug #6 | `404` |

#### One name, three systems — and only one of them was renamed

The Convex project that holds `famous-wildcat-229` was called
`beindigital-restaurant` until 2026-09-01, when it was renamed to
**`beyours-commercial-site`** (name and slug) after the empty project of that
name was deleted. Renaming a Convex project does not touch its deployments:
`famous-wildcat-229` is still `famous-wildcat-229`, the URLs are unchanged, and
nothing was re-wired. It was safe to change the slug too because the project had
no deploy keys, production or preview — the dashboard warns that a slug change
invalidates any key in use.

`beindigital-restaurant` still exists, and means two other things:

| Where | What it is |
| --- | --- |
| GitHub | the repository, `be-in-digital/beindigital-restaurant` |
| Vercel | the project that builds `apps/site` |
| ~~Convex~~ | **renamed** — now `beyours-commercial-site` |

So a search for that name will keep returning hits. They are not stale; they are
about the other two systems.

#### How each row was established

- **Measured 2026-09-01.** Every `/version`: unauthenticated
  `GET https://<name>.convex.cloud/version`. Project, team and role for the
  `be-yours` rows: read off the dashboard's deployment list. The five
  `momoseck8` rows: the CLI logged into `be-yours` is **refused** on each, which
  is what "still on the other account" means here.
- **The transfer, verified twice.** The dashboard lists
  the transferred project under `be-yours`, and the same CLI that was refused
  `famous-wildcat-229` an hour earlier now reads its 27 environment variables.
- **The site's project and `hallowed-schnauzer-20` had never been written
  down anywhere.** The site's real backend was found by reading the served
  production bundle, not by reading this repository.

#### Two things this leaves open

**`dusty-nightingale-945` is a redundant empty project.** It was created for the
cutover, has the schema and 139 functions deployed, and holds **no documents at
all**. The site never moved onto it and no longer needs to. Deleting
`beyours-commercial-site` is the tidy-up; keeping it is a second empty project
someone will mistake for production one day.

**`zany-barracuda-114` is the shared demo backend, and has not been deployed to
yet.** Decided 2026-09-01: every template's demo — the sites a prospect browses
to try a design — points at this one deployment, because a backend per design
would be a deployment per colour scheme. It answers `200` because Convex
provisions a backend before anything is pushed to it, so it holds no functions
until the template is deployed there.

A theme that is **sold** still gets its own repository and its own Convex
deployment. That is unchanged, and it is what keeps client data isolation
structural instead of a filter someone has to remember.

**The six old deployments are still up.** Five answer `200` and serve nothing.
Decommissioning them is
[`tasks/convex-account-cutover-runbook.md`](tasks/convex-account-cutover-runbook.md)
§4, and it is not done.

**`youthful-goose-352` is not in this project.** `beindigital-engine` contains
only the two deployments above, so the `beyours-reference` project is genuinely
separate — the signature of an `npx convex dev` run on 2026-08-27 (#79) with no
`CONVEX_DEPLOYMENT` set, which creates a fresh project rather than joining the
existing one. It shares no env vars with either deployment above. It *is* on team
`momoseck8`, so it consumes the same included resources as production without
anything depending on it.

**Both production backends share one disable threshold.** `fearless-poodle-133`
(beyours.fr — the site prospects buy from) and `robust-elephant-263` (the engine
— client restaurants, plus Stripe BID billing) are different projects but the
same team, and Convex spending caps apply **per team**. One threshold crossed
takes down the shop and the product together. That is the single most important
line in this table; the procedure is in the
[spending-cap runbook](tasks/convex-spending-cap-runbook.md).

#### What a `200` does and does not prove

All five live deployments answer with the **identical** build stamp
(`20260824T183734Z-bd777bce25d6`) — including `fearless-poodle-133` and
`reliable-parrot-452`, which are definitively in different projects. `/version`
is served by the platform, not by your functions, so:

- A `404` is a definite red: the name resolves to nothing.
- A `200` proves only that *some* live Convex backend answers on that subdomain.
  It does **not** prove the deployment is ours, which team it is on, which
  project it belongs to, or that its functions are working.

So the probe never filled in the Team and Convex project columns above — the
dashboard did. Where a cell still reads *unrecorded*, it is because nobody has
looked yet, not because a `200` was taken as an answer.

#### Settled: `robust-elephant-263` is ours

Confirmed in the Convex dashboard on 2026-08-28. It is the **production
deployment of project `beindigital-engine`** — the same project whose dev
deployment is `reliable-parrot-452`. The name was introduced on 2026-03-03 in
`3ba27b3`, the commit that added the Stripe BID subscription system, and then
never written down a second time, which is why nothing in the repository could
corroborate it.

Two consequences:

- [`apps/reference/MISE_EN_PROD.md`](apps/reference/MISE_EN_PROD.md) §1 no longer
  asks you to create a production deployment. It exists; the remaining work there
  is copying env vars onto it with live values.
- [Card 10](tasks/clickup-technique-cards.md) (the nine live Stripe BID
  variables) has its target: `robust-elephant-263`, reached with `--prod` from
  `apps/reference`. Run `pnpx convex env list --prod` first and read what it
  prints — `--prod` resolves through the local `CONVEX_DEPLOYMENT`, and a
  checkout linked to `beyours-reference` would silently aim at the wrong project.

#### Still open

- **Delete the `beyours-reference` project** — decided 2026-08-28. It holds one
  stray dev deployment (`youthful-goose-352`) that nothing depends on, and draws
  against the same included resources as production. This is a dashboard action
  for the team owner: <https://dashboard.convex.dev> → project → Settings →
  Delete. Deleting a project deletes its deployments and their data, so confirm
  nobody's local checkout is still linked to it first (`npx convex env list` from
  `apps/reference` prints the deployment it resolves).

  The cause is fixed: with no `CONVEX_DEPLOYMENT` set, `npx convex dev` offers to
  create a new project and proposes a name derived from the package —
  `@beyours/reference` → `beyours-reference`. `apps/reference/.env.example` now
  says to pick the existing `beindigital-engine` instead.
- **`capable-crocodile-720`'s project** has never been recorded anywhere.

### Rolling back

The project was reconnected to this repository on 2026-08-16; it previously
built the standalone `be-in-digital/beyours` repository with Root Directory at
the root.

**Fastest path, and the one to reach for first:** promote deployment
`dpl_5cZtp6nZ3j8e4Mzv7GQHtj12N9BQ` from the Vercel dashboard. That is the last
production build served from the old configuration — it restores the site
immediately, with no rebuild and no repository involved.

**Full path**, if the site has to keep deploying from the old repository:

```bash
gh repo unarchive be-in-digital/beyours                       # archived 2026-08-16
vercel project update beindigital-restaurant --auto-detect root-directory --scope be-in-digital
vercel git connect https://github.com/be-in-digital/beyours --scope be-in-digital
```

`be-in-digital/beyours` was archived once its history had been verified as
fully reachable from this repository (`apps/site`, brought in with
`git subtree`). It is read-only, kept only as this rollback path — nothing
builds it any more.

---

## Things to watch

**The site's demo storefront is a reimplementation.**
`apps/site/lib/template-storefront.ts` shares no code with `apps/themes`, the
product actually shipped. A prospect therefore tries something other than what
they buy, and the two drift apart with every change. This is the main open
architectural issue in the repository.

**The catalogue exists in three copies.** 52 entries in
`apps/site/lib/templates-data.ts`, 51 directories in `apps/themes/templates/`,
50 demos in `apps/themes/demos/`. Three lists that no test reconciles.

**A commit made directly on the mirror is lost.**
`be-in-digital/beyours-boilerplate` is rebuilt in full on every sync (see
[The distribution mirror](#the-distribution-mirror)). All changes belong here,
in `apps/themes`.

**11 Deliveroo integration tests never run.** The files
`apps/reference/e2e/deliveroo/**/*.test.ts` fall into a blind spot: Vitest
excludes `**/e2e/**`, and the Playwright projects only match `*.spec.ts`.
Neither runner sees them. Verified: `playwright test --list` returns none of
them. Rename them to `.spec.ts` and wire them to a project, or move them out of
`e2e/`.

**32 routes under `apps/reference/app/(admin)/` are redirects** to
`/dashboard/*`. They are historical aliases, not duplicates: do not try to merge
them.

---

## History

This repository was called `beindigital`, then `beyours-engine`, and is now
`beyours`. Until August 2026 it hosted the engine **and** both of the company's
websites.

The August 2026 split first moved the four projects into four repositories, then
regrouped the three that belong to BeYours — the site, the engine, the template
— into this one, with their full history (`git subtree`). `beyours-engine` was
then dropped as a name: the repository is no longer just the engine. The agency
site went its own way, to
[`beindigital.fr`](https://github.com/be-in-digital/beindigital.fr): different
brand, different business, no code dependency.

`be-in-digital/beyours-legacy-site` is the archived, read-only remains of the
standalone site repository. It was renamed out of the way to free the `beyours`
name; its history is fully reachable here through `apps/site`.

⚠️ **Four repository names were freed by those renames:** `beindigital`,
`beindigital-engine`, `beindigital-boilerplate`, `beyours-engine`. Scripts in
production rely on the associated GitHub redirects. **Do not recreate any of
them** — creating a repository under one of those names silently destroys the
redirect.

---

## Picking up the project

In order, arriving with no context:

1. This README, then [`apps/docs/getting-started/introduction.md`](apps/docs/getting-started/introduction.md).
2. The [Naming](#naming-what-gets-renamed-and-what-never-does) section, before touching anything that carries a name.
3. `pnpm install && pnpm dev:reference` — the reference app is the shortest path to seeing the whole product run.
4. `packages/convex-schema/src/` for the data model, `packages/convex-functions/src/` for what acts on it.
5. Open `apps/themes/demos/index.html` in a browser: that is what a prospect sees, and it works offline.
