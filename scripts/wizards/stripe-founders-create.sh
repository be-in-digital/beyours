#!/usr/bin/env bash
# ===========================================================================
# scripts/wizards/stripe-founders-create.sh
# ---------------------------------------------------------------------------
# The WRITE half of LAUNCH-02 (#173). Its sibling
# `stripe-founders-launch.sh` verifies the nine Stripe objects and creates
# none of them — it says so in its own header ("This script never writes
# anything anyway"). So the console work had a gate and no door. This is the
# door.
#
# It creates, in the Stripe account the key belongs to:
#
#   2 creation Products      §2 of tasks/stripe-founders-offer-runbook.md
#   2 maintenance Products   §4 — deliberately NOT the creation ones, see below
#   4 maintenance Prices     §4
#   1 founders coupon        §3
#   ------------------------
#   9 objects, which is the count tasks/owner-decisions.md records as owed.
#
# WHAT IT REFUSES TO DO
#
# It does not set the seven Convex variables. Reading an id back and pasting
# it is §5's job and it is three lines; writing to a production deployment
# from the same pass that created the objects would mean one command whose
# half-failure leaves ids in Stripe that nothing points at, with no way to
# tell which half ran. The script prints the exact `convex env set` lines
# instead, ready to paste.
#
# ON AMOUNTS: none are written here. They are read out of
# `apps/site/convex/planPrices.ts`, the declared single source of truth. Its
# sibling states the reason and it is the same one: "A third copy of
# 100 €/1 000 €/200 €/2 000 € in this file is exactly the drift that audit
# exists to catch." This would have been the fourth.
#
# ON SAFETY: a dry run is the DEFAULT. Nothing is written without `--apply`,
# which is spelled out rather than implied because the objects this creates
# take money from real customers. `STRIPE_SECRET_KEY` is read from the
# environment, never from a flag (a flag lands in shell history), and is
# never echoed — not in the dry run, not in an error, not in `set -x`.
#
# ON RE-RUNNING: every object is addressed by a stable identifier, so a
# second run finds what the first created instead of duplicating it. That is
# not a nicety. A duplicated coupon is a SECOND set of ten free builds, and
# duplicated Prices are a renewal billed twice at the wrong id with no guard
# anywhere in the repo to notice — §4 says so outright: "No code asserts that
# the recurring Price matches planPrices."
#
#   Products  metadata[beyours_role], looked up via /v1/products/search
#   Prices    lookup_key, which Stripe enforces as unique per account
#   Coupon    a caller-chosen `id`, so a re-create collides by construction
#
# WHAT NO SCRIPT CAN CHECK, and this one does not pretend to: that a real
# checkout shows the creation line at 0,00 €. A wrong `applies_to` produces
# the RIGHT total — Stripe spreads the discount pro rata instead of zeroing
# the creation line, so the customer pays the same and the invoice splits an
# amortizable investment and a deductible charge in the wrong proportions.
# No total-based check sees it. Only a browser does. The script ends by
# saying so.
#
# Usage:
#   export STRIPE_SECRET_KEY=sk_live_...
#   bash scripts/wizards/stripe-founders-create.sh              # dry run
#   bash scripts/wizards/stripe-founders-create.sh --apply      # create
#
# Options:
#   --apply         Actually create. Without it nothing is written.
#   --coupon-id ID  Coupon id to create (default: beyours-founders-creation).
#                   Stripe surfaces this to the customer, so keep it readable.
# ===========================================================================

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
PLAN_PRICES="$REPO_ROOT/apps/site/convex/planPrices.ts"

APPLY=0
COUPON_ID="beyours-founders-creation"

while [ $# -gt 0 ]; do
  case "$1" in
    --apply) APPLY=1; shift ;;
    --coupon-id) COUPON_ID="${2:?--coupon-id needs a value}"; shift 2 ;;
    -h|--help) sed -n '2,70p' "${BASH_SOURCE[0]}"; exit 0 ;;
    *) echo "Unknown argument: $1" >&2; exit 2 ;;
  esac
done

# --- Preconditions --------------------------------------------------------

if [ -z "${STRIPE_SECRET_KEY:-}" ]; then
  cat >&2 <<'MSG'
STRIPE_SECRET_KEY is not set.

  export STRIPE_SECRET_KEY=sk_live_...     # or sk_test_... to rehearse

It is read from the environment on purpose: a --key flag would land in shell
history, and these objects take money from real customers.
MSG
  exit 2
fi

case "$STRIPE_SECRET_KEY" in
  sk_live_*) MODE="LIVE"  ;;
  sk_test_*) MODE="TEST"  ;;
  rk_*)      MODE="RESTRICTED" ;;
  *) echo "STRIPE_SECRET_KEY does not look like a Stripe secret key." >&2; exit 2 ;;
esac

command -v curl >/dev/null || { echo "curl is required." >&2; exit 2; }
command -v python3 >/dev/null || { echo "python3 is required (JSON parsing)." >&2; exit 2; }
[ -f "$PLAN_PRICES" ] || { echo "Cannot find $PLAN_PRICES" >&2; exit 2; }

# --- Amounts, read from the single source of truth ------------------------
#
# Parsed rather than restated. If planPrices.ts moves a number, this script
# moves with it; if its SHAPE changes, the extraction fails loudly here
# instead of quietly creating a Price at the wrong amount.

read_cents() { # $1 = plan, $2 = field
  python3 - "$PLAN_PRICES" "$1" "$2" <<'PY'
import re, sys
src, plan, field = sys.argv[1], sys.argv[2], sys.argv[3]
text = open(src, encoding="utf-8").read()
block = re.search(plan + r"\s*:\s*\{(.*?)\}", text, re.S)
if not block:
    sys.exit("planPrices.ts: no block for plan '%s'" % plan)
m = re.search(field + r"\s*:\s*(\d+)", block.group(1))
if not m:
    sys.exit("planPrices.ts: no field '%s' under '%s'" % (field, plan))
print(m.group(1))
PY
}

ESS_MONTHLY="$(read_cents essentielle maintenanceMonthly)"
ESS_YEARLY="$(read_cents essentielle maintenanceYearly)"
PRE_MONTHLY="$(read_cents premium maintenanceMonthly)"
PRE_YEARLY="$(read_cents premium maintenanceYearly)"

# --- Stripe plumbing ------------------------------------------------------
#
# `-u "$KEY:"` keeps the key out of the argv a process list would show.

api() { # $1 = METHOD, $2 = path, rest = --data pairs
  local method="$1" path="$2" out rc; shift 2
  set +e
  out="$(curl -sS -X "$method" "https://api.stripe.com/v1/$path" \
    -u "$STRIPE_SECRET_KEY:" \
    -H "Stripe-Version: 2024-06-20" \
    "$@" 2>&1)"
  rc=$?
  set -e
  if [ $rc -ne 0 ]; then
    # This is the dangerous failure, so it stops the run rather than
    # returning empty: a GET that fails at the transport layer yields no
    # `data[0].id`, which is indistinguishable from "the object does not
    # exist" — and the caller's next move on that reading is to CREATE it.
    # A duplicated coupon is a second set of ten free builds.
    echo "  ✗ could not reach api.stripe.com (curl exit $rc)." >&2
    printf '    %s\n' "$out" >&2
    echo "    Nothing was created. Run this where Stripe is reachable and retry;" >&2
    echo "    it is safe to re-run — every object is addressed by a stable id." >&2
    exit 1
  fi
  printf '%s' "$out"
}

json() { # $1 = key path, reads stdin
  python3 -c '
import json,sys
d=json.load(sys.stdin)
for k in sys.argv[1].split("."):
    if d is None: break
    d = d[int(k)] if k.isdigit() else d.get(k)
print(d if d is not None else "")' "$1"
}

die_on_error() { # $1 = response body, $2 = what we were doing
  local msg
  msg="$(printf '%s' "$1" | python3 -c '
import json,sys
try: print(json.load(sys.stdin).get("error",{}).get("message",""))
except Exception: print("")')"
  if [ -n "$msg" ]; then
    echo "  ✗ $2: $msg" >&2
    exit 1
  fi
}

# --- The nine objects -----------------------------------------------------

declare -A RESULT

ensure_product() { # $1 = role, $2 = customer-facing name, $3 = description
  local role="$1" name="$2" desc="$3" body id
  body="$(api GET "products/search" --data-urlencode "query=metadata['beyours_role']:'$role'")"
  die_on_error "$body" "searching for product '$role'"
  id="$(printf '%s' "$body" | json 'data.0.id')"

  if [ -n "$id" ]; then
    echo "  = $role already exists: $id"
  elif [ "$APPLY" -eq 0 ]; then
    echo "  + would create product '$name'  (metadata.beyours_role=$role)"
    id="prod_DRYRUN_$role"
  else
    body="$(api POST products \
      --data-urlencode "name=$name" \
      --data-urlencode "description=$desc" \
      --data-urlencode "metadata[beyours_role]=$role")"
    die_on_error "$body" "creating product '$role'"
    id="$(printf '%s' "$body" | json id)"
    echo "  + created $role: $id"
  fi
  RESULT["$role"]="$id"
}

ensure_price() { # $1 = lookup_key, $2 = product id, $3 = cents, $4 = interval
  local key="$1" product="$2" cents="$3" interval="$4" body id
  body="$(api GET "prices?lookup_keys[]=$key&limit=1")"
  die_on_error "$body" "searching for price '$key'"
  id="$(printf '%s' "$body" | json 'data.0.id')"

  if [ -n "$id" ]; then
    local got
    got="$(printf '%s' "$body" | json 'data.0.unit_amount')"
    if [ "$got" != "$cents" ]; then
      # Prices are immutable in Stripe, so this cannot be repaired in place.
      # Saying it plainly beats a green run over a wrong renewal amount.
      echo "  ! $key exists at $got cents, planPrices says $cents." >&2
      echo "    A Stripe Price is immutable. Archive it in the Dashboard and" >&2
      echo "    re-run, or keep it and fix planPrices — but they must agree." >&2
      exit 1
    fi
    echo "  = $key already exists: $id ($cents cents / $interval)"
  elif [ "$APPLY" -eq 0 ]; then
    echo "  + would create price $key  $cents cents / $interval  exclusive  eur"
    id="price_DRYRUN_$key"
  else
    body="$(api POST prices \
      --data-urlencode "product=$product" \
      --data-urlencode "unit_amount=$cents" \
      --data-urlencode "currency=eur" \
      --data-urlencode "recurring[interval]=$interval" \
      --data-urlencode "tax_behavior=exclusive" \
      --data-urlencode "lookup_key=$key")"
    die_on_error "$body" "creating price '$key'"
    id="$(printf '%s' "$body" | json id)"
    echo "  + created $key: $id"
  fi
  RESULT["$key"]="$id"
}

ensure_coupon() { # $1 = creation product id
  local product="$1" body id
  body="$(api GET "coupons/$COUPON_ID")"
  id="$(printf '%s' "$body" | json id)"

  if [ -n "$id" ]; then
    local redeemed max
    redeemed="$(printf '%s' "$body" | json times_redeemed)"
    max="$(printf '%s' "$body" | json max_redemptions)"
    echo "  = coupon already exists: $id  ($redeemed/$max redeemed)"
    # §6b: a non-zero count before the first sale means seats are already gone.
    [ "$redeemed" != "0" ] && echo "  ! times_redeemed is $redeemed, not 0 — only $((max - redeemed)) seats remain." >&2
  elif [ "$APPLY" -eq 0 ]; then
    echo "  + would create coupon '$COUPON_ID'  percent_off=100  max_redemptions=10"
    echo "    applies_to = $product   duration=once   redeem_by unset"
    id="$COUPON_ID"
  else
    # percent_off over amount_off: §3 — it stays correct if
    # planPrices.essentielle.creation moves; a fixed amount_off would
    # silently leave a remainder on the creation line.
    # max_redemptions 10 mirrors foundersOffer.totalSlots.
    # redeem_by is deliberately unset: "It ends when the slots run out,
    # never on a date."
    body="$(api POST coupons \
      --data-urlencode "id=$COUPON_ID" \
      --data-urlencode "percent_off=100" \
      --data-urlencode "duration=once" \
      --data-urlencode "max_redemptions=10" \
      --data-urlencode "applies_to[products][]=$product")"
    die_on_error "$body" "creating coupon '$COUPON_ID'"
    id="$(printf '%s' "$body" | json id)"
    echo "  + created coupon: $id"
  fi
  RESULT[coupon]="$id"
}

# --- Run ------------------------------------------------------------------

echo
echo "Stripe account mode: $MODE"
[ "$APPLY" -eq 0 ] && echo "DRY RUN — nothing will be written. Add --apply to create." \
                   || echo "APPLY — objects will be created in the $MODE account."
echo "Amounts read from apps/site/convex/planPrices.ts"
echo

echo "§2  Creation products"
ensure_product creation_essentielle \
  "BeYours — Essentielle — Création" \
  "Création du site BeYours, offre Essentielle."
ensure_product creation_premium \
  "BeYours — Premium — Création" \
  "Création du site BeYours, offre Premium."

echo
echo "§4  Maintenance products — separate from the creation ones, so the"
echo "    founders coupon's applies_to cannot zero a renewal"
ensure_product maintenance_essentielle \
  "BeYours — Essentielle — Maintenance" \
  "Maintenance annuelle du site BeYours, offre Essentielle."
ensure_product maintenance_premium \
  "BeYours — Premium — Maintenance" \
  "Maintenance annuelle du site BeYours, offre Premium."

echo
echo "§4  Maintenance prices"
ensure_price beyours_maintenance_essentielle_monthly "${RESULT[maintenance_essentielle]}" "$ESS_MONTHLY" month
ensure_price beyours_maintenance_essentielle_yearly  "${RESULT[maintenance_essentielle]}" "$ESS_YEARLY"  year
ensure_price beyours_maintenance_premium_monthly     "${RESULT[maintenance_premium]}"     "$PRE_MONTHLY" month
ensure_price beyours_maintenance_premium_yearly      "${RESULT[maintenance_premium]}"     "$PRE_YEARLY"  year

echo
echo "§3  Founders coupon"
ensure_coupon "${RESULT[creation_essentielle]}"

# --- Hand-off -------------------------------------------------------------

cat <<EOF

───────────────────────────────────────────────────────────────────────────
§5  Set these on the deployment that SELLS — famous-wildcat-229, not the
    retired fearless-poodle-133, which still answers 200. From apps/site:

pnpx convex env set STRIPE_PRODUCT_CREATION_ESSENTIELLE "${RESULT[creation_essentielle]}" --prod
pnpx convex env set STRIPE_PRODUCT_CREATION_PREMIUM     "${RESULT[creation_premium]}" --prod
pnpx convex env set STRIPE_FOUNDERS_COUPON_ID           "${RESULT[coupon]}" --prod
pnpx convex env set STRIPE_PRICE_ESSENTIELLE_MONTHLY    "${RESULT[beyours_maintenance_essentielle_monthly]}" --prod
pnpx convex env set STRIPE_PRICE_ESSENTIELLE_YEARLY     "${RESULT[beyours_maintenance_essentielle_yearly]}" --prod
pnpx convex env set STRIPE_PRICE_PREMIUM_MONTHLY        "${RESULT[beyours_maintenance_premium_monthly]}" --prod
pnpx convex env set STRIPE_PRICE_PREMIUM_YEARLY         "${RESULT[beyours_maintenance_premium_yearly]}" --prod

§6  Then verify, and let the gate confirm it rather than this script:

bash scripts/wizards/stripe-founders-launch.sh --prod
cd apps/site && pnpx convex run stripeAudit:run --prod

§6c ONE THING NEITHER SCRIPT CAN CHECK. Open a real Essentielle checkout and
    look at the CREATION LINE. It must read 0,00 €.

    A wrong applies_to gives the right TOTAL — Stripe spreads the discount
    pro rata over every line instead of zeroing the creation one. The
    customer pays the same, and the invoice splits an amortizable investment
    and a deductible charge in the wrong proportions. No total-based check
    can see it. Only that line can.
───────────────────────────────────────────────────────────────────────────
EOF

[ "$APPLY" -eq 0 ] && echo "(dry run — nothing above was created; ids shown as prod_DRYRUN_* / price_DRYRUN_*)"
exit 0
