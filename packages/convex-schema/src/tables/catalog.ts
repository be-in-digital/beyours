import { defineTable } from "convex/server"
import { v } from "convex/values"

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
 * Menus table (combos/formules)
 * Meal deals and combo offers with a fixed list of included products
 */
export const menusTable = defineTable({
  storeId: v.id("stores"),
  name: v.string(),
  description: v.optional(v.string()),
  price: v.number(), // in cents, fixed price
  imageUrl: v.optional(v.string()),
  productIds: v.array(v.id("products")), // flat list of included products
  platformVisibility: v.optional(v.object({
    uberEats: v.optional(v.boolean()),
    deliveroo: v.optional(v.boolean()),
  })),
  isActive: v.boolean(),
  sortOrder: v.number(),
  createdAt: v.number(),
  updatedAt: v.number(),
})
  .index("by_storeId", ["storeId"])
  .index("by_storeId_isActive", ["storeId", "isActive"])
