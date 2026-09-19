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
# ON RE-RUNNING: every object is found before it is created, so a second run
# finds what the first made instead of duplicating it. That is not a nicety.
# A duplicated coupon is a SECOND set of ten free builds, and duplicated
# Prices are a renewal billed at an id no guard in this repo compares to
# anything — §4 says as much: "No code asserts that the recurring Price
# matches planPrices."
#
# HOW each object is found matters as much as that it is, and the obvious
# choice is the wrong one:
#
#   Products  listed via /v1/products and matched on metadata[beyours_role].
#             NOT /v1/products/search — Stripe's search index is EVENTUALLY
#             CONSISTENT ("up to a minute" for new objects), so two --apply
#             runs in quick succession would search, miss what the first run
#             had just made, and create it again. A list endpoint is read
#             from the live table and has no such window.
#             Nor a caller-chosen product id, which would be immediately
#             consistent but would not start with `prod_` — and
#             `apps/site/lib/env.ts:136` refuses a
#             STRIPE_PRODUCT_CREATION_* that does not.
#   Prices    lookup_key, filtered on /v1/prices, which is also a list.
#   Coupon    a caller-chosen `id`, so a re-create collides by construction.
#             Allowed here precisely because a coupon id has no prefix to
#             satisfy — the runbook says so in §5.
#
# ON BASH 3.2: no associative arrays, no namerefs. macOS still ships bash
# 3.2 (2007, the last GPLv2 release), which is where this runs; `declare -A`
# is a bash 4 feature and fails there with "invalid option".
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
    -h|--help) sed -n '2,86p' "${BASH_SOURCE[0]}"; exit 0 ;;
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

# The response body goes to a FILE, not to a command substitution, and that
# is deliberate. `exit 1` inside `$(...)` kills only the subshell, so a
# transport failure was surviving as an empty body and the run carried on to
# report success — the exact "green over a section it never looked at" this
# script's header condemns. Whether `set -e` propagates out of nested
# substitutions is also one of the things that differs between bash 3.2 (the
# macOS target) and bash 5. Calling curl as a plain command removes the
# question rather than betting on the answer.
RESP="${TMPDIR:-/tmp}/beyours-stripe.$$.json"
ERRF="${TMPDIR:-/tmp}/beyours-stripe.$$.err"
trap 'rm -f "$RESP" "$ERRF"' EXIT INT TERM

api() { # $1 = METHOD, $2 = path, rest = curl args. Body lands in $RESP.
  local method="$1" rc path="$2"; shift 2
  set +e
  if [ "$method" = "GET" ]; then
    # -G moves --data-urlencode into the query string. Without it curl sends
    # a GET carrying a body, which is not what the list endpoints read.
    curl -sS -G "https://api.stripe.com/v1/$path" \
      -u "$STRIPE_SECRET_KEY:" -H "Stripe-Version: 2024-06-20" \
      "$@" -o "$RESP" 2>"$ERRF"
  else
    curl -sS -X "$method" "https://api.stripe.com/v1/$path" \
      -u "$STRIPE_SECRET_KEY:" -H "Stripe-Version: 2024-06-20" \
      "$@" -o "$RESP" 2>"$ERRF"
  fi
  rc=$?
  set -e
  if [ $rc -ne 0 ]; then
    # A GET that fails at the transport layer yields no id, which is
    # indistinguishable from "the object does not exist" — and the caller's
    # next move on that reading is to CREATE it. A duplicated coupon is a
    # second set of ten free builds, so this stops the run.
    echo "  ✗ could not reach api.stripe.com (curl exit $rc)." >&2
    [ -s "$ERRF" ] && sed 's/^/    /' "$ERRF" >&2
    echo "    Nothing was created. Run this where Stripe is reachable and retry;" >&2
    echo "    it is safe to re-run — every object is found before it is created." >&2
    exit 1
  fi
}

field() { # $1 = dotted key path, read out of $RESP
  # Tolerates a non-JSON or empty body: an unreadable response must surface
  # as "absent", never as a traceback the caller then ignores.
  python3 -c '
import json,sys
try: d=json.load(open(sys.argv[2],encoding="utf-8"))
except Exception: print(""); sys.exit(0)
for k in sys.argv[1].split("."):
    if d is None: break
    try: d = d[int(k)] if k.isdigit() else d.get(k)
    except Exception: d = None
print("" if d is None else (str(d).lower() if isinstance(d,bool) else d))' "$1" "$RESP"
}

die_on_error() { # $1 = what we were doing. Reads $RESP.
  local msg
  msg="$(python3 -c '
import json,sys
try: print(json.load(open(sys.argv[1],encoding="utf-8")).get("error",{}).get("message",""))
except Exception: print("")' "$RESP")"
  if [ -n "$msg" ]; then
    echo "  ✗ $1: $msg" >&2
    exit 1
  fi
}

# --- The nine objects -----------------------------------------------------
#
# bash 3.2 has no associative arrays and no namerefs, so each helper leaves
# its result in LAST_ID and the caller copies it into a named variable.

LAST_ID=""
FOUND_ID=""

find_product_by_role() { # $1 = role -> sets FOUND_ID ("" when absent)
  local role="$1" after="" more last
  FOUND_ID=""
  while : ; do
    if [ -n "$after" ]; then
      api GET products --data-urlencode "limit=100" --data-urlencode "starting_after=$after"
    else
      api GET products --data-urlencode "limit=100"
    fi
    die_on_error "listing products"
    FOUND_ID="$(python3 -c '
import json,sys
try: d=json.load(open(sys.argv[2],encoding="utf-8"))
except Exception: print(""); sys.exit(0)
role=sys.argv[1]
for p in d.get("data",[]):
    if (p.get("metadata") or {}).get("beyours_role")==role:
        print(p["id"]); break' "$role" "$RESP")"
    [ -n "$FOUND_ID" ] && return 0
    more="$(field has_more)"
    [ "$more" = "true" ] || return 0
    last="$(python3 -c '
import json,sys
try: d=json.load(open(sys.argv[1],encoding="utf-8")).get("data",[])
except Exception: d=[]
print(d[-1]["id"] if d else "")' "$RESP")"
    [ -n "$last" ] || return 0
    after="$last"
  done
}

ensure_product() { # $1 = role, $2 = customer-facing name, $3 = description
  local role="$1" name="$2" desc="$3" id
  find_product_by_role "$role"
  id="$FOUND_ID"

  if [ -n "$id" ]; then
    echo "  = $role already exists: $id"
  elif [ "$APPLY" -eq 0 ]; then
    echo "  + would create product '$name'  (metadata.beyours_role=$role)"
    id="prod_DRYRUN_$role"
  else
    api POST products \
      --data-urlencode "name=$name" \
      --data-urlencode "description=$desc" \
      --data-urlencode "metadata[beyours_role]=$role"
    die_on_error "creating product '$role'"
    id="$(field id)"
    [ -n "$id" ] || { echo "  ✗ Stripe returned no product id for '$role'." >&2; exit 1; }
    echo "  + created $role: $id"
  fi
  LAST_ID="$id"
}

ensure_price() { # $1 = lookup_key, $2 = product id, $3 = cents, $4 = interval
  local key="$1" product="$2" cents="$3" interval="$4" id got
  api GET prices --data-urlencode "lookup_keys[]=$key" --data-urlencode "limit=1"
  die_on_error "listing price '$key'"
  id="$(field 'data.0.id')"

  if [ -n "$id" ]; then
    got="$(field 'data.0.unit_amount')"
    if [ "$got" != "$cents" ]; then
      # A Stripe Price is immutable, so this cannot be repaired in place.
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
    api POST prices \
      --data-urlencode "product=$product" \
      --data-urlencode "unit_amount=$cents" \
      --data-urlencode "currency=eur" \
      --data-urlencode "recurring[interval]=$interval" \
      --data-urlencode "tax_behavior=exclusive" \
      --data-urlencode "lookup_key=$key"
    die_on_error "creating price '$key'"
    id="$(field id)"
    [ -n "$id" ] || { echo "  ✗ Stripe returned no price id for '$key'." >&2; exit 1; }
    echo "  + created $key: $id"
  fi
  LAST_ID="$id"
}

assert_coupon_restriction() { # $1 = the creation product the coupon must name
  # Read the coupon BACK and check it carries the restriction. A POST that
  # returns 200 proves Stripe accepted the request, not that it understood
  # the parameter: a misencoded `applies_to` is dropped silently and the
  # coupon is created unrestricted. This is the one property no later check
  # catches, because an unrestricted 100% coupon still produces the right
  # TOTAL — it just spreads the discount across every line.
  local product="$1" got
  api GET "coupons/$COUPON_ID"
  die_on_error "reading back coupon '$COUPON_ID'"
  got="$(python3 -c '
import json,sys
try: d=json.load(open(sys.argv[1],encoding="utf-8"))
except Exception: print(""); sys.exit(0)
print(",".join((d.get("applies_to") or {}).get("products") or []))' "$RESP")"

  if [ "$got" != "$product" ]; then
    echo "  ✗ coupon '$COUPON_ID' is NOT restricted to $product." >&2
    if [ -z "$got" ]; then
      echo "    It carries NO product restriction: a 100% coupon that applies to" >&2
      echo "    EVERY line of the session, maintenance included." >&2
    else
      echo "    It is restricted to: $got" >&2
    fi
    echo "    applies_to cannot be changed on an existing coupon. Delete it and" >&2
    echo "    re-run this script:" >&2
    echo "      curl -sS -X DELETE https://api.stripe.com/v1/coupons/$COUPON_ID -u \"\$STRIPE_SECRET_KEY:\"" >&2
    exit 1
  fi
  echo "    verified: applies_to = $got"
}

ensure_coupon() { # $1 = creation product id
  local product="$1" id redeemed max
  # A 404 here is the expected "not created yet" answer, so this one GET is
  # deliberately not passed through die_on_error.
  api GET "coupons/$COUPON_ID"
  id="$(field id)"

  if [ -n "$id" ]; then
    redeemed="$(field times_redeemed)"
    max="$(field max_redemptions)"
    echo "  = coupon already exists: $id  ($redeemed/$max redeemed)"
    # §6b: a non-zero count before the first sale means seats are already gone.
    if [ -n "$redeemed" ] && [ "$redeemed" != "0" ]; then
      echo "  ! times_redeemed is $redeemed, not 0 — only $((max - redeemed)) seats remain." >&2
    fi
    # An existing coupon gets the same check as a new one. Without this, a
    # re-run over a coupon created unrestricted says "already exists" and
    # moves on, which is how the defect would have reached the live account.
    assert_coupon_restriction "$product"
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
    # `applies_to[products][0]`, with the INDEX. The bare `[]` form is a
    # Rack/PHP convention Stripe does not parse; it created the coupon with
    # no product restriction at all and reported success, which is the worst
    # of the three outcomes — an unrestricted 100% coupon spreads pro rata
    # over every line, so the total is right and the invoice is wrong.
    api POST coupons \
      --data-urlencode "id=$COUPON_ID" \
      --data-urlencode "percent_off=100" \
      --data-urlencode "duration=once" \
      --data-urlencode "max_redemptions=10" \
      --data-urlencode "applies_to[products][0]=$product"
    die_on_error "creating coupon '$COUPON_ID'"
    id="$(field id)"
    [ -n "$id" ] || { echo "  ✗ Stripe returned no coupon id." >&2; exit 1; }
    echo "  + created coupon: $id"
    assert_coupon_restriction "$product"
  fi
  LAST_ID="$id"
}

# --- Run ------------------------------------------------------------------

echo
echo "Stripe account mode: $MODE"
if [ "$APPLY" -eq 0 ]; then
  echo "DRY RUN — nothing will be written. Add --apply to create."
else
  echo "APPLY — objects will be created in the $MODE account."
fi
echo "Amounts read from apps/site/convex/planPrices.ts"
echo

echo "§2  Creation products"
ensure_product creation_essentielle \
  "BeYours — Essentielle — Création" \
  "Création du site BeYours, offre Essentielle."
PROD_CREATION_ESSENTIELLE="$LAST_ID"
ensure_product creation_premium \
  "BeYours — Premium — Création" \
  "Création du site BeYours, offre Premium."
PROD_CREATION_PREMIUM="$LAST_ID"

echo
echo "§4  Maintenance products — separate from the creation ones, so the"
echo "    founders coupon's applies_to cannot zero a renewal"
ensure_product maintenance_essentielle \
  "BeYours — Essentielle — Maintenance" \
  "Maintenance annuelle du site BeYours, offre Essentielle."
PROD_MAINTENANCE_ESSENTIELLE="$LAST_ID"
ensure_product maintenance_premium \
  "BeYours — Premium — Maintenance" \
  "Maintenance annuelle du site BeYours, offre Premium."
PROD_MAINTENANCE_PREMIUM="$LAST_ID"

echo
echo "§4  Maintenance prices"
ensure_price beyours_maintenance_essentielle_monthly "$PROD_MAINTENANCE_ESSENTIELLE" "$ESS_MONTHLY" month
PRICE_ESS_MONTHLY="$LAST_ID"
ensure_price beyours_maintenance_essentielle_yearly  "$PROD_MAINTENANCE_ESSENTIELLE" "$ESS_YEARLY"  year
PRICE_ESS_YEARLY="$LAST_ID"
ensure_price beyours_maintenance_premium_monthly     "$PROD_MAINTENANCE_PREMIUM"     "$PRE_MONTHLY" month
PRICE_PRE_MONTHLY="$LAST_ID"
ensure_price beyours_maintenance_premium_yearly      "$PROD_MAINTENANCE_PREMIUM"     "$PRE_YEARLY"  year
PRICE_PRE_YEARLY="$LAST_ID"

echo
echo "§3  Founders coupon"
ensure_coupon "$PROD_CREATION_ESSENTIELLE"
COUPON="$LAST_ID"

# --- Hand-off -------------------------------------------------------------

cat <<EOF

───────────────────────────────────────────────────────────────────────────
§5  Set these on the deployment that SELLS — famous-wildcat-229, not the
    retired fearless-poodle-133, which still answers 200. From apps/site:

pnpx convex env set STRIPE_PRODUCT_CREATION_ESSENTIELLE "$PROD_CREATION_ESSENTIELLE" --prod
pnpx convex env set STRIPE_PRODUCT_CREATION_PREMIUM     "$PROD_CREATION_PREMIUM" --prod
pnpx convex env set STRIPE_FOUNDERS_COUPON_ID           "$COUPON" --prod
pnpx convex env set STRIPE_PRICE_ESSENTIELLE_MONTHLY    "$PRICE_ESS_MONTHLY" --prod
pnpx convex env set STRIPE_PRICE_ESSENTIELLE_YEARLY     "$PRICE_ESS_YEARLY" --prod
pnpx convex env set STRIPE_PRICE_PREMIUM_MONTHLY        "$PRICE_PRE_MONTHLY" --prod
pnpx convex env set STRIPE_PRICE_PREMIUM_YEARLY         "$PRICE_PRE_YEARLY" --prod

    And the eighth, which no id above carries — §0's prerequisite:

pnpx convex env set STRIPE_TAX_ENABLED "true" --prod

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

if [ "$APPLY" -eq 0 ]; then
  echo "(dry run — nothing above was created; ids shown as prod_DRYRUN_* / price_DRYRUN_*)"
fi
exit 0
