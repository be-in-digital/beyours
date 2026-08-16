# Runbook — Secret rotation & git history purge

> Operational procedure following the production audit. This file contains
> **no secret**: the values are pulled out of the history at purge time, or
> typed by you into the portals. Never commit a secret.

## Context (what leaked)

| Item | Where | Severity | Action |
|---------|-----|---------|--------|
| `DELIVEROO_CLIENT_ID` + `DELIVEROO_CLIENT_SECRET` (sandbox) | hardcoded in `scripts/deliveroo-menu-scenarios.sh`, present in git history | High | Regenerate + purge the history |
| Better Auth session token + `convex_jwt` | `apps/restaurant-theme/e2e/.auth/admin.json`, in the history | Medium (test account) | Invalidate the session + purge the file |

> ⚠️ **`apps/restaurant-theme/` no longer exists** — that app was split into
> `apps/reference` and `apps/themes`. The path above is kept **verbatim on
> purpose**: it is the path the file had *in the commits*, and that is what
> Part B targets. Verified — it is the only path this file ever had. Do not
> "modernize" it.

> The current code no longer contains these values (fixed on the audit branch),
> but **deleting a file does not purge the history**: past commits still expose
> them for as long as the history is not rewritten.

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
cd /tmp && git clone git@github.com:be-in-digital/<repo>.git purge && cd purge
```

### B.2 — Generate the replacement file from the history (no secret typed by hand)

This one-liner reads the old version of the script and writes `secrets-to-redact.txt`
in the format git-filter-repo expects, without you copying the value:

```bash
git show origin/main:scripts/deliveroo-menu-scenarios.sh \
  | grep -E 'DELIVEROO_CLIENT_(ID|SECRET):-' \
  | sed -E 's/.*:-([^}]+)}.*/literal:\1==>***REDACTED***/' \
  > secrets-to-redact.txt

# Check (prints the structure only, not the value):
sed -E 's/literal:.*==>/literal:<masqué>==>/' secrets-to-redact.txt
# Must print 2 lines "literal:<masqué>==>***REDACTED***"
```

> `secrets-to-redact.txt` is already in `.gitignore`. Delete it after the purge.

### B.3 — Rewrite the history

```bash
# 1) Replace the secret values in the WHOLE history
git filter-repo --replace-text secrets-to-redact.txt

# 2) Remove the leaked auth state file from the WHOLE history
#    KEEP this path as-is. `apps/restaurant-theme/` is gone from the working
#    tree, but filter-repo matches paths AS THEY WERE IN THE COMMITS, and this
#    is the only path the file ever had. Rewriting it to apps/reference/ or
#    apps/themes/ would silently purge NOTHING.
git filter-repo --path apps/restaurant-theme/e2e/.auth/admin.json --invert-paths
```

### B.4 — Republish + clean up

```bash
git remote add origin git@github.com:be-in-digital/<repo>.git   # filter-repo drops the remote as a safety measure
git push --force --all
git push --force --tags
rm -f secrets-to-redact.txt
```

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
- [ ] A.2 Leaked Better Auth session deleted (or `BETTER_AUTH_SECRET` rotated)
- [ ] B History purge done on a fresh clone + force-push
- [ ] B Team told to re-clone; open PRs handled
- [ ] B `secrets-to-redact.txt` deleted
- [ ] Owner + rotation cadence defined (periodic rotation)
