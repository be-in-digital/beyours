/**
 * Uber Eats menu sync utilities
 *
 * Contains the menu payload builder that converts internal products/categories
 * to the Uber Eats API format. The actual Convex action handlers live in the
 * app-level wrapper (apps/restaurant-theme/convex/uberEatsMenuSync.ts) because
 * they need access to the generated `api` object for ctx.runQuery/runMutation.
 */

// === Uber Eats Menu Payload type (mirrored from @beindigital-engine/integrations) ===

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
    price_info: {
      price: number
      overrides?: Array<{ context_type: string; context_value: string; price: number }>
    }
    tax_info?: { tax_rate: number }
    modifier_group_ids?: { ids: string[] }
    quantity_info?: { quantity: { max_permitted: number; min_permitted: number } }
  }>
  modifier_groups: Array<{
    id: string
    title: { translations: Record<string, string> }
    quantity_info: { quantity: { max_permitted: number; min_permitted: number } }
    modifier_options: Array<{ id: string; type: "ITEM" }>
  }>
  display_options?: {
    disable_item_instructions?: boolean
  }
}

// === Types for internal DB records ===

export interface StoreIntegrationRecord {
  _id: string
  storeId: string
  platform: "uberEats" | "deliveroo"
  platformStoreId: string
  brandId?: string
  syncMenu: boolean
  autoAccept: boolean
  enabled: boolean
  storeStatus?: "ONLINE" | "PAUSED" | "OFFLINE"
  prepTime?: number
  lastMenuSyncAt?: number
  menuSyncStatus?: "idle" | "syncing" | "success" | "error"
  menuSyncError?: string
  lastSyncAt?: number
  createdAt: number
  updatedAt: number
}

export interface ProductRecord {
  _id: string
  storeId: string
  categoryId: string
  name: string
  slug: string
  description?: string
  price: number
  compareAtPrice?: number
  taxRate: number
  preparationTime?: number
  sku?: string
  images: string[]
  options?: ProductOptionRecord[]
  allergens?: string[]
  nutritionalInfo?: {
    calories?: number
    protein?: number
    carbs?: number
    fat?: number
    fiber?: number
  }
  tags?: string[]
  stock?: {
    tracked: boolean
    quantity: number
    lowStockThreshold: number
  }
  scheduling?: {
    availableFrom?: string
    availableUntil?: string
    availableDays?: number[]
  }
  spiceLevel?: number
  isActive: boolean
  isFeatured: boolean
  sortOrder: number
  source?: string
  externalIds?: {
    uberEatsId?: string
    deliverooId?: string
  }
  createdAt: number
  updatedAt: number
}

export interface ProductOptionRecord {
  id: string
  name: string
  required: boolean
  maxSelections?: number
  externalIds?: {
    uberEatsId?: string
    deliverooId?: string
  }
  choices: ProductChoiceRecord[]
}

export interface ProductChoiceRecord {
  id: string
  name: string
  priceModifier: number
  externalIds?: {
    uberEatsId?: string
    deliverooId?: string
  }
}

export interface CategoryRecord {
  _id: string
  storeId: string
  name: string
  slug: string
  description?: string
  imageUrl?: string
  sortOrder: number
  isActive: boolean
  createdAt: number
  updatedAt: number
}

// === Days of the week for service availability ===

const ALL_DAYS = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
] as const

// === Helpers ===

/**
 * Convert internal products + categories to Uber Eats menu payload format.
 *
 * - Only includes active categories and active products
 * - Skips categories with no active products
 * - Maps product options to Uber Eats modifier groups
 * - Prices are passed through as-is (DB and Uber Eats API both use cents)
 * - Uses externalIds when available for modifier group/choice IDs
 */
export function buildUberEatsMenuPayload(
  products: ProductRecord[],
  categories: CategoryRecord[]
): UberEatsMenuPayload {
  // Filter only active categories and products
  const activeCategories = categories.filter((c) => c.isActive)
  const activeProducts = products.filter((p) => p.isActive)

  // Build category ID to products map
  const categoryProductsMap = new Map<string, ProductRecord[]>()
  for (const product of activeProducts) {
    const existing = categoryProductsMap.get(product.categoryId) ?? []
    existing.push(product)
    categoryProductsMap.set(product.categoryId, existing)
  }

  // Build Uber Eats categories (only those with active products)
  const uberCategories: UberEatsMenuPayload["categories"] = []
  const categoryIds: string[] = []

  for (const category of activeCategories) {
    const catProducts = categoryProductsMap.get(category._id) ?? []
    if (catProducts.length === 0) continue

    const categoryId = `cat-${category._id}`
    categoryIds.push(categoryId)

    uberCategories.push({
      id: categoryId,
      title: { translations: { en: category.name } },
      entities: catProducts.map((p) => ({
        id: `item-${p._id}`,
        type: "ITEM" as const,
      })),
    })
  }

  // Build Uber Eats items and modifier groups
  const uberItems: UberEatsMenuPayload["items"] = []
  const uberModifierGroups: NonNullable<UberEatsMenuPayload["modifier_groups"]> = []

  for (const product of activeProducts) {
    const itemId = `item-${product._id}`
    const modifierGroupIds: string[] = []

    // Build modifier groups from product options
    if (product.options && product.options.length > 0) {
      for (const option of product.options) {
        const mgId = option.externalIds?.uberEatsId ?? `mg-${product._id}-${option.id}`
        modifierGroupIds.push(mgId)

        // Build modifier options (choices represented as items in Uber Eats)
        const modifierItems: Array<{ id: string; type: "ITEM" }> = []
        for (const choice of option.choices) {
          const modItemId = choice.externalIds?.uberEatsId ?? `mod-${product._id}-${option.id}-${choice.id}`
          modifierItems.push({ id: modItemId, type: "ITEM" as const })

          // Uber Eats requires modifiers to also be listed as items
          uberItems.push({
            id: modItemId,
            external_data: choice.id,
            title: { translations: { en: choice.name } },
            price_info: {
              price: choice.priceModifier,
            },
            quantity_info: {
              quantity: { max_permitted: 1, min_permitted: 1 },
            },
          })
        }

        uberModifierGroups.push({
          id: mgId,
          title: { translations: { en: option.name } },
          quantity_info: {
            quantity: {
              max_permitted: option.maxSelections ?? option.choices.length,
              min_permitted: option.required ? 1 : 0,
            },
          },
          modifier_options: modifierItems,
        })
      }
    }

    // Build the main item
    const item: UberEatsMenuPayload["items"][number] = {
      id: itemId,
      external_data: product._id,
      title: { translations: { en: product.name } },
      price_info: {
        // DB stores prices in cents, Uber Eats API expects cents
        price: product.price,
      },
    }

    if (product.description) {
      item.description = { translations: { en: product.description } }
    }

    if (product.images.length > 0) {
      item.image_url = product.images[0]
    }

    if (product.taxRate > 0) {
      item.tax_info = { tax_rate: product.taxRate }
    }

    if (modifierGroupIds.length > 0) {
      item.modifier_group_ids = { ids: modifierGroupIds }
    }

    uberItems.push(item)
  }

  // Build the main menu with full-day availability
  const serviceAvailability = ALL_DAYS.map((day) => ({
    day_of_week: day,
    time_periods: [{ start_time: "00:00", end_time: "23:59" }],
  }))

  return {
    menus: [
      {
        id: "main-menu",
        title: { translations: { en: "Main Menu" } },
        service_availability: serviceAvailability,
        category_ids: categoryIds,
      },
    ],
    categories: uberCategories,
    items: uberItems,
    modifier_groups: uberModifierGroups,
  }
}
