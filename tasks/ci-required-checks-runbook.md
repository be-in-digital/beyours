# Runbook — make CI blocking and switch E2E on (`be-in-digital/beyours`)

> Closes the engineering half of **LAUNCH-08**. The other half is repository
> settings only an admin of `be-in-digital/beyours` can change, plus a Convex
> deployment only its owner can create — this file tells them exactly what to
> set, in what order, and how to tell whether it worked. It contains **no
> secret**.

## Why this card exists

When this card was written, `main` had **no branch protection at all**
(`GET /repos/…/branches/main/protection` answered `404 Branch not protected`).
Every workflow ran, nothing they reported was binding, and anything could be
merged over a red check.

> **Status: §6 is done, §3–§5 are not.** Protection was applied later the same
> day, 2026-08-28, with this card's own PR (#202): the four `ci.yml` checks are
> required and *require branches to be up to date* is on. Everything about the
> E2E half below is still outstanding — the suite has never run. What §6 records
> now is what was applied, not what to do next.

The E2E suite was the sharper half of the problem. It was gated on a repository
variable that had never been set:

```yaml
# .github/workflows/e2e.yml:14 — REMOVED 2026-08-31
if: vars.CONVEX_E2E_ENABLED == 'true'
```

`gh variable list` returned nothing, so the `e2e` job had **never once run**.
`tasks/sprint-durcissement-reference.md:634` records the consequence: *510 tests,
0 passed, 510 skipped*, report `ok: true`. The last eight CI runs before the fix
finished in 7-11 seconds and were all green.

**Resolved 2026-08-31.** The gate is gone and the job provisions its own Convex
backend, so there is no variable to set and no secret to place — see section 3.
Section 4 is what is genuinely still outstanding, and it is short.

---

## 1. What was broken, and is now fixed in code

Turning the variable on was not one setting away. Three defects sat between the
flag and a suite that runs, none of which had ever been reachable — every human
run went through `cd apps/reference && pnpm test:e2e`, while CI calls
`pnpm test:e2e` from the **root**, through Turbo. That difference is where all
three lived.

| # | Defect | Symptom the operator would have seen | Fixed by |
|---|---|---|---|
| 1 | `turbo.json` declared no `env`/`passThroughEnv` on `test:e2e`, and Turbo 2 defaults to `envMode: "strict"` — it deletes undeclared variables from a task's environment | `next start` failed its own check with *"10 environment variable(s) missing or invalid"*, the web server never came up, and the run died on Playwright's 120 s `webServer` timeout with **0 tests executed** | `turbo.json` — `passThroughEnv` on `test:e2e` |
| 2 | `tsx` was in no `package.json` in this repo (only `apps/themes`), so `npx tsx scripts/seed-users.mts` could not resolve. The step ended in `\|\| true` | Nothing. The seed never ran, the suite tested an empty database, and the failure surfaced ~400 tests later as admin screens that would not load | `apps/reference/package.json` — `tsx` devDependency; `e2e.yml` — the `\|\| true` removed |
| 3 | The seed's `fetch` sent no `Origin` header. Better Auth rejects every state-changing request without one | `403 MISSING_OR_NULL_ORIGIN` on all six accounts → *"No account could be created or opened. Nothing to seed."* | `scripts/seed-users.mts` — sends `Origin: BASE_URL` |
| 4 | The job was gated on `vars.CONVEX_E2E_ENABLED == 'true'`, a variable nobody had created, and `E2E Status` treated `skipped` as a pass | Eight consecutive CI runs finished in **7-11 seconds**, all green, having executed no test at all | `e2e.yml` — the gate removed, the job provisions its own backend; `E2E Status` now fails on anything that is not `success` |
| 5 | `hasRealBackend` was `!url?.includes("placeholder")`, which is `!undefined` — **true** — when the variable is unset | The opposite of what its own comment claimed: an unconfigured run declared it had a backend | `playwright.config.ts` (both apps) — unset is now false, and it says so on stderr |
| 6 | When `hasRealBackend` is false the `setup` and `admin` projects are spread *out of* the projects array. A project that is never declared is not reported as skipped — it is absent | 43 of 56 spec files vanished from the run **and from the report**, and Playwright exited 0 over the remainder | `scripts/assert-e2e-ran.mjs`, run after the suite: it fails unless `setup`, `public` and `admin` each report tests |
| 7 | The production CSP is `connect-src 'self' https: wss:`, which blocks `ws://127.0.0.1` — so a suite running against a local backend could never open the Convex socket | Every admin screen sat on a loading skeleton until the 30 s timeout; read as a broken product, was a blocked WebSocket | `lib/security/content-security-policy.ts` (both apps) — the configured Convex origin is admitted **only** when it is a loopback address |

All three were reproduced and then re-verified against a real Convex backend
(an anonymous local deployment with the functions pushed), running the exact
command CI runs with the exact environment `e2e.yml` sets. Before: 10 missing
variables, 0 tests. After: server boots, seed writes 6 accounts + 6 profiles +
the restaurant fixture, Playwright executes.

> **What this does not fix:** the state of the specs themselves. Sprint 0 of
> `sprint-durcissement-reference.md` lists S0-3 (specs written against a stale
> UI), S0-4 (80 assertions locked inside `if (…)` with no `else`, across 15
> specs) and S0-5 (a console-error filter that ignores `401`, `403`, `500` and
> `Failed to fetch`). Those are TECH-12's, not this card's. Section 5 says what
> to do about them before switching the check to *required*.

---

## 2. The exact check names

Branch protection matches the **job** `name:`, not the workflow name. Getting
one wrong does not fail loudly — it blocks every pull request forever, waiting
for a check that will never report.

| Check string | Workflow | Fires on a PR? | Line |
|---|---|---|---|
| `Lint` | `ci.yml` | yes | `.github/workflows/ci.yml:13` |
| `Type Check` | `ci.yml` | yes | `.github/workflows/ci.yml:45` |
| `Test` | `ci.yml` | yes | `.github/workflows/ci.yml:77` |
| `Build` | `ci.yml` | yes | `.github/workflows/ci.yml:109` |
| `E2E Status` | `e2e.yml` | yes, always | `.github/workflows/e2e.yml:155` |
| `Gitleaks (secret scan)` | `security.yml` | yes | `.github/workflows/security.yml:22` |
| `pnpm audit (deps vulnerabilities)` | `security.yml` | yes | `.github/workflows/security.yml:51` |
| ~~`E2E Tests`~~ | `e2e.yml` | **do not require it** — see below | `.github/workflows/e2e.yml:10` |
| ~~`Release`~~, ~~`Sync the mirror`~~ | `release.yml`, `publish-mirror.yml` | no — `push` / `workflow_run` only | — |

Two more checks appear in the picker and come from the Vercel GitHub app, not
from this repository: `Vercel` and `Vercel Preview Comments`. Requiring them
ties merges to a third-party deployment; leave them out unless that is what you
want.

**Require `E2E Status`, never `E2E Tests`** — and the reason is not the one it
looks like. Measured on PR #197 (2026-08-28), with `CONVEX_E2E_ENABLED` unset:

```
E2E Tests:  status=completed  conclusion=skipped
E2E Status: status=completed  conclusion=success
```

The gated job *does* post a check run, and GitHub counts a `skipped` required
check as satisfied. So requiring `E2E Tests` would not block anything — it would
go **quietly green** every time somebody unsets the variable, which is the exact
failure `e2e-status` was added to remove. `e2e-status` carries `if: always()`
and `needs: [e2e]` so one check always reports for real: it passes when the
suite is off, passes when the suite passed, and fails on every other outcome
including `cancelled` (`e2e.yml:154-178`).

`E2E Tests` and `E2E Status` are only produced by `pull_request`
(`e2e.yml:3-6`) — there is no `push` trigger. A direct push to `main` gets the
four `CI` checks and the two `Security` ones, and no E2E signal at all.

---
## 3. The test deployment — no longer anyone's to provision

**Sections 3 and 4 of this runbook used to ask the account owner for a Convex
project and twelve `E2E_*` secrets. Neither is needed any more, and nothing here
is waiting on an owner.**

`e2e.yml` starts its own Convex backend on the runner: it downloads the same
`convex-local-backend` binary the Convex CLI uses for a local deployment, mints
an instance secret and an admin key with `openssl` and `keygen`, runs it on
127.0.0.1:3310, and pushes `apps/reference/convex/` to it with
`convex deploy`. No account, no login, no secret, and nothing that can be left
unset by mistake. The runner is destroyed afterwards.

That was the whole reason the suite never ran. The job was gated on
`vars.CONVEX_E2E_ENABLED == 'true'`; the variable was never created, because
creating it meant first provisioning a deployment and twelve secrets. The gate
is gone — the job now runs on every pull request.

Verified end to end on 2026-08-31, against exactly this setup:

| Step | Result |
|---|---|
| `convex deploy` to the local backend | all tables, indexes and the Better Auth component installed, exit 0 |
| `pnpm build --filter=@beyours/reference...` | 7/7 tasks, real output |
| `npx tsx scripts/seed-users.mts` | 6 accounts, 6 profiles, restaurant fixture, exit 0 |
| `auth.setup.ts` | signs in, saves storage state |
| `public` project | 74 tests executed, 64 passed |
| `admin` project (Dashboard) | 34 of 36 passed |

### Pinning the backend

`CONVEX_BACKEND_VERSION` in `e2e.yml` names a
[convex-backend release](https://github.com/get-convex/convex-backend/releases).
It is pinned, not `latest`, so the suite fails when the product changes and not
when the backend does overnight. Bump it deliberately, and keep it roughly in
step with the `convex` version in `apps/reference/package.json`.

### If you ever do want a hosted deployment

Nothing above stops you. Point `NEXT_PUBLIC_CONVEX_URL`,
`NEXT_PUBLIC_CONVEX_SITE_URL` and `CONVEX_SITE_URL` at it in the
*Write the suite's environment* step, drop the *Start a Convex backend* and
*Deploy Convex functions* steps, and supply `CONVEX_DEPLOY_KEY`. Never point it
at a deployment a client is served from: the seed creates accounts and the suite
writes orders, products and team members.

---

## 4. What is still outstanding — owner and admin only

Two things, and neither blocks the suite from running.

1. **Add `E2E Status` to the required checks.** Protection currently requires
   `Lint`, `Type Check`, `Test`, `Build` (section 6). `E2E Status` was left out
   deliberately, because a check that is red for reasons nobody intends teaches
   the team that a required check is advisory. Section 5 is the procedure: watch
   it stay green across several pull requests first, then add it.

   It is `E2E Status`, never `E2E Tests`. A gated job reports
   `conclusion=skipped`, which GitHub counts as satisfied.

   ```bash
   gh api -X PATCH repos/be-in-digital/beyours/branches/main/protection/required_status_checks \
     -f 'contexts[]=Lint' -f 'contexts[]=Type Check' -f 'contexts[]=Test' \
     -f 'contexts[]=Build' -f 'contexts[]=E2E Status'
   ```

2. **Read the Convex spending cap** (`#178`). A cap set too low disables every
   project on the team, production included. The procedure is
   `tasks/convex-spending-cap-runbook.md`; reading the current value needs the
   Convex console and belongs to the account owner. Nothing in this repository
   can observe it.

---

## 5. Prove it runs before you make it required

Order matters. A required check that has never passed once locks the repository.

1. Open a throwaway pull request against `main`.
2. Confirm on it that **`E2E Tests` ran** — not skipped — and read the job log:
   - `Server ready after Ns` then `=== Seeding complete! ===` in *Seed test users*.
     A red step here now stops the job on purpose; before this card it was
     swallowed by `|| true`.
   - Playwright reporting a **non-zero number of tests executed**. `0 passed` is
     the failure this whole card exists to remove.
3. Download the `playwright-report` artifact and read the pass/fail split.

**Expect red, and plan for it.** The `public` project was run end to end on
2026-08-28 against a seeded backend, with `CI=true` so the retry and server
settings match the job's:

```
6 failed
  address-autocomplete.spec.ts:147  standalone: typing shows suggestions and clicking one fills all fields
  address-autocomplete.spec.ts:182  dialog: clicking a suggestion does NOT close the dialog
  auth/sign-in.spec.ts:100          should attempt redirect on successful login
  storefront/stale-store-selection.spec.ts:39  renders the storefront rather than blanking on it
  storefront/stale-store-selection.spec.ts:69  recovers onto a store the deployment does have
  storefront/tracking.spec.ts:36    should eventually display invalid token message
59 passed (8.4m)
```

That is the *easy* project — 65 of 503 tests, the ones that need no login. The
failures are the S0-3 family (specs written against a UI that has moved on: the
tracking page no longer renders "Commande introuvable") plus two that want a
Google Maps key the workflow does not set. `admin` — 437 tests behind
`auth.setup.ts` — has not been measured, and S0-4's 80 conditional assertions
live there.

**So take the second path:**

- **The suite is green** → add `E2E Status` to the required list in step 6.
- **The suite is red — measured, today** → **do not make `E2E Status` required
  yet.** Make the four `CI` checks required now (they pass; verified on #202),
  leave `CONVEX_E2E_ENABLED=true` so the suite runs and is visible on every PR,
  and add `E2E Status` once it has been green across a few consecutive PRs. A
  red required check that everybody learns to override teaches the team that
  required checks are advisory.

> **The 30-minute job timeout will not be enough.** `e2e.yml:12` sets
> `timeout-minutes: 30`, and Playwright runs `workers: 1`
> (`playwright.config.ts:38`) with 2 retries in CI — deliberately, both are
> documented in that file as fixes for real flakiness. 65 tests took **8.4
> minutes** in the measurement above. 503 will not fit. Raise the timeout when
> you switch the flag on, or split the projects across jobs. `e2e-status`
> correctly reports a cancelled job as a failure, so a timeout blocks merges
> rather than passing quietly — which is the right behaviour and also means you
> will notice immediately.

---

## 6. Turn protection on — repo admin only · ✅ DONE 2026-08-28

Settings → Branches → branch protection on `main`. What is **applied today**:

| Setting | Applied | Note |
|---|---|---|
| Required checks | `Lint`, `Type Check`, `Test`, `Build` | the four `ci.yml` job names from §2 |
| Require branches to be up to date (`strict`) | **on** | the setting you will feel daily — see below |
| Required approving reviews | **0** | a pull request is required; an approval is not |
| Do not allow bypassing (`enforce_admins`) | **off** | deliberate, see below |
| Force pushes / deletions on `main` | blocked | |

Three choices worth not "fixing" without a reason:

- **`E2E Status` is not required.** §5 measured the `public` project at 59
  passed / 6 failed. Requiring a red check teaches the team that required checks
  are advisory. Add it once the suite has been green across consecutive PRs —
  and add `E2E Status`, never `E2E Tests`, for the reason §2 gives.
- **`Gitleaks` and `pnpm audit` are not required.** A new advisory in a
  dependency nobody touched would block unrelated merges.
- **Bypass is left on.** Turning it off before the checks have been stable for a
  week means an admin cannot merge the fix for the thing that broke CI.

**`strict: true` is the setting that costs time.** A pull request that is green
but behind `main` cannot merge until it is rebased, and on an active day that
can happen more than once per PR — it happened to #202 itself, and again to
[#203](https://github.com/be-in-digital/beyours/pull/203), which needed two
rebases. That is the intended trade (nothing reaches `main` untested against
`main`), but if it becomes the bottleneck it is one call to relax:

```bash
gh api -X PATCH repos/be-in-digital/beyours/branches/main/protection/required_status_checks -f strict=false
```

Verify from the outside:

```bash
gh api repos/be-in-digital/beyours/branches/main/protection --jq '.required_status_checks.contexts'
```

Today this prints `["Lint","Type Check","Test","Build"]`. A `404 Branch not
protected` would mean protection has been removed, not that the command is
wrong.

---

## 7. What this repo can and cannot detect

| | Detected today? |
|---|---|
| Lint / type / unit-test / build regression | **Yes** — `ci.yml`, on every PR, and **blocking** since 2026-08-28 (§6). |
| A committed secret | **Yes** — `security.yml`, but see `rotation-deliveroo` history: a green scan says nothing about what is already in the history |
| A functional regression in a user journey | **No.** The E2E suite has never run. That is what §3–§5 change. |
| **The Convex backend failing to compile** | **No.** `apps/*/tsconfig.json` excludes `convex/`, `next build` does not touch it, and no workflow runs `convex deploy` or `convex codegen` — TECH-12, first box. |
| A `release.yml` publish over a red CI | **No.** It triggers on `push` to `main` with no `needs:` — TECH-12, second box. Branch protection narrows this (nothing reaches `main` without passing) but does not close it: a direct admin push still publishes. |
| **`DELIVEROO_*` secrets set but silently stripped** | **No.** The `test` task in `turbo.json` has the same missing-`env` shape this card fixed for `test:e2e`. The 11 Deliveroo suites self-skip when their variables are absent, so setting them in CI would not make them run. Nobody has set them, so nothing is wrong today — but the same trap is armed. |

---

## 8. Sign-off

- [ ] A Convex deployment dedicated to CI exists, and is **not** one any client is served from
- [ ] Its functions have been pushed (`npx convex deploy`), and there is a note of who re-pushes them when `convex/` changes
- [ ] `BETTER_AUTH_SECRET`, `ENCRYPTION_KEY`, `SITE_URL` set **on the deployment**
- [ ] `BETTER_AUTH_SECRET` on the deployment and `E2E_BETTER_AUTH_SECRET` in GitHub hold the same value
- [ ] Repository **variable** `CONVEX_E2E_ENABLED=true`
- [ ] `E2E_NEXT_PUBLIC_CONVEX_URL` set; `E2E_CONVEX_DEPLOY_KEY` set
- [ ] A pull request has been observed where `E2E Tests` **ran**, the seed reported `=== Seeding complete! ===`, and Playwright executed a non-zero number of tests
- [ ] The pass/fail split of that run is written down, and §5's branch chosen from it
- [x] `main` requires `Lint`, `Type Check`, `Test`, `Build` — applied 2026-08-28
- [ ] `E2E Status` required — **only** once the suite has been green on consecutive PRs
- [x] `gh api …/branches/main/protection` returns the intended context list

---

*Related: `apps/reference/e2e/README.md` (running the suite, and the secret
table), `apps/reference/.env.e2e.example` (which variable lives on the
deployment and which on the runner), `tasks/sprint-durcissement-reference.md`
§Sprint 0 (S0-1 is this card; S0-3 to S0-5 are the suite defects §5 warns
about), `apps/themes/docs/SETUP-CI.md` (the same job for the mirror and client
repos — different check names).*
