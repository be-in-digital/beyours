# End-to-end tests

510 Playwright tests. Until August 2026 none of them had ever run — neither
locally nor in CI — so this file exists to make the setup explicit rather than
tribal.

## Why they were inert

Two independent gates, and neither says anything when it closes.

**Locally**, `playwright.config.ts` decides:

```ts
const hasRealBackend = !process.env.NEXT_PUBLIC_CONVEX_URL?.includes("placeholder")
```

Without a real Convex URL the `setup` and `admin` projects are not registered at
all. Playwright then reports success on the handful of public tests it did run —
there is no "skipped" line for a project that was never declared.

**In CI**, `.github/workflows/e2e.yml` *was* gated on `vars.CONVEX_E2E_ENABLED
== 'true'`. The variable was never set, so the job was skipped on every run for
months — and `E2E Status` reported that skip as success. Eight consecutive runs
finished in 7-11 seconds and were believed.

Three ways to be green while testing nothing. Anyone reading a passing PR would
reasonably conclude the suite ran.

> **Current state.** The gate is gone (#276). The job downloads and starts its
> own `convex-local-backend`, pushes the functions self-hosted, builds, seeds,
> and runs the suite in four shards — no Convex account and no `E2E_*` secrets,
> which had been the stated reason for keeping it switched off. It runs on pull
> requests, on pushes to `main`, and in the merge queue, and `E2E Status` is a
> required check. `scripts/assert-e2e-ran.mjs` reads the merged report and fails
> the job unless `setup`, `public` and `admin` each report tests and at least
> 100 ran in total, so a suite that quietly runs nothing can no longer be green.

**And a third, found in August 2026 when the flag was finally exercised.** CI
calls `pnpm test:e2e` from the *root*, so the task runs through Turbo — which
runs in `envMode: "strict"` and deletes every variable a task has not declared.
`turbo.json` declared none for `test:e2e`, so `SEED_PASSWORD`,
`BETTER_AUTH_SECRET` and the rest never reached the runner: `next start` failed
its own env check and the run died on the 120 s `webServer` timeout, 0 tests
executed. Every local run went through `cd apps/reference` and never saw it.
The task now carries a `passThroughEnv` list — keep it in step with anything new
the suite or the server reads.

## Running them locally

Everything below targets a deployment you are willing to see wiped: the seed
script creates accounts, and the suite writes orders, products and team members.

**1. Link a Convex deployment** (once). Writes `CONVEX_DEPLOYMENT` and
`NEXT_PUBLIC_CONVEX_URL` into `.env.local`, and pushes the functions:

```bash
cd apps/reference && npx convex dev
```

**2. Set what the BACKEND reads.** A Convex function does not see `.env.local` —
these have to live on the deployment:

```bash
npx convex env set BETTER_AUTH_SECRET "$(openssl rand -base64 32)"
```

```bash
npx convex env set ENCRYPTION_KEY "$(openssl rand -hex 32)"
```

```bash
npx convex env set SITE_URL http://localhost:3000
```

`ENCRYPTION_KEY` must be exactly 64 hex characters — it is the AES-256-GCM key
protecting the payment-provider tokens in `paymentConnections`.

**2 bis. Four variables a PRODUCTION server refuses to start without.**

`instrumentation.ts` validates them at boot, so `next start` dies before serving
anything. A dev server tolerates their absence, which is why this only bites
when running against a build. Placeholders are enough — no test reaches S3, SES
or OpenAI today:

```bash
export AWS_REGION=eu-west-3 AWS_ACCESS_KEY_ID=placeholder AWS_SECRET_ACCESS_KEY=placeholder OPENAI_API_KEY=sk-placeholder
```

**3. Set what the RUNNER reads.** Copy `.env.e2e.example` to `.env.e2e` and fill
it in, or export the variables. The one that matters most:

```bash
export SEED_PASSWORD="a-throwaway-password"
```

`scripts/seed-users.mts` writes it and `e2e/auth.setup.ts` signs in with it. The
two must agree. Neither hardcodes it — `auth.setup.ts` used to carry a literal,
and not even the matching one, so the setup only worked on the machine where
they happened to coincide.

**4. Seed the accounts**, with the dev server running:

```bash
pnpm dev
```

```bash
cd apps/reference && npx tsx scripts/seed-users.mts
```

Six accounts, all `test.*@beindigital.fr`: owner (`client_admin`), manager,
cuisine (`kitchen`), service (`waiter`), and two customers. They exercise the
role boundaries the authorisation tests assert.

**5. Run:**

```bash
cd apps/reference && pnpm test:e2e
```

Check the header names three projects — `setup`, `public`, `admin`. If it names
only `public`, the backend was not detected: re-read step 1 before reading any
result as a pass.

## CI

Nothing to enable, and nothing to provision. The suite runs on every pull
request, on pushes to `main`, and in the merge queue.

`.github/workflows/e2e.yml` downloads `convex-local-backend` (pinned in
`CONVEX_BACKEND_VERSION`), starts it on the runner, writes an `.env.local`
pointing at it, builds, deploys the functions self-hosted, seeds an owner
account and runs the suite in four shards. No Convex account, no deploy key,
and no `E2E_*` secrets — the absence of which had been the stated reason for
leaving the suite switched off for months.

The four shards upload blob reports; `e2e-report` merges them and runs
`scripts/assert-e2e-ran.mjs`, which fails unless `setup`, `public` and `admin`
each report tests and at least 100 ran in total.

**The required check is `E2E Status`, never a shard.** A job that does not run
reports `skipped`, and GitHub counts a skip as satisfied; `E2E Status` is an
aggregate that runs unconditionally and fails on skip, cancel and failure
alike. `tasks/ci-required-checks-runbook.md` is the full procedure, including
the branch-protection half and the order to do it in.

The Deliveroo webhook specs skip themselves unless `DELIVEROO_CLIENT_ID`,
`DELIVEROO_CLIENT_SECRET`, `DELIVEROO_WEBHOOK_SECRET`, `DELIVEROO_SITE_ID` and
`DELIVEROO_BRAND_ID` are present — a genuine `test.skip`, which does appear in
the report.

## Before trusting a green run

Neutralise something the suite claims to cover and confirm it goes red. A suite
that has never failed has never been shown to work: that is exactly how these
510 tests stayed inert for months while reporting success.
