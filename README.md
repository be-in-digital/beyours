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
| `e2e.yml` | Playwright on the reference app, if the `E2E_*` secrets exist |
| `release.yml` | changesets — version PR, then publication |
| `publish-mirror.yml` | Pushes `apps/themes` to the distribution mirror |
| `security.yml` | gitleaks over full history + `pnpm audit`, plus a daily run |

⚠️ **The GitHub Actions minutes on the Free plan (2,000/month for private
repositories) are exhausted** — the quota was exceeded in July and August 2026.
Jobs fail within seconds without running a single step, so a red cross on a PR
says nothing about the code. Verify locally (`pnpm lint`, `pnpm type-check`,
`pnpm test`, `pnpm build`) until the monthly reset or a raised spending limit.

---

## Deployment

| Vercel project | Team | Source | Root Directory |
| --- | --- | --- | --- |
| `beindigital-restaurant` | `be-in-digital` | this repo, `main` branch → **beyours.fr** | `apps/site` |
| 1 project per client | `be-in-digital` | the client's cloned repository | root |

Convex is pushed separately, from the app directory: `npx convex deploy`. Each
client has **their own Convex deployment** — data isolation is structural, not
enforced in application code.

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

This repository was called `beindigital`, then `beyours-engine`. Until August
2026 it hosted the engine **and** both of the company's websites.

The August 2026 split first moved the four projects into four repositories, then
regrouped the three that belong to BeYours — the site, the engine, the template
— into this one, with their full history (`git subtree`). The agency site went
its own way, to
[`beindigital.fr`](https://github.com/be-in-digital/beindigital.fr): different
brand, different business, no code dependency.

⚠️ **Three repository names were freed by those renames:** `beindigital`,
`beindigital-engine`, `beindigital-boilerplate`. Scripts in production rely on
the associated GitHub redirects. **Do not recreate any of them** — creating a
repository under one of those names silently destroys the redirect.

---

## Picking up the project

In order, arriving with no context:

1. This README, then [`apps/docs/getting-started/introduction.md`](apps/docs/getting-started/introduction.md).
2. The [Naming](#naming-what-gets-renamed-and-what-never-does) section, before touching anything that carries a name.
3. `pnpm install && pnpm dev:reference` — the reference app is the shortest path to seeing the whole product run.
4. `packages/convex-schema/src/` for the data model, `packages/convex-functions/src/` for what acts on it.
5. Open `apps/themes/demos/index.html` in a browser: that is what a prospect sees, and it works offline.
