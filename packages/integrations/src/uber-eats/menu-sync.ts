/**
 * Uber Eats menu synchronization
 * Pull: fetch menu from Uber Eats → match with internal products
 * Push: send internal catalog to Uber Eats
 */

import type { UberEatsCredentials } from "./types"
import { fetchUberEats, validatePathParam } from "./client"
import { IntegrationError } from "../common/errors"
import type {
  PulledCategory,
  PulledItem,
  PulledModifierGroup,
  PulledModifier,
} from "../common/menu-types"

// Re-export shared types for backwards compatibility
export type { PulledCategory, PulledItem, PulledModifierGroup, PulledModifier }

/**
 * Fetch the current menu for a store from Uber Eats
 */
export async function pullMenu(
  credentials: UberEatsCredentials,
  storeId: string
): Promise<{ categories: PulledCategory[]; rawMenu: unknown }> {
  const safeStoreId = validatePathParam(storeId, "storeId")
  const response = await fetchUberEats(
    credentials,
    `/v2/eats/stores/${safeStoreId}/menus`
  )

  if (!response.ok) {
    const errorText = await response.text()
    throw new IntegrationError(
      `Failed to fetch menu for store ${storeId}`,
      response.status,
      "uberEats",
      errorText
    )
  }

  const rawMenu = await response.json()
  const categories = parseMenuResponse(rawMenu)

  return { categories, rawMenu }
}

/**
 * Push the internal catalog to Uber Eats
 */
export async function pushMenu(
  credentials: UberEatsCredentials,
  storeId: string,
  menuPayload: UberEatsMenuPayload
): Promise<void> {
  const safeStoreId = validatePathParam(storeId, "storeId")
  const response = await fetchUberEats(
    credentials,
    `/v2/eats/stores/${safeStoreId}/menus`,
    {
      method: "PUT",
      body: menuPayload,
    }
  )

  if (!response.ok) {
    const errorText = await response.text()
    throw new IntegrationError(
      `Failed to push menu to store ${storeId}`,
      response.status,
      "uberEats",
      errorText
    )
  }
}

export interface UberEatsMenuPayload {
  menus: Array<{
    id: string
    title: { translations: Record<string, string> }
    service_availability: Array<{
      day_of_week: string
      time_periods: Array<{ start_time: string; end_time: string }>
    }>
    category_ids: string[]
  }>
  categories: Array<{
    id: string
    title: { translations: Record<string, string> }
    entities: Array<{ id: string; type: "ITEM" }>
  }>
  items: Array<{
    id: string
    external_data?: string
    title: { translations: Record<string, string> }
    description?: { translations: Record<string, string> }
    image_url?: string
    price_info: { price: number; overrides?: Array<{ context_type: string; context_value: string; price: number }> }
    tax_info?: { tax_rate: number }
    modifier_group_ids?: { ids: string[] }
    quantity_info?: { quantity: { max_permitted: number; min_permitted: number } }
  }>
  modifier_groups?: Array<{
    id: string
    title: { translations: Record<string, string> }
    quantity_info: { quantity: { max_permitted: number; min_permitted: number } }
    modifier_options: Array<{ id: string; type: "ITEM" }>
  }>
  display_options?: {
    disable_item_instructions?: boolean
  }
}

// === Helpers ===

/**
 * Parse the raw Uber Eats menu response into a structured format
 */
function parseMenuResponse(rawMenu: unknown): PulledCategory[] {
  const menu = rawMenu as Record<string, unknown>
  const categories: PulledCategory[] = []

  // The menu response structure varies; handle the common format
  const menuData = menu as {
    menus?: Array<{ category_ids?: string[] }>
    categories?: Array<{ id: string; title?: { translations?: Record<string, string> }; entities?: Array<{ id: string }> }>
    items?: Array<{
      id: string
      title?: { translations?: Record<string, string> }
      description?: { translations?: Record<string, string> }
      image_url?: string
      price_info?: { price?: number }
      modifier_group_ids?: { ids?: string[] }
    }>
    modifier_groups?: Array<{
      id: string
      title?: { translations?: Record<string, string> }
      modifier_options?: Array<{ id: string }>
    }>
  }

  if (!menuData.categories || !menuData.items) {
    return categories
  }

  const itemsMap = new Map<string, (typeof menuData.items)[number]>()
  for (const item of menuData.items) {
    itemsMap.set(item.id, item)
  }

  type ModGroupType = NonNullable<typeof menuData.modifier_groups>[number]
  const modGroupsMap = new Map<string, ModGroupType>()
  if (menuData.modifier_groups) {
    for (const group of menuData.modifier_groups) {
      modGroupsMap.set(group.id, group)
    }
  }

  for (const cat of menuData.categories) {
    const catName = cat.title?.translations?.["en"] ?? cat.title?.translations?.[Object.keys(cat.title?.translations ?? {})[0] ?? ""] ?? cat.id

    const items: PulledItem[] = []
    if (cat.entities) {
      for (const entity of cat.entities) {
        const item = itemsMap.get(entity.id)
        if (!item) continue

        const itemName = item.title?.translations?.["en"] ?? item.title?.translations?.[Object.keys(item.title?.translations ?? {})[0] ?? ""] ?? item.id
        const itemDesc = item.description?.translations?.["en"] ?? item.description?.translations?.[Object.keys(item.description?.translations ?? {})[0] ?? ""]

        const modifierGroups: PulledModifierGroup[] = []
        if (item.modifier_group_ids?.ids) {
          for (const mgId of item.modifier_group_ids.ids) {
            const mg = modGroupsMap.get(mgId)
            if (!mg) continue
            const mgName = mg.title?.translations?.["en"] ?? mg.title?.translations?.[Object.keys(mg.title?.translations ?? {})[0] ?? ""] ?? mg.id

            const modifiers: PulledModifier[] = []
            if (mg.modifier_options) {
              for (const mo of mg.modifier_options) {
                const modItem = itemsMap.get(mo.id)
                if (modItem) {
                  modifiers.push({
                    externalId: modItem.id,
                    name: modItem.title?.translations?.["en"] ?? modItem.id,
                    price: modItem.price_info?.price ?? 0,
                  })
                }
              }
            }
            modifierGroups.push({ externalId: mg.id, name: mgName, modifiers })
          }
        }

        items.push({
          externalId: item.id,
          name: itemName,
          description: itemDesc,
          imageUrl: item.image_url,
          price: item.price_info?.price ?? 0,
          modifierGroups,
        })
      }
    }

    categories.push({
      externalId: cat.id,
      name: catName,
      items,
    })
  }

  return categories
}
