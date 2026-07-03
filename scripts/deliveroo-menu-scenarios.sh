#!/bin/bash
# ============================================================================
# Deliveroo Menu API - Sandbox Scenario Test Script
# Based on base-theme implementation and Deliveroo Developer Portal scenarios
# ============================================================================
set -euo pipefail

# --- Configuration ---
# Credentials MUST come from the environment. NEVER hardcode secrets here.
# Provide them via your shell or .env.local (see apps/docs/guides/delivery-integrations.md):
#   export DELIVEROO_CLIENT_ID=...        DELIVEROO_CLIENT_SECRET=...
CLIENT_ID="${DELIVEROO_CLIENT_ID:-}"
CLIENT_SECRET="${DELIVEROO_CLIENT_SECRET:-}"
AUTH_URL="https://auth-sandbox.developers.deliveroo.com/oauth2/token"
MENU_API="https://api-sandbox.developers.deliveroo.com/menu"
SITE_API="https://api-sandbox.developers.deliveroo.com/site"

# These will be populated by Scenario 1
SITE_ID="${DELIVEROO_SITE_ID:-}"
BRAND_ID="${DELIVEROO_BRAND_ID:-}"
MENU_ID="${DELIVEROO_MENU_ID:-test-menu-1}"

# --- Colors ---
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# --- Helpers ---
log_info()  { echo -e "${BLUE}[INFO]${NC} $1"; }
log_ok()    { echo -e "${GREEN}[OK]${NC} $1"; }
log_warn()  { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }
log_step()  { echo -e "\n${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"; echo -e "${YELLOW}  $1${NC}"; echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"; }

get_token() {
  if [ -z "$CLIENT_ID" ] || [ -z "$CLIENT_SECRET" ]; then
    log_error "DELIVEROO_CLIENT_ID and DELIVEROO_CLIENT_SECRET must be set in the environment."
    log_info "These are the Deliveroo *sandbox* app credentials. Never commit them."
    log_info "See apps/docs/guides/delivery-integrations.md for how to obtain and provide them."
    exit 1
  fi
  local BASIC_AUTH
  BASIC_AUTH=$(echo -n "${CLIENT_ID}:${CLIENT_SECRET}" | base64)
  TOKEN=$(curl -s -X POST "$AUTH_URL" \
    -H "Authorization: Basic ${BASIC_AUTH}" \
    -H "Content-Type: application/x-www-form-urlencoded" \
    -d "grant_type=client_credentials" | jq -r '.access_token')

  if [ -z "$TOKEN" ] || [ "$TOKEN" = "null" ]; then
    log_error "Failed to get OAuth token"
    exit 1
  fi
  log_ok "OAuth token obtained (${TOKEN:0:20}...)"
}

api_call() {
  local METHOD="$1"
  local URL="$2"
  local DATA="${3:-}"
  local EXTRA_HEADERS="${4:-}"

  local ARGS=(-s -w "\n%{http_code}" -X "$METHOD" "$URL" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Accept: application/json" \
    -H "Content-Type: application/json")

  [ -n "$DATA" ] && ARGS+=(-d "$DATA")

  local RESPONSE
  RESPONSE=$(curl "${ARGS[@]}")
  local HTTP_CODE
  HTTP_CODE=$(echo "$RESPONSE" | tail -1)
  local BODY
  BODY=$(echo "$RESPONSE" | sed '$d')

  if [[ "$HTTP_CODE" =~ ^2 ]]; then
    log_ok "HTTP $HTTP_CODE"
  else
    log_error "HTTP $HTTP_CODE"
  fi
  echo "$BODY" | jq . 2>/dev/null || echo "$BODY"

  # Export for chaining
  LAST_RESPONSE="$BODY"
  LAST_STATUS="$HTTP_CODE"
}

# ============================================================================
# SCENARIO 1: Fetch Brand ID
# GET /site/v1/restaurant_locations/{siteId}
# ============================================================================
scenario_1() {
  log_step "Scenario 1: Fetch Brand ID"

  if [ -z "$SITE_ID" ]; then
    log_error "SITE_ID is required. Set DELIVEROO_SITE_ID env var."
    log_info "Find your site ID in Deliveroo Developer Portal > Sandbox sites"
    exit 1
  fi

  log_info "Fetching brand ID for site: $SITE_ID"
  api_call GET "${SITE_API}/v1/restaurant_locations/${SITE_ID}"

  # Extract brand_id (returned as array)
  BRAND_ID=$(echo "$LAST_RESPONSE" | jq -r '.brand_id[0] // .brand_id // empty' 2>/dev/null)
  if [ -z "$BRAND_ID" ] || [ "$BRAND_ID" = "null" ]; then
    # Try alternate format
    BRAND_ID=$(echo "$LAST_RESPONSE" | jq -r '.id // empty' 2>/dev/null)
  fi

  if [ -n "$BRAND_ID" ] && [ "$BRAND_ID" != "null" ]; then
    log_ok "Brand ID: $BRAND_ID"
    export BRAND_ID
  else
    log_error "Could not extract brand_id from response"
  fi
}

# ============================================================================
# SCENARIO 2: Menu Upload (Complex)
# PUT /menu/v1/brands/{brandId}/menus/{menuId}
# Requirements: 1 mealtime, 2 categories, 6 items, modifiers, 2 dietary types
# ============================================================================
scenario_2() {
  log_step "Scenario 2: Menu Upload (Complex)"
  check_brand_id

  local PAYLOAD
  PAYLOAD=$(cat <<'ENDJSON'
{
  "name": "Scenario 2 Test Menu",
  "description": "Complex menu with modifiers and dietary types",
  "site_ids": ["SITE_ID_PLACEHOLDER"],
  "menu": {
    "mealtimes": [{
      "id": "MT_ALL_DAY",
      "name": {"en": "All Day Menu"},
      "description": {"en": "Available all day long"},
      "category_ids": ["CAT_MAINS", "CAT_DRINKS"],
      "schedule": [
        {"day_of_week": 0, "time_periods": [{"start": "00:00", "end": "23:59"}]},
        {"day_of_week": 1, "time_periods": [{"start": "00:00", "end": "23:59"}]},
        {"day_of_week": 2, "time_periods": [{"start": "00:00", "end": "23:59"}]},
        {"day_of_week": 3, "time_periods": [{"start": "00:00", "end": "23:59"}]},
        {"day_of_week": 4, "time_periods": [{"start": "00:00", "end": "23:59"}]},
        {"day_of_week": 5, "time_periods": [{"start": "00:00", "end": "23:59"}]},
        {"day_of_week": 6, "time_periods": [{"start": "00:00", "end": "23:59"}]}
      ],
      "image": {"url": "https://res.cloudinary.com/demo/image/upload/sample.jpg"}
    }],
    "categories": [
      {"id": "CAT_MAINS", "name": {"en": "Mains"}, "description": {"en": "Main courses"}, "item_ids": ["ITEM_BURGER", "ITEM_PIZZA"]},
      {"id": "CAT_DRINKS", "name": {"en": "Drinks"}, "item_ids": ["ITEM_COKE", "ITEM_PIZZA"]}
    ],
    "modifiers": [
      {"id": "MOD_GRP_SAUCE", "name": {"en": "Choose Sauce"}, "min_selection": 1, "max_selection": 1, "item_ids": ["MOD_KETCHUP", "MOD_MAYO"]},
      {"id": "MOD_GRP_TOPPINGS", "name": {"en": "Extra Toppings"}, "min_selection": 0, "max_selection": 5, "item_ids": ["MOD_CHEESE", "MOD_BACON"]}
    ],
    "items": [
      {"id": "ITEM_BURGER", "name": {"en": "Classic Burger"}, "description": {"en": "Juicy beef burger"}, "operational_name": "OP_BURGER", "plu": "PLU_BURGER", "price_info": {"price": 1000}, "type": "ITEM", "modifier_ids": ["MOD_GRP_SAUCE", "MOD_GRP_TOPPINGS"], "diets": ["halal"], "image": {"url": "https://res.cloudinary.com/demo/image/upload/sample.jpg"}, "tax_rate": "20"},
      {"id": "ITEM_PIZZA", "name": {"en": "Margherita Pizza"}, "description": {"en": "Classic cheese pizza"}, "operational_name": "OP_PIZZA", "plu": "PLU_PIZZA", "price_info": {"price": 1200}, "type": "ITEM", "diets": ["vegetarian"], "image": {"url": "https://res.cloudinary.com/demo/image/upload/sample.jpg"}, "tax_rate": "20"},
      {"id": "ITEM_COKE", "name": {"en": "Coca Cola"}, "description": {"en": "Refreshing cola"}, "operational_name": "OP_COKE", "plu": "PLU_COKE", "price_info": {"price": 200}, "type": "ITEM", "tax_rate": "20"},
      {"id": "MOD_KETCHUP", "name": {"en": "Ketchup"}, "description": {"en": "Tomato sauce"}, "operational_name": "OP_KETCHUP", "plu": "PLU_KETCHUP", "price_info": {"price": 0}, "type": "CHOICE", "tax_rate": "20"},
      {"id": "MOD_MAYO", "name": {"en": "Mayonnaise"}, "description": {"en": "Creamy mayo"}, "operational_name": "OP_MAYO", "plu": "PLU_MAYO", "price_info": {"price": 0}, "type": "CHOICE", "tax_rate": "20"},
      {"id": "MOD_CHEESE", "name": {"en": "Extra Cheese"}, "description": {"en": "More cheese"}, "operational_name": "OP_CHEESE", "plu": "PLU_CHEESE", "price_info": {"price": 150}, "type": "CHOICE", "tax_rate": "20"},
      {"id": "MOD_BACON", "name": {"en": "Crispy Bacon"}, "description": {"en": "Smoked bacon"}, "operational_name": "OP_BACON", "plu": "PLU_BACON", "price_info": {"price": 200}, "type": "CHOICE", "tax_rate": "20"}
    ]
  }
}
ENDJSON
)
  PAYLOAD=$(echo "$PAYLOAD" | sed "s/SITE_ID_PLACEHOLDER/$SITE_ID/g")

  log_info "Uploading complex menu..."
  api_call PUT "${MENU_API}/v1/brands/${BRAND_ID}/menus/${MENU_ID}" "$PAYLOAD"
}

# ============================================================================
# SCENARIO 3: Menu Upload with Mealtimes
# Requirements: 2+ mealtimes with distinct schedules
# ============================================================================
scenario_3() {
  log_step "Scenario 3: Menu Upload with Mealtimes"
  check_brand_id

  local TS
  TS=$(date +%s)
  local PAYLOAD
  PAYLOAD=$(cat <<ENDJSON
{
  "name": "Scenario 3 Multi-Mealtime Menu ${TS}",
  "description": "Multiple mealtimes with distinct schedules",
  "site_ids": ["${SITE_ID}"],
  "menu": {
    "mealtimes": [
      {
        "id": "MT_BREAKFAST",
        "name": {"en": "Breakfast"},
        "description": {"en": "Start your day right"},
        "category_ids": ["CAT_BREAKFAST"],
        "schedule": [
          {"day_of_week": 0, "time_periods": [{"start": "00:00", "end": "10:59"}]},
          {"day_of_week": 1, "time_periods": [{"start": "00:00", "end": "10:59"}]},
          {"day_of_week": 2, "time_periods": [{"start": "00:00", "end": "10:59"}]},
          {"day_of_week": 3, "time_periods": [{"start": "00:00", "end": "10:59"}]},
          {"day_of_week": 4, "time_periods": [{"start": "00:00", "end": "10:59"}]},
          {"day_of_week": 5, "time_periods": [{"start": "00:00", "end": "10:59"}]},
          {"day_of_week": 6, "time_periods": [{"start": "00:00", "end": "10:59"}]}
        ],
        "image": {"url": "https://res.cloudinary.com/demo/image/upload/sample.jpg"}
      },
      {
        "id": "MT_MAIN",
        "name": {"en": "Main Menu"},
        "description": {"en": "Lunch and dinner"},
        "category_ids": ["CAT_MAINS", "CAT_DRINKS"],
        "schedule": [
          {"day_of_week": 0, "time_periods": [{"start": "11:00", "end": "23:59"}]},
          {"day_of_week": 1, "time_periods": [{"start": "11:00", "end": "23:59"}]},
          {"day_of_week": 2, "time_periods": [{"start": "11:00", "end": "23:59"}]},
          {"day_of_week": 3, "time_periods": [{"start": "11:00", "end": "23:59"}]},
          {"day_of_week": 4, "time_periods": [{"start": "11:00", "end": "23:59"}]},
          {"day_of_week": 5, "time_periods": [{"start": "11:00", "end": "23:59"}]},
          {"day_of_week": 6, "time_periods": [{"start": "11:00", "end": "23:59"}]}
        ],
        "image": {"url": "https://res.cloudinary.com/demo/image/upload/sample.jpg"}
      }
    ],
    "categories": [
      {"id": "CAT_BREAKFAST", "name": {"en": "Breakfast"}, "item_ids": ["ITEM_PANCAKES", "ITEM_COFFEE"]},
      {"id": "CAT_MAINS", "name": {"en": "Mains"}, "item_ids": ["ITEM_BURGER", "ITEM_PIZZA"]},
      {"id": "CAT_DRINKS", "name": {"en": "Drinks"}, "item_ids": ["ITEM_COKE", "ITEM_COFFEE"]}
    ],
    "modifiers": [],
    "items": [
      {"id": "ITEM_PANCAKES", "name": {"en": "Pancakes"}, "description": {"en": "Fluffy pancakes"}, "plu": "PLU_PANCAKES", "price_info": {"price": 800}, "type": "ITEM", "tax_rate": "20"},
      {"id": "ITEM_COFFEE", "name": {"en": "Black Coffee"}, "description": {"en": "Strong coffee"}, "plu": "PLU_COFFEE", "price_info": {"price": 250}, "type": "ITEM", "tax_rate": "20"},
      {"id": "ITEM_BURGER", "name": {"en": "Classic Burger"}, "description": {"en": "Beef burger"}, "plu": "PLU_BURGER", "price_info": {"price": 1000}, "type": "ITEM", "tax_rate": "20"},
      {"id": "ITEM_PIZZA", "name": {"en": "Margherita"}, "description": {"en": "Cheese pizza"}, "plu": "PLU_PIZZA", "price_info": {"price": 1200}, "type": "ITEM", "tax_rate": "20"},
      {"id": "ITEM_COKE", "name": {"en": "Coca Cola"}, "description": {"en": "Refreshing cola"}, "plu": "PLU_COKE", "price_info": {"price": 200}, "type": "ITEM", "tax_rate": "20"}
    ]
  }
}
ENDJSON
)

  log_info "Uploading multi-mealtime menu..."
  api_call PUT "${MENU_API}/v1/brands/${BRAND_ID}/menus/${MENU_ID}" "$PAYLOAD"
}

# ============================================================================
# SCENARIO 4: Menu Upload with Bundles
# Requirements: Bundles, price overrides, party_size, upsells
# ============================================================================
scenario_4_upload_only() {
  check_brand_id
  local TS
  TS=$(date +%s)
  local PAYLOAD
  PAYLOAD=$(cat <<ENDJSON
{
  "name": "Base Menu ${TS}",
  "description": "Menu with known item IDs for unavailability tests",
  "site_ids": ["${SITE_ID}"],
  "menu": {
    "mealtimes": [{"id": "MT_BASE_${TS}", "name": {"en": "All Day"}, "category_ids": ["CAT_MAINS", "CAT_SIDES"], "schedule": [{"day_of_week": 0, "time_periods": [{"start": "00:00", "end": "23:59"}]},{"day_of_week": 1, "time_periods": [{"start": "00:00", "end": "23:59"}]},{"day_of_week": 2, "time_periods": [{"start": "00:00", "end": "23:59"}]},{"day_of_week": 3, "time_periods": [{"start": "00:00", "end": "23:59"}]},{"day_of_week": 4, "time_periods": [{"start": "00:00", "end": "23:59"}]},{"day_of_week": 5, "time_periods": [{"start": "00:00", "end": "23:59"}]},{"day_of_week": 6, "time_periods": [{"start": "00:00", "end": "23:59"}]}], "image": {"url": "https://res.cloudinary.com/demo/image/upload/sample.jpg"}}],
    "categories": [
      {"id": "CAT_MAINS", "name": {"en": "Mains"}, "item_ids": ["ITEM_BURGER", "ITEM_CHEESEBURGER"]},
      {"id": "CAT_SIDES", "name": {"en": "Sides"}, "item_ids": ["ITEM_FRIES", "ITEM_COKE"]}
    ],
    "items": [
      {"id": "ITEM_BURGER", "name": {"en": "Classic Burger"}, "operational_name": "OP_BURGER", "plu": "PLU_BURGER", "price_info": {"price": 1000}, "type": "ITEM", "tax_rate": "20"},
      {"id": "ITEM_CHEESEBURGER", "name": {"en": "Cheeseburger"}, "operational_name": "OP_CHEESE", "plu": "PLU_CHEESE", "price_info": {"price": 1200}, "type": "ITEM", "tax_rate": "20"},
      {"id": "ITEM_FRIES", "name": {"en": "French Fries"}, "operational_name": "OP_FRIES", "plu": "PLU_FRIES", "price_info": {"price": 300}, "type": "ITEM", "tax_rate": "20"},
      {"id": "ITEM_COKE", "name": {"en": "Coca Cola"}, "operational_name": "OP_COKE", "plu": "PLU_COKE", "price_info": {"price": 200}, "type": "ITEM", "tax_rate": "20"}
    ]
  }
}
ENDJSON
)
  api_call PUT "${MENU_API}/v1/brands/${BRAND_ID}/menus/${MENU_ID}" "$PAYLOAD"
}

scenario_4() {
  log_step "Scenario 4: Menu Upload with Bundles"
  check_brand_id

  local TS
  TS=$(date +%s)
  local PAYLOAD
  PAYLOAD=$(cat <<ENDJSON
{
  "name": "Scenario 4 Bundle Menu ${TS}",
  "description": "Menu with bundles and price overrides",
  "site_ids": ["${SITE_ID}"],
  "menu": {
    "mealtimes": [{
      "id": "MT_ALL_DAY_${TS}",
      "name": {"en": "All Day Menu"},
      "description": {"en": "Available all day"},
      "category_ids": ["CAT_DEALS", "CAT_MAINS", "CAT_SIDES"],
      "schedule": [
        {"day_of_week": 0, "time_periods": [{"start": "00:00", "end": "23:59"}]},
        {"day_of_week": 1, "time_periods": [{"start": "00:00", "end": "23:59"}]},
        {"day_of_week": 2, "time_periods": [{"start": "00:00", "end": "23:59"}]},
        {"day_of_week": 3, "time_periods": [{"start": "00:00", "end": "23:59"}]},
        {"day_of_week": 4, "time_periods": [{"start": "00:00", "end": "23:59"}]},
        {"day_of_week": 5, "time_periods": [{"start": "00:00", "end": "23:59"}]},
        {"day_of_week": 6, "time_periods": [{"start": "00:00", "end": "23:59"}]}
      ],
      "image": {"url": "https://res.cloudinary.com/demo/image/upload/sample.jpg"}
    }],
    "categories": [
      {"id": "CAT_DEALS", "name": {"en": "Meal Deals"}, "item_ids": ["BUNDLE_MEAL_1", "BUNDLE_MEAL_2"]},
      {"id": "CAT_MAINS", "name": {"en": "Mains"}, "item_ids": ["ITEM_BURGER", "ITEM_CHEESEBURGER"]},
      {"id": "CAT_SIDES", "name": {"en": "Sides & Drinks"}, "item_ids": ["ITEM_FRIES", "ITEM_COKE"]}
    ],
    "modifiers": [
      {"id": "MOD_GRP_BUNDLE_MAINS", "name": {"en": "Choose your Main"}, "min_selection": 1, "max_selection": 1, "type": "bundle-item", "item_ids": ["ITEM_BURGER", "ITEM_CHEESEBURGER"]},
      {"id": "MOD_GRP_BUNDLE_SIDES", "name": {"en": "Choose your Side"}, "min_selection": 1, "max_selection": 1, "type": "bundle-item", "item_ids": ["ITEM_FRIES"]},
      {"id": "MOD_GRP_BUNDLE_DRINKS", "name": {"en": "Choose your Drink"}, "min_selection": 1, "max_selection": 1, "type": "bundle-item", "item_ids": ["ITEM_COKE"]},
      {"id": "MOD_GRP_UPSELL", "name": {"en": "Make it a meal?"}, "min_selection": 0, "max_selection": 2, "type": "up-sell-existing-items", "item_ids": ["ITEM_FRIES", "ITEM_COKE"]},
      {"id": "MOD_GRP_BUNDLE_MAINS_2", "name": {"en": "Choose 2 Mains"}, "min_selection": 2, "max_selection": 2, "type": "bundle-item", "item_ids": ["ITEM_BURGER", "ITEM_CHEESEBURGER"]}
    ],
    "items": [
      {"id": "BUNDLE_MEAL_1", "name": {"en": "Burger Meal for One"}, "description": {"en": "Burger + Fries + Drink"}, "operational_name": "OP_MEAL_1", "plu": "PLU_MEAL_1", "price_info": {"price": 1300}, "type": "BUNDLE", "party_size": 1, "modifier_ids": ["MOD_GRP_BUNDLE_MAINS", "MOD_GRP_BUNDLE_SIDES", "MOD_GRP_BUNDLE_DRINKS"], "tax_rate": "20", "contains_alcohol": false},
      {"id": "BUNDLE_MEAL_2", "name": {"en": "Double Trouble"}, "description": {"en": "Two Burgers"}, "operational_name": "OP_MEAL_2", "plu": "PLU_MEAL_2", "price_info": {"price": 1800}, "type": "BUNDLE", "party_size": 2, "modifier_ids": ["MOD_GRP_BUNDLE_MAINS_2"], "tax_rate": "20", "contains_alcohol": false},
      {"id": "ITEM_BURGER", "name": {"en": "Classic Burger"}, "description": {"en": "Juicy beef burger"}, "operational_name": "OP_BURGER", "plu": "PLU_BURGER", "price_info": {"price": 1000, "overrides": [{"type": "ITEM", "id": "BUNDLE_MEAL_1", "price": 0}, {"type": "MODIFIER", "id": "MOD_GRP_BUNDLE_MAINS_2", "price": 0}, {"type": "MODIFIER", "id": "MOD_GRP_UPSELL", "price": 1000}]}, "type": "ITEM", "modifier_ids": ["MOD_GRP_UPSELL"], "tax_rate": "20", "contains_alcohol": false},
      {"id": "ITEM_CHEESEBURGER", "name": {"en": "Cheeseburger"}, "description": {"en": "Burger with cheese"}, "operational_name": "OP_CHEESE", "plu": "PLU_CHEESE", "price_info": {"price": 1200, "overrides": [{"type": "MODIFIER", "id": "MOD_GRP_BUNDLE_MAINS", "price": 200}, {"type": "MODIFIER", "id": "MOD_GRP_BUNDLE_MAINS_2", "price": 200}]}, "type": "ITEM", "tax_rate": "20", "contains_alcohol": false},
      {"id": "ITEM_FRIES", "name": {"en": "French Fries"}, "description": {"en": "Crispy fries"}, "operational_name": "OP_FRIES", "plu": "PLU_FRIES", "price_info": {"price": 300, "overrides": [{"type": "MODIFIER", "id": "MOD_GRP_BUNDLE_SIDES", "price": 0}, {"type": "MODIFIER", "id": "MOD_GRP_UPSELL", "price": 250}]}, "type": "ITEM", "tax_rate": "20", "contains_alcohol": false},
      {"id": "ITEM_COKE", "name": {"en": "Coca Cola"}, "description": {"en": "Chilled coke"}, "operational_name": "OP_COKE", "plu": "PLU_COKE", "price_info": {"price": 200, "overrides": [{"type": "MODIFIER", "id": "MOD_GRP_BUNDLE_DRINKS", "price": 0}, {"type": "MODIFIER", "id": "MOD_GRP_UPSELL", "price": 150}]}, "type": "ITEM", "tax_rate": "20", "contains_alcohol": false}
    ]
  }
}
ENDJSON
)

  log_info "Uploading bundle menu..."
  api_call PUT "${MENU_API}/v1/brands/${BRAND_ID}/menus/${MENU_ID}" "$PAYLOAD"
}

# ============================================================================
# SCENARIO 5: Update Existing Menu with No Changes (Idempotency)
# ============================================================================
scenario_5() {
  log_step "Scenario 5: Update Menu (No Changes)"
  check_brand_id

  local PAYLOAD
  PAYLOAD=$(cat <<ENDJSON
{
  "name": "Scenario 5 Test Menu - Static Baseline",
  "description": "Validating MATCH_EXISTING_MENU response",
  "site_ids": ["${SITE_ID}"],
  "menu": {
    "mealtimes": [{
      "id": "MT_SCENARIO_5_CLEAN",
      "name": {"en": "Standard Mealtime"},
      "description": {"en": "Everyday menu"},
      "category_ids": ["CAT_SCEN5_MAINS"],
      "schedule": [
        {"day_of_week": 0, "time_periods": [{"start": "00:00", "end": "23:59"}]},
        {"day_of_week": 1, "time_periods": [{"start": "00:00", "end": "23:59"}]},
        {"day_of_week": 2, "time_periods": [{"start": "00:00", "end": "23:59"}]},
        {"day_of_week": 3, "time_periods": [{"start": "00:00", "end": "23:59"}]},
        {"day_of_week": 4, "time_periods": [{"start": "00:00", "end": "23:59"}]},
        {"day_of_week": 5, "time_periods": [{"start": "00:00", "end": "23:59"}]},
        {"day_of_week": 6, "time_periods": [{"start": "00:00", "end": "23:59"}]}
      ],
      "image": {"url": "https://res.cloudinary.com/demo/image/upload/sample.jpg"}
    }],
    "categories": [{"id": "CAT_SCEN5_MAINS", "name": {"en": "Mains"}, "item_ids": ["ITEM_SCEN5_BURGER"]}],
    "modifiers": [{"id": "MOD_GRP_SCEN5_SAUCE", "name": {"en": "Choose Sauce"}, "min_selection": 0, "max_selection": 1, "item_ids": ["MOD_SCEN5_KETCHUP"]}],
    "items": [
      {"id": "ITEM_SCEN5_BURGER", "name": {"en": "Classic Burger"}, "description": {"en": "Juicy beef burger"}, "operational_name": "OP_SCEN5_BURGER", "plu": "PLU_SCEN5_BURGER", "price_info": {"price": 1000}, "type": "ITEM", "modifier_ids": ["MOD_GRP_SCEN5_SAUCE"], "tax_rate": "20", "contains_alcohol": false},
      {"id": "MOD_SCEN5_KETCHUP", "name": {"en": "Ketchup"}, "operational_name": "OP_SCEN5_KETCHUP", "plu": "PLU_SCEN5_KETCHUP", "price_info": {"price": 0}, "type": "CHOICE", "tax_rate": "20"}
    ]
  }
}
ENDJSON
)

  log_info "Upload 1: Initial menu..."
  api_call PUT "${MENU_API}/v1/brands/${BRAND_ID}/menus/${MENU_ID}" "$PAYLOAD"

  log_info "Waiting 3s before re-upload..."
  sleep 3

  log_info "Upload 2: Same menu (no changes)..."
  api_call PUT "${MENU_API}/v1/brands/${BRAND_ID}/menus/${MENU_ID}" "$PAYLOAD"
}

# ============================================================================
# SCENARIO 6: Menu Create/Update + Webhook Callback
# ============================================================================
scenario_6() {
  log_step "Scenario 6: Menu + Webhook Callback"
  check_brand_id

  local TS
  TS=$(date +%s)
  local PAYLOAD
  PAYLOAD=$(cat <<ENDJSON
{
  "name": "Scenario 6 Webhook Test ${TS}",
  "description": "Triggering webhook callback",
  "site_ids": ["${SITE_ID}"],
  "menu": {
    "mealtimes": [{
      "id": "MT_SCEN6_${TS}",
      "name": {"en": "Webhook Mealtime"},
      "description": {"en": "Triggering events"},
      "category_ids": ["CAT_SCEN6_${TS}"],
      "schedule": [
        {"day_of_week": 0, "time_periods": [{"start": "00:00", "end": "23:59"}]},
        {"day_of_week": 1, "time_periods": [{"start": "00:00", "end": "23:59"}]},
        {"day_of_week": 2, "time_periods": [{"start": "00:00", "end": "23:59"}]},
        {"day_of_week": 3, "time_periods": [{"start": "00:00", "end": "23:59"}]},
        {"day_of_week": 4, "time_periods": [{"start": "00:00", "end": "23:59"}]},
        {"day_of_week": 5, "time_periods": [{"start": "00:00", "end": "23:59"}]},
        {"day_of_week": 6, "time_periods": [{"start": "00:00", "end": "23:59"}]}
      ],
      "image": {"url": "https://res.cloudinary.com/demo/image/upload/sample.jpg"}
    }],
    "categories": [{"id": "CAT_SCEN6_${TS}", "name": {"en": "Scenario 6 Items ${TS}"}, "item_ids": ["ITEM_SCEN6_${TS}"]}],
    "items": [{"id": "ITEM_SCEN6_${TS}", "name": {"en": "Webhook Trigger Item ${TS}"}, "description": {"en": "Item for Scenario 6 - ${TS}"}, "operational_name": "Webhook Item ${TS}", "plu": "PLU_SCEN6_${TS}", "price_info": {"price": $((500 + RANDOM % 500))}, "type": "ITEM", "tax_rate": "20"}]
  }
}
ENDJSON
)

  log_info "Uploading menu (webhook should fire)..."
  api_call PUT "${MENU_API}/v1/brands/${BRAND_ID}/menus/${MENU_ID}" "$PAYLOAD"
  log_info "Check Convex logs for menu.publish_event webhook"
}

# ============================================================================
# SCENARIO 7: Image Caching Headers
# Requirements: Images must return ETag or Last-Modified headers
# ============================================================================
scenario_7() {
  log_step "Scenario 7: Image Caching Headers"
  check_brand_id

  local PAYLOAD
  PAYLOAD=$(cat <<ENDJSON
{
  "name": "Scenario 7 Image Headers",
  "description": "Testing ETag/Last-Modified headers",
  "site_ids": ["${SITE_ID}"],
  "menu": {
    "mealtimes": [{
      "id": "MT_SCEN7",
      "name": {"en": "Image Test Menu"},
      "description": {"en": "Testing image headers"},
      "category_ids": ["CAT_SCEN7"],
      "schedule": [
        {"day_of_week": 0, "time_periods": [{"start": "00:00", "end": "23:59"}]},
        {"day_of_week": 1, "time_periods": [{"start": "00:00", "end": "23:59"}]},
        {"day_of_week": 2, "time_periods": [{"start": "00:00", "end": "23:59"}]},
        {"day_of_week": 3, "time_periods": [{"start": "00:00", "end": "23:59"}]},
        {"day_of_week": 4, "time_periods": [{"start": "00:00", "end": "23:59"}]},
        {"day_of_week": 5, "time_periods": [{"start": "00:00", "end": "23:59"}]},
        {"day_of_week": 6, "time_periods": [{"start": "00:00", "end": "23:59"}]}
      ],
      "image": {"url": "https://res.cloudinary.com/demo/image/upload/sample.jpg"}
    }],
    "categories": [{"id": "CAT_SCEN7", "name": {"en": "Image Items"}, "item_ids": ["ITEM_SCEN7_1"]}],
    "modifiers": [],
    "items": [{"id": "ITEM_SCEN7_1", "name": {"en": "Burger with Image"}, "description": {"en": "Checking caching headers"}, "operational_name": "OP_IMAGE_CHECK", "plu": "PLU_SCEN7_1", "price_info": {"price": 1200}, "type": "ITEM", "tax_rate": "20", "image": {"url": "https://res.cloudinary.com/demo/image/upload/sample.jpg"}}]
  }
}
ENDJSON
)

  log_info "Uploading menu with Cloudinary images (cache headers OK)..."
  api_call PUT "${MENU_API}/v1/brands/${BRAND_ID}/menus/${MENU_ID}" "$PAYLOAD"
}

# ============================================================================
# SCENARIO 8: Update Menu Unavailabilities
# POST /v1/brands/{brandId}/menus/{menuId}/item_unavailabilities/{siteId}
# ============================================================================
scenario_8() {
  log_step "Scenario 8: Update Menu Unavailabilities"
  check_brand_id

  local TS
  TS=$(date +%s)

  log_info "Step 0: Uploading menu with required item IDs (orange_juice, granola, whole_milk)..."
  local MENU_PAYLOAD
  MENU_PAYLOAD=$(cat <<ENDJSON
{
  "name": "Scenario 8 Menu ${TS}",
  "description": "Menu for unavailability tests",
  "site_ids": ["${SITE_ID}"],
  "menu": {
    "mealtimes": [{"id": "MT_SCEN8_${TS}", "name": {"en": "All Day"}, "category_ids": ["CAT_SCEN8"], "schedule": [{"day_of_week": 0, "time_periods": [{"start": "00:00", "end": "23:59"}]},{"day_of_week": 1, "time_periods": [{"start": "00:00", "end": "23:59"}]},{"day_of_week": 2, "time_periods": [{"start": "00:00", "end": "23:59"}]},{"day_of_week": 3, "time_periods": [{"start": "00:00", "end": "23:59"}]},{"day_of_week": 4, "time_periods": [{"start": "00:00", "end": "23:59"}]},{"day_of_week": 5, "time_periods": [{"start": "00:00", "end": "23:59"}]},{"day_of_week": 6, "time_periods": [{"start": "00:00", "end": "23:59"}]}], "image": {"url": "https://res.cloudinary.com/demo/image/upload/sample.jpg"}}],
    "categories": [{"id": "CAT_SCEN8", "name": {"en": "Breakfast"}, "item_ids": ["orange_juice", "granola", "whole_milk"]}],
    "items": [
      {"id": "orange_juice", "name": {"en": "Orange Juice"}, "operational_name": "OJ", "plu": "PLU_OJ", "price_info": {"price": 350}, "type": "ITEM", "tax_rate": "20"},
      {"id": "granola", "name": {"en": "Granola"}, "operational_name": "GRANOLA", "plu": "PLU_GRANOLA", "price_info": {"price": 500}, "type": "ITEM", "tax_rate": "20"},
      {"id": "whole_milk", "name": {"en": "Whole Milk"}, "operational_name": "MILK", "plu": "PLU_MILK", "price_info": {"price": 200}, "type": "ITEM", "tax_rate": "20"}
    ]
  }
}
ENDJSON
)
  api_call PUT "${MENU_API}/v1/brands/${BRAND_ID}/menus/${MENU_ID}" "$MENU_PAYLOAD"

  log_info "Waiting 2s..."
  sleep 2

  log_info "Step 1: Mark orange_juice + granola as UNAVAILABLE..."
  api_call POST "${MENU_API}/v1/brands/${BRAND_ID}/menus/${MENU_ID}/item_unavailabilities/${SITE_ID}" \
    '{"item_unavailabilities": [{"item_id": "orange_juice", "status": "unavailable"}, {"item_id": "granola", "status": "unavailable"}]}'

  log_info "Waiting 2s (rate limit)..."
  sleep 2

  log_info "Step 2: Mark orange_juice as AVAILABLE, whole_milk as UNAVAILABLE..."
  api_call POST "${MENU_API}/v1/brands/${BRAND_ID}/menus/${MENU_ID}/item_unavailabilities/${SITE_ID}" \
    '{"item_unavailabilities": [{"item_id": "orange_juice", "status": "available"}, {"item_id": "whole_milk", "status": "unavailable"}]}'
}

# ============================================================================
# SCENARIO 9: Replace Item Unavailabilities (PUT)
# PUT /v1/brands/{brandId}/menus/{menuId}/item_unavailabilities/{siteId}
# ============================================================================
scenario_9() {
  log_step "Scenario 9: Replace Item Unavailabilities (Tablet mode)"
  check_brand_id

  log_info "Step 1: GET current unavailabilities..."
  api_call GET "${MENU_API}/v1/brands/${BRAND_ID}/menus/${MENU_ID}/item_unavailabilities/${SITE_ID}"

  log_info "Waiting 15s (rate limit: 1 req/min on this endpoint)..."
  sleep 15

  log_info "Step 2: PUT replace ALL unavailabilities (preserve existing + add whole_milk)..."
  api_call PUT "${MENU_API}/v1/brands/${BRAND_ID}/menus/${MENU_ID}/item_unavailabilities/${SITE_ID}" \
    '{"unavailable_ids": ["orange_juice", "whole_milk"], "hidden_ids": ["granola"]}'
}

# ============================================================================
# SCENARIO 10: Reset Menu Item Unavailabilities
# ============================================================================
scenario_10() {
  log_step "Scenario 10: Reset Menu Item Unavailabilities"
  check_brand_id

  log_info "Step 1: GET current unavailabilities..."
  api_call GET "${MENU_API}/v1/brands/${BRAND_ID}/menus/${MENU_ID}/item_unavailabilities/${SITE_ID}"

  log_info "Waiting 15s (rate limit)..."
  sleep 15

  log_info "Step 2: PUT reset all items to available (empty lists)..."
  api_call PUT "${MENU_API}/v1/brands/${BRAND_ID}/menus/${MENU_ID}/item_unavailabilities/${SITE_ID}" \
    '{"unavailable_ids": [], "hidden_ids": []}'
}

# ============================================================================
# SCENARIO 11: Menu Morning Stock Reset
# Mark items as unavailable, then reset
# ============================================================================
scenario_11() {
  log_step "Scenario 11: Menu Morning Stock Reset"
  check_brand_id

  log_info "Step 1: Mark granola as UNAVAILABLE, orange_juice as HIDDEN (POST)..."
  api_call POST "${MENU_API}/v1/brands/${BRAND_ID}/menus/${MENU_ID}/item_unavailabilities/${SITE_ID}" \
    '{"item_unavailabilities": [{"item_id": "granola", "status": "unavailable"}, {"item_id": "orange_juice", "status": "hidden"}]}'
}

# ============================================================================
# SCENARIO 12: Ignoring Menu Morning Stock Reset
# Use V2 POST endpoint to update without resetting
# ============================================================================
scenario_12() {
  log_step "Scenario 12: Ignoring Menu Morning Stock Reset"
  check_brand_id

  log_info "Step 1: Polling for initial state (orange_juice unavailable)..."
  for i in $(seq 1 10); do
    log_info "GET attempt ${i}..."
    api_call GET "${MENU_API}/v1/brands/${BRAND_ID}/menus/${MENU_ID}/item_unavailabilities/${SITE_ID}"
    sleep 2
  done

  log_info "Waiting 15s (rate limit)..."
  sleep 15

  log_info "Step 2: Set whole_milk as UNAVAILABLE (POST, ignoring morning reset)..."
  api_call POST "${MENU_API}/v1/brands/${BRAND_ID}/menus/${MENU_ID}/item_unavailabilities/${SITE_ID}" \
    '{"item_unavailabilities": [{"item_id": "whole_milk", "status": "unavailable"}]}'
}

# ============================================================================
# SCENARIO 13: Update Unavailabilities After Menu Upload
# ============================================================================
scenario_13() {
  log_step "Scenario 13: Update Unavailabilities After Menu Upload (150 items)"
  check_brand_id

  local TS
  TS=$(date +%s)

  log_info "Step 1: Generating large menu with 150 items..."
  # Generate 150 items JSON
  local ITEMS=""
  local ITEM_IDS=""
  for i in $(seq 0 149); do
    [ -n "$ITEMS" ] && ITEMS="${ITEMS},"
    [ -n "$ITEM_IDS" ] && ITEM_IDS="${ITEM_IDS},"
    ITEMS="${ITEMS}{\"id\": \"item_${i}\", \"name\": {\"en\": \"Item ${i} - ${TS}\"}, \"description\": {\"en\": \"Description for Item ${i} (${TS})\"}, \"price_info\": {\"price\": $((1000 + i))}, \"tax_rate\": \"20\", \"type\": \"ITEM\", \"plu\": \"plu_${i}\"}"
    ITEM_IDS="${ITEM_IDS}\"item_${i}\""
  done

  local PAYLOAD="{
  \"menu\": {
    \"items\": [${ITEMS}],
    \"categories\": [{\"id\": \"cat_large\", \"name\": {\"en\": \"Large Category\"}, \"item_ids\": [${ITEM_IDS}]}],
    \"mealtimes\": [{\"id\": \"meal_large\", \"name\": {\"en\": \"All Day\"}, \"image\": {\"url\": \"https://res.cloudinary.com/demo/image/upload/sample.jpg\"}, \"schedule\": [{\"day_of_week\": 1, \"time_periods\": [{\"start\": \"00:00:00\", \"end\": \"23:59:00\"}]}], \"category_ids\": [\"cat_large\"]}],
    \"modifiers\": [],
    \"currency_code\": \"EUR\"
  },
  \"site_ids\": [\"${SITE_ID}\"]
}"

  log_info "Uploading menu (150 items, forces async processing)..."
  api_call PUT "${MENU_API}/v1/brands/${BRAND_ID}/menus/${MENU_ID}" "$PAYLOAD"

  log_info "Waiting 30s for async menu processing + webhook..."
  sleep 30

  log_info "Step 2: Mark item_0 as UNAVAILABLE after upload..."
  api_call POST "${MENU_API}/v1/brands/${BRAND_ID}/menus/${MENU_ID}/item_unavailabilities/${SITE_ID}" \
    '{"item_unavailabilities": [{"item_id": "item_0", "status": "unavailable"}]}'
}

# ============================================================================
# SCENARIO 14: [V3] Generate S3 Upload URL
# PUT /menu/v3/brands/{brandId}/menus/{menuId}
# ============================================================================
scenario_14() {
  log_step "Scenario 14: [V3] Generate S3 Upload URL"
  check_brand_id

  log_info "Generating S3 upload URL..."
  api_call PUT "${MENU_API}/v3/brands/${BRAND_ID}/menus/${MENU_ID}"

  S3_URL=$(echo "$LAST_RESPONSE" | jq -r '.upload_url // empty' 2>/dev/null)
  V3_VERSION=$(echo "$LAST_RESPONSE" | jq -r '.version // empty' 2>/dev/null)

  if [ -n "$S3_URL" ]; then
    log_ok "S3 URL: ${S3_URL:0:80}..."
    log_ok "Version: $V3_VERSION"
    export S3_URL V3_VERSION
  else
    log_warn "Could not extract S3 URL from response"
  fi
}

# ============================================================================
# SCENARIO 15: [V3] Async Menu Upload + Webhook
# 1. Generate S3 URL (PUT)
# 2. Upload to S3
# 3. Start job (POST)
# ============================================================================
scenario_15() {
  log_step "Scenario 15: [V3] Async Menu Upload + Webhook"
  check_brand_id

  log_info "Step 1: Generate S3 upload URL..."
  api_call PUT "${MENU_API}/v3/brands/${BRAND_ID}/menus/${MENU_ID}"

  local S3_URL
  S3_URL=$(echo "$LAST_RESPONSE" | jq -r '.upload_url // empty' 2>/dev/null)
  local V3_VERSION
  V3_VERSION=$(echo "$LAST_RESPONSE" | jq -r '.version // empty' 2>/dev/null)

  if [ -z "$S3_URL" ] || [ "$S3_URL" = "null" ]; then
    log_error "Failed to get S3 URL"
    return 1
  fi
  log_ok "S3 URL obtained"

  log_info "Step 2: Upload menu JSON to S3..."
  local TS
  TS=$(date +%s)
  local MENU_PAYLOAD
  MENU_PAYLOAD=$(cat <<ENDJSON
{
  "name": "V3 Async Menu ${TS}",
  "description": "V3 async upload test",
  "site_ids": ["${SITE_ID}"],
  "menu": {
    "mealtimes": [{
      "id": "MT_V3_${TS}",
      "name": {"en": "V3 Menu"},
      "category_ids": ["CAT_V3"],
      "schedule": [
        {"day_of_week": 0, "time_periods": [{"start": "00:00", "end": "23:59"}]},
        {"day_of_week": 1, "time_periods": [{"start": "00:00", "end": "23:59"}]},
        {"day_of_week": 2, "time_periods": [{"start": "00:00", "end": "23:59"}]},
        {"day_of_week": 3, "time_periods": [{"start": "00:00", "end": "23:59"}]},
        {"day_of_week": 4, "time_periods": [{"start": "00:00", "end": "23:59"}]},
        {"day_of_week": 5, "time_periods": [{"start": "00:00", "end": "23:59"}]},
        {"day_of_week": 6, "time_periods": [{"start": "00:00", "end": "23:59"}]}
      ],
      "image": {"url": "https://res.cloudinary.com/demo/image/upload/sample.jpg"}
    }],
    "categories": [{"id": "CAT_V3", "name": {"en": "V3 Items"}, "item_ids": ["ITEM_V3_1"]}],
    "items": [{"id": "ITEM_V3_1", "name": {"en": "V3 Burger"}, "price_info": {"price": 1000}, "type": "ITEM", "plu": "PLU_V3_1", "tax_rate": "20"}]
  }
}
ENDJSON
)

  # S3 upload uses PUT WITHOUT Authorization header (presigned URL)
  local S3_STATUS
  S3_STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X PUT "$S3_URL" \
    -H "Content-Type: application/json" \
    -d "$MENU_PAYLOAD")

  if [[ "$S3_STATUS" =~ ^2 ]]; then
    log_ok "S3 upload: HTTP $S3_STATUS"
  else
    log_error "S3 upload: HTTP $S3_STATUS"
    return 1
  fi

  log_info "Step 3: Start publish job..."
  local JOB_PAYLOAD
  JOB_PAYLOAD=$(cat <<ENDJSON
{
  "action": "publish_menu_to_live",
  "params": {
    "menu_id": "${MENU_ID}",
    "site_ids": ["${SITE_ID}"],
    "version": "${V3_VERSION}"
  }
}
ENDJSON
)
  api_call POST "${MENU_API}/v3/brands/${BRAND_ID}/jobs" "$JOB_PAYLOAD"

  JOB_ID=$(echo "$LAST_RESPONSE" | jq -r '.job_id // .id // empty' 2>/dev/null)
  if [ -n "$JOB_ID" ]; then
    log_ok "Job ID: $JOB_ID"
    export JOB_ID
  fi
}

# ============================================================================
# SCENARIO 16: [V3] Fetch Menu Upload Job Status
# GET /menu/v3/brands/{brandId}/jobs/{jobId}
# ============================================================================
scenario_16() {
  log_step "Scenario 16: [V3] Fetch Menu Upload Job Status"
  check_brand_id

  if [ -z "${JOB_ID:-}" ]; then
    log_warn "No JOB_ID set. Run scenario 15 first."
    log_info "Or set: export JOB_ID=<your-job-id>"
    return 1
  fi

  log_info "Polling job status (max 10 attempts)..."
  for i in $(seq 1 10); do
    api_call GET "${MENU_API}/v3/brands/${BRAND_ID}/jobs/${JOB_ID}"
    local STATUS
    STATUS=$(echo "$LAST_RESPONSE" | jq -r '.status // empty' 2>/dev/null)
    log_info "Attempt $i: status=$STATUS"

    if [ "$STATUS" = "success" ] || [ "$STATUS" = "completed" ]; then
      log_ok "Job completed!"
      return 0
    elif [ "$STATUS" = "failed" ]; then
      log_error "Job failed"
      return 1
    fi

    sleep 3
  done
  log_warn "Job still pending after 10 attempts"
}

# ============================================================================
# SCENARIO 17: [V3] Get Menu Async
# GET /menu/v3/brands/{brandId}/menus/{menuId}
# ============================================================================
scenario_17() {
  log_step "Scenario 17: [V3] Get Menu Async"
  check_brand_id

  log_info "Fetching V3 menu..."
  api_call GET "${MENU_API}/v3/brands/${BRAND_ID}/menus/${MENU_ID}"
}

# ============================================================================
# Helpers
# ============================================================================
check_brand_id() {
  if [ -z "$BRAND_ID" ]; then
    log_error "BRAND_ID is required. Run scenario 1 first."
    exit 1
  fi
}

show_usage() {
  echo -e "${BLUE}Deliveroo Menu API Scenario Test Script${NC}"
  echo ""
  echo "Usage: $0 <scenario_number> [options]"
  echo ""
  echo "Required env vars:"
  echo "  DELIVEROO_SITE_ID    - Your sandbox site ID (from Developer Portal)"
  echo ""
  echo "Optional env vars:"
  echo "  DELIVEROO_BRAND_ID   - Brand ID (fetched by scenario 1)"
  echo "  DELIVEROO_MENU_ID    - Menu ID (default: test-menu-1)"
  echo "  DELIVEROO_CLIENT_ID  - API client ID"
  echo "  DELIVEROO_CLIENT_SECRET - API client secret"
  echo ""
  echo "Scenarios:"
  echo "  1   Fetch Brand ID"
  echo "  2   Menu upload (complex: modifiers, dietary types)"
  echo "  3   Menu upload with mealtimes"
  echo "  4   Menu upload with bundles"
  echo "  5   Update menu with no changes (idempotency)"
  echo "  6   Menu create/update + webhook callback"
  echo "  7   Image caching headers"
  echo "  8   Update menu unavailabilities"
  echo "  9   Replace item unavailabilities (tablet mode)"
  echo "  10  Reset menu item unavailabilities"
  echo "  11  Menu morning stock reset"
  echo "  12  Ignoring menu morning stock reset"
  echo "  13  Update unavailabilities after menu upload"
  echo "  14  [V3] Generate S3 upload URL"
  echo "  15  [V3] Async menu upload + webhook"
  echo "  16  [V3] Fetch menu upload job status"
  echo "  17  [V3] Get menu async"
  echo "  all Run all scenarios sequentially"
  echo ""
  echo "Examples:"
  echo "  DELIVEROO_SITE_ID=12345 $0 1        # Get brand ID"
  echo "  DELIVEROO_SITE_ID=12345 DELIVEROO_BRAND_ID=abc-123 $0 2"
  echo "  DELIVEROO_SITE_ID=12345 $0 all       # Run all"
}

run_all() {
  get_token
  scenario_1
  sleep 2
  for i in $(seq 2 13); do
    scenario_${i}
    sleep 2
  done
  for i in $(seq 14 17); do
    scenario_${i}
    sleep 2
  done
  log_step "ALL SCENARIOS COMPLETE"
}

# ============================================================================
# Main
# ============================================================================
if [ $# -eq 0 ]; then
  show_usage
  exit 0
fi

SCENARIO="$1"

get_token

case "$SCENARIO" in
  1|2|3|4|5|6|7|8|9|10|11|12|13|14|15|16|17)
    scenario_${SCENARIO}
    ;;
  all)
    run_all
    ;;
  *)
    show_usage
    exit 1
    ;;
esac

echo ""
log_ok "Done!"
