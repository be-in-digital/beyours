#!/usr/bin/env bash
# ===========================================================================
# scripts/wizards/stripe-founders-launch.sh
# ---------------------------------------------------------------------------
# The console-side residue of LAUNCH-02 (#173), in one runnable pass.
#
# Until the Stripe objects below exist, the FIRST Essentielle sale is refused
# by the code — deliberately. `resolveFoundersPricing` throws rather than hand
# out a build it cannot cap, and `resolveMaintenancePriceId` refuses a checkout
# it cannot bill. Both are correct: a customer is never charged for a plan that
# cannot be billed, and the eleventh founder never walks away with a free
# 3 500 € build. This script is what turns those refusals off, honestly.
#
# What has to exist, none of which a repository can create:
#
#   1. The deployment the ids belong on — `famous-wildcat-229`, NOT the retired
#      `fearless-poodle-133`, which still answers 200 and is named in older
#      documents. A checkout linked elsewhere writes live Stripe ids into a dev
#      backend without complaining.
#   2. Seven variables on it: two creation Products, the founders coupon, and
#      the four maintenance Prices.
#   3. The Stripe objects those ids point at, with the right amounts, currency,
#      tax behaviour and — for the coupon — the right `applies_to`.
#   4. One thing no script can establish: that a real checkout shows the
#      creation line at 0,00 €.
#
# Sections 1-3 can be checked from a terminal. Section 4 cannot, and that is
# not a limitation worth papering over: a WRONG `applies_to` produces the RIGHT
# total. Stripe spreads the discount pro rata across every line instead of
# zeroing the creation one, so the customer pays the same and the invoice
# splits an amortizable investment and a deductible charge in the wrong
# proportions. No total-based check can see it. Only looking at the creation
# line can, and only a browser can do that. So section 4 prints the exact path
# and counts itself UNVERIFIED rather than pretending.
#
# That distinction is the whole design, borrowed from its sibling
# `github-e2e-maps-bootstrap.sh`: three states, not two — satisfied,
# outstanding, and "I could not check". Collapsing the third into the first is
# how a gate reports green over a section it never managed to look at.
#
# On values: the amounts are never written down here. Section 3 delegates to
# `stripeAudit:run` (convex/stripeAudit.ts), which derives what each Price must
# be from `planPrices` — the declared single source of truth. A third copy of
# 100 €/1 000 €/200 €/2 000 € in this file is exactly the drift that audit
# exists to catch.
#
# On secrets: Product, Price and coupon ids are identifiers, not secrets — they
# travel to the browser in ordinary Stripe calls, and confirming them is the
# point of this script, so they are printed. `STRIPE_SECRET_KEY` and anything
# else matching *_KEY or *_SECRET is never read and never echoed.
#
# The reasoning behind every field — why `percent_off: 100` over `amount_off`,
# what `max_redemptions` does and does not cap, why the maintenance Prices must
# hang off a DIFFERENT product — lives in `tasks/stripe-founders-offer-runbook.md`.
# This script is its executable half: read that page to understand the steps,
# run this one to perform them and to prove they were performed.
#
# Usage:
#   bash scripts/wizards/stripe-founders-launch.sh            # all sections
#   bash scripts/wizards/stripe-founders-launch.sh --check    # read only
#   bash scripts/wizards/stripe-founders-launch.sh --prod
#   bash scripts/wizards/stripe-founders-launch.sh --section 2
#
# Options:
#   --check           Read only. This script never writes anything anyway —
#                     the flag exists so that habit carries over from its
#                     sibling, and so `--check` is always safe to type.
#   --prod            Target the production Convex deployment (`--prod`).
#                     Without it, whatever CONVEX_DEPLOYMENT points at.
#   --app NAME        App directory to run the Convex CLI from. Default: site.
#   --deployment NAME Deployment the ids are expected to land on.
#                     Default: famous-wildcat-229.
#   --section N       Run only section N (1-4). Repeatable.
#   -h, --help        This text.
#
# Exit status: 0 when every section it ran is satisfied, 1 when anything is
# outstanding OR unverified, 2 on a usage mistake. A usage mistake must never
# be mistakable for a finding.
# ===========================================================================
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

APP="site"
CHECK_ONLY=false
CONVEX_TARGET=()
EXPECTED_DEPLOYMENT="famous-wildcat-229"
SECTIONS=()

usage() {
  awk 'NR>2 && /^# =====/ {exit} NR>2' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --check)      CHECK_ONLY=true; shift ;;
    --prod)       CONVEX_TARGET=(--prod); shift ;;
    --app)        [[ $# -ge 2 ]] || { echo "--app needs a value" >&2; exit 2; }
                  APP="$2"; shift 2 ;;
    --deployment) [[ $# -ge 2 ]] || { echo "--deployment needs a value" >&2; exit 2; }
                  EXPECTED_DEPLOYMENT="$2"; shift 2 ;;
    --section)    [[ $# -ge 2 ]] || { echo "--section needs a value" >&2; exit 2; }
                  case "$2" in
                    1|2|3|4) SECTIONS+=("$2") ;;
                    *) echo "--section must be 1, 2, 3 or 4 (got: $2)" >&2; exit 2 ;;
                  esac
                  shift 2 ;;
    -h|--help)    usage; exit 0 ;;
    *) echo "Unknown option: $1" >&2; usage >&2; exit 2 ;;
  esac
done

[[ ${#SECTIONS[@]} -eq 0 ]] && SECTIONS=(1 2 3 4)

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
unknown() { printf '  %s?%s %s\n' "$Y" "$Z" "$1"; UNVERIFIED=$((UNVERIFIED + 1)); }
note()    { printf '    %s%s%s\n' "$D" "$1" "$Z"; }
runs()    { for s in "${SECTIONS[@]}"; do [[ "$s" == "$1" ]] && return 0; done; return 1; }

# Reads one variable off the Convex deployment. Prints nothing; returns 1 when
# absent or unreadable, so the caller decides which of the three states it is.
convex_env_get() {
  (cd "$APP_DIR" && npx convex env get "$1" "${CONVEX_TARGET[@]}" </dev/null 2>/dev/null) \
    | tr -d '\r\n'
}

DEPLOYMENT_REACHABLE=false
probe_deployment() {
  if (cd "$APP_DIR" && npx convex env list "${CONVEX_TARGET[@]}" </dev/null >/dev/null 2>&1); then
    DEPLOYMENT_REACHABLE=true
  fi
}

# ===========================================================================
# 1 · The deployment the ids land on
# ===========================================================================
section_deployment() {
  heading "1 · Deployment  (apps/$APP)"

  cat <<'EXPLAIN'
  Read this before setting anything. `--prod` resolves through the local
  CONVEX_DEPLOYMENT, so it targets whichever project THIS checkout is linked
  to. A checkout linked elsewhere writes your live Stripe ids into a dev
  backend and reports success.

EXPLAIN

  if ! command -v npx >/dev/null 2>&1; then
    bad "npx not found — install Node.js, then re-run."
    return
  fi

  probe_deployment
  if ! $DEPLOYMENT_REACHABLE; then
    unknown "Could not reach a Convex deployment from apps/$APP — nothing read."
    note "This is NOT the same as the variables being unset; the script cannot"
    note "tell from here. Link one and re-run:  cd apps/$APP && npx convex dev"
    return
  fi

  # CONVEX_CLOUD_URL is set by Convex itself and carries the deployment name,
  # which `env list` does not print.
  local url
  url="$(convex_env_get CONVEX_CLOUD_URL || true)"

  if [[ -z "$url" ]]; then
    unknown "Deployment answered, but CONVEX_CLOUD_URL was empty — name not confirmed."
    note "Confirm by eye before setting anything:  cd apps/$APP && npx convex env list ${CONVEX_TARGET[*]}"
    return
  fi

  if [[ "$url" == *"$EXPECTED_DEPLOYMENT"* ]]; then
    ok "Targeting $EXPECTED_DEPLOYMENT ($url)."
    return
  fi

  bad "Targeting $url, which is NOT $EXPECTED_DEPLOYMENT."
  note "Setting the seven variables here would put live Stripe ids on the wrong"
  note "backend. If this checkout should point elsewhere, re-link it; if the"
  note "expected deployment has genuinely changed, pass --deployment NAME and"
  note "correct tasks/stripe-founders-offer-runbook.md §1 in the same change."
  if [[ "$url" == *"fearless-poodle-133"* ]]; then
    note "fearless-poodle-133 is the RETIRED deployment. It still answers 200 and"
    note "is named in several older documents. It serves nothing."
  fi
}

# ===========================================================================
# 2 · The seven variables
# ===========================================================================
PRODUCT_VARS=(STRIPE_PRODUCT_CREATION_ESSENTIELLE STRIPE_PRODUCT_CREATION_PREMIUM)
PRICE_VARS=(STRIPE_PRICE_ESSENTIELLE_MONTHLY STRIPE_PRICE_ESSENTIELLE_YEARLY
            STRIPE_PRICE_PREMIUM_MONTHLY STRIPE_PRICE_PREMIUM_YEARLY)
COUPON_VAR=STRIPE_FOUNDERS_COUPON_ID

COUPON_ID=""
ESSENTIELLE_PRODUCT_ID=""

section_variables() {
  heading "2 · The seven variables on $EXPECTED_DEPLOYMENT"

  cat <<'EXPLAIN'
  All seven are read by Convex actions only. NONE of them belongs on Vercel —
  no line of the Next server reads any of them.

EXPLAIN

  if ! $DEPLOYMENT_REACHABLE; then
    probe_deployment
  fi
  if ! $DEPLOYMENT_REACHABLE; then
    unknown "Deployment unreachable — none of the seven variables was read."
    note "Unread is not unset. Re-run once the CLI can reach a deployment."
    return
  fi

  local name value missing=() malformed=()

  # The two creation Products: prefix-checked, because a Price id pasted here is
  # accepted by Stripe right up to applies_to, which then matches nothing.
  for name in "${PRODUCT_VARS[@]}"; do
    value="$(convex_env_get "$name" || true)"
    if [[ -z "$value" ]]; then
      missing+=("$name"); continue
    fi
    if [[ "$value" != prod_* ]]; then
      malformed+=("$name is \"$value\" — a Product id starts with prod_")
      continue
    fi
    ok "$name = $value"
    [[ "$name" == "STRIPE_PRODUCT_CREATION_ESSENTIELLE" ]] && ESSENTIELLE_PRODUCT_ID="$value"
  done

  value="$(convex_env_get "$COUPON_VAR" || true)"
  if [[ -z "$value" ]]; then
    missing+=("$COUPON_VAR")
  else
    # No prefix rule: a coupon id is whatever was typed at creation, and may be
    # a short readable code rather than a generated one.
    ok "$COUPON_VAR = $value"
    COUPON_ID="$value"
  fi

  for name in "${PRICE_VARS[@]}"; do
    value="$(convex_env_get "$name" || true)"
    if [[ -z "$value" ]]; then
      missing+=("$name"); continue
    fi
    if [[ "$value" != price_* ]]; then
      malformed+=("$name is \"$value\" — a Price id starts with price_")
      continue
    fi
    ok "$name = $value"
  done

  local item
  for item in "${malformed[@]}"; do
    bad "$item"
  done

  if [[ ${#missing[@]} -gt 0 ]]; then
    bad "${#missing[@]} of 7 not set: ${missing[*]}"
    echo
    note "Create the objects first (runbook §2-§4), then:"
    note "  cd apps/$APP"
    for item in "${missing[@]}"; do
      case "$item" in
        STRIPE_PRODUCT_CREATION_*) note "  pnpx convex env set $item \"prod_...\" ${CONVEX_TARGET[*]}" ;;
        STRIPE_PRICE_*)            note "  pnpx convex env set $item \"price_...\" ${CONVEX_TARGET[*]}" ;;
        *)                         note "  pnpx convex env set $item \"...\" ${CONVEX_TARGET[*]}" ;;
      esac
    done
  elif [[ ${#malformed[@]} -eq 0 ]]; then
    ok "All seven set, and each id has the shape its variable expects."
  fi

  # The founders pair is the blocking one, and half of it is worse than none.
  local have_coupon=false have_product=false
  [[ -n "$COUPON_ID" ]] && have_coupon=true
  [[ -n "$ESSENTIELLE_PRODUCT_ID" ]] && have_product=true
  if $have_coupon && ! $have_product; then
    warn "Coupon set without STRIPE_PRODUCT_CREATION_ESSENTIELLE."
    note "The discount would spread pro rata over the maintenance line."
  elif $have_product && ! $have_coupon; then
    warn "Creation product set without the coupon that caps the offer."
    note "Nothing would stop the eleventh founder taking a free build."
  fi
}

# ===========================================================================
# 3 · The objects those ids point at
# ===========================================================================
section_objects() {
  heading "3 · Reading the Stripe objects back"

  cat <<'EXPLAIN'
  An id that is SET is not an id that is RIGHT. The four Prices are compared
  against planPrices by convex/stripeAudit.ts — amount, currency, tax_behavior,
  interval, whether the Price hangs off a creation Product, and whether the
  object is live or test.

EXPLAIN

  if ! $DEPLOYMENT_REACHABLE; then
    unknown "Deployment unreachable — the audit was not run."
    return
  fi

  local out
  if ! out="$(cd "$APP_DIR" && npx convex run stripeAudit:run "${CONVEX_TARGET[@]}" </dev/null 2>&1)"; then
    unknown "stripeAudit:run did not complete — the Prices were NOT compared."
    note "Output:"
    printf '%s\n' "$out" | sed 's/^/      /' | head -12
    note "Run it yourself:  cd apps/$APP && pnpx convex run stripeAudit:run ${CONVEX_TARGET[*]}"
    return
  fi

  # Parse rather than grep: "findings": [] with any spacing, and a summary that
  # may sit behind Convex's own log lines. A parse failure is its own state —
  # reporting "no findings" because the JSON was unreadable is the exact
  # failure this script is shaped to avoid.
  local parsed
  parsed="$(printf '%s' "$out" | node -e '
    let s = ""; process.stdin.on("data", d => s += d).on("end", () => {
      const start = s.indexOf("{"), end = s.lastIndexOf("}");
      if (start < 0 || end < start) { console.log("UNPARSEABLE"); return; }
      try {
        const r = JSON.parse(s.slice(start, end + 1));
        if (!Array.isArray(r.findings)) { console.log("UNPARSEABLE"); return; }
        console.log(String(r.findings.length));
        console.log(r.summary || "");
        for (const f of r.findings) console.log(`${f.envName} [${f.field}] ${f.message}`);
      } catch { console.log("UNPARSEABLE"); }
    });
  ' 2>/dev/null || echo UNPARSEABLE)"

  if [[ "$parsed" == UNPARSEABLE* || -z "$parsed" ]]; then
    unknown "Could not read the audit's answer — the Prices were NOT compared."
    note "Run it yourself:  cd apps/$APP && pnpx convex run stripeAudit:run ${CONVEX_TARGET[*]}"
    return
  fi

  local count summary
  count="$(printf '%s\n' "$parsed" | sed -n '1p')"
  summary="$(printf '%s\n' "$parsed" | sed -n '2p')"

  if [[ "$count" == "0" ]]; then
    ok "${summary:-The four Prices match planPrices.}"
  else
    bad "$count discrepancy/ies between Stripe and planPrices:"
    printf '%s\n' "$parsed" | tail -n +3 | sed 's/^/      /'
    note "Fix them in the Stripe Dashboard; do not edit planPrices to match."
  fi

  # ── The coupon. Not covered by the audit, and it is the expensive one. ──
  echo
  if [[ -z "$COUPON_ID" ]]; then
    unknown "No coupon id known from section 2 — coupon not read back."
    return
  fi

  if ! command -v stripe >/dev/null 2>&1; then
    unknown "The Stripe CLI is not installed — coupon $COUPON_ID NOT read back."
    note "Three fields decide whether the offer is capped and lands on the right"
    note "line. Check them by hand, in the Dashboard or with:"
    note "  stripe coupons retrieve $COUPON_ID --live"
    note "  max_redemptions  must be 10   (foundersOffer.totalSlots)"
    note "  times_redeemed   must be 0    before the first sale"
    note "  applies_to       must list ${ESSENTIELLE_PRODUCT_ID:-the Essentielle creation product}"
    return
  fi

  local coupon
  if ! coupon="$(stripe coupons retrieve "$COUPON_ID" --live 2>/dev/null)"; then
    unknown "Stripe CLI could not retrieve coupon $COUPON_ID (not authenticated, or no such coupon)."
    note "  stripe login   then re-run, or check it in the Dashboard."
    return
  fi

  local max_red times_red applies
  max_red="$(printf '%s' "$coupon" | node -pe 'JSON.parse(require("fs").readFileSync(0,"utf8")).max_redemptions ?? ""' 2>/dev/null || echo "")"
  times_red="$(printf '%s' "$coupon" | node -pe 'JSON.parse(require("fs").readFileSync(0,"utf8")).times_redeemed ?? ""' 2>/dev/null || echo "")"
  applies="$(printf '%s' "$coupon" | node -pe '(JSON.parse(require("fs").readFileSync(0,"utf8")).applies_to?.products ?? []).join(",")' 2>/dev/null || echo "")"

  if [[ "$max_red" == "10" ]]; then
    ok "Coupon caps at 10 redemptions."
  elif [[ -z "$max_red" ]]; then
    bad "Coupon has NO max_redemptions — the offer is uncapped."
    note "Every founder past the tenth is a free 3 500 € build."
  else
    warn "Coupon caps at $max_red, not 10 (foundersOffer.totalSlots)."
  fi

  if [[ "$times_red" == "0" ]]; then
    ok "Not yet redeemed — all 10 seats available."
  elif [[ -n "$times_red" ]]; then
    warn "Already redeemed $times_red time(s) — ${max_red:-?} minus $times_red seats remain."
  fi

  if [[ -z "$applies" ]]; then
    bad "Coupon has no applies_to — the discount will spread across every line."
    note "The total stays right; the split between creation and maintenance does not."
  elif [[ -n "$ESSENTIELLE_PRODUCT_ID" && "$applies" == *"$ESSENTIELLE_PRODUCT_ID"* ]]; then
    ok "applies_to targets the Essentielle creation product."
    note "Targeting the right product is necessary, not sufficient — section 4."
  else
    bad "applies_to is [$applies], which does not include ${ESSENTIELLE_PRODUCT_ID:-the Essentielle creation product}."
  fi
}

# ===========================================================================
# 4 · The part no script can establish
# ===========================================================================
section_checkout() {
  heading "4 · The creation line at 0,00 €  (browser only)"

  cat <<'EXPLAIN'
  Everything above can be right and this can still be wrong, which is why it is
  a section and not a footnote. A misdirected applies_to produces the RIGHT
  TOTAL: Stripe spreads the discount pro rata across both lines instead of
  zeroing the creation one. Nothing in the amounts gives it away. The only
  evidence is the creation line itself.

  Do this once, before the first real sale:

    1. Open a real Essentielle checkout on beyours.fr.
    2. Stop at the Stripe page. Do NOT pay.
    3. The page must show TWO lines — creation and maintenance — with the
       creation line at 0,00 €, and a total equal to the maintenance line
       plus VAT.
    4. If the creation line is not zero but the total looks right, applies_to
       is wrong. Fix the coupon; do not ship it.
    5. Abandon the session.

  An unpaid checkout holds a founders seat for 24 h (foundersOffer.ts:19-25)
  and then returns it, so this costs one seat for a day and nothing
  permanently.

EXPLAIN

  unknown "Not verifiable from a terminal — see the five steps above."
  note "There is no Stripe API that answers 'would this session zero the"
  note "creation line'; the discount is computed when the session is built."
  note "Recorded as unverified on purpose. It is the last thing between a"
  note "correct-looking configuration and a wrong invoice."
}

# ===========================================================================
# Run
# ===========================================================================
printf '%sBeYours — founders offer: deployment, seven variables, Stripe objects%s\n' "$B" "$Z"
printf '%sapp: apps/%s   expected deployment: %s   mode: %s%s\n' \
  "$D" "$APP" "$EXPECTED_DEPLOYMENT" "$($CHECK_ONLY && echo 'read only' || echo 'read only (this script never writes)')" "$Z"

if runs 1; then section_deployment; fi
if runs 2; then section_variables; fi
if runs 3; then section_objects; fi
if runs 4; then section_checkout; fi

heading "Summary"
if [[ $OUTSTANDING -eq 0 && $UNVERIFIED -eq 0 ]]; then
  ok "Every section this run checked is satisfied."
  exit 0
fi
[[ $OUTSTANDING -gt 0 ]] && printf '  %s✗%s %s\n' "$R" "$Z" "$OUTSTANDING item(s) outstanding — see the ✗ lines above."
[[ $UNVERIFIED -gt 0 ]] && printf '  %s?%s %s\n' "$Y" "$Z" "$UNVERIFIED item(s) NOT VERIFIED — see the ? lines above. Unchecked is not the same as fine."
exit 1
