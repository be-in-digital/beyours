# Infisical — where this repo's environment lives

> **Decision: the whole environment of this repository lives in Infisical —
> `apps/site`, `apps/reference`, `apps/themes`, the platform credentials and the
> names CI reads. One store for tests, for builds and for local development.**
> What stays out is what was never ours: a client's own AWS, Stripe or Convex
> values live in that client's deployment, not here.

**Project**: `beyours-platform` — org `Be in Digital`
(`23152286-a0d4-4794-9a79-4b1c268ac2e3`), project
`da164dca-75e2-4646-b302-5b2274b2b285`. Plan: Free.

## Why this had to be settled

[`tasks/secret-rotation-runbook.md`](../../../tasks/secret-rotation-runbook.md)
§A.3 lists where each secret lives. For a partner-app credential the answer is:
the Convex env of **every** deployment, plus Vercel, plus GitHub Secrets, plus
every laptop that ever ran the app. So §A.1 — rotating the Deliveroo secret —
reads "propagate the new value to every store that needs it", by hand, with no
list of stores that is guaranteed complete.

That cost grows with every client signed. One store for the shared half turns
the propagation step into a command.

## What is shared, and what only looks shared

**Shared — BeYours owns the account, the value is byte-identical everywhere:**

| Variable | Why it is ours |
|---|---|
| `OPENAI_API_KEY` | BeYours pays for the GPT translations |
| `UBER_EATS_CLIENT_ID` / `_CLIENT_SECRET` / `_WEBHOOK_SECRET` | one partner app, registered by the agency |
| `UBER_DIRECT_WEBHOOK_SECRET` | rides on the same Uber app |
| `DELIVEROO_CLIENT_ID` / `_CLIENT_SECRET` / `_WEBHOOK_SECRET` | one partner app, registered by the agency |
| `STRIPE_BID_SECRET_KEY` / `_WEBHOOK_SECRET` / the seven `STRIPE_BID_PRICE_*` | what BeYours charges *the restaurateur* — our Stripe account, not theirs |
| `BID_NOTIFY_EMAIL` | our inbox |

**Not shared — and these are the trap, because they sit in the same blocks of
`.env.convex.example` and are named alike:**

| Variable | Whose it is |
|---|---|
| `DELIVEROO_BRAND_ID`, `DELIVEROO_SITE_ID` | the restaurant's own Deliveroo listing |
| `UBER_EATS_SANDBOX_MODE`, `DELIVEROO_IS_SANDBOX` | per deployment |
| `BID_APP_URL` | the client's own URL |
| `STRIPE_*` without the `BID` (`STRIPE_SECRET_KEY`…) | the restaurant's own Stripe account |
| `AWS_*` | every restaurant owns its AWS account — [`aws-ownership.md`](./aws-ownership.md) |
| `BETTER_AUTH_SECRET`, `EMAIL_API_SECRET`, `ENCRYPTION_KEY`, `ADMIN_BOOTSTRAP_TOKEN`, `SEED_PASSWORD` | generated per deployment. Sharing one would make a single client's leak everybody's, and rotating `ENCRYPTION_KEY` forces **every** merchant back through the OAuth connect flow |
| `JWT_PRIVATE_KEY`, `JWKS` | written straight onto the deployment by the auth tooling. No application code names them, so they look like orphans in an audit and are the one pair you must not remove |

> ⚠️ **That rule is now enforced, and it was not before.** Those seven names are
> `DEPLOYMENT_OWNED` in `scripts/infisical-bootstrap.mjs`. `migrate` refuses to
> put one into the store, `seed` refuses to mint one into `/platform` or
> `/themes`, `check` reports one it finds there, and
> `setup-convex-env.sh --infisical` refuses to push one onto a deployment. The
> 4 Sep 2026 audit found them sitting in `/themes` — the folder a client clone
> starts from — among the 17 keys that folder would have pushed, and a witness
> dry run answering `would set JWT_PRIVATE_KEY / JWKS / ENCRYPTION_KEY /
> BETTER_AUTH_SECRET`. Nothing was propagating them yet. Delete them from any
> shared folder you find them in.

> ⚠️ The Package-Level table in
> [`environment-variables.md`](./environment-variables.md) still lists `AWS_*`
> as platform-level. It is stale — `packages/core/.env.example` and
> `aws-ownership.md` are the current answer. Do not move AWS keys into the
> shared folder on the strength of that table.

One still to confirm before it moves: `UNSPLASH_ACCESS_KEY`. If the CMS media
search runs on one BeYours Unsplash app it is shared; if a client ever gets
their own, it is not.

## Structure — what exists today

Created on 2026-09-01 — four folders, in **each** of the three environments (`dev`, `staging`,
`prod` — those slugs are what `--env` takes):

| Folder | Holds | Keys | Source of the list |
|---|---|---:|---|
| `/platform` | BeYours' own credentials, identical everywhere | 18 | `packages/core/.env.example` + the BID block |
| `/site` | `apps/site`, the commercial site | 29 | `apps/site/.env.example` |
| `/reference` | `apps/reference`, the bench CI builds and e2e-tests | 68 | `apps/reference/.env.example` |
| `/themes` | `apps/themes`, the **defaults a client clone starts from** | 73 | its two `.env*.example` |
| `/demo` | the **one running demo instance**, shared by every template's demo | 73 | the same two |

`node scripts/infisical-bootstrap.mjs scopes` prints those lists and their
counts. Read it rather than this table if the two disagree — the specs are the
source, this is a copy.

There was a fifth folder, `/ci`, holding the names GitHub Actions read. It is
gone: since [#276](https://github.com/be-in-digital/beyours/pull/276) the e2e job
starts its own Convex backend on the runner and reads **no secret at all**, so
there was nothing left for that folder to hold. Provisioning nothing beats
provisioning well.

### `/themes` and `/demo` are not the same thing

They carry the same 73 variable names and mean opposite things.

`/themes` holds **defaults**: what a client's cloned repository starts from
before anyone fills it in. Nothing runs on those values.

`/demo` holds **one real environment**. Every template's demo — the sites a
prospect browses to try a design before buying — points at a single Convex
backend, `zany-barracuda-114`, in project `beyours-client-template`. One
deployment for all the demos, because a backend per design would be a deployment
per colour scheme.

**This changes nothing about the clients.** A theme that is sold still gets its
own repository and its own Convex deployment, and that is what makes data
isolation structural rather than a filter someone has to remember. See the
README, and `tasks/client-offboarding-runbook.md` for what per-client ownership
buys at the other end of the relationship.

### Loading the values

They are not in this repo — there is no `.env` file anywhere in the working
tree. They live in two places, and each moves differently:

| Where | How it comes out |
|---|---|
| Convex deployment envs | `npx convex env list [--prod]` → a dotenv file |
| Vercel | `vercel env pull` |

There is no GitHub half. `plan` used to name 13 `E2E_*` repository secrets to
take out of GitHub by hand; they do not exist and never did — this repository
stores four secrets (`INFISICAL_CLIENT_ID`, `INFISICAL_CLIENT_SECRET`,
`MIRROR_PUSH_TOKEN`, `TURBO_TOKEN`), and since #276 the e2e job reads no
application secret at all. GitHub is still write-only, so anything that ever
does land there comes back out of its own portal or gets regenerated.

`migrate` does the Convex half in one move, and does the two parts that are easy
to get wrong by hand.

It **routes each key to its owner**: a key BeYours owns goes to `/platform`
wherever it was found on the deployment; the rest goes to the scope you named;
anything in no spec is listed and deliberately not pushed.

And it **refuses the seven `DEPLOYMENT_OWNED` names outright**, before it looks
at any spec — that order is the fix. Five of them (`BETTER_AUTH_SECRET`,
`ENCRYPTION_KEY`, `EMAIL_API_SECRET`, `ADMIN_BOOTSTRAP_TOKEN`, `SEED_PASSWORD`)
*are* in every app's `.env.example`, so a routing that asked "is it in the spec?"
first filed them under the scope and pushed them. That is how `/themes` came to
hold one deployment's generated secrets as the defaults every clone starts from.

It is a dry run unless you pass `--apply`, it writes its intermediate file with
mode 600 into a temp dir it deletes afterwards, and it never prints a value.

For the rest: `infisical secrets set --file=<dotenv>` from the CLI, or the
drag-and-drop box on each folder's page in the dashboard.

> The one dangerous moment is the dotenv file sitting in plaintext on disk
> between the pull and the push. `chmod 600` it, and delete it after.

## Billing — why there is no per-client anything

Infisical bills **per identity, humans and machines alike**. The free tier is 5
identities, 3 environments and 10 secret syncs, with no audit log and no
versioning; Pro is roughly $20 per identity per month (checked 2026-09-01).

**Never an identity per client. Never a sync per client.** Both are billed or
capped per unit, and either one would index the infrastructure bill on the sales
pipeline. Folders are free; identities are not.

Machine identities, one per *usage*:

| Identity | Used by | Access | Created |
|---|---|---|---|
| `infra-ci` | GitHub Actions | project `beyours-platform`, role **Viewer** | 2026-09-01 |
| `infra-provisioning` | ops laptops running `pnpm convex:env` | same, when it is needed | not yet |

`infra-ci` carries **two different UUIDs**, and they are not interchangeable:

| What | Value | Where it goes |
|---|---|---|
| Identity ID | `53cae282-0b9b-44c4-b122-c2ad232d10aa` | the identity's own page URL, and nowhere else |
| Universal Auth **Client ID** | `ef6c3483-d126-410a-9bd6-9af34a35734b` | `INFISICAL_CLIENT_ID` |

> The identity ID was the only one written down here, so it is the one that went
> into `INFISICAL_CLIENT_ID`, and the store answered `401 Invalid credentials`
> every morning from 2026-09-01 to 2026-09-10
> ([#456](https://github.com/be-in-digital/beyours/issues/456)). Infisical
> returns the same 401 for a wrong client ID as for a revoked client secret, so
> the error does not say which. The identity's own page does: it read
> `Last Used: Never`, with its client secret at 0 uses. Nothing had expired —
> the credential had never once been accepted. Read that page before rotating
> anything, or you will replace a secret that was always correct.

Its **organization** role is `no-access`: an identity should reach a project
because it was granted that project, never because it is a member of the org.

> `Viewer` reads the **whole project**, not just `/platform`. Scoping a
> role to a path needs custom roles, and those are a Pro feature — the Free plan
> has no fine-grained RBAC. Viewer is the tightest grant available here, and it
> is still read-only. If the store later holds something CI has no business
> reading, that is the moment the per-path scoping stops being optional.

```bash
export INFISICAL_TOKEN=$(infisical login --method=universal-auth \
  --client-id="$INFISICAL_CLIENT_ID" --client-secret="$INFISICAL_CLIENT_SECRET" \
  --silent --plain)
```

That client secret is the one credential that unlocks all the others. It belongs
in the ops password manager and in GitHub Secrets — never in a repo, never in a
`.env` that gets copied into a client's clone.

## Using the store — the three consumers

The point is not to keep secrets somewhere tidy. It is that every place the
environment is needed reads from the same one. Three places need it, and they
are wired differently because they are different problems.

### Local development — done

```bash
infisical login              # once, per machine. That is the whole setup.

pnpm dev:site                # goes through the store, automatically
pnpm dev:reference
```

**`dev` is wired, not offered.** `apps/site` and `apps/reference` route their own
`dev` script through the store, so there is nothing to remember and nothing to
type differently. An opt-in command is a command someone forgets, which is the
failure this exists to prevent.

It degrades rather than blocks: no CLI, or no session, and the app starts anyway
after printing why the store was skipped. `pnpm dev:plain` skips it deliberately.
The project id is committed as a default — it names a project, it does not open
one, and reading still needs a session.

**`apps/themes` is deliberately not wired.** That app is cloned into a client's
repository, and a client has no Infisical. Its `dev` stays plain; the agency uses
`pnpm dev:themes:env` and `pnpm dev:demo:env` when it wants the store.

`run` loads `/platform` first and the scope's folder second, so a scope value
beats the shared one — the same order the CI jobs use, on purpose: one rule to
remember rather than two.

Nothing is written to disk. There is no `.env.local` to drift out of date, to
leak into a commit, or to forget after a rotation. That is the whole benefit, and
it is lost the moment someone re-creates the file "just to be safe".

### GitHub Actions — done for what CI needs

`ci.yml`'s build job reads `/platform`. `e2e.yml` deliberately reads nothing:
since #276 it starts its own Convex backend and needs no secret at all, which is
better than supplying one. See **Builds** below.

### Vercel — one API token, then a sync

Vercel builds do not run the Infisical CLI, and `NEXT_PUBLIC_*` must be real
Vercel environment variables at build time or Next has nothing to inline. So the
mechanism is a **secret sync**, which pushes a folder into the project's
environment. It needs an API token, which is why nobody's tooling can do it for
you.

**1. Create the token, on Vercel.** Profile icon → *Account Settings* →
**API Tokens** → **Create**. Name it `Infisical`, scope it to the
`be-in-digital` team, and copy it — it is shown once.

> Do not set an expiry unless you plan to rotate it. An expired token stops the
> sync silently: Vercel keeps serving the last values it received, so nothing
> looks broken until a secret changes and does not arrive.

**2. Create the connection, in Infisical.** *Integrations* → **App Connections**
→ **+ Add Connection** → Vercel. Paste the token, name it `vercel`.

**3. Create the sync.** *Project* → *Integrations* → **Secret Syncs** →
**Add Sync** → Vercel.

| Field | Value |
|---|---|
| Environment | `prod` |
| Secret Path | `/site` |
| Vercel Connection | the one from step 2 |
| Vercel App | `beyours` |
| Vercel App Environment | `production` |
| Initial Sync Behavior | **overwrite destination** — the store is the source, or it is not |
| Auto-Sync Enabled | on |
| Disable Secret Deletion | **on**, at least at first: a key removed from `/site` will not silently vanish from a live site |
| Name | `site-prod` |

Repeat per app that gains a Vercel project. The Free plan allows 10 syncs, so
this is not where the budget goes — identities are.

> ⚠️ **A sync does not rebuild.** Changing a `NEXT_PUBLIC_*` still needs a
> **rebuild without cache**: a plain redeploy reuses the build cache and does not
> re-inline the new value. That is bug #6, and a good secret store does not
> repeal it. After any sync touching a `NEXT_PUBLIC_*`, rebuild without cache and
> verify what is actually served:
>
> ```bash
> node apps/site/scripts/check-prod-bundle.mjs https://beyours.fr
> ```

**Before you turn auto-sync on**, check the folder can answer. Syncing `/site`
while it is missing keys will remove nothing (deletion is disabled above) but
will not supply them either:

```bash
pnpm env:check --env=prod --scope=site
```

### What has to be true first

A store that cannot answer is worse than no store: point a consumer at an empty
folder and it gets placeholders or nothing. Check before switching anything over:

```bash
pnpm env:check --env=prod
```

`check` answers in its exit code, and the two failures are different problems:

| Code | Means | What it is |
|---:|---|---|
| 0 | every folder matches its spec | — |
| 1 | the store answered; keys are missing, or a shared folder holds a per-deployment secret | a backlog item |
| 2 | bad flags | a mistake in the command |
| 3 | no CLI, no session, or a folder that would not read | an incident: the rotation chain is broken *now* |

They were one code until 07/09/2026, which is why nothing could be automated on
top: an outage and a half-filled folder looked identical.
[`env-store-health.yml`](../../../.github/workflows/env-store-health.yml) runs
`check --env=prod` every morning and reads them — 1 becomes a `::warning::` and
a green run, 3 becomes an `::error::` and a red one. It is deliberately **not**
a required check and must never become one: a merge must not depend on a third
party's uptime, which is the same trade `ci.yml` refuses above.

## Builds

One CI job reads the store, and it is not the one you would expect.

**`e2e.yml` deliberately does not.** Since #276 it starts its own Convex backend
on the runner, from the published binary, with no account and no secret. That is
strictly better than wiring it to a store: nothing to provision, and nothing that
can be left unset by mistake. Do not re-wire it.

**`ci.yml`'s `build` job does**, at `/platform`, and what it can change is narrow
by construction: `turbo.json` declares only `SENTRY_ORG`, `SENTRY_PROJECT` and
`SENTRY_AUTH_TOKEN` in the build task's `env`, so those three — plus
`NEXT_PUBLIC_*`, through framework inference — are all that can reach the build.
Everything else the store carries is stripped by turbo before `next build` sees
it.

> **This paragraph used to end "fill those three and CI builds start uploading
> source maps". Do not.** `/platform` holds no `SENTRY_*` key, by design, and
> putting them there is refused by the spec — see the struck item under *Left*
> at the end of this document for the measurement and the reasoning. The short
> version: `SENTRY_PROJECT` is per client, the three are an all-or-none group so
> the other two cannot go without it, and this job builds all three apps at once
> from one folder. That turbo declares them is a statement about what *could*
> reach the build, not a recommendation about where to put them.

Three mechanics keep this safe rather than clever:

- **Two gates.** `vars.INFISICAL_ENABLED` says the store should be used, and a
  job-level `HAS_INFISICAL` witness says the credentials exist — a step's `if:`
  cannot read `secrets`, but a job's `env:` can. So the variable and the
  credentials may arrive in either order without a failed run in between.
- **`continue-on-error`.** `Build` is a required check on `main` and what the
  store adds is an enhancement. An Infisical outage, a rotated identity or a
  typo in a variable must not become "nobody can merge". What it also did was
  make the failure invisible — a yellow step inside a green job nobody opens —
  so a following step now prints a `::warning::` when the load fails. Still not
  a failure; just no longer silent.
- **Step-level `env:` outranks `$GITHUB_ENV`.** The build's
  `NEXT_PUBLIC_CONVEX_URL: https://placeholder.convex.cloud` is step-level on
  purpose: a real Convex URL from the store cannot leak into that compile-check
  build and get inlined into a bundle.

The action is pinned to a commit SHA rather than a tag: it is third-party and it
receives a machine identity.

## Pushing to a Convex deployment

```bash
export INFISICAL_PROJECT_ID=<the platform project>
export INFISICAL_ENV=prod

cd <client-repo>
pnpm convex:env:infisical -- --dry-run     # names only, writes nothing
pnpm convex:env:infisical                  # onto the dev deployment
bash scripts/setup-convex-env.sh --infisical --prod
bash scripts/setup-convex-env.sh --infisical --path=/demo   # another folder
```

**It reads `/platform` by default, and refuses `/`.** Until 07/09/2026 the
default was `/`, the root folder — which holds zero keys in every environment,
because every secret lives one level down. So the documented rotation printed
`0 variables set on Convex` per client, exited 0, and propagated nothing: every
restaurant kept the revoked credential. A folder that exports no key is now a
hard error, for the same reason — reading nothing is never a successful push.
`apps/themes/scripts/setup-convex-env.test.mjs` holds both behaviours, with a
stub CLI and values the test controls.

**It never pushes a `DEPLOYMENT_OWNED` name out of the store**, and names the
ones it skipped in its summary. Those seven still come from `.env.convex` —
that file *is* one deployment's own half, and `.env.convex.example` asks for
four of them by name — except `JWT_PRIVATE_KEY` and `JWKS`, which no file may
carry from anywhere.

[`setup-convex-env.sh`](../../../apps/themes/scripts/setup-convex-env.sh) merges
two sources: Infisical first, then `.env.convex` for everything the shared store
does not hold. A key present in both is taken from Infisical and **named in the
output** — that is a stale local copy of a BeYours credential, and it should be
deleted from `.env.convex` so the next rotation has one place to change.

Without `--infisical` the script behaves exactly as before, reading only
`.env.convex`. A client clone with no Infisical CLI is unaffected.

## What this does not do

1. **It does not pull.** Infisical has no Convex sync destination (Vercel,
   GitHub, GitLab, AWS, Netlify, Fly, Railway and ~40 others do exist — Convex
   does not, checked 2026-09-01). A rotated value reaches a deployment when
   somebody runs the script against it, and not before. Rotation is still a
   runbook; it is just a shorter one.
2. **It does not clean the git history.** Part B of the rotation runbook stands
   untouched.
3. **It does not un-leak the Deliveroo secret.** Do §A.1 *first*: moving a
   compromised value into a tidy store leaves it compromised.
4. **The free tier has no audit log and no versioning.** You cannot ask it who
   changed what, or roll a value back. If that becomes load-bearing, that is the
   Pro line — or self-hosting, since everything outside `ee/` is MIT.

## State, and what is left

Done (2026-09-01):

- [x] Org `Be in Digital`, project `beyours-platform` (`beyours-platform-4mu-x`), Free plan
- [x] Environments `dev` / `staging` / `prod`, four folders in each
- [x] Machine identity `infra-ci`, Universal Auth, org `no-access`, project Viewer
- [x] `INFISICAL_CLIENT_ID` / `INFISICAL_CLIENT_SECRET` in GitHub secrets
- [x] `scripts/infisical-bootstrap.mjs` — `scopes`, `folders`, `check`, `plan`, `migrate`
- [x] `setup-convex-env.sh --infisical` — the read path back onto a deployment
- [x] `ci.yml`'s build job reads `/platform`, behind `INFISICAL_ENABLED`
- [x] **Proven end to end**: run 34435958325, job `Check the store answers`, step
      *Log in as the CI machine identity* — universal auth accepted, `prod`
      graded. Dated 2026-09-10, and the date matters: this is the FIRST login
      this identity ever completed.
- [ ] ~~Proven end to end: run 33476568224, job `Build`, step *Load the shared
      credentials from Infisical* — universal auth accepted, step green.~~
      Retracted 2026-09-10. That step carries `continue-on-error: true`
      (`.github/workflows/ci.yml:376`), so it cannot report red and its colour
      proves nothing about the store. The identity had authenticated zero times
      when this box was ticked, and stayed at zero for nine days. Cite a step
      that is allowed to fail, or cite nothing.

Done (2026-09-07, [#328](https://github.com/be-in-digital/beyours/issues/328)) —
the chain was measured end to end and three of its links were carrying nothing,
or too much:

- [x] The bridge reads `/platform` by default and refuses `/`; a zero-key export
      is a hard error. Before this, the documented rotation propagated nothing.
- [x] The seven `DEPLOYMENT_OWNED` names cannot travel: not into the store
      (`migrate`), not into a shared folder (`seed`), not out onto a deployment
      (`setup-convex-env.sh`), and `check` reports one it finds.
- [x] The six `STRIPE_BID_PRICE_*` plan keys are in the specs, so the paid Auto
      Blog tier can be provisioned through this chain at all.
- [x] `check` splits its exit codes, `ci.yml` annotates a failed load, and
      `env-store-health.yml` asks the store every morning.
- [x] `tasks/secret-rotation-runbook.md` §A.3 rewritten: Infisical first, and
      the thirteen `E2E_*` GitHub Secrets it used to list are gone — they never
      existed.

Left:

1. **The folders are not filled in.** `node scripts/infisical-bootstrap.mjs plan`
   prints how values get in, folder by folder. `/platform` first — 18 keys, and
   the ones whose rotation hurts most. `pnpm env:check --env=prod` says what is
   actually there today; this document cannot.
2. **Take the Deliveroo pair from the portal, not from a running deployment.**
   §A.1 of the rotation runbook has to happen first: a compromised value copied
   into a tidy store is still compromised, and now it is compromised in the
   place everything else reads from.
3. ~~**`SENTRY_*` in `/platform`** if you want CI builds to upload source
   maps.~~ **Struck 09/09/2026 — this was wrong, and following it cost a line in
   the daily report every morning.** `/platform`'s spec is
   `packages/core/.env.example` plus an eleven-name `add:` list, and neither has
   ever contained a `SENTRY_*` key: `/platform` is 18 keys, none of them Sentry.
   An operator who did this got, on every `pnpm env:check`:

   ```
     not in any spec (3): SENTRY_AUTH_TOKEN, SENTRY_ORG, SENTRY_PROJECT
   ```

   — and `/platform` lost its `complete` line, in a report
   `env-store-health.yml` appends verbatim to the job summary at 06:15 UTC daily.

   **The spec is right and this document was wrong.** The three are one
   all-or-none feature group (`packages/core/src/env/manifest.ts:211-214`,
   "Sentry source maps"), and one member of it, `SENTRY_PROJECT`, is
   **per client** — `apps/docs/deployment/sentry.md` is titled *"Sentry — one
   project per client"*, and the engine's own fixture spells it
   `SENTRY_PROJECT: 'pizzeria-napoli'`
   (`packages/core/src/env/__tests__/validate-all-env.test.ts:230`). A folder
   described as *"BeYours' own credentials — identical on every deployment"*
   cannot hold a per-client value. And because the group is all-or-none, you
   cannot split it either: `validateAllEnv` refuses two of the three and names
   the gap ("rejects half a source-map upload"). So all three stay where the
   spec already puts them — `/site`, `/reference`, `/themes`, `/demo`.

   **Then what about CI's `/platform` load?** It cannot supply them, and it
   should not try. `ci.yml`'s build job compiles **all three apps in one turbo
   run**, so one `SENTRY_PROJECT` in one shared folder would file three apps'
   source maps under a single Sentry project — the exact merging
   `sentry.md` exists to prevent. It is also a *compile check*: it builds with
   `NEXT_PUBLIC_CONVEX_URL: https://placeholder.convex.cloud` and throws the
   artifacts away, so uploading its maps would create releases for a bundle
   nobody runs. Source maps belong to the deploy host, per app — which is what
   `sentry.md` already says: *"It belongs on the build host — a Vercel
   environment variable or a CI secret."* Set them per Vercel project, not here.
   Nothing breaks meanwhile: `next.config.ts` sets
   `sourcemaps.disable: !(ORG && PROJECT && AUTH_TOKEN)`, so an unset triple
   disables the upload cleanly rather than failing the build.

   Held by `node scripts/infisical-bootstrap.mjs doc`, which checks every folder
   claim in this file against the spec and needs no store.

   It reads a claim in either direction — "`KEY` in `/folder`", and
   "`/folder` holds `KEY`" with the verbs *holds*, *carries*, *contains*,
   *declares*, *lists* — and it understands `holds no KEY`, which is checked the
   other way round: that spelling is satisfied by the key being **absent**.
   Striking a claim through retracts it, so a correction can quote what it
   corrects.

   It knew only the first spelling until 09/09/2026, and this document by then
   used only the second, so it reported `0 folder claim(s) checked` and exited
   0 — indistinguishable from a document with nothing to check. It now proves
   its own patterns against a dozen phrasings on every run and refuses to grade
   anything if they have stopped seeing.
