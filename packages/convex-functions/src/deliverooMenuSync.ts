/**
 * Deliveroo menu sync utilities
 *
 * Contains the menu payload builder that converts internal products/categories
 * to the Deliveroo V1 API format. The actual Convex action handlers live in the
 * app-level wrapper (apps/reference/convex/deliverooMenuSync.ts) because
 * they need access to the generated `api` object for ctx.runQuery/runMutation.
 */

// Re-export types from uberEatsMenuSync since they're shared
export type {
  StoreIntegrationRecord,
  ProductRecord,
  CategoryRecord,
  ProductOptionRecord,
  ProductChoiceRecord,
} from "./uberEatsMenuSync";

import type { ProductRecord, CategoryRecord } from "./uberEatsMenuSync";

// === V1 Menu Payload Types (matches Deliveroo Partner API V1) ===

interface LocalizedString {
  en: string
  fr?: string
}

interface V1Mealtime {
  id: string
  name: LocalizedString
  image: { url: string }
  category_ids: string[]
  schedule: Array<{
    day_of_week: number
    time_periods: Array<{ start: string; end: string }>
  }>
}

interface V1Category {
  id: string
  name: LocalizedString
  description?: LocalizedString
  item_ids: string[]
}

interface V1Item {
  id: string
  name: LocalizedString
  description?: LocalizedString
  operational_name: string
  plu: string
  price_info: { price: number }
  type: "ITEM"
  tax_rate: string
  image?: { url: string }
  modifier_group_ids?: string[]
}

interface V1Modifier {
  id: string
  name: LocalizedString
  description?: LocalizedString
  operational_name: string
  plu: string
  price_info: { price: number }
  tax_rate: string
  type: "ITEM"
}

interface V1ModifierGroup {
  id: string
  name: LocalizedString
  operational_name: string
  min_selection: number
  max_selection: number
  modifier_ids: string[]
}

export interface DeliverooMenuV1Payload {
  name: string
  description?: string
  site_ids: string[]
  menu: {
    mealtimes: V1Mealtime[]
    categories: V1Category[]
    items: V1Item[]
    modifiers: V1Modifier[]
    modifier_groups: V1ModifierGroup[]
  }
}

// === Helpers ===

/**
 * Compute the platform price for a product, applying individual override or global markup.
 *
 * Priority:
 * 1. product.platformOverrides.deliveroo.price — individual product override (exact price in cents)
 * 2. priceMarkup > 0 — apply global percentage markup, rounded up to nearest cent
 * 3. product.price — no markup, pass through as-is
 *
 * Math.ceil ensures the restaurateur never loses money on rounding.
 */
function getPlatformPrice(
  product: { price: number; platformOverrides?: { deliveroo?: { price?: number } } },
  priceMarkup: number
): number {
  if (product.platformOverrides?.deliveroo?.price != null) {
    return product.platformOverrides.deliveroo.price;
  }
  if (priceMarkup > 0) {
    return Math.ceil(product.price * (1 + priceMarkup / 100));
  }
  return product.price;
}

/**
 * Create a localized string object from a plain string.
 * Uses the same value for en and fr since product names are already
 * in the restaurant's language.
 */
function localized(text: string): LocalizedString {
  return { en: text, fr: text }
}

/**
 * Truncate string to max length for operational_name field.
 */
function operationalName(text: string, maxLen = 50): string {
  return text.substring(0, maxLen)
}

/**
 * Build a 7-day, all-day schedule (00:00–23:59 every day).
 */
function allDaySchedule() {
  return Array.from({ length: 7 }, (_, i) => ({
    day_of_week: i,
    time_periods: [{ start: "00:00", end: "23:59" }],
  }))
}

// === Build Payload ===

/**
 * Convert internal products + categories to Deliveroo V1 menu payload.
 *
 * Produces the flat-array format expected by PUT /v1/brands/{brandId}/menus/{menuId}:
 * - mealtimes with schedule, image cover photo (all-day by default)
 * - categories with item_ids references
 * - items with price_info, tax_rate, modifier_group_ids
 * - modifiers (individual modifier items)
 * - modifier_groups with modifier_ids references
 *
 * Prices are in cents; markup is applied via getPlatformPrice().
 */
export function buildDeliverooMenuPayload(
  products: ProductRecord[],
  categories: CategoryRecord[],
  siteId: string,
  priceMarkup: number = 0
): DeliverooMenuV1Payload {
  const activeCategories = categories.filter((c) => c.isActive);
  const activeProducts = products.filter((p) => p.isActive);

  // Group products by category
  const categoryProductsMap = new Map<string, ProductRecord[]>();
  for (const product of activeProducts) {
    const existing = categoryProductsMap.get(product.categoryId) ?? [];
    existing.push(product);
    categoryProductsMap.set(product.categoryId, existing);
  }

  // Collect all items, modifiers, and modifier groups in flat arrays
  const v1Categories: V1Category[] = [];
  const v1Items: V1Item[] = [];
  const v1Modifiers: V1Modifier[] = [];
  const v1ModifierGroups: V1ModifierGroup[] = [];

  for (const category of activeCategories) {
    const catProducts = categoryProductsMap.get(category._id) ?? [];
    if (catProducts.length === 0) continue;

    const itemIds: string[] = [];

    for (const product of catProducts) {
      const itemId = product.externalIds?.deliverooId ?? product._id;
      itemIds.push(itemId);

      const item: V1Item = {
        id: itemId,
        name: localized(product.name),
        operational_name: operationalName(product.name),
        plu: product.externalIds?.deliverooId ?? product._id,
        // getPlatformPrice applies individual override or global markup (always rounds up)
        price_info: { price: getPlatformPrice(product, priceMarkup) },
        type: "ITEM",
        tax_rate: (product.taxRate ?? 10).toString(),
      };

      if (product.description) {
        item.description = localized(product.description);
      }

      if (product.images.length > 0 && product.images[0]) {
        item.image = { url: product.images[0] };
      }

      // Build modifier groups and modifiers from product options
      if (product.options && product.options.length > 0) {
        const modGroupIds: string[] = [];

        for (const option of product.options) {
          const mgId = option.externalIds?.deliverooId ?? `mg-${product._id}-${option.id}`;
          modGroupIds.push(mgId);

          const modIds: string[] = [];

          for (const choice of option.choices) {
            const modId = choice.externalIds?.deliverooId ?? `mod-${product._id}-${option.id}-${choice.id}`;
            modIds.push(modId);

            v1Modifiers.push({
              id: modId,
              name: localized(choice.name),
              description: localized(""),
              operational_name: operationalName(choice.name),
              plu: modId,
              price_info: { price: Math.round(choice.priceModifier) },
              tax_rate: (product.taxRate ?? 10).toString(),
              type: "ITEM",
            });
          }

          v1ModifierGroups.push({
            id: mgId,
            name: localized(option.name),
            operational_name: operationalName(option.name),
            min_selection: option.required ? 1 : 0,
            max_selection: option.maxSelections ?? option.choices.length,
            modifier_ids: modIds,
          });
        }

        item.modifier_group_ids = modGroupIds;
      }

      v1Items.push(item);
    }

    v1Categories.push({
      id: category._id,
      name: localized(category.name),
      description: category.description ? localized(category.description) : localized(""),
      item_ids: itemIds,
    });
  }

  // Pick a cover image from the first product that has one
  const coverImage = activeProducts.find((p) => p.images.length > 0)?.images[0]
    ?? "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=800&q=80"

  // Single mealtime covering all categories and all days
  const mealtime: V1Mealtime = {
    id: "MT_ALL_DAY",
    name: localized("Menu"),
    image: { url: coverImage },
    category_ids: v1Categories.map((c) => c.id),
    schedule: allDaySchedule(),
  };

  return {
    name: "Menu Sync",
    description: `Synced on ${new Date().toISOString()}`,
    site_ids: [siteId],
    menu: {
      mealtimes: [mealtime],
      categories: v1Categories,
      items: v1Items,
      modifiers: v1Modifiers,
      modifier_groups: v1ModifierGroups,
    },
  };
}
