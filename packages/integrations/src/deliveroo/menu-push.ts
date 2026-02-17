/**
 * Build and push Deliveroo menu payload with PLU mapping
 */

import type { DeliverooCredentials } from "./types"
import { fetchDeliveroo } from "./client"

// === Types ===

export interface DeliverooMenuCategory {
  id: string
  name: string
  description?: string
  items: DeliverooMenuItemPayload[]
}

export interface DeliverooMenuItemPayload {
  id: string
  name: string
  description?: string
  image_url?: string
  price: { fractional: number; currency_code: string }
  pos_item_id?: string
  modifier_groups?: DeliverooModifierGroupPayload[]
  tax_rate?: number
}

export interface DeliverooModifierGroupPayload {
  id: string
  name: string
  min_selection: number
  max_selection: number
  modifiers: DeliverooModifierPayload[]
}

export interface DeliverooModifierPayload {
  id: string
  name: string
  price: { fractional: number; currency_code: string }
  pos_item_id?: string
}

export interface DeliverooFullMenuPayload {
  categories: DeliverooMenuCategory[]
  currency_code: string
}

// Internal product/category types (mirrored from convex-functions)
export interface InternalProduct {
  _id: string
  categoryId: string
  name: string
  description?: string
  price: number // cents
  images: string[]
  isActive: boolean
  taxRate: number
  externalIds?: { deliverooId?: string; uberEatsId?: string }
  options?: Array<{
    id: string
    name: string
    required: boolean
    maxSelections?: number
    externalIds?: { deliverooId?: string }
    choices: Array<{
      id: string
      name: string
      priceModifier: number // cents
      externalIds?: { deliverooId?: string }
    }>
  }>
}

export interface InternalCategory {
  _id: string
  name: string
  description?: string
  isActive: boolean
  sortOrder: number
}

// === Build Payload ===

/**
 * Build Deliveroo menu payload from internal products and categories.
 *
 * - Only includes active categories and products
 * - Skips categories with no active products
 * - Uses externalIds.deliverooId as PLU/POS item ID when available
 * - Prices are passed through (DB stores cents, Deliveroo expects fractional cents)
 */
export function buildDeliverooMenuPayload(
  products: InternalProduct[],
  categories: InternalCategory[],
  currencyCode: string = "EUR"
): DeliverooFullMenuPayload {
  const activeCategories = categories.filter(c => c.isActive)
  const activeProducts = products.filter(p => p.isActive)

  // Group products by category
  const productsByCategory = new Map<string, InternalProduct[]>()
  for (const product of activeProducts) {
    const existing = productsByCategory.get(product.categoryId) ?? []
    existing.push(product)
    productsByCategory.set(product.categoryId, existing)
  }

  const menuCategories: DeliverooMenuCategory[] = []

  for (const category of activeCategories) {
    const catProducts = productsByCategory.get(category._id) ?? []
    if (catProducts.length === 0) continue

    const items: DeliverooMenuItemPayload[] = catProducts.map(product => {
      const item: DeliverooMenuItemPayload = {
        id: product.externalIds?.deliverooId ?? product._id,
        name: product.name,
        price: { fractional: product.price, currency_code: currencyCode },
      }

      if (product.description) item.description = product.description
      if (product.images.length > 0) item.image_url = product.images[0]
      if (product.externalIds?.deliverooId) item.pos_item_id = product.externalIds.deliverooId
      if (product.taxRate > 0) item.tax_rate = product.taxRate

      // Build modifier groups from options
      if (product.options && product.options.length > 0) {
        item.modifier_groups = product.options.map(option => ({
          id: option.externalIds?.deliverooId ?? `mg-${product._id}-${option.id}`,
          name: option.name,
          min_selection: option.required ? 1 : 0,
          max_selection: option.maxSelections ?? option.choices.length,
          modifiers: option.choices.map(choice => ({
            id: choice.externalIds?.deliverooId ?? `mod-${product._id}-${option.id}-${choice.id}`,
            name: choice.name,
            price: { fractional: choice.priceModifier, currency_code: currencyCode },
            ...(choice.externalIds?.deliverooId ? { pos_item_id: choice.externalIds.deliverooId } : {}),
          })),
        }))
      }

      return item
    })

    menuCategories.push({
      id: category._id,
      name: category.name,
      ...(category.description ? { description: category.description } : {}),
      items,
    })
  }

  return { categories: menuCategories, currency_code: currencyCode }
}

// === Push to API ===

/**
 * Push menu to Deliveroo for a specific brand/site.
 * Uses PUT /v2/brands/{brandId}/sites/{siteId}/menu
 */
export async function pushMenu(
  credentials: DeliverooCredentials,
  brandId: string,
  siteId: string,
  payload: DeliverooFullMenuPayload
): Promise<void> {
  const response = await fetchDeliveroo(
    credentials,
    `/v2/brands/${brandId}/sites/${siteId}/menu`,
    { method: "PUT", body: payload },
    "menu"
  )
  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Failed to push menu to Deliveroo (${response.status}): ${errorText}`)
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
    `/v1/brands/${brandId}/sites/${siteId}/plu_mapping`,
    { method: "PUT", body: { mappings } },
    "menu"
  )
  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Failed to set PLU mappings (${response.status}): ${errorText}`)
  }
}
