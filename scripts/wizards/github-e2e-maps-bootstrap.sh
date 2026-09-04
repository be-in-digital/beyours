#!/usr/bin/env bash
# ===========================================================================
# scripts/wizards/github-e2e-maps-bootstrap.sh
# ---------------------------------------------------------------------------
# The console-side residue of LAUNCH-08 and LAUNCH-09, in one runnable pass.
#
# Three things no amount of repository work can close, because each ends inside
# somebody else's console:
#
#   1. ADMIN_BOOTSTRAP_TOKEN on the Convex deployment. Without it `/setup`
#      refuses everyone and the client cannot become administrator of the
#      back office they just paid for. WITH the wrong handling of it, the first
#      stranger to find the deployment URL takes the restaurant.
#   2. An HTTP-referrer restriction on NEXT_PUBLIC_GOOGLE_MAPS_API_KEY. The key
#      ships in the client bundle by design — that is what `NEXT_PUBLIC_` means
#      — so an unrestricted one is a billing drain anybody can read off the page.
#   3. Branch protection and the E2E suite on GitHub. Verified here, not set:
#      the E2E secrets that used to be outstanding no longer exist (the job
#      provisions its own Convex backend), so all that remains is confirming
#      the required checks are actually required.
#
# Sections 1 and 3 can be checked from a terminal, and section 1 can be DONE
# from one. Section 2 can be neither: Google Cloud has no API for setting an
# API key's restrictions worth wiring up for a handful of clients a year, and
# the restriction cannot be read back over the network either — `maps/api/js`
# answers 200 with an identical body for any key, and enforcement happens later
# in the browser. So section 2 prints the exact click path plus a two-minute
# browser check, and counts itself UNVERIFIED rather than pretending.
#
# That distinction is the whole design of this script. It reports three states,
# not two: satisfied, outstanding, and "I could not check". An earlier version
# collapsed the third into the first and reported a green summary over a
# section it had never managed to look at.
#
# The reasoning behind all of this — why the claim fails closed, why a public
# Maps key still needs restricting, what /setup shows in each state — lives in
# `apps/docs/deployment/first-administrator.md`. This script is its executable
# half: read that page to understand the steps, run this one to perform them and
# to prove they were performed.
#
# On secrets: the CHECK path never prints a value — it reports presence and
# length only, so it is safe to run and paste anywhere. The write path prints
# exactly one, the bootstrap token it has just generated, because the operator
# has to hand that to the client and there is nowhere else for it to come from.
# Nothing else is ever echoed, and `--check` never reaches that line.
#
# Usage:
#   bash scripts/wizards/github-e2e-maps-bootstrap.sh            # all sections
#   bash scripts/wizards/github-e2e-maps-bootstrap.sh --check    # verify only
#   bash scripts/wizards/github-e2e-maps-bootstrap.sh --app themes
#   bash scripts/wizards/github-e2e-maps-bootstrap.sh --prod
#   bash scripts/wizards/github-e2e-maps-bootstrap.sh --section 2
#
# Options:
#   --check          Verify only. Writes nothing, sets nothing. Safe on a
#                    client's production deployment.
#   --app NAME       Which app directory to run the Convex CLI from.
#                    Default: themes (the app a paying client actually runs).
#   --prod           Target the production Convex deployment (`--prod`) rather
#                    than the one named by CONVEX_DEPLOYMENT in .env.local.
#   --section N      Run only section N (1, 2 or 3). Repeatable.
#   --maps-key KEY   The Maps key section 2 should talk about. Defaults to
#                    NEXT_PUBLIC_GOOGLE_MAPS_API_KEY from the environment or
#                    from the app's .env.local. Section 2 reports whether a key
#                    exists to restrict; it cannot read back the restriction.
#   -h, --help       This text.
#
# Exit status: 0 when every section it ran is satisfied, 1 when at least one is
# outstanding. So it is usable as a pre-handover gate, not only as a checklist.
# ===========================================================================
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

APP="themes"
CHECK_ONLY=false
CONVEX_TARGET=()
MAPS_KEY="${NEXT_PUBLIC_GOOGLE_MAPS_API_KEY:-}"
SECTIONS=()

# The banner is delimited by the two `# ===` rules at the top of this file, so
# the help text follows the header rather than a line number that drifts every
# time somebody adds a paragraph to it.
usage() {
  awk 'NR>2 && /^# =====/ {exit} NR>2' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --check)      CHECK_ONLY=true; shift ;;
    --prod)       CONVEX_TARGET=(--prod); shift ;;
    # `${2:?...}` exits 1, which this script reserves for "something is
    # outstanding". A usage mistake must not be mistakable for a finding.
    --app)        [[ $# -ge 2 ]] || { echo "--app needs a value" >&2; exit 2; }
                  APP="$2"; shift 2 ;;
    --maps-key)   [[ $# -ge 2 ]] || { echo "--maps-key needs a value" >&2; exit 2; }
                  MAPS_KEY="$2"; shift 2 ;;
    --section)    [[ $# -ge 2 ]] || { echo "--section needs a value" >&2; exit 2; }
                  case "$2" in
                    1|2|3) SECTIONS+=("$2") ;;
                    *) echo "--section must be 1, 2 or 3 (got: $2)" >&2; exit 2 ;;
                  esac
                  shift 2 ;;
    -h|--help)    usage; exit 0 ;;
    *) echo "Unknown option: $1" >&2; usage >&2; exit 2 ;;
  esac
done

[[ ${#SECTIONS[@]} -eq 0 ]] && SECTIONS=(1 2 3)

APP_DIR="$REPO_ROOT/apps/$APP"
if [[ ! -d "$APP_DIR" ]]; then
  echo "No such app: apps/$APP (expected one of: $(ls "$REPO_ROOT/apps" | tr '\n' ' '))" >&2
  exit 2
fi

# ── Output helpers ─────────────────────────────────────────────────────────
if [[ -t 1 ]]; then
  B=$'\e[1m'; R=$'\e[31m'; G=$'\e[32m'; Y=$'\e[33m'; D=$'\e[2m'; Z=$'\e[0m'
else
  B=""; R=""; G=""; Y=""; D=""; Z=""
fi

OUTSTANDING=0
UNVERIFIED=0
heading() { printf '\n%s══ %s ══%s\n\n' "$B" "$1" "$Z"; }
ok()      { printf '  %s✓%s %s\n' "$G" "$Z" "$1"; }
warn()    { printf '  %s!%s %s\n' "$Y" "$Z" "$1"; }
bad()     { printf '  %s✗%s %s\n' "$R" "$Z" "$1"; OUTSTANDING=$((OUTSTANDING + 1)); }
# "I could not look" is not "I looked and it is fine". Collapsing the two is how
# a gate reports green over a section it never managed to check.
unknown() { printf '  %s?%s %s\n' "$Y" "$Z" "$1"; UNVERIFIED=$((UNVERIFIED + 1)); }
note()    { printf '    %s%s%s\n' "$D" "$1" "$Z"; }
runs()    { for s in "${SECTIONS[@]}"; do [[ "$s" == "$1" ]] && return 0; done; return 1; }

# ===========================================================================
# 1 · ADMIN_BOOTSTRAP_TOKEN on the Convex deployment
# ===========================================================================
section_bootstrap_token() {
  heading "1 · ADMIN_BOOTSTRAP_TOKEN  (apps/$APP)"

  cat <<'EXPLAIN'
  What it is. The secret that lets ONE person claim the first super-admin seat
  at /setup on a fresh deployment. `claimFirstAdmin` fails closed: with the
  variable unset it refuses everybody, including the restaurateur — a fresh
  clone has no administrator and no way to appoint one.

  Where it lives. On the CONVEX DEPLOYMENT, not in .env.local. A Convex
  function cannot read .env.local; that is what made the first attempt at
  setting this fail.

EXPLAIN

  if ! command -v npx >/dev/null 2>&1; then
    bad "npx not found — install Node.js, then re-run."
    return
  fi

  # Three outcomes, not two. `npx convex env get` fails identically for "no
  # deployment linked", "not authenticated" and "the variable is absent", and
  # reporting the last one as fact is how a runbook states something it never
  # established. Prove the deployment answers at all before reading anything
  # into what it said.
  local reachable=false present=false value=""
  if (cd "$APP_DIR" && npx convex env list "${CONVEX_TARGET[@]}" </dev/null >/dev/null 2>&1); then
    reachable=true
  fi

  if ! $reachable; then
    unknown "Could not reach a Convex deployment from apps/$APP — nothing read."
    note "This is NOT the same as the token being unset; the script cannot tell"
    note "from here. Link one and re-run:  cd apps/$APP && npx convex dev"
    note "Then:  npx convex env set ADMIN_BOOTSTRAP_TOKEN \"\$(openssl rand -base64 32)\" ${CONVEX_TARGET[*]}"
    return
  fi

  if value="$(cd "$APP_DIR" && npx convex env get ADMIN_BOOTSTRAP_TOKEN "${CONVEX_TARGET[@]}" </dev/null 2>/dev/null)"; then
    # Never echo the value. Presence and length only.
    value="$(printf '%s' "$value" | tr -d '\r\n')"
    [[ -n "$value" ]] && present=true
  fi

  if $present; then
    ok "Set on the deployment (${#value} characters)."
    if [[ ${#value} -lt 32 ]]; then
      warn "Shorter than 32 characters. Regenerate it: openssl rand -base64 32"
      note "A guessable bootstrap token is the same hole as no token at all."
    fi
    note "Value deliberately not printed. Read it back with:"
    note "  cd apps/$APP && npx convex env get ADMIN_BOOTSTRAP_TOKEN ${CONVEX_TARGET[*]}"
    echo
    note "ONCE THE SEAT IS CLAIMED, drop it — nothing else reads it, and a spare"
    note "key to a door already locked from the inside is one more secret to"
    note "rotate when somebody leaves:"
    note "  cd apps/$APP && npx convex env remove ADMIN_BOOTSTRAP_TOKEN ${CONVEX_TARGET[*]}"
    note "This script cannot tell whether the seat is taken — /setup can, and"
    note "says so. Reasoning: apps/docs/deployment/first-administrator.md"
    return
  fi

  if $CHECK_ONLY; then
    bad "NOT set on the deployment. /setup will refuse everyone."
    note "Re-run without --check to have this script generate and set one."
    return
  fi

  echo "  Not set. Generating one and placing it on the deployment."
  echo
  local token
  token="$(openssl rand -base64 32)"

  if (cd "$APP_DIR" && npx convex env set ADMIN_BOOTSTRAP_TOKEN "$token" "${CONVEX_TARGET[@]}" </dev/null >/dev/null 2>&1); then
    ok "Generated and set (32 random bytes, base64)."
    echo
    printf '  %sHand this to the client, once, over a channel you trust:%s\n\n' "$B" "$Z"
    printf '      %s\n\n' "$token"
    cat <<EOF
  Then have them, in this order:
    1. Sign up on the storefront and confirm the address. The seat attaches to
       an ACCOUNT, not to the token.
    2. Open https://<their-domain>/setup, paste the token, submit.
    3. Delete their copy. The screen closes itself the moment the seat is
       taken, and the token is worth nothing afterwards — but a secret nobody
       needs is a secret nobody should still be holding.

  You do not need to keep it either. If the seat is never claimed, rotate:
    cd apps/$APP && npx convex env set ADMIN_BOOTSTRAP_TOKEN "\$(openssl rand -base64 32)" ${CONVEX_TARGET[*]}
EOF
  else
    bad "Could not set it. Is a deployment linked (CONVEX_DEPLOYMENT in apps/$APP/.env.local)?"
    note "Link one with: cd apps/$APP && npx convex dev"
    note "Then place it by hand:"
    note "  npx convex env set ADMIN_BOOTSTRAP_TOKEN \"\$(openssl rand -base64 32)\" ${CONVEX_TARGET[*]}"
  fi
}

# ===========================================================================
# 2 · Restrict the Google Maps key
# ===========================================================================
section_maps_key() {
  heading "2 · NEXT_PUBLIC_GOOGLE_MAPS_API_KEY  (Google Cloud console)"

  if [[ -z "$MAPS_KEY" && -f "$APP_DIR/.env.local" ]]; then
    MAPS_KEY="$(grep -E '^NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=' "$APP_DIR/.env.local" 2>/dev/null | tail -1 | cut -d= -f2- | tr -d '"'"'"'\r' || true)"
  fi

  cat <<'EXPLAIN'
  What it is. The browser key behind address autocomplete. It is shipped to
  every visitor in the page source — `NEXT_PUBLIC_` says so — so it cannot be
  kept secret and does not need to be. What it needs is to be USELESS to anyone
  who lifts it, which is what the two restrictions below do.

  The click path (Google Cloud console, the CLIENT's own project):

    APIs & Services › Credentials › the browser key › Edit

    a) Application restrictions → Websites. Add, exactly:
         https://<client-domain>/*
         https://www.<client-domain>/*
       Add nothing else. Not `*`, not a bare domain without the path — Google
       treats a missing `/*` as matching the root document only, and the map
       then fails on every other page.

    b) API restrictions → Restrict key. Tick exactly two:
         Maps JavaScript API
         Places API
       Two, not three. Every loader in the repository asks for exactly
       `maps/api/js?key=...&libraries=places` — there are three byte-identical
       copies (apps/reference/hooks/, apps/themes/hooks/ and packages/ui/src/
       hooks/useGooglePlacesAutocomplete.ts:22), and each app imports its own
       rather than the package's. The coordinates they read come off
       `place.geometry` in the Place Details response, a Places field;
       `google.maps.Geocoder` appears in none of the three.
       Anything else ticked is billable surface nobody uses.

    c) Then set a budget alert on the project — Billing › Budgets & alerts.
       Restrictions stop the theft; the alert is how you find out you were
       wrong about that.

EXPLAIN

  if [[ -z "$MAPS_KEY" ]]; then
    warn "No key configured for apps/$APP — address autocomplete is optional."
    note "A client without address autocomplete needs no key and no restriction."
    note "If this client HAS one, pass it: $0 --section 2 --maps-key AIza..."
    note "Reasoning, one-key-per-client, and the budget alert:"
    note "  apps/docs/deployment/first-administrator.md"
    return
  fi

  # WHY THERE IS NO NETWORK CHECK HERE.
  #
  # An earlier version of this script curl'd the loader with a forbidden
  # `Referer` and graded the response. It could never have worked, and it
  # always reported success:
  #
  #   - `maps/api/js` is only a bootstrap loader. It answers HTTP 200 with a
  #     byte-identical ~1.36 MB body for ANY key — valid, invalid, restricted,
  #     unrestricted. Measured across three keys including `totally-not-a-key`.
  #   - Referrer and key enforcement happen afterwards, in the browser, inside
  #     the `AuthenticationService.Authenticate` call the loader makes. A single
  #     curl of the loader never reaches it.
  #   - The grader matched the string `keyless`, which is baked into every
  #     bundle as part of a `utm_campaign=keyless` docs URL. It has nothing to
  #     do with the key, so the "invalid key" branch swallowed every response
  #     and an unrestricted production key graded green.
  #
  # A check that cannot fail is worse than no check: it converts "nobody has
  # verified this" into "verified". So this section states plainly that the
  # verification is a browser step, and counts it UNVERIFIED until a human
  # confirms it. That keeps the gate honest at the cost of being manual.
  unknown "Restriction cannot be verified from a terminal — it is enforced in the browser."
  echo
  note "Confirm it yourself, in two minutes, once the restriction is applied:"
  note "  1. Open https://<client-domain> and use the address field."
  note "     The autocomplete dropdown must appear."
  note "  2. Open the SAME page from any other origin (a local file, a Vercel"
  note "     preview you removed from the list, another domain)."
  note "     The browser console must show: RefererNotAllowedMapError"
  note "  If step 2 shows a working map instead, the key is NOT restricted."
  echo
  note "Reasoning, one-key-per-client, and the budget alert:"
  note "  apps/docs/deployment/first-administrator.md"
}

# ===========================================================================
# 3 · GitHub — branch protection and the E2E suite
# ===========================================================================
section_github() {
  heading "3 · GitHub — required checks  (verify only)"

  cat <<'EXPLAIN'
  Nothing to place here any more. The E2E job used to be gated on
  CONVEX_E2E_ENABLED plus a set of E2E_* secrets that were never created, so it
  was skipped on every run while reporting green. That gate is gone: the job
  starts its own Convex backend on the runner, with no account and no secrets.

  What remains is confirming the checks are REQUIRED rather than merely green,
  which needs repository-admin rights. Full procedure, including the exact API
  calls and what each check is named:

      tasks/ci-required-checks-runbook.md

EXPLAIN

  if ! command -v gh >/dev/null 2>&1; then
    unknown "gh CLI not found — cannot read the rules from here."
    note "Check by hand: Settings › Rules › Rulesets › main."
    note "Expected required checks: Lint, Type Check, Test, Build, E2E Status."
    note "Full expected state, rule by rule: tasks/ci-required-checks-runbook.md §6."
    return
  fi

  # `main` is protected by a RULESET, not by a classic branch protection: the
  # classic one was deleted on 2026-09-03 because the merge queue is not
  # expressible in that model. `GET /branches/main/protection` therefore answers
  # `404 Branch not protected`, and that answer is correct rather than alarming
  # — an earlier draft of this wizard read that endpoint and would have told the
  # owner their repository was wide open. Read the rules where they now live.
  local rules
  if ! rules="$(gh api "repos/be-in-digital/beyours/rules/branches/main" 2>/dev/null)"; then
    bad "Could not read the branch rules (gh not authenticated, or no access to the repo)."
    note "gh auth login, then re-run — or check Settings › Rules › Rulesets by hand."
    return
  fi

  if ! grep -q 'required_status_checks' <<<"$rules"; then
    bad "main has no required status checks. Anything can be merged over a red build."
    note "See tasks/ci-required-checks-runbook.md §6 for the ruleset to apply."
    return
  fi

  ok "main requires status checks (via a ruleset)."

  # Parsed, not grepped: `grep '"context":"X"'` assumes GitHub never pretty-
  # prints, and a single space after a colon would report all five as missing.
  local contexts
  contexts="$(cd "$REPO_ROOT" && gh api "repos/be-in-digital/beyours/rules/branches/main" \
    --jq '.[] | select(.type=="required_status_checks")
              | .parameters.required_status_checks[]?.context' 2>/dev/null || true)"

  local missing=()
  local check
  for check in "Lint" "Type Check" "Test" "Build" "E2E Status"; do
    grep -qxF "$check" <<<"$contexts" || missing+=("$check")
  done

  if [[ ${#missing[@]} -eq 0 ]]; then
    ok "All five expected checks are required, 'E2E Status' among them."
  else
    bad "Required checks missing: ${missing[*]}"
    note "A pull request that breaks one of these can still merge."
    note "See tasks/ci-required-checks-runbook.md §2 for the exact names, §6 for the ruleset."
  fi

  # The merge queue is what replaced `strict: true` — it tests the prospective
  # merged state, which is why 'up to date before merging' is deliberately off.
  if grep -q 'merge_queue' <<<"$rules"; then
    ok "The merge queue is active (it replaces 'require branches to be up to date')."
  else
    warn "No merge queue rule. Not fatal, but §6 explains why this repo wants one."
  fi
}

# ===========================================================================
# Run
# ===========================================================================
printf '%sBeYours — console residue: bootstrap token, Maps key, required checks%s\n' "$B" "$Z"
printf '%sapp: apps/%s   mode: %s%s\n' "$D" "$APP" "$($CHECK_ONLY && echo 'check only' || echo 'check and set')" "$Z"

# `if` rather than `runs N && section` for legibility only. (An earlier comment
# here claimed `set -e` would abort on a skipped section; it would not — a
# command failing anywhere but the end of an `&&` list is exempt, which is also
# why `runs()` itself is safe to call the way it is.)
if runs 1; then section_bootstrap_token; fi
if runs 2; then section_maps_key; fi
if runs 3; then section_github; fi

heading "Summary"
if [[ $OUTSTANDING -eq 0 && $UNVERIFIED -eq 0 ]]; then
  ok "Every section this run checked is satisfied."
  exit 0
fi
[[ $OUTSTANDING -gt 0 ]] && printf '  %s✗%s %s\n' "$R" "$Z" "$OUTSTANDING item(s) outstanding — see the ✗ lines above."
[[ $UNVERIFIED -gt 0 ]] && printf '  %s?%s %s\n' "$Y" "$Z" "$UNVERIFIED item(s) NOT VERIFIED — see the ? lines above. Unchecked is not the same as fine."
exit 1
