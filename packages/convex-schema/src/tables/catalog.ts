import { defineTable } from "convex/server"
import { v } from "convex/values"

// ── Translation validators ──────────────────────────────────────────────

/**
 * Translation entry for products and categories (name + description)
 */
const translationEntryValidator = v.object({
  name: v.optional(v.string()),
  description: v.optional(v.string()),
  _meta: v.optional(v.object({
    nameHash: v.optional(v.string()),
    nameAuto: v.optional(v.boolean()),
    descHash: v.optional(v.string()),
    descAuto: v.optional(v.boolean()),
  })),
})

/**
 * Translation entry for menus (name + description + section labels by sectionId)
 */
const menuTranslationEntryValidator = v.object({
  name: v.optional(v.string()),
  description: v.optional(v.string()),
  sections: v.optional(v.record(v.string(), v.object({
    label: v.optional(v.string()),
    labelHash: v.optional(v.string()),
    labelAuto: v.optional(v.boolean()),
  }))),
  _meta: v.optional(v.object({
    nameHash: v.optional(v.string()),
    nameAuto: v.optional(v.boolean()),
    descHash: v.optional(v.string()),
    descAuto: v.optional(v.boolean()),
  })),
})

// ── Tables ──────────────────────────────────────────────────────────────

/**
 * Categories table
 * Hierarchical product categories
 */
export const categoriesTable = defineTable({
  storeId: v.id("stores"),
  name: v.string(),
  slug: v.string(),
  description: v.optional(v.string()),
  imageUrl: v.optional(v.string()),
  sortOrder: v.number(),
  isActive: v.boolean(),
  parentId: v.optional(v.id("categories")),
  // i18n
  translations: v.optional(v.record(v.string(), translationEntryValidator)),
  pendingTranslation: v.optional(v.boolean()),
  scheduledTranslationJobId: v.optional(v.id("_scheduled_functions")),
  createdAt: v.number(),
  updatedAt: v.number(),
})
  .index("by_storeId", ["storeId"])
  .index("by_storeId_sortOrder", ["storeId", "sortOrder"])
  .index("by_storeId_slug", ["storeId", "slug"])

/**
 * Products table
 * Core product catalog with options, allergens, scheduling,
 * and full platform integration support (Uber Eats, Deliveroo)
 */
export const productsTable = defineTable({
  storeId: v.id("stores"),
  categoryId: v.id("categories"),
  // Reference to another product (e.g. platform-imported variant linked to the canonical product)
  linkedProductId: v.optional(v.id("products")),
  name: v.string(),
  slug: v.string(),
  description: v.optional(v.string()),
  price: v.number(), // in cents
  compareAtPrice: v.optional(v.number()),
  taxRate: v.number(), // tax rate in % (e.g. 10 for 10%)
  preparationTime: v.optional(v.number()), // in minutes
  sku: v.optional(v.string()), // product code / PLU
  images: v.array(v.string()), // S3 URLs
  options: v.array(v.object({
    id: v.string(),
    name: v.string(),
    required: v.boolean(),
    maxSelections: v.optional(v.number()),
    externalIds: v.optional(v.object({
      uberEatsId: v.optional(v.string()),
      deliverooId: v.optional(v.string()),
    })),
    choices: v.array(v.object({
      id: v.string(),
      name: v.string(),
      priceModifier: v.number(), // in cents, can be negative
      externalIds: v.optional(v.object({
        uberEatsId: v.optional(v.string()),
        deliverooId: v.optional(v.string()),
      })),
    })),
  })),
  allergens: v.array(v.string()),
  nutritionalInfo: v.optional(v.object({
    calories: v.optional(v.number()),
    protein: v.optional(v.number()),
    carbs: v.optional(v.number()),
    fat: v.optional(v.number()),
    fiber: v.optional(v.number()),
  })),
  tags: v.array(v.string()),
  stock: v.optional(v.object({
    tracked: v.boolean(),
    quantity: v.number(),
    lowStockThreshold: v.number(),
    autoDisableWhenEmpty: v.optional(v.boolean()),
  })),
  scheduling: v.optional(v.object({
    availableFrom: v.optional(v.string()), // "11:00"
    availableUntil: v.optional(v.string()), // "14:00"
    availableDays: v.optional(v.array(v.number())), // [1,2,3,4,5]
  })),
  spiceLevel: v.optional(v.number()), // 0-5
  isActive: v.boolean(),
  isFeatured: v.boolean(),
  sortOrder: v.number(),
  // Product source: created manually or imported from a platform
  source: v.string(), // "manual" | "uber_eats" | "deliveroo"
  // External IDs to link with platforms
  externalIds: v.optional(v.object({
    uberEatsId: v.optional(v.string()),
    deliverooId: v.optional(v.string()),
  })),
  // Per-platform price and status overrides
  platformOverrides: v.optional(v.object({
    uberEats: v.optional(v.object({
      price: v.optional(v.number()), // price in cents if different
      isActive: v.optional(v.boolean()), // suspended on Uber Eats?
      lastSyncedAt: v.optional(v.number()), // last sync timestamp
      syncError: v.optional(v.string()), // sync error message
    })),
    deliveroo: v.optional(v.object({
      price: v.optional(v.number()),
      isActive: v.optional(v.boolean()),
      lastSyncedAt: v.optional(v.number()),
      syncError: v.optional(v.string()),
    })),
  })),
  // i18n
  translations: v.optional(v.record(v.string(), translationEntryValidator)),
  pendingTranslation: v.optional(v.boolean()),
  scheduledTranslationJobId: v.optional(v.id("_scheduled_functions")),
  createdAt: v.number(),
  updatedAt: v.number(),
})
  .index("by_storeId", ["storeId"])
  .index("by_storeId_categoryId", ["storeId", "categoryId"])
  .index("by_storeId_isActive", ["storeId", "isActive"])
  .index("by_storeId_isFeatured", ["storeId", "isFeatured"])
  .index("by_storeId_slug", ["storeId", "slug"])
  .index("by_storeId_source", ["storeId", "source"])
  .index("by_linkedProductId", ["linkedProductId"])

/**
 * Menu section validator (combo line items)
 *
 * Each section represents a line in the combo/formule:
 * - "fixed": a single mandatory product (e.g. "Big Wrap")
 * - "pick_products": customer picks from a list of products (e.g. "Choose a drink")
 * - "pick_category": customer picks from all active products in a category (e.g. "Any burger")
 */
export const menuSectionValidator = v.object({
  sectionId: v.string(), // nanoid, unique per menu
  label: v.string(),
  type: v.union(
    v.literal("fixed"),
    v.literal("pick_products"),
    v.literal("pick_category")
  ),
  required: v.boolean(),
  minChoices: v.number(),
  maxChoices: v.number(),
  allowDuplicates: v.boolean(),
  sortOrder: v.number(),
  // "fixed" → single product
  productId: v.optional(v.id("products")),
  // "pick_products" → list of products to choose from
  productIds: v.optional(v.array(v.id("products"))),
  // "pick_category" → all active products in this category
  categoryId: v.optional(v.id("categories")),
  // Future: per-product price adjustments (hidden at MVP)
  priceAdjustments: v.optional(
    v.array(v.object({
      productId: v.id("products"),
      adjustment: v.number(), // in cents
    }))
  ),
})

/**
 * Menus table (combos/formules)
 * Meal deals and combo offers with configurable sections
 */
export const menusTable = defineTable({
  storeId: v.id("stores"),
  name: v.string(),
  description: v.optional(v.string()),
  price: v.number(), // in cents, fixed price for the whole menu
  imageUrl: v.optional(v.string()),
  sections: v.array(menuSectionValidator),
  platformVisibility: v.optional(v.object({
    uberEats: v.optional(v.boolean()),
    deliveroo: v.optional(v.boolean()),
  })),
  isActive: v.boolean(),
  sortOrder: v.number(),
  // i18n
  translations: v.optional(v.record(v.string(), menuTranslationEntryValidator)),
  pendingTranslation: v.optional(v.boolean()),
  scheduledTranslationJobId: v.optional(v.id("_scheduled_functions")),
  createdAt: v.number(),
  updatedAt: v.number(),
})
  .index("by_storeId", ["storeId"])
  .index("by_storeId_isActive", ["storeId", "isActive"])
