/**
 * Deliveroo menu synchronization
 * Pull: fetch menu from Deliveroo -> parse into PulledCategory[] format
 */

import type { DeliverooCredentials } from "./types"
import type {
  DeliverooMenuListResponse,
  DeliverooMenuResponse,
  DeliverooCategory,
  DeliverooMenuItem,
  DeliverooModifierGroup,
} from "./types"
import { fetchDeliveroo, validatePathParam } from "./client"
import { IntegrationError } from "../common/errors"
import type {
  PulledCategory,
  PulledItem,
  PulledModifierGroup,
  PulledModifier,
} from "../common/menu-types"

/**
 * Fetch and parse the menu for a Deliveroo brand/site.
 *
 * Strategy:
 * 1. Try V1: GET /v1/brands/{brandId}/menus -> pick first menu -> GET /v1/brands/{brandId}/menus/{menuId}
 * 2. Fallback V2: GET /v2/brands/{brandId}/sites/{siteId}/menu
 */
export async function pullMenu(
  credentials: DeliverooCredentials,
  brandId: string,
  siteId?: string
): Promise<{ categories: PulledCategory[]; rawMenu: unknown }> {
  // Try V1 first
  try {
    const rawMenu = await fetchMenuV1(credentials, brandId)
    if (rawMenu) {
      const categories = parseMenuResponse(rawMenu)
      return { categories, rawMenu }
    }
  } catch (error) {
    console.warn("Deliveroo V1 menu fetch failed, trying V2:", error)
  }

  // Fallback to V2 (requires siteId)
  if (!siteId) {
    throw new Error(
      "V1 menu fetch failed and no siteId provided for V2 fallback"
    )
  }

  const rawMenu = await fetchMenuV2(credentials, brandId, siteId)
  const categories = parseMenuResponse(rawMenu)
  return { categories, rawMenu }
}

/**
 * V1: List menus then fetch the first one
 */
async function fetchMenuV1(
  credentials: DeliverooCredentials,
  brandId: string
): Promise<DeliverooMenuResponse | null> {
  const safeBrandId = validatePathParam(brandId, "brandId")

  // List available menus
  const listResponse = await fetchDeliveroo(
    credentials,
    `/v1/brands/${safeBrandId}/menus`,
    {},
    "menu"
  )

  if (!listResponse.ok) {
    const errorText = await listResponse.text()
    throw new IntegrationError(
      `Failed to list Deliveroo menus for brand ${brandId}`,
      listResponse.status,
      "deliveroo",
      errorText
    )
  }

  const listData = (await listResponse.json()) as DeliverooMenuListResponse
  if (!listData.menus || listData.menus.length === 0) {
    return null
  }

  // Fetch the first menu
  const menuId = listData.menus[0]!.id
  const safeMenuId = validatePathParam(menuId, "menuId")
  const menuResponse = await fetchDeliveroo(
    credentials,
    `/v1/brands/${safeBrandId}/menus/${safeMenuId}`,
    {},
    "menu"
  )

  if (!menuResponse.ok) {
    const errorText = await menuResponse.text()
    throw new IntegrationError(
      `Failed to fetch Deliveroo menu ${menuId}`,
      menuResponse.status,
      "deliveroo",
      errorText
    )
  }

  return (await menuResponse.json()) as DeliverooMenuResponse
}

/**
 * V2: Fetch menu directly by brand + site
 */
async function fetchMenuV2(
  credentials: DeliverooCredentials,
  brandId: string,
  siteId: string
): Promise<DeliverooMenuResponse> {
  const safeBrandId = validatePathParam(brandId, "brandId")
  const safeSiteId = validatePathParam(siteId, "siteId")

  const response = await fetchDeliveroo(
    credentials,
    `/v2/brands/${safeBrandId}/sites/${safeSiteId}/menu`,
    {},
    "menu"
  )

  if (!response.ok) {
    const errorText = await response.text()
    throw new IntegrationError(
      `Failed to fetch Deliveroo V2 menu for brand ${brandId}, site ${siteId}`,
      response.status,
      "deliveroo",
      errorText
    )
  }

  return (await response.json()) as DeliverooMenuResponse
}

/**
 * Parse the Deliveroo menu response into the unified PulledCategory[] format
 */
function parseMenuResponse(menu: DeliverooMenuResponse): PulledCategory[] {
  const categories: PulledCategory[] = []

  if (!menu.categories || !menu.items) {
    return categories
  }

  // Build items map for fast lookup
  const itemsMap = new Map<string, DeliverooMenuItem>()
  for (const item of menu.items) {
    itemsMap.set(item.id, item)
  }

  // Build modifier groups map
  const modGroupsMap = new Map<string, DeliverooModifierGroup>()
  if (menu.modifier_groups) {
    for (const group of menu.modifier_groups) {
      modGroupsMap.set(group.id, group)
    }
  }

  for (const cat of menu.categories) {
    const items: PulledItem[] = []

    if (cat.item_ids) {
      for (const itemId of cat.item_ids) {
        const item = itemsMap.get(itemId)
        if (!item) continue

        const modifierGroups: PulledModifierGroup[] = []
        if (item.modifier_group_ids) {
          for (const mgId of item.modifier_group_ids) {
            const mg = modGroupsMap.get(mgId)
            if (!mg) continue

            const modifiers: PulledModifier[] = mg.modifiers.map((mod) => ({
              externalId: mod.id,
              name: mod.name,
              price: mod.price?.fractional ?? 0,
            }))

            modifierGroups.push({
              externalId: mg.id,
              name: mg.name,
              modifiers,
            })
          }
        }

        items.push({
          externalId: item.id,
          name: item.name,
          description: item.description,
          imageUrl: item.image_url,
          price: item.price?.fractional ?? 0,
          modifierGroups,
        })
      }
    }

    categories.push({
      externalId: cat.id,
      name: cat.name,
      items,
    })
  }

  return categories
}
