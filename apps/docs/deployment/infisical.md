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
| `STRIPE_BID_SECRET_KEY` / `_WEBHOOK_SECRET` / `STRIPE_BID_PRICE_MAINTENANCE` | what BeYours charges *the restaurateur* — our Stripe account, not theirs |
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
| `BETTER_AUTH_SECRET`, `EMAIL_API_SECRET`, `ENCRYPTION_KEY`, `ADMIN_BOOTSTRAP_TOKEN` | generated per deployment. Sharing one would make a single client's leak everybody's, and rotating `ENCRYPTION_KEY` forces **every** merchant back through the OAuth connect flow |

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
| `/platform` | BeYours' own credentials, identical everywhere | 12 | `packages/core/.env.example` + the BID block |
| `/site` | `apps/site`, the commercial site | 29 | `apps/site/.env.example` |
| `/reference` | `apps/reference`, the bench CI builds and e2e-tests | 62 | `apps/reference/.env.example` |
| `/themes` | `apps/themes`, the **defaults a client clone starts from** | 66 | its two `.env*.example` |
| `/demo` | the **one running demo instance**, shared by every template's demo | 66 | the same two |

There was a fifth folder, `/ci`, holding the names GitHub Actions read. It is
gone: since [#276](https://github.com/be-in-digital/beyours/pull/276) the e2e job
starts its own Convex backend on the runner and reads **no secret at all**, so
there was nothing left for that folder to hold. Provisioning nothing beats
provisioning well.

### `/themes` and `/demo` are not the same thing

They carry the same 66 variable names and mean opposite things.

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
tree. They live in three places, and each moves differently:

| Where | How it comes out |
|---|---|
| Convex deployment envs | `npx convex env list [--prod]` → a dotenv file |
| Vercel | `vercel env pull` |
| GitHub Secrets | **it does not.** GitHub is write-only by design |

`plan` prints the exact commands. For the GitHub half, take the values from the
portals they came from, or regenerate them — regenerating costs one rotation and
ends the question of who has seen the old value.

`migrate` does the Convex half in one move, and does the part that is easy to
get wrong by hand: it **routes each key to its owner**. A key BeYours owns goes
to `/platform` wherever it was found on the deployment; the rest goes to the
scope you named; anything in no spec is listed and deliberately not pushed.
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
| `infra-ci` | GitHub Actions | project `beyours-platform`, role **Viewer** | 2026-09-01, id `53cae282-0b9b-44c4-b122-c2ad232d10aa` |
| `infra-provisioning` | ops laptops running `pnpm convex:env` | same, when it is needed | not yet |

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
it. Fill those three and CI builds start uploading source maps; leave them and
nothing changes.

Three mechanics keep this safe rather than clever:

- **Two gates.** `vars.INFISICAL_ENABLED` says the store should be used, and a
  job-level `HAS_INFISICAL` witness says the credentials exist — a step's `if:`
  cannot read `secrets`, but a job's `env:` can. So the variable and the
  credentials may arrive in either order without a failed run in between.
- **`continue-on-error`.** `Build` is a required check on `main` and what the
  store adds is an enhancement. An Infisical outage, a rotated identity or a
  typo in a variable must not become "nobody can merge".
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
```

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
- [x] **Proven end to end**: run 33476568224, job `Build`, step *Load the shared
      credentials from Infisical* — `HAS_INFISICAL: true`, universal auth
      accepted, step green. The machine identity works from CI.

Left:

1. **The folders are empty.** `node scripts/infisical-bootstrap.mjs plan` prints
   how values get in, folder by folder. `/platform` first — 12 keys, and the
   ones whose rotation hurts most.
2. **Take the Deliveroo pair from the portal, not from a running deployment.**
   §A.1 of the rotation runbook has to happen first: a compromised value copied
   into a tidy store is still compromised, and now it is compromised in the
   place everything else reads from.
3. **`SENTRY_*` in `/platform`** if you want CI builds to upload source maps.
   The path is proven; only the values are missing. Note this changes the build
   cache key — turbo declares those three in the build task's `env` — so the
   first build after is a cache miss by design.
