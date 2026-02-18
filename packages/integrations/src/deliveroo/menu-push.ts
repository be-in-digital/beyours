/**
 * Build and push Deliveroo menu payload using V1 API
 *
 * Uses PUT /v1/brands/{brandId}/menus/{menuId} (documented endpoint).
 * The POST /v1/brands/{brandId}/menus route is behind a different gateway
 * authorizer that rejects Bearer tokens, so we use PUT with a stable menu ID.
 */

import type { DeliverooCredentials } from "./types"
import { fetchDeliveroo, validatePathParam } from "./client"
import { IntegrationError } from "../common/errors"

// === V1 Menu Payload Types ===

export interface DeliverooLocalizedString {
  en: string
  fr?: string
}

export interface DeliverooV1Mealtime {
  id: string
  name: DeliverooLocalizedString
  image: { url: string }
  category_ids: string[]
  schedule: Array<{
    day_of_week: number
    time_periods: Array<{ start: string; end: string }>
  }>
}

export interface DeliverooV1Category {
  id: string
  name: DeliverooLocalizedString
  description?: DeliverooLocalizedString
  item_ids: string[]
}

export interface DeliverooV1Item {
  id: string
  name: DeliverooLocalizedString
  description?: DeliverooLocalizedString
  operational_name: string
  plu: string
  price_info: { price: number }
  type: "ITEM"
  tax_rate: string
  image?: { url: string }
  modifier_group_ids?: string[]
}

export interface DeliverooV1Modifier {
  id: string
  name: DeliverooLocalizedString
  description?: DeliverooLocalizedString
  operational_name: string
  plu: string
  price_info: { price: number }
  tax_rate: string
  type: "ITEM"
}

export interface DeliverooV1ModifierGroup {
  id: string
  name: DeliverooLocalizedString
  operational_name: string
  min_selection: number
  max_selection: number
  modifier_ids: string[]
}

export interface DeliverooV1MenuPayload {
  name: string
  description?: string
  site_ids: string[]
  menu: {
    mealtimes: DeliverooV1Mealtime[]
    categories: DeliverooV1Category[]
    items: DeliverooV1Item[]
    modifiers: DeliverooV1Modifier[]
    modifier_groups: DeliverooV1ModifierGroup[]
  }
}

// === Push to API ===

/**
 * Push menu to Deliveroo for a specific brand.
 * Uses PUT /v1/brands/{brandId}/menus/{menuId} (documented V1 endpoint).
 *
 * The payload must include site_ids to specify which sites the menu applies to.
 * A stable menuId is required — typically "main-menu" for single-menu restaurants.
 */
export async function pushMenu(
  credentials: DeliverooCredentials,
  brandId: string,
  menuId: string,
  payload: DeliverooV1MenuPayload
): Promise<void> {
  const response = await fetchDeliveroo(
    credentials,
    `/v1/brands/${validatePathParam(brandId, "brandId")}/menus/${validatePathParam(menuId, "menuId")}`,
    { method: "PUT", body: payload },
    "menu"
  )
  if (!response.ok) {
    const errorText = await response.text()
    throw new IntegrationError(
      "Failed to push menu to Deliveroo",
      response.status,
      "deliveroo",
      errorText
    )
  }
}

/**
 * Set PLU (Price Look-Up) mappings for items.
 * Maps internal product IDs to Deliveroo item IDs.
 */
export async function setPLUMappings(
  credentials: DeliverooCredentials,
  brandId: string,
  siteId: string,
  mappings: Array<{ deliveroo_item_id: string; pos_item_id: string }>
): Promise<void> {
  if (mappings.length === 0) return

  const response = await fetchDeliveroo(
    credentials,
    `/v1/brands/${validatePathParam(brandId, "brandId")}/sites/${validatePathParam(siteId, "siteId")}/plu_mapping`,
    { method: "PUT", body: { mappings } },
    "menu"
  )
  if (!response.ok) {
    const errorText = await response.text()
    throw new IntegrationError(
      "Failed to set Deliveroo PLU mappings",
      response.status,
      "deliveroo",
      errorText
    )
  }
}
