/**
 * Deliveroo menu sync utilities
 *
 * Contains the menu payload builder that converts internal products/categories
 * to the Deliveroo API format. The actual Convex action handlers live in the
 * app-level wrapper (apps/restaurant-theme/convex/deliverooMenuSync.ts) because
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

// === Deliveroo Menu Payload type (mirrored from @beindigital-engine/integrations) ===

export interface DeliverooMenuPayload {
  categories: Array<{
    id: string
    name: string
    items: Array<{
      id: string
      name: string
      description?: string
      price: number
      image_url?: string
      modifier_groups?: Array<{
        id: string
        name: string
        min_selection?: number
        max_selection?: number
        modifiers: Array<{
          id: string
          name: string
          price: number
        }>
      }>
    }>
  }>
}

// === Helpers ===

import type { ProductRecord, CategoryRecord } from "./uberEatsMenuSync";

/**
 * Convert internal products + categories to Deliveroo menu payload format.
 *
 * - Only includes active categories and active products
 * - Skips categories with no active products
 * - Maps product options to Deliveroo modifier groups
 * - Prices are passed through as-is (DB and Deliveroo API both use cents)
 * - Uses externalIds when available for modifier group/choice IDs
 */
export function buildDeliverooMenuPayload(
  products: ProductRecord[],
  categories: CategoryRecord[]
): DeliverooMenuPayload {
  // Filter only active categories and products
  const activeCategories = categories.filter((c) => c.isActive);
  const activeProducts = products.filter((p) => p.isActive);

  // Build category ID to products map
  const categoryProductsMap = new Map<string, ProductRecord[]>();
  for (const product of activeProducts) {
    const existing = categoryProductsMap.get(product.categoryId) ?? [];
    existing.push(product);
    categoryProductsMap.set(product.categoryId, existing);
  }

  // Build Deliveroo categories (only those with active products)
  const deliverooCategories: DeliverooMenuPayload["categories"] = [];

  for (const category of activeCategories) {
    const catProducts = categoryProductsMap.get(category._id) ?? [];
    if (catProducts.length === 0) continue;

    const categoryItems = catProducts.map((product) => {
      const item: DeliverooMenuPayload["categories"][number]["items"][number] = {
        id: product.externalIds?.deliverooId ?? `item-${product._id}`,
        name: product.name,
        price: product.price, // Already in cents
      };

      if (product.description) {
        item.description = product.description;
      }

      if (product.images.length > 0) {
        item.image_url = product.images[0];
      }

      // Build modifier groups from product options
      if (product.options && product.options.length > 0) {
        item.modifier_groups = product.options.map((option) => {
          const modifierGroup = {
            id: option.externalIds?.deliverooId ?? `mg-${product._id}-${option.id}`,
            name: option.name,
            min_selection: option.required ? 1 : 0,
            max_selection: option.maxSelections ?? option.choices.length,
            modifiers: option.choices.map((choice) => ({
              id: choice.externalIds?.deliverooId ?? `mod-${product._id}-${option.id}-${choice.id}`,
              name: choice.name,
              price: choice.priceModifier,
            })),
          };
          return modifierGroup;
        });
      }

      return item;
    });

    deliverooCategories.push({
      id: `cat-${category._id}`,
      name: category.name,
      items: categoryItems,
    });
  }

  return {
    categories: deliverooCategories,
  };
}
