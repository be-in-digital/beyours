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
# from one. Section 2 cannot: Google Cloud has no API for setting an API key's
# restrictions that is worth wiring up for a handful of clients a year. So the
# wizard prints the exact click path and then VERIFIES the result over the
# network, which is the half that matters — an instruction nobody can check is
# how a key stays unrestricted for a year while everyone believes otherwise.
#
# The reasoning behind all of this — why the claim fails closed, why a public
# Maps key still needs restricting, what /setup shows in each state — lives in
# `apps/docs/deployment/first-administrator.md`. This script is its executable
# half: read that page to understand the steps, run this one to perform them and
# to prove they were performed.
#
# This script never prints a secret value. It reports presence and length.
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
#   --maps-key KEY   The Maps key to verify in section 2. Defaults to
#                    NEXT_PUBLIC_GOOGLE_MAPS_API_KEY from the environment or
#                    from the app's .env.local.
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
    --app)        APP="${2:?--app needs a value}"; shift 2 ;;
    --maps-key)   MAPS_KEY="${2:?--maps-key needs a value}"; shift 2 ;;
    --section)    SECTIONS+=("${2:?--section needs a value}"); shift 2 ;;
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
heading() { printf '\n%s══ %s ══%s\n\n' "$B" "$1" "$Z"; }
ok()      { printf '  %s✓%s %s\n' "$G" "$Z" "$1"; }
warn()    { printf '  %s!%s %s\n' "$Y" "$Z" "$1"; }
bad()     { printf '  %s✗%s %s\n' "$R" "$Z" "$1"; OUTSTANDING=$((OUTSTANDING + 1)); }
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

  local present=false value=""
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
       Two, not three. Those are what the only loader in the repository asks
       for (`maps/api/js?libraries=places`,
       packages/ui/src/hooks/useGooglePlacesAutocomplete.ts:22), and the
       coordinates it reads come off `place.geometry` in the Place Details
       response — a Places field. `google.maps.Geocoder` appears nowhere.
       Anything else ticked is billable surface nobody uses.

    c) Then set a budget alert on the project — Billing › Budgets & alerts.
       Restrictions stop the theft; the alert is how you find out you were
       wrong about that.

EXPLAIN

  if [[ -z "$MAPS_KEY" ]]; then
    warn "No key to verify (NEXT_PUBLIC_GOOGLE_MAPS_API_KEY unset, and none in apps/$APP/.env.local)."
    note "Address autocomplete is optional — a client without it needs no key."
    note "To verify one: $0 --section 2 --maps-key AIza..."
    return
  fi

  if ! command -v curl >/dev/null 2>&1; then
    warn "curl not found — cannot verify the restriction. The click path above still stands."
    return
  fi

  echo "  Verifying over the network: asking Google for the Maps loader while"
  echo "  claiming to be a site that must NOT be allowed to use this key."
  echo

  local body
  body="$(curl -sS --max-time 20 \
    -H 'Referer: https://key-restriction-probe.invalid/' \
    "https://maps.googleapis.com/maps/api/js?key=${MAPS_KEY}&libraries=places" 2>/dev/null || true)"

  if [[ -z "$body" ]]; then
    warn "No response from Google — network blocked? Verification inconclusive."
    note "Re-run from a machine with plain outbound HTTPS before handover."
    return
  fi

  if grep -qi 'RefererNotAllowedMapError\|referer.*not.*allowed\|not authorized to use this API' <<<"$body"; then
    ok "Referrer-restricted: a foreign origin is refused."
    note "Confirm in the console that the allowed list is the CLIENT's domain"
    note "and not a leftover localhost entry — this probe cannot see the list."
  elif grep -qi 'ApiNotActivatedMapError\|ApiTargetBlockedMapError\|This API project is not authorized' <<<"$body"; then
    ok "The key is restricted (Google refused this request)."
    note "If autocomplete is broken in the product too, the API restriction is"
    note "too narrow — tick Maps JavaScript API *and* Places API."
  elif grep -qi 'InvalidKeyMapError\|API key not valid\|keyless' <<<"$body"; then
    warn "Google says this key is invalid or unrecognised. Nothing to restrict yet."
    note "Check you passed the browser key from the client's own project."
  else
    bad "UNRESTRICTED: Google served the Maps loader to an origin that should be refused."
    note "Anyone can lift this key from the page source and bill the client for it."
    note "Apply (a) and (b) above, then re-run: $0 --section 2 --check"
  fi

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
    warn "gh CLI not found — cannot read the rules from here."
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

  local missing=()
  local check
  for check in "Lint" "Type Check" "Test" "Build" "E2E Status"; do
    grep -q "\"context\":\"${check}\"" <<<"$rules" || missing+=("$check")
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

# `runs N && section` would abort the script under `set -e` the moment a
# section is skipped, because a false AND-list is itself the tested command.
if runs 1; then section_bootstrap_token; fi
if runs 2; then section_maps_key; fi
if runs 3; then section_github; fi

heading "Summary"
if [[ $OUTSTANDING -eq 0 ]]; then
  ok "Every section this run checked is satisfied."
  exit 0
fi
bad "$OUTSTANDING item(s) outstanding — see the ✗ lines above."
exit 1
