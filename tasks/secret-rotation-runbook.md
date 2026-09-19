# Runbook — Secret rotation & git history purge

> Operational procedure following the production audit. This file contains
> **no secret**: the values are pulled out of the history at purge time, or
> typed by you into the portals. Never commit a secret.

## Context (what leaked)

| Item | Where | Severity | Action |
|---------|-----|---------|--------|
| `DELIVEROO_CLIENT_ID` + `DELIVEROO_CLIENT_SECRET` (sandbox) | hardcoded in `scripts/deliveroo-menu-scenarios.sh`, present in git history | High | Regenerate + purge the history |
| **the same** Deliveroo `client_id` + `client_secret` | also `apps/restaurant-theme/e2e/deliveroo/test-config.ts` | High | Same rotation; covered by `--replace-text` in Part B |
| Better Auth session token + `convex_jwt` | `apps/restaurant-theme/e2e/.auth/admin.json`, in the history | Low since 2026-02-25 (was Medium — expired, test account) | Accepted in `.gitleaksignore`; still purged by Part B |

> **No per-file commit count belongs in this table**, and one used to: the
> Deliveroo row read "18 commits" against `test-config.ts` alone. That number
> was wrong, and wrong in the direction that matters — it counted one of the two
> files and silently omitted `scripts/deliveroo-menu-scenarios.sh`, where the
> secret lived **longest**. The real figures are per *commit*, span both files,
> and live in exactly one place in this document: **Blast radius**, below. Do not
> restate a count here — cite that table, or it drifts again. It already did:
> the correction was measured on 2026-09-04 and recorded in `.gitleaksignore`,
> and three "18 commits" claims survived in this file until 2026-09-09.

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
full history on every push (`gitleaks detect --source . --redact --verbose
--no-banner`, CLI pinned to **8.21.2**, `fetch-depth: 0`). Its verdict has
changed twice, so date any statement about it:

| Run | Scope | Findings |
|---|---|---|
| 2026-08-16 | 270 commits | **3** — before the two project rules existed |
| 2026-09-04 | 466 commits | **4** — the two new rules firing on `7cf4d41` |
| 2026-09-04 → today | same | **0 reported** — those four are fingerprint-scoped in `.gitleaksignore` |

| Finding | Reported by gitleaks? | Real leak? | Covered here? |
|---|---|---|---|
| `convex_jwt` in `apps/restaurant-theme/e2e/.auth/admin.json:15` | **Yes**, then silenced by fingerprint | **Yes** | A.2 + Part B |
| `ENCRYPTION_KEY` in `packages/core/src/env/__tests__/schemas.test.ts:101` | Was, until `061436a` | No — test fixture | allowlisted in `.gitleaks.toml` |
| Deliveroo secret in `scripts/deliveroo-menu-scenarios.sh` | **No** until #315; **yes** since, then silenced by fingerprint | **Yes** | A.1 + Part B |
| Deliveroo secret in `apps/restaurant-theme/e2e/deliveroo/test-config.ts` | **No** until #315; **yes** since, then silenced by fingerprint | **Yes** | A.1 + Part B |

Two things follow:

1. **Gitleaks did NOT flag the Deliveroo secret — until #315.** Its default
   rules do not match that pattern, so two project rules were added
   (`deliveroo-client-secret-shape` and `-context`, in `.gitleaks.toml`). They
   fire on four historical findings, all on `7cf4d41` of 2026-03-11, and made
   `security.yml` red on `main` itself on every run. Those four are now
   fingerprint-scoped in `.gitleaksignore` (`:110-113`) so the scanner can still
   report a fifth; read that entry, it states plainly that the secret remains
   unrotated.

   **That silencing was verified by execution on 2026-09-09**, because a
   fingerprint file that does not actually work would leave the scanner mute on
   a real leak. Built a throwaway repo carrying a *fabricated* 52-character
   base36 token in the same two paths and the same two syntactic positions as
   the real leak (`:-` in a shell default, `|| "` in TypeScript), and ran the
   CI command against it with gitleaks 8.21.2:

   ```
   no .gitleaksignore                     -> leaks found: 4    exit 1
   the four fingerprints in .gitleaksignore -> no leaks found  exit 0
   + a FIFTH secret, new line, same file   -> leaks found: 1   exit 1
   ```

   The third line is the one that justifies the entry: silencing four known
   findings is what lets the scanner speak about a fifth, and it does — one
   finding, not five and not zero. `.gitleaksignore`'s per-fingerprint scoping
   (commit × path × rule × line) is doing exactly what it claims.

   The instruction stands unchanged: do not treat a green Gitleaks run as proof
   the history is clean — this runbook stays the source of truth for A.1.
2. **The JWT finding is accepted, not fixed** (decided 2026-08-26). It is
   recorded in `.gitleaksignore`, with the measurements that justify it: the
   token expired 2026-02-25, it was a 15-minute session on a dev deployment,
   both cookies were scoped to localhost, and the repository is private. It is
   deliberately NOT in `.gitleaks.toml`, which stays reserved for values that
   were never credentials.

   The consequence has to be said plainly: **Gitleaks is green while the history
   is still dirty.** The Deliveroo secret above is *detected* — item 1's two
   rules match it — and then accepted by fingerprint, and it is still unrotated.
   Read this runbook, not the check. (This paragraph used to say the secret was
   "undetected by the scanner", which stopped being true with #315 and is
   contradicted by item 1 above. Corrected 2026-09-09.)

   Purging was deferred rather than rejected: Part B rewrites every SHA and
   would invalidate the 14 pull requests open at the time. **That blocker has
   expired** — the queue is no longer what it was. What a rewrite costs is in
   the Blast radius table below, and only there: this sentence used to restate
   the figures, and they were five days stale the moment the table was
   re-measured on a full clone.

---

## Part A — Secret rotation

General order for **any** secret:

**regenerate → write the new value into the store FIRST → propagate → re-verify
→ revoke the old one.** Never put the value in the repo.

> ⚠️ **"Store first" is not tidiness, it is correctness.** For any credential
> BeYours owns, `setup-convex-env.sh --infisical` treats Infisical as
> authoritative: it pushes the store's value and then lets `.env.convex` fill in
> only what the store did not carry. So a value rotated on a deployment but not
> in the store is **undone by the next provisioning run of that deployment** —
> silently, and with a green summary. Change the store, then propagate outwards.
> §A.3 says which secrets that applies to.

### A.1 — Deliveroo (sandbox), top priority

1. **Regenerate**: Deliveroo Developer Portal → your sandbox app → *Credentials* → regenerate the `client_secret`.
2. **Write it into Infisical first** — this is a credential BeYours owns, so
   `/platform` is where it lives and every other copy is downstream of it:

   ```bash
   infisical secrets set DELIVEROO_CLIENT_SECRET \
     --projectId="$INFISICAL_PROJECT_ID" --env=prod --path=/platform
   ```

3. **Propagate** to every deployment that needs it. There is no Convex sync —
   the value moves when somebody runs this against a deployment, and not before:

   ```bash
   # In EACH client repo, and in apps/themes / apps/reference here:
   export INFISICAL_PROJECT_ID=<the platform project>
   export INFISICAL_ENV=prod
   bash scripts/setup-convex-env.sh --infisical --dry-run   # names only
   bash scripts/setup-convex-env.sh --infisical             # dev deployment
   bash scripts/setup-convex-env.sh --infisical --prod      # prod deployment

   # Read the count. "0 variables set" means nothing propagated, and since
   # 07/09/2026 an empty folder is a hard error rather than a green line.
   ```

   Deliveroo is not read on the Next side, so there is no Vercel copy to change.
   Local `.env.local` files are stale the moment they exist: `pnpm dev` goes
   through the store (`apps/docs/deployment/infisical.md`), so the fix for a
   laptop is to delete the file, not to edit it.

   The list of deployments is still yours to keep — Infisical pushes nothing
   on its own. What disappears is the retyping, and the risk that two
   deployments end up holding different values. Conventions and setup:
   [`apps/docs/deployment/infisical.md`](../apps/docs/deployment/infisical.md).

   > ⚠️ **Until 07/09/2026 that command propagated nothing.** `INFISICAL_PATH`
   > defaulted to `/`, the root folder, which holds zero keys in every
   > environment — every secret lives one level down. The run printed a
   > confident `0 variables set on Convex` per client and exited 0, so a
   > rotation done exactly as written left every restaurant on the revoked
   > credential. The default is now `/platform`, `/` is refused, and a folder
   > that exports no key is a hard error. If you ran a rotation before that
   > date, **it did not land**: run it again and read the count.

4. **Re-verify**: send a signed test webhook (see audit option 3: webhook simulator) → must answer `200`; a badly signed payload → `401`.
5. **Revoke** the old secret in the portal once traffic is healthy.

### A.2 — Invalidate the leaked Better Auth session

This is a **test** account (`test.owner@beindigital.fr`) on the dev deployment:

- **Simple option (targeted)**: Convex Dashboard → the Better Auth component's `session` table → delete that user's row(s) (and/or delete the test user). The leaked `convex_jwt` expires on its own.
- **Nuclear option**: rotate `BETTER_AUTH_SECRET` (invalidates **every** session/JWT → logs everyone out). Keep this for cases where a real account is in doubt.

### A.3 — Reference: where each secret lives, and in what order to change it

This table used to have a **GitHub Secrets** column full of `(E2E_*)` marks and
no Infisical column at all. Both were wrong, and wrong in the direction that
makes a rotation fail quietly:

- **The `E2E_*` secrets do not exist.** This repository stores exactly four
  secrets — `INFISICAL_CLIENT_ID`, `INFISICAL_CLIENT_SECRET`, `MIRROR_PUSH_TOKEN`
  and `TURBO_TOKEN` (plus the automatic `GITHUB_TOKEN`). Since
  [#276](https://github.com/be-in-digital/beyours/pull/276) the e2e job starts
  its own Convex backend on the runner and reads no application secret at all.
  Anyone following the old table went looking for thirteen values that were not
  there — and, worse, could reasonably conclude the sweep was done.
- **Infisical was missing**, and it is now the *first* place to change, not the
  last. `setup-convex-env.sh --infisical` makes the store authoritative over
  `.env.convex`, so a deployment rotated by hand is reverted by its own next
  provisioning run if the store still holds the old value.

**The order, for anything in the "BeYours owns it" half:**

> **1.** regenerate in the portal → **2.** `infisical secrets set … --path=/platform`
> → **3.** `setup-convex-env.sh --infisical [--prod]` on every deployment
> → **4.** re-verify → **5.** revoke the old value.

| Secret | Owner | Infisical | Convex env | Vercel | `.env.local` |
|---|---|:---:|:---:|:---:|:---:|
| `UBER_EATS_CLIENT_ID` / `_CLIENT_SECRET` / `_WEBHOOK_SECRET` | BeYours | `/platform` | ✅ every deployment | — | via the store |
| `UBER_DIRECT_WEBHOOK_SECRET` | BeYours | `/platform` | ✅ every deployment | — | via the store |
| `DELIVEROO_CLIENT_ID` / `_CLIENT_SECRET` / `_WEBHOOK_SECRET` | BeYours | `/platform` | ✅ every deployment | — | via the store |
| `OPENAI_API_KEY` | BeYours | `/platform` | ✅ every deployment | — | via the store |
| `STRIPE_BID_SECRET_KEY` / `_WEBHOOK_SECRET` / the seven `STRIPE_BID_PRICE_*` | BeYours | `/platform` | ✅ every deployment | — | via the store |
| `BID_NOTIFY_EMAIL` | BeYours | `/platform` | ✅ every deployment | ✅ `apps/site` | via the store |
| `STRIPE_SECRET_KEY` / `_WEBHOOK_SECRET`, `PAYPAL_*`, `SUMUP_*` | the restaurant | ❌ never | ✅ its own | ✅ its own | its own `.env.convex` |
| `AWS_ACCESS_KEY_ID` / `_SECRET_ACCESS_KEY` | the restaurant | ❌ never | ✅ its own | ✅ its own | its own `.env.convex` |
| `BETTER_AUTH_SECRET`, `EMAIL_API_SECRET`, `ENCRYPTION_KEY`, `ADMIN_BOOTSTRAP_TOKEN`, `SEED_PASSWORD` | the deployment | ❌ never | ✅ its own | ✅ its own | its own `.env.convex` |
| `JWT_PRIVATE_KEY`, `JWKS` | the deployment | ❌ never | written by the auth CLI | — | — |
| `INFISICAL_CLIENT_SECRET` | BeYours | ❌ (it opens the store) | — | — | GitHub Secrets + the password manager |

The `apps/site` half — `STRIPE_*` for beyours.fr, `RESEND_API_KEY` — lives in
`/site` and reaches Vercel through the secret sync, not through this script.

**"Owner" is the whole rule.** The rows marked ❌ *never* are not
recommendations:

- A per-restaurant credential in a shared folder would be pushed onto every
  other restaurant by the very command above.
- A per-deployment secret in a shared folder is worse: two sites holding one
  `ENCRYPTION_KEY` means either one's leak decrypts the other's stored OAuth
  tokens. Both `setup-convex-env.sh` and `infisical-bootstrap.mjs` now refuse to
  move those seven names into or out of a shared folder, and
  `pnpm env:check --env=prod` reports one if it finds it. Before 07/09/2026
  nothing did, and `/themes` was found holding them.

> ⚠️ **`ENCRYPTION_KEY`** encrypts the stored OAuth tokens (`uberEatsConnections`).
> Rotating it makes existing tokens unreadable → merchants will have to
> **re-run the OAuth connect flow**. Plan it, don't improvise it. It is also
> per-deployment: rotating it is N separate operations, not one.

**What this table cannot tell you is what the store actually holds today.** Ask
it, don't trust a document:

```bash
pnpm env:check --env=prod          # 0 complete · 1 incomplete · 3 store down
```

`.github/workflows/env-store-health.yml` runs that every morning and annotates
the result. It is deliberately not a required check: a merge must not depend on
a third party's uptime.

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

The same two values also live in `apps/restaurant-theme/e2e/deliveroo/test-config.ts`.
`--replace-text` scrubs every blob in history, so that file is covered by the same
replacement file — provided the two lines above are correct. **Do not put a commit
count on either file here**: the count that matters is per commit across both, and
it is in Blast radius below. This sentence used to read "(18 commits)", which was
the single wrong number this whole document was built around.

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

**This table is the only place in this document that carries a commit count.**
Every other section cites it. That is deliberate: the "18 commits" figure was
wrong for months precisely because four sections each restated it and none of
them was the source.

The 2026-08-16 figures below were stale in every direction. Re-measured by
execution:

| | 2026-08-16 | **2026-09-04** |
|---|---|---|
| Commits across all local refs | 387 | **699** |
| Commits reachable from origin | — | **680** (was 470 on 4 Sep) |
| Commits on `main` (all rewritten) | — | **472** (was 393 on 4 Sep) |
| Commits containing the secret, all refs | — | **137** |
| …of those, ancestors of `main` (published) | 18 (claimed) | **41** |
| …local-only, never pushed | — | **96** |
| Remote branches carrying the leak | 4 | **72 — every one** (was 8 on 4 Sep) |
| Remote tags carrying the leak | 10 of 35 | **75** (was 59 of 60); 63 are `@be-in-digital/*` release anchors |
| Open PRs invalidated | 14 | **2** (#420, #421 — drafts, 9 Sep; a draft's SHAs die like any other) |

**How to re-measure — and why you must, before you quote any of it.**
These figures were taken on 2026-09-04 on a *full* clone with every ref fetched.
They are reproduced here, not re-verified: the counts depend on refs that a
working clone may not hold. Re-run them before acting:

```bash
# 1. A FULL clone. A shallow one silently answers a different question.
git clone https://github.com/be-in-digital/beyours.git measure && cd measure
git fetch --tags --prune origin '+refs/heads/*:refs/remotes/origin/*'
git rev-parse --is-shallow-repository        # must print: false

# 2. Recover the secret from the commit that introduced it — never type it.
SECRET=$(git show 7cf4d41:scripts/deliveroo-menu-scenarios.sh \
  | sed -nE 's/.*DELIVEROO_CLIENT_SECRET:-([0-9a-z]{52})\}.*/\1/p')
test -n "$SECRET" || echo "FAILED to recover the value — do not proceed"

# 3. The three counts, in the units the table uses.
git log --all        --format=%H -S"$SECRET" | wc -l   # all local refs   (was 137)
git log origin/main  --format=%H -S"$SECRET" | wc -l   # published        (was  41)
# local-only = the first minus the second                                 (was  96)

git rev-list origin/main --count                       # rewritten by Part B (was 393)
```

> ⚠️ **Do not run step 3 in a shallow clone and believe the answer.** Measured
> here on 2026-09-09: `git rev-parse --is-shallow-repository` → `true`,
> `git rev-list --all --count` → `67`, `git tag | wc -l` → `0`, and `7cf4d41` is
> not present at all (`git cat-file -t 7cf4d41` → `fatal: Not a valid object
> name`). A shallow clone answers **zero** to every count above and looks clean.
> The same trap catches the scanner: the CI command run here returned
> `60 commits scanned … no leaks found`, exit 0 — green, on a clone that simply
> does not contain the leaked commits. That is a third distinct way to get a
> green Gitleaks over a dirty history, alongside "no rule matched" and
> "fingerprint silenced".

Two of these change the decision rather than just the arithmetic:

- **The blocker has expired.** Part B was deferred because it would invalidate
  14 open pull requests. The queue is empty. That reason no longer applies.
- **59 of the 60 remote tags carry the leak**, and they are the
  `@be-in-digital/*` release anchors. A rewrite moves every one of them, so the
  publish chain's version anchors all move with it. This is now the expensive
  part, not the PRs.

  They are on the OLD scope, and will stay there until the first `@be-yours`
  release. The rename (#572) reset the ten packages to `1.0.0` but publishes
  nothing while `RELEASE_HOLD.md` is in the tree, so `git tag -l '@be-yours/*'`
  answers **0** today against **125** for `@be-in-digital/*`. Whoever runs Part B
  matches on the old scope — matching on the new one moves nothing.

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

**Consequence, and how it was settled.** Those rules made the `Gitleaks (secret
scan)` job fail on `main` itself on every run. **#337 (merged 4 Sep 2026)
accepted the four findings by fingerprint** — commit, file, rule and line — so
that a *fifth* leak is visible instead of arriving as one more line in a
permanently red list. See item 1 above and the entry in `.gitleaksignore`, which
states in the same breath that the secret remains unrotated. The job is **not**
one of the five required status checks (Lint, Type Check, Test, Build, E2E
Status), so neither red nor green has ever blocked a merge.

The four lines come out when Part B rewrites the history. Until then: a green
Gitleaks run is not proof this history is clean, and this runbook — not the
check — is the source of truth for A.1.

*(This paragraph previously instructed "do not silence it in `.gitleaksignore`",
which #337 reversed. Corrected 2026-09-09.)*

**Verified by execution, 2026-09-09**, because "a fifth leak is still visible" is
a claim about a tool and was worth measuring rather than trusting. On a
synthetic repository reproducing the same two paths and the same syntactic
positions with a fabricated token, under the pinned gitleaks 8.21.2: **4**
findings with no ignore file (exit 1), **0** with the four fingerprints
(exit 0), **1** when a fifth occurrence is added on a new line (exit 1). The
scoping works, so the trade is real rather than hoped-for.

So `.gitleaksignore` records **two** kinds of entry, and they must not be
confused. One is a credential accepted as *no longer exploitable* — the
`convex_jwt`, provably dead: expired, fifteen-minute lifetime, localhost scope.
The other is a credential *still live* whose finding is silenced only to keep
the channel usable, which is this one. The second kind carries an expiry, and
it is the sentence above: those four lines come out when Part B rewrites the
history. An entry of the second kind left behind after a rotation would be the
first kind's claim made falsely.

Then: tell the team to **re-clone** (old clones keep the leaked history), and
rebase / close-reopen the open PRs if needed. GitHub can keep cached views for a
while; open a GitHub support ticket if the repo is public and an immediate cache
purge is required.

> Alternative: [BFG Repo-Cleaner](https://rtyley.github.io/bfg-repo-cleaner/)
> (`bfg --replace-text secrets-to-redact.txt` + `bfg --delete-files admin.json`).
> git-filter-repo is the recommended tool today.

---

## Checklist

> **Nothing below is unblocked by repository work.** A.1 step 1 and the whole of
> Part B are **account-owner actions** — regenerating the credential lives in the
> Deliveroo Developer Portal, and force-pushing a rewritten `main` is a decision
> only the owner can take. #172 is open for exactly that reason. No amount of
> editing this file rotates anything.

- [ ] A.1 Deliveroo secret regenerated in the portal — **account owner, Deliveroo
      Developer Portal. This is the one that actually ends the exposure, and it
      must happen BEFORE Part B, not after: a rewrite of a live credential's
      history still leaves the credential live.**
- [ ] A.1 Written into Infisical `/platform` FIRST (or the next provisioning
      run of any deployment silently restores the old value)
- [ ] A.1 Propagated with `setup-convex-env.sh --infisical [--prod]` on every
      deployment, **count read** on each run — not GitHub Secrets, which hold no
      `E2E_*` value and never did
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
- [x] The PR-queue blocker has expired — **0 open PRs** (measured 2026-09-04; was
      14). Part B is no longer waiting on the queue. It is waiting on the owner.
- [ ] Drop the four Deliveroo fingerprints from `.gitleaksignore` **as part of**
      Part B, in the same change that rewrites the history — not before (the
      finding comes back and drowns the channel) and not after (the file then
      claims a leak that no longer exists)
- [ ] B History purge done on a fresh clone + force-push — **account owner;
      the size of it is the Blast radius table above, re-measured before you
      start rather than read from here**
- [ ] B Team told to re-clone; open PRs handled
- [ ] B `secrets-to-redact.txt` deleted
- [ ] Owner + rotation cadence defined (periodic rotation)
