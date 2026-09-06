# Deployment

Where each part of this repository runs, what has to exist before it can run there,
and which runbook to open when something has to be done by hand.

**Checked against the tree at `158019f` (5 September 2026).** Companion files:
[`ARCHITECTURE.md`](ARCHITECTURE.md) for how the pieces fit,
[`TESTING.md`](TESTING.md) for what gates a merge, [`README.md`](README.md) for the
measured Convex inventory.

> **This file names variables. It never carries a value.** No token, key, secret,
> connection string or internal hostname belongs in repository documentation — the
> runbooks it links to are written to the same rule, and each says so at the top.
> If you need a value, it is in Infisical, in a provider console, or in the client's
> own deployment.

---

## 1. What gets deployed, and where

| Artefact | Target | Trigger |
| --- | --- | --- |
| `apps/site` | Vercel project `beindigital-restaurant`, team `be-in-digital` → **beyours.fr** | push to `main` |
| `apps/site/convex` | Convex deployment `famous-wildcat-229` | `npx convex deploy` from `apps/site` |
| `apps/reference` | No production target. Local and preview only | — |
| `apps/reference/convex` | Convex deployment `optimistic-swordfish-937` | `npx convex deploy` from `apps/reference` |
| `apps/themes` | One Vercel project **per client**, from that client's own repository | push to the client's `main` |
| `apps/themes/convex` | One Convex deployment **per client** | `npx convex deploy` from the client's clone |
| `apps/themes/demos` | Its own Vercel deployment, `noindex` (`apps/themes/demos/vercel.json`) | with the template |
| `packages/*` | GitHub Packages, `@be-in-digital/*` | merging the changesets version PR |
| `apps/themes` (as a tree) | `be-in-digital/beyours-boilerplate`, the distribution mirror | `publish-mirror.yml` |

`apps/reference` deploys to nothing in production. It is the bench.

---

## 2. Vercel

Each app carries `vercel.json` with an ignore command:

```json
{ "ignoreCommand": "npx turbo-ignore @beyours/<app>" }
```

Turbo follows the dependency graph, so a change in `packages/ui` builds `reference`
and `themes` and skips `site`. A change at the repository root invalidates everything.
See [`ARCHITECTURE.md`](ARCHITECTURE.md#3-a-push-only-builds-what-it-touches).

Setup for a client project — the Root Directory, the `NODE_AUTH_TOKEN` needed to
install `@be-in-digital/*` from GitHub Packages, custom domains — is
[`apps/docs/deployment/vercel.md`](apps/docs/deployment/vercel.md) and
[`apps/docs/deployment/github-packages.md`](apps/docs/deployment/github-packages.md).
Both are current; do not duplicate their steps here.

One thing worth restating because it bites: **inside the monorepo no
`NODE_AUTH_TOKEN` is needed** — the apps consume the packages through `workspace:^`.
The token is required in a **client repository**, which installs from the registry.
`apps/themes` enforces this with a `preinstall` script
(`apps/themes/scripts/check-node-auth-token.mjs`), which is why a fresh clone that is
missing the token fails early and legibly instead of at a resolution error.

---

## 3. Convex

**One Convex deployment per client.** Data isolation is structural: nothing points a
second restaurant at a first one's backend. It is not a filter someone has to
remember, and it is not row-level. A theme that is *sold* gets its own repository and
its own deployment; the demos share one.

Convex is pushed separately from Vercel, from the app directory:

```bash
npx convex deploy          # the deployment the local CONVEX_DEPLOYMENT resolves to
npx convex env list        # read it back — always do this before --prod
```

**`--prod` resolves through the local `CONVEX_DEPLOYMENT`.** A checkout linked to the
wrong project silently aims at the wrong backend. Run `npx convex env list --prod`
and read what it prints before any write.

The authoritative, measured deployment inventory — which deployment serves what,
which team owns it, which ones answer `200` and serve nothing — is
[`README.md` § Convex deployments](README.md#convex-deployments), re-measured
2026-09-01. It is not repeated here, because a second copy would drift from it. Four
facts from it that change what you do:

- **beyours.fr runs on `famous-wildcat-229`**, project `beyours-commercial-site`. The
  project was *transferred* between teams, not migrated: same deployment, same URLs,
  same env vars, same data.
- **`dusty-nightingale-945` is an empty, unused project.** It has the schema and the
  functions deployed and holds no documents at all. Do not mistake it for production.
- **`zany-barracuda-114` is the shared demo backend** — one backend for every
  template's demo, because a backend per design would be a deployment per colour
  scheme. Not yet deployed to.
- **A `200` on `/version` proves almost nothing.** It is served by the platform, not
  by your functions: it does not prove the deployment is ours, which team it is on,
  or that its functions work. A `404` is a definite red. Fill in the team and project
  columns from the dashboard, never from a probe.

Spending caps apply **per team**, so two production backends on one team share a
single disable threshold — one crossed takes down both. Procedure:
[`tasks/convex-spending-cap-runbook.md`](tasks/convex-spending-cap-runbook.md).
Decommissioning the six superseded deployments is
[`tasks/convex-account-cutover-runbook.md`](tasks/convex-account-cutover-runbook.md)
§4, and it is **not done**.

---

## 4. Environment

Three tiers, defined in `packages/core/src/env/schemas.ts` and enforced at boot by
`apps/*/instrumentation.ts`, which calls `validateAllEnv()` and **throws in
production** when anything is missing.

### The required tier — a deployment will not boot without these

`packages/core/src/env/schemas.ts:69-106`. Ten variables, none of them routed through
the `opt()` helper, so an `.env` copied from the template and left unfilled fails
here rather than silently at the client:

| Variable | What is broken without it |
| --- | --- |
| `NEXT_PUBLIC_CONVEX_URL` | No backend — every query hangs |
| `CONVEX_SITE_URL` | Webhook and OAuth callback URLs point nowhere |
| `SITE_URL` | Password reset returns early, mail never sent |
| `BETTER_AUTH_SECRET` | Same early return; sessions unsignable. Minimum 32 chars |
| `ENCRYPTION_KEY` | OAuth tokens cannot be stored at rest. 64 hex chars |
| `AWS_REGION`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` | No AWS at all |
| `AWS_S3_BUCKET_NAME` | No upload target |
| `AWS_SES_FROM_EMAIL` | No transactional mail leaves the deployment |

`AWS_S3_PUBLIC_BASE_URL` is deliberately **not** required: unset means media is served
through the app's own `/api/files` proxy, which is a supported configuration. Set it
only to name a CDN fronting the bucket.

### Feature groups — all or nothing

`SITE_FEATURE_GROUPS` (`schemas.ts:249` onward). Half a payment provider is worse than
none: the admin offers the method, the customer picks it, and the charge fails at the
till. Setting **any** variable in a group makes the whole group required at boot.

| Feature | Variables |
| --- | --- |
| Stripe (restaurant payments) | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` |
| PayPal | `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET` |
| SumUp | `SUMUP_CLIENT_ID`, `SUMUP_CLIENT_SECRET` |
| BeYours billing (maintenance renewal) | `STRIPE_BID_SECRET_KEY`, `STRIPE_BID_WEBHOOK_SECRET`, `BID_APP_URL` |
| Sentry source maps | `SENTRY_ORG`, `SENTRY_PROJECT`, `SENTRY_AUTH_TOKEN` |

`STRIPE_PUBLISHABLE_KEY` is deliberately outside the Stripe group: no line of the
product reads it today, so demanding it would gate a deploy on a value nothing
consumes. The Sentry **DSN** is deliberately outside its group too — a DSN on its own
is a complete, working configuration; it is the source-map upload that is
all-or-nothing.

Sandbox flags fail **closed**: `PAYPAL_SANDBOX_MODE`, `UBER_EATS_SANDBOX_MODE` and
`DELIVEROO_IS_SANDBOX` resolve to SANDBOX when unset, never to production
(`packages/core/src/env/sandbox.ts`).

### Where each value lives

| Kind | Where it lives | Owner |
| --- | --- | --- |
| Platform credentials (`OPENAI_API_KEY`, Uber Eats / Deliveroo partner apps) | Infisical `/platform`, then each deployment | BeYours |
| `apps/site` values | Infisical `/site` | BeYours |
| `apps/reference` values | Infisical `/reference` | BeYours |
| Template defaults | Infisical `/themes` (Next side + Convex side) | BeYours |
| Shared demo instance | Infisical `/demo` | BeYours |
| A client's AWS, Stripe, Convex, Sentry values | **That client's own deployment** | The client |

The Infisical project, its scopes and the reasoning are
[`apps/docs/deployment/infisical.md`](apps/docs/deployment/infisical.md);
`scripts/infisical-bootstrap.mjs` implements `check`, `plan`, `seed`, `migrate`,
`run` and `scopes` against them, and `pnpm dev:site:env` / `dev:reference:env` /
`dev:themes:env` / `dev:demo:env` run a dev server with a scope loaded.

Note the boundary: **what is shared is what was always ours.** A client's own
credentials never enter this store.

Inside a client's clone, `apps/themes/scripts/env.mjs` manages the three env files
together — `.env.local` (Next, the source of truth), `.env.convex` (the shared subset
pushed by `pnpm convex:env`) and `mobile/.env`:

```bash
pnpm env:setup    # wizard: required vars, then each integration
pnpm env:check    # what is missing, and which groups are half-configured
pnpm env:sync     # propagate .env.local → .env.convex + mobile/.env
```

Its `REQUIRED` / `GROUPS` / `CONVEX_KEYS` lists mirror the Zod schemas in
`packages/core/src/env/schemas.ts`; keep them in step when the engine changes.

Full variable-by-variable reference:
[`apps/docs/deployment/environment-variables.md`](apps/docs/deployment/environment-variables.md).
`_project/ENVIRONMENT_VARIABLES.md` is the older, historical version of the same
material — read the `apps/docs` one first.

### Two variables a fresh deployment cannot set for itself

`ADMIN_BOOTSTRAP_TOKEN` claims the **first** super-admin seat: provisioning a
`userProfiles` record requires a super admin, and a fresh deployment has none, so the
first seat has to come from outside the permission system. It fails closed — unset
refuses everyone — and it goes on the **Convex** deployment, not on Vercel.

`NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` is a billing-drain vector until it is restricted.

Both, with the click paths and an executable companion
(`scripts/wizards/github-e2e-maps-bootstrap.sh --check`, which writes nothing and
distinguishes *outstanding* from *unverified*), are
[`apps/docs/deployment/first-administrator.md`](apps/docs/deployment/first-administrator.md).

---

## 5. Publishing the packages

1. `pnpm changeset` — describe the change, pick patch / minor / major
2. Commit the generated file under `.changeset/`
3. Merge to `main`

`release.yml` then runs. Two things about it are not obvious from the outside:

**Versioning is a human step.** The workflow does **not** open the "version packages"
pull request — this GitHub enterprise forbids Actions from creating pull requests
outright, and no repository setting can grant it. `changeset publish` instead compares
the versions on `main` against the registry and pushes whatever is missing, so a
merged version bump releases itself. With nothing to do it prints "No unpublished
projects to publish" and exits 0. The manual versioning step is written up in
[`apps/docs/deployment/github-packages.md`](apps/docs/deployment/github-packages.md).

**The release chain gates on four of the five required checks.** `release.yml` calls
`ci.yml` through `workflow_call`, covering `Lint`, `Type Check`, `Test` and `Build`.
`E2E Status` lives in `e2e.yml`, which the chain never calls, so a red or
still-running E2E suite does not stop a publish. Recorded in the workflow header and
tracked as #308. See [`TESTING.md`](TESTING.md#4-ci).

All three apps are excluded from versioning (`.changeset/config.json`): they are not
published, they are deployed.

---

## 6. The distribution mirror

Clients do not clone this repository. They clone
**`be-in-digital/beyours-boilerplate`**, because a client site cannot clone a
subdirectory of a monorepo — git clones whole repositories. The mirror is the
shippable cut of `apps/themes`.

`scripts/publish-mirror.mjs` rewrites the four things that only make sense here:

| | In `apps/themes` | In the mirror |
| --- | --- | --- |
| Engine dependencies | `workspace:^` | the published versions |
| Lockfile | the root one | its own, regenerated |
| `vercel.json` | `turbo-ignore` | absent — no turbo workspace client-side |
| `name` | `@beyours/themes` | `beyours-boilerplate` |

`publish-mirror.yml` fires on two events, because the mirror drifts in two ways: a
template change (push to `main` touching `apps/themes/**`) and a package
republication (completion of *Release*). `workflow_dispatch` offers an on-demand dry
run. Locally:

```bash
NODE_AUTH_TOKEN=<PAT with read:packages> node scripts/publish-mirror.mjs --check
```

Four operational facts:

- **A sync refuses to run if the pinned versions cannot resolve what the template
  imports.** CI builds `apps/themes` against `packages/*` at HEAD through the
  workspace link; a client installs the tarballs pinned from the registry. A
  subpath added to a package's `exports` without a version bump exists in the
  first and not the second, so every required check stays green while a client
  clone dies at `next build` with `ERR_PACKAGE_PATH_NOT_EXPORTED`. The gate reads
  each published `exports` map out of the **tarball** (`npm pack`), because GitHub
  Packages omits the field from the packument `npm view` reads — trusting that
  silence is what made this check a no-op until #380. A lookup that fails is
  reported as unknown and also stops the sync: if it says the exports could not be
  read, check `NODE_AUTH_TOKEN` and the registry rather than the template. The fix
  for a genuine mismatch is to release the engine first, never to delete the
  import.
- **The mirror is rebuilt in full on every run: a commit made directly on it
  disappears.** All changes belong here, in `apps/themes`.
- **Its history is preserved — never a force-push.** Every client site has a
  `template` remote pointing at it and merges from it.
- **Required secret: `MIRROR_PUSH_TOKEN`**, a fine-grained PAT with `contents: write`
  on `beyours-boilerplate`. Without it the job runs as a dry run and reports drift
  without pushing — `GITHUB_TOKEN` is scoped to the current repository only. The job
  has a 15-minute ceiling because the failure that mattered once did not fail: pnpm
  hung, the job sat until somebody cancelled it fifty minutes later, and `cancelled`
  is neither a pass nor a failure — the mirror went twelve days without a sync and no
  run ever said so.

`pnpm check:mirror-css`, which runs inside the required `Lint` job, is the only check
that compiles what a **client** builds rather than what this repository builds. See
[`TESTING.md`](TESTING.md#4-ci).

---

## 7. A client site, end to end

```
beyours create client-luigi --name "Chez Luigi" --template pizzeria \
  --repo be-in-digital/client-luigi
```

The `beyours` wrapper (`apps/themes/scripts/beyours`) fetches its scripts from the
boilerplate on every call, so it picks up template updates without reinstalling. The
same work is `node scripts/create-site.mjs <dir> [options]` from a clone; it can also
be piped straight from the boilerplate without cloning first. Steps: clone → add the
`template` remote → create the private GitHub repo → `pnpm install` →
`pnpm setup --yes` (writes `site.config.ts`, secrets, `.env.local`) → initial commit →
push. Details: [`apps/themes/README.md`](apps/themes/README.md).

Then, in order:

1. **AWS, on day one.** Every client gets its **own AWS account** — S3 bucket, SES
   identity and IAM user, all following them if they leave, the same rule that
   already governs their Convex deployment, Sentry project and Stripe account. Start
   it first, not because it is long to do but because it ends in a queue at AWS that
   nobody can hurry (SES production access). Runbook:
   [`tasks/client-aws-onboarding-runbook.md`](tasks/client-aws-onboarding-runbook.md);
   rationale: [`apps/docs/deployment/aws-ownership.md`](apps/docs/deployment/aws-ownership.md).
2. **The S3 bucket is private.** No object is readable without credentials; media
   reaches the browser through `/api/files` or through a CDN fronting the bucket.
   Both answers used to coexist in the product and each broke half of it. Reasoning:
   [`apps/docs/deployment/s3-bucket-policy.md`](apps/docs/deployment/s3-bucket-policy.md).
3. **Sentry: one project per client.** The DSN is the isolation — a restaurant's
   errors, its quota and its retention stay its own.
   [`apps/docs/deployment/sentry.md`](apps/docs/deployment/sentry.md).
4. **The first administrator**, then the Maps key restriction (§4).
5. **Licence key registration**:
   [`tasks/license-key-registration-runbook.md`](tasks/license-key-registration-runbook.md).

**Offboarding is not automatic.** `saFleet.updateStatus`
(`apps/site/convex/saFleet.ts:252`) patches `status: "offboarded"`, stamps
`offboardedAt` and writes an activity row. That is the whole of it: no key rotation,
no teardown, no access revocation — the deployment keeps every credential it was
provisioned with. The date is stamped precisely so the console can show that
revocation is still outstanding rather than letting the "Sorti" badge read as done.
What to revoke and in what order is
[`tasks/client-offboarding-runbook.md`](tasks/client-offboarding-runbook.md).

**Two update channels, never just one:**

| Channel | Command | Carries |
| --- | --- | --- |
| npm | `pnpm update:engine` | Business logic — the `@be-in-digital/*` packages, by semver |
| git | `pnpm update:template` | The application shell — routes, Convex wrappers, scripts, configs |

A site can take one without the other. **The maintenance freeze is not enforced
client-side**: `update-template.mjs` runs a bare `git fetch template` and nothing
checks the contract before pulling commits, so an expired site that runs the command
gets everything. The business model is written; its guard is not.

---

## 8. Rolling back beyours.fr

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

`be-in-digital/beyours` was archived once its history had been verified as fully
reachable from this repository (`apps/site`, brought in with `git subtree`). It is
read-only and kept only as this rollback path.

For a client site, rollback is the client's own Vercel project: promote the previous
deployment there. A Convex rollback is a redeploy of the previous functions from a
checkout at the previous commit — Convex has no promote button, so the git history is
the rollback mechanism.

---

## 9. Secret hygiene

- **Never commit a value.** `security.yml` runs gitleaks over the full history plus
  `pnpm audit`, on pushes and pull requests against `main` and daily at 03:00 UTC.
  Neither of its checks is a required check on `main`, on purpose: a new advisory in
  a dependency nobody touched would block unrelated merges. That makes the nightly
  run the one that matters — read it.
- **Rotation is not one action.** For a partner-app credential the value lives in the
  Convex env of *every* deployment, plus Vercel, plus GitHub Secrets, plus every
  laptop that ever ran the app. That cost is what Infisical exists to reduce.
  Procedure, including the git-history purge:
  [`tasks/secret-rotation-runbook.md`](tasks/secret-rotation-runbook.md).
- **One rotation is still open and urgent** — the exposed Deliveroo sandbox
  credential, LAUNCH-01 in
  [`tasks/sales-readiness-backlog.md`](tasks/sales-readiness-backlog.md).
- **Personal data has its own procedure**:
  [`tasks/gdpr-erasure-runbook.md`](tasks/gdpr-erasure-runbook.md).

---

## 10. Runbook index

Operational procedures live in `tasks/`. Each is self-contained, and most open by
stating that they contain no credential —
`grep -li "no credential\|no secret" tasks/*.md` lists ten of them.

| File | When to open it |
| --- | --- |
| [`client-aws-onboarding-runbook.md`](tasks/client-aws-onboarding-runbook.md) | New client, day one |
| [`client-offboarding-runbook.md`](tasks/client-offboarding-runbook.md) | A client leaves |
| [`license-key-registration-runbook.md`](tasks/license-key-registration-runbook.md) | Registering a site's licence |
| [`convex-account-cutover-runbook.md`](tasks/convex-account-cutover-runbook.md) | Moving or decommissioning a Convex deployment |
| [`convex-spending-cap-runbook.md`](tasks/convex-spending-cap-runbook.md) | Convex quota or spending cap |
| [`secret-rotation-runbook.md`](tasks/secret-rotation-runbook.md) | A credential leaked or is being rotated |
| [`gdpr-erasure-runbook.md`](tasks/gdpr-erasure-runbook.md) | An erasure request |
| [`uber-eats-go-live-runbook.md`](tasks/uber-eats-go-live-runbook.md) | Uber Eats certification and go-live |
| [`stripe-connect-runbook.md`](tasks/stripe-connect-runbook.md) · [`stripe-founders-offer-runbook.md`](tasks/stripe-founders-offer-runbook.md) | Stripe setup and the *fondateurs* offer |
| [`webhook-migration-checklist.md`](tasks/webhook-migration-checklist.md) | Repointing a provider's webhooks |
| [`ci-required-checks-runbook.md`](tasks/ci-required-checks-runbook.md) | Changing what blocks a merge |
| [`production-checklist.md`](tasks/production-checklist.md) · [`production-accounts-checklist.md`](tasks/production-accounts-checklist.md) | Pre-launch sweeps |

> **Five files under `tasks/` carry a "superseded in part" banner about Convex
> deployment names** — `grep -l "uperseded in part" tasks/*.md` lists
> `convex-account-cutover-runbook`, `convex-spending-cap-runbook`,
> `production-accounts-checklist`, `production-checklist` and
> `webhook-migration-checklist`. Their *procedures* are current; their *deployment
> names* are not. The measured inventory is
> [`README.md` § Convex deployments](README.md#convex-deployments).

---

## 11. Known gaps

Stated because a deployment document that omits them is how they stay open.

- **The maintenance freeze has no enforcement** (§7).
- **Offboarding revokes nothing automatically** (§7).
- **The release chain does not gate on `E2E Status`** (§5, #308).
- **Six superseded Convex deployments are still up.** Five answer `200` and serve
  nothing; decommissioning them is
  [`convex-account-cutover-runbook.md`](tasks/convex-account-cutover-runbook.md) §4,
  and it is not done.
- **`dusty-nightingale-945`** is a redundant empty project that someone will one day
  mistake for production.
- **There is no automated backup.** Eight cron jobs are registered in
  `apps/*/convex/crons.ts` and none of them is a backup; what exists is a manual
  export in the admin that states it excludes S3 objects. Daily backups are
  nevertheless billed on beyours.fr — see
  [`FEATURES.md`](FEATURES.md#5-sold-and-absent--the-ledger-re-checked), T-7.
- **`TURBO_TOKEN` may not exist yet.** Until it does the remote cache wiring is
  inert, which was measured rather than assumed: an empty token exits 0 and an
  invalid one still completed 7 tasks out of 7 by falling back to the local cache. A
  misconfigured cache degrades; it does not break a build.
