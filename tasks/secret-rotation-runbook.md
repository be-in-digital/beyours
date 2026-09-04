# Runbook — Secret rotation & git history purge

> Operational procedure following the production audit. This file contains
> **no secret**: the values are pulled out of the history at purge time, or
> typed by you into the portals. Never commit a secret.

## Context (what leaked)

| Item | Where | Severity | Action |
|---------|-----|---------|--------|
| `DELIVEROO_CLIENT_ID` + `DELIVEROO_CLIENT_SECRET` (sandbox) | hardcoded in `scripts/deliveroo-menu-scenarios.sh`, present in git history | High | Regenerate + purge the history |
| **the same** Deliveroo `client_id` + `client_secret` | `apps/restaurant-theme/e2e/deliveroo/test-config.ts`, 18 commits | High | Same rotation; covered by `--replace-text` in Part B |
| Better Auth session token + `convex_jwt` | `apps/restaurant-theme/e2e/.auth/admin.json`, in the history | Low since 2026-02-25 (was Medium — expired, test account) | Accepted in `.gitleaksignore`; still purged by Part B |

> ⚠️ **`apps/restaurant-theme/` no longer exists** — that app was split into
> `apps/reference` and `apps/themes`. The path above is kept **verbatim on
> purpose**: it is the path the file had *in the commits*, and that is what
> Part B targets. Verified — it is the only path this file ever had. Do not
> "modernize" it.

> The current code no longer contains these values (fixed on the audit branch),
> but **deleting a file does not purge the history**: past commits still expose
> them for as long as the history is not rewritten.

### What the automated scan sees (and misses)

The `Gitleaks (secret scan)` job in `.github/workflows/security.yml` scans the
full history on every push. Run of 2026-08-16, 270 commits, **3 findings** — and
the overlap with the table above is only partial:

| Finding | Reported by gitleaks? | Real leak? | Covered here? |
|---|---|---|---|
| `convex_jwt` in `apps/restaurant-theme/e2e/.auth/admin.json:15` | **Yes** | **Yes** | A.2 + Part B |
| `ENCRYPTION_KEY` in `packages/core/src/env/__tests__/schemas.test.ts:101` | Was, until `061436a` | No — test fixture | allowlisted in `.gitleaks.toml` |
| Deliveroo secret in `scripts/deliveroo-menu-scenarios.sh` | **No** | **Yes** | A.1 + Part B |
| Deliveroo secret in `apps/restaurant-theme/e2e/deliveroo/test-config.ts` (18 commits) | **No** | **Yes** | A.1 + Part B |

Two things follow:

1. **Gitleaks did NOT flag the Deliveroo secret — until #315.** Its default
   rules do not match that pattern, so two project rules were added
   (`deliveroo-client-secret-shape` and `-context`, in `.gitleaks.toml`). They
   fire on four historical findings, all on `7cf4d41` of 2026-03-11, and made
   `security.yml` red on `main` itself on every run. Those four are now
   fingerprint-scoped in `.gitleaksignore` so the scanner can still report a
   fifth; read that entry, it states plainly that the secret remains unrotated.

   The instruction stands unchanged: do not treat a green Gitleaks run as proof
   the history is clean — this runbook stays the source of truth for A.1.
2. **The JWT finding is accepted, not fixed** (decided 2026-08-26). It is
   recorded in `.gitleaksignore`, with the measurements that justify it: the
   token expired 2026-02-25, it was a 15-minute session on a dev deployment,
   both cookies were scoped to localhost, and the repository is private. It is
   deliberately NOT in `.gitleaks.toml`, which stays reserved for values that
   were never credentials.

   The consequence has to be said plainly: **Gitleaks is now green while the
   history is still dirty.** The Deliveroo secret above is undetected by the
   scanner and still unrotated. Read this runbook, not the check.

   Purging was deferred rather than rejected: Part B rewrites every SHA and
   would invalidate the 14 pull requests open at the time. Do it once the queue
   is empty.

---

## Part A — Secret rotation

General order for **any** secret: **regenerate → propagate everywhere → re-verify → revoke the old one**. Never put the value in the repo.

### A.1 — Deliveroo (sandbox), top priority

1. **Regenerate**: Deliveroo Developer Portal → your sandbox app → *Credentials* → regenerate the `client_secret`.
2. **Propagate** the new value to every store that needs it:
   ```bash
   # Convex (webhook/action runtime) — on EVERY deployment
   npx convex env set DELIVEROO_CLIENT_SECRET "<nouvelle_valeur>"          # dev
   npx convex env set DELIVEROO_CLIENT_SECRET "<nouvelle_valeur>" --prod   # prod
   # Vercel (if read on the Next side): Dashboard → Settings → Environment Variables
   # GitHub (if ever used in CI): gh secret set DELIVEROO_CLIENT_SECRET
   # Local: apps/reference/.env.local and apps/themes/.env.local (never committed)
   #        plus apps/themes/.env.convex if the value is applied via `pnpm convex:env`
   ```

   > Once the platform store of
   > [`apps/docs/deployment/infisical.md`](../apps/docs/deployment/infisical.md)
   > exists, step 2 shrinks to: change the value **once** in Infisical, then run
   > `bash scripts/setup-convex-env.sh --infisical [--prod]` in each client repo.
   > The list of deployments is still yours to keep — Infisical pushes nothing on
   > its own, and it has no Convex sync. What disappears is the retyping, and the
   > risk that two stores end up holding different values.

3. **Re-verify**: send a signed test webhook (see audit option 3: webhook simulator) → must answer `200`; a badly signed payload → `401`.
4. **Revoke** the old secret in the portal once traffic is healthy.

### A.2 — Invalidate the leaked Better Auth session

This is a **test** account (`test.owner@beindigital.fr`) on the dev deployment:

- **Simple option (targeted)**: Convex Dashboard → the Better Auth component's `session` table → delete that user's row(s) (and/or delete the test user). The leaked `convex_jwt` expires on its own.
- **Nuclear option**: rotate `BETTER_AUTH_SECRET` (invalidates **every** session/JWT → logs everyone out). Keep this for cases where a real account is in doubt.

### A.3 — Reference: where each secret lives (for future rotations)

| Secret | Convex env | Vercel env | GitHub Secrets | `.env.local` |
|--------|:---------:|:----------:|:--------------:|:------------:|
| `UBER_EATS_CLIENT_SECRET` / `_WEBHOOK_SECRET` | ✅ | — | (E2E_*) | ✅ |
| `DELIVEROO_CLIENT_SECRET` / `_WEBHOOK_SECRET` | ✅ | — | (E2E_*) | ✅ |
| `STRIPE_*`, `PAYPAL_*`, `SUMUP_*` | ✅ | ✅ | — | ✅ |
| `AWS_ACCESS_KEY_ID` / `_SECRET_ACCESS_KEY` | ✅ | ✅ | (E2E_*) | ✅ |
| `OPENAI_API_KEY` | ✅ | — | (E2E_*) | ✅ |
| `BETTER_AUTH_SECRET` | ✅ | ✅ | (E2E_*) | ✅ |
| `ENCRYPTION_KEY` | ✅ | ✅ | (E2E_*) | ✅ |

> ⚠️ **`ENCRYPTION_KEY`** encrypts the stored OAuth tokens (`uberEatsConnections`).
> Rotating it makes existing tokens unreadable → merchants will have to
> **re-run the OAuth connect flow**. Plan it, don't improvise it.

---

## Part B — Git history purge

> ⚠️ **History rewrite = force-push.** Coordinate with the team: everyone will
> have to **re-clone**. Do it on a **fresh full clone**, NOT in the Conductor
> workspace (linked worktree, `.git` is a file → filter-repo breaks).
> Prerequisite: the Deliveroo secret must already be **regenerated** (Part A.1),
> so the historical value is dead even if the purge is delayed.

### B.1 — Prepare a fresh clone + the tool

```bash
brew install git-filter-repo          # or: pipx install git-filter-repo
cd /tmp && git clone https://github.com/be-in-digital/beyours.git purge && cd purge
```

### B.2 — Generate the replacement file from the history (no secret typed by hand)

> ⚠️ **Read the source commit carefully.** An earlier version of this step read
> `origin/main:scripts/deliveroo-menu-scenarios.sh` — but that blob is already the
> **fixed** one (`${DELIVEROO_CLIENT_ID:-}`, empty defaults). The `[^}]+` group
> never matches, `secrets-to-redact.txt` ends up holding two raw shell lines
> instead of `literal:…==>…` pairs, and filter-repo then replaces those two
> harmless lines while **purging no secret at all** — with a successful exit code.
> Read the value from `7cf4d41`, the commit that introduced it.

```bash
git show 7cf4d41:scripts/deliveroo-menu-scenarios.sh \
  | grep -E 'DELIVEROO_CLIENT_(ID|SECRET):-' \
  | sed -E 's/.*:-([^}]+)\}.*/literal:\1==>***REDACTED***/' \
  > secrets-to-redact.txt

# Check the STRUCTURE, not the eyeball: must print exactly 2.
grep -c '^literal:.*==>' secrets-to-redact.txt
```

The same two values also live in `apps/restaurant-theme/e2e/deliveroo/test-config.ts`
(18 commits). `--replace-text` scrubs every blob in history, so that file is covered
by the same replacement file — provided the two lines above are correct.

> `secrets-to-redact.txt` is already in `.gitignore` (line 49). Delete it after the purge.

### B.3 — Rewrite the history

> ⚠️ **One invocation, not two.** filter-repo refuses to run a second time on the
> same clone (it is no longer "fresh" and aborts with `already_ran`). Splitting
> this into two commands means the second one silently never executes.

```bash
# KEEP the apps/restaurant-theme/ path as-is. That directory is gone from the
# working tree, but filter-repo matches paths AS THEY WERE IN THE COMMITS, and
# this is the only path that file ever had. Rewriting it to apps/reference/ or
# apps/themes/ would purge NOTHING.
git filter-repo \
  --replace-text secrets-to-redact.txt \
  --path apps/restaurant-theme/e2e/.auth/admin.json --invert-paths
```

### B.4 — Republish + clean up

```bash
git remote add origin https://github.com/be-in-digital/beyours.git   # filter-repo drops the remote as a safety measure

# Check the branches survived the rewrite BEFORE pushing. filter-repo promotes
# remote-tracking refs to local branches in a fresh clone, but if one is missing
# here, `--all` silently leaves it untouched on the remote and the leaked history
# comes straight back through it.
git branch          # expect: main, changeset-release/main,
                    #         chore/monorepo-beyours,
                    #         claude/apps-reference-architecture-0e580f

git push --force --all
git push --force --tags
rm -f secrets-to-redact.txt
```

### Blast radius (re-measured 2026-09-04)

The 2026-08-16 figures below were stale in every direction. Re-measured by
execution:

| | 2026-08-16 | **2026-09-04** |
|---|---|---|
| Commits across all local refs | 387 | **699** |
| Commits reachable from origin | — | **470** |
| Commits on `main` (all rewritten) | — | **393** |
| Commits containing the secret, all refs | — | **137** |
| …of those, ancestors of `main` (published) | 18 (claimed) | **41** |
| …local-only, never pushed | — | **96** |
| Remote branches carrying the leak | 4 | **8 — every one** |
| Remote tags carrying the leak | 10 of 35 | **59 of 60** |
| Open PRs invalidated | 14 | **0** |

Two of these change the decision rather than just the arithmetic:

- **The blocker has expired.** Part B was deferred because it would invalidate
  14 open pull requests. The queue is empty. That reason no longer applies.
- **59 of the 60 remote tags carry the leak**, and they are the
  `@be-in-digital/*` release anchors. A rewrite moves every one of them, so the
  publish chain's version anchors all move with it. This is now the expensive
  part, not the PRs.

> ⚠️ **A rewrite of origin does not reach everything, and origin has been
> rewritten once already.** Local and remote tags of the same name point at
> different commits (e.g. `@be-in-digital/core@2.0.1`: same author date, same
> subject, different tree). Both lineages contain the secret. This clone retains
> the **pre-rewrite** lineage under `archive/main-avant-monorepo` and **34 stale
> local tags** — 96 leaked commits that were never pushed and that a fresh clone
> of origin will not touch. `git fetch` does not update tags that already exist
> locally, which is how they were left behind. Whoever holds such a clone keeps
> the secret: they must delete those refs or rewrite them separately.
>
> Corrected: `c0f09cb` is reachable from **35 local refs and zero remote refs**.
> The earlier claim that CI's checkout fetches it via pushed tags is not true.

### Detection status (2026-09-04)

`.gitleaks.toml` now carries two rules — `deliveroo-client-secret-context` and
`deliveroo-client-secret-shape` — which match this credential. Before them, no
rule did: it is a bare 52-character base36 token, and the leak placed it after
`:-` in a shell default and after `|| "` in TypeScript, neither of which the
stock generic-api-key rule reads as an assignment. That is why the daily scan
was green over a dirty history for months.

Validated over all 7,459 blobs in the object store: the two rules match 3 blobs
and yield exactly one distinct token — the secret. No false positives at HEAD
(2,655 tracked files) or anywhere in history.

**Consequence: the `Gitleaks (secret scan)` job will now FAIL on `main`** until
the credential is rotated and Part B is executed. That job is **not** one of the
five required status checks (Lint, Type Check, Test, Build, E2E Status), so the
red does not block merges — it makes a real finding visible instead of hiding
it. Do not silence it in `.gitleaksignore`: per that file's own policy an entry
records a credential accepted as *no longer exploitable*, and this one has not
been rotated yet.

Then: tell the team to **re-clone** (old clones keep the leaked history), and
rebase / close-reopen the open PRs if needed. GitHub can keep cached views for a
while; open a GitHub support ticket if the repo is public and an immediate cache
purge is required.

> Alternative: [BFG Repo-Cleaner](https://rtyley.github.io/bfg-repo-cleaner/)
> (`bfg --replace-text secrets-to-redact.txt` + `bfg --delete-files admin.json`).
> git-filter-repo is the recommended tool today.

---

## Checklist

- [ ] A.1 Deliveroo secret regenerated in the portal
- [ ] A.1 Propagated: Convex (dev + prod), Vercel, GitHub (if CI), `.env.local`
- [ ] A.1 Signed test webhook → `200`; badly signed → `401`
- [ ] A.1 Old Deliveroo secret revoked
- [x] A.2 Leaked `convex_jwt` expired on its own 2026-02-25 (verified 2026-08-26)
- [ ] A.2 Test account's Better Auth `session` rows deleted on the dev deployment
      (hygiene only — measured 2026-08-26 on `reliable-parrot-452`, the
      `beindigital-engine` dev deployment: **224 session rows, 0 still valid**;
      199 belong to `test.owner@beindigital.fr` and none are active. The two rows
      matching the leaked cookie expired 2026-03-04. Nothing here is exploitable;
      deleting is tidying, not remediation. The CLI cannot do it — `convex data`
      is read-only and no deployed function touches the component — so it is a
      Convex Dashboard operation: Data → component `betterAuth` → `session`.)
- [ ] Re-check `.gitleaksignore` when the PR queue is empty: purge, then drop the entry
- [ ] B History purge done on a fresh clone + force-push
- [ ] B Team told to re-clone; open PRs handled
- [ ] B `secrets-to-redact.txt` deleted
- [ ] Owner + rotation cadence defined (periodic rotation)
