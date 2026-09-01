# Runbook — Cutover to the dedicated Convex account

> **⚠️ Superseded in part, 2026-09-01 — Convex deployments.** This file names
> deployments whose roles have changed. The cutover to the dedicated account
> completed, and the site's project was **transferred** (not migrated) from team
> `momoseck8` to `be-yours`, so the deployment, its URLs, its env vars and its
> data are unchanged — only the owning team moved.
>
> What this file may still get wrong: beyours.fr runs on **`famous-wildcat-229`**
> (project `beindigital-restaurant`), never on `fearless-poodle-133`; the engine
> runs on **`optimistic-swordfish-937`**, no longer on `robust-elephant-263`.
> `dusty-nightingale-945` is an empty, unused project.
>
> The measured inventory is in the README, section **Convex deployments**. The
> reasoning below is kept as the record of what was done at the time.


> Three clean projects now exist on the company account. Production still runs
> on the old personal one. This file is what closes that gap, in the order that
> does not break the site. It contains **no credential**.

## What exists already

Created and **verified** on 2026-08-28, team `be-yours` (account
`developers@beyours.fr`):

| Project | What it is | Production deployment |
|---|---|---|
| `beyours-commercial-site` | beyours.fr — marketing, template catalogue, Stripe checkout, affiliate portal, ops console | `dusty-nightingale-945` |
| `beyours-engine-reference` | the engine's test bench — storefront, admin, CMS, kitchen display, QR games | `optimistic-swordfish-937` |
| `beyours-client-template` | the boilerplate cloned per restaurant | *(none — see below)* |

Verified past `/version`, which only proves a backend answers:

- `apps/site` — schema and functions deployed; `affiliateSettings:get` returns
  its defaults, so functions execute.
- `apps/reference` — schema and functions deployed, `betterAuth` component
  installed, 122 public queries registered; `stores:list` returns `[]` and
  `auth:getCurrentUser` returns null without a session. **This is the first time
  the engine's Convex push has been verified at all.**

**`beyours-client-template` has no deployment on purpose.** Convex dev
deployments are personal (`dev/<user>`) and are created on demand by
`npx convex dev`. Pre-creating a shared one is exactly how the old account ended
up with `youthful-goose-352`, a stray backend nobody owned.

**Region: US East (N. Virginia)** — decided 2026-08-28. It keeps the plan's
included usage, which EU West does not (EU carries a 30% surcharge and no
included amounts). A deployment's region **cannot be changed afterwards**.

> ⚠️ **Record the transfer basis.** Consumer personal data — customer names,
> emails, phones, order history, and the game form's first name / last name /
> email / phone — will sit outside the EU. That needs a transfer basis in the
> privacy policy and an entry in the record of processing activities
> (`apps/reference/MISE_EN_PROD.md` §7). This is a paperwork task, not a
> configuration one, and it is not done.

## What still runs on the old account

Nothing below has been touched. Production is still served by team `momoseck8`:

| Deployment | Serves | Project |
|---|---|---|
| `fearless-poodle-133` | beyours.fr, live | `wedilybird` |
| `robust-elephant-263` | the engine, incl. Stripe BID billing | `beindigital-engine` |

> ⚠️ **Rebuilding was chosen over transferring, so the old data is abandoned.**
> Convex can transfer a project between teams while preserving deployments,
> URLs, env vars, data and deploy keys; that path was deliberately not taken.
> **Export anything worth keeping before deleting the old projects** — beyours.fr
> has been live, so `contactLeads`, `affiliateUsers` and any `orders` rows exist
> only there. `npx convex export --deployment <old>` writes a ZIP.

## The cutover, in order

Each step depends on the one before. Doing them out of order takes the site
down rather than moving it.

### 1. Environment variables — before anything points at the new backends

Both new deployments have **no environment variables at all**. Confirmed:
`npx convex env list` answers "No environment variables set" on each.

> **No longer true, measured 2026-09-01.** `optimistic-swordfish-937` now
> carries environment variables and serves as the engine's production;
> `dusty-nightingale-945` carries six and serves nothing. And this step lost its
> purpose along the way: the site's backend reached the new account by
> **transfer**, which carries its env vars with it, so there was nothing to push. A
deployment without them does not merely degrade — `instrumentation.ts` refuses
to boot in production, and the auth layer returns 500 without `CONVEX_SITE_URL`.

For each app, from its directory:

```bash
pnpm env:check     # everything the deployment needs is present locally?
pnpm env:sync      # .env.local -> .env.convex
pnpm convex:env    # push to the deployment
```

Set the values that name the deployment itself — `CONVEX_SITE_URL`, `SITE_URL`,
`BID_APP_URL` — to the **new** URLs, not copies of the old ones. Use live
credentials, not the test ones the old deployment carried.

### 2. Vercel

Point `NEXT_PUBLIC_CONVEX_URL`, `NEXT_PUBLIC_CONVEX_SITE_URL`,
`CONVEX_SITE_URL` and `CONVEX_DEPLOYMENT` at the new deployment.

> ⚠️ **Then rebuild without cache.** `NEXT_PUBLIC_*` values are inlined at
> `next build`; a plain redeploy reuses the cached bundle and keeps serving the
> old Convex URL. This is bug #6, and it is the single most likely way this
> cutover appears to work and does not.

Check the bundle actually served, do not assume:

```bash
node apps/site/scripts/check-prod-bundle.mjs https://beyours.fr
```

That script hard-codes `fearless-poodle-133` as the only allowed subdomain
(`check-prod-bundle.mjs:26`), so **it will fail until you update it** to
`dusty-nightingale-945`. Update it as part of this step — its blocklist should
gain the old name at the same time, exactly as it holds `happy-otter-123`.

### 3. Webhooks and origins

> The full inventory — every URL a third party holds on us, which host it is on,
> and which secret verifies it — is
> [`webhook-migration-checklist.md`](./webhook-migration-checklist.md). The
> summary below is not complete: it omits Uber Direct, the SNS re-subscription
> for SES bounces, SumUp's OAuth return, and the `licenseApi` host baked into
> every client site. Work from the checklist, not from here.

- **Stripe** — recreate the endpoints against the new `.convex.site` host, for
  both flows (`STRIPE_WEBHOOK_SECRET` and `STRIPE_BID_WEBHOOK_SECRET`). A
  webhook secret is per endpoint; the old ones will not verify.
- **Uber Eats / Deliveroo** — the same, plus the OAuth redirect URIs registered
  in each partner portal.
- **Auth** — `trustedOrigins` reads `SITE_URL`; confirm you can still sign in.

### 4. Only then, the old account

Once the new deployments serve real traffic and have for long enough to trust:
export, delete the old projects, and remove the old team. Deleting a Convex
project deletes its deployments and their data, with no undo.

The spending-cap card ([`convex-spending-cap-runbook.md`](./convex-spending-cap-runbook.md))
is scoped to `momoseck8` and will need rewriting for `be-yours` when this lands
— the blast radius changes team.

## Sign-off

- [ ] Old data exported, or explicitly written off
- [ ] Env vars pushed to `dusty-nightingale-945` and `optimistic-swordfish-937`
- [ ] Vercel repointed **and rebuilt without cache**
- [ ] `check-prod-bundle.mjs` updated to the new subdomain, old one blocklisted
- [ ] Bundle check passes against the live site
- [ ] Stripe webhooks recreated, both flows; sign-in works
- [ ] Uber Eats / Deliveroo redirect URIs re-registered
- [ ] GDPR: US transfer basis recorded in the privacy policy and the register
- [ ] Old projects deleted, old team removed
- [ ] `README.md` → Convex deployments table rewritten for the new account

---

*Related: [README → Convex deployments](../README.md#convex-deployments) (the
inventory this replaces), [`convex-spending-cap-runbook.md`](./convex-spending-cap-runbook.md)
(scoped to the old team until this lands).*
